"""
Hatchet task: email-handle-inbound

Processes an inbound email asynchronously:
1. Load EmailChannelConfiguration and product
2. Build AgentMessage via EmailChannelConnector (with threading)
3. Run the agentic loop
4. Send response via EmailResponseAdapter
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class InboundEmailInput(BaseModel):
    config_id: str
    sender_email: str
    sender_name: str = ''
    subject: str = ''
    text_body: str
    message_id: str = ''
    in_reply_to: str = ''
    references: str = ''


@hatchet.task(
    name="email-handle-inbound",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=InboundEmailInput,
)
async def handle_inbound_email(workflow_input: InboundEmailInput, context: Context):
    from apps.integrations.email_channel.adapter import EmailResponseAdapter
    from apps.integrations.email_channel.connector import EmailChannelConnector
    from apps.integrations.email_channel.models import EmailChannelConfiguration
    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.channels import Channel
    from apps.products.services.agent_resolver import resolve_agent_config

    config_id = workflow_input.config_id

    try:
        config = await EmailChannelConfiguration.objects.select_related(
            'product', 'organization'
        ).aget(id=config_id, is_active=True)
    except EmailChannelConfiguration.DoesNotExist:
        logger.error("[EMAIL] No active config for id %s", config_id)
        return {'error': f'No active email config for {config_id}'}

    product = config.product
    connector = EmailChannelConnector(config)

    message = await connector.build_agent_message(
        sender_email=workflow_input.sender_email,
        sender_name=workflow_input.sender_name,
        subject=workflow_input.subject,
        text_body=workflow_input.text_body,
        message_id=workflow_input.message_id,
        in_reply_to=workflow_input.in_reply_to,
        references=workflow_input.references,
    )

    adapter = EmailResponseAdapter(
        config=config,
        reply_to_email=workflow_input.sender_email,
        original_subject=workflow_input.subject,
        original_message_id=workflow_input.message_id,
        in_reply_to=workflow_input.in_reply_to,
    )

    from apps.analytics.models import ChatConversation
    try:
        conv = await ChatConversation.objects.aget(id=message.conversation_id)
        adapter.set_conversation(conv)
    except ChatConversation.DoesNotExist:
        pass

    agent_config = await resolve_agent_config(
        product=product,
        channel=Channel.EMAIL,
        channel_context={"email_address": workflow_input.sender_email},
    )

    try:
        service = AgentAnswerServiceReActAsync(
            help_center_config=product,
            organization=config.organization,
            conversation_id=str(message.conversation_id),
            agent_config=agent_config,
        )

        async for event in service.ask_stream(
            agent_message=message,
        ):
            await adapter.on_event(event)

        await adapter.finalize()

    except Exception as e:
        logger.exception("[EMAIL] Error processing inbound email: %s", e)

    return {
        'config_id': config_id,
        'sender': workflow_input.sender_email,
        'status': 'completed',
    }
