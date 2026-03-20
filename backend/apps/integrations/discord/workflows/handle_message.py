"""
Hatchet task: discord-handle-message

Processes a Discord message event asynchronously:
1. Load DiscordInstallation and product
2. Build AgentMessage via DiscordChannelConnector
3. Run the agentic loop
4. Post response via DiscordResponseAdapter
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class DiscordMessageInput(BaseModel):
    guild_id: str
    channel_id: str
    author_id: str
    author_username: str
    content: str
    message_id: str
    thread_id: str = ''


@hatchet.task(
    name="discord-handle-message",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=DiscordMessageInput,
)
async def handle_discord_message(workflow_input: DiscordMessageInput, context: Context):
    from apps.integrations.discord.adapter import DiscordResponseAdapter
    from apps.integrations.discord.connector import DiscordChannelConnector
    from apps.integrations.discord.models import DiscordInstallation
    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.channels import Channel
    from apps.products.services.agent_resolver import resolve_agent_config

    guild_id = workflow_input.guild_id

    try:
        installation = await DiscordInstallation.objects.select_related(
            'product', 'organization'
        ).aget(guild_id=guild_id, is_active=True)
    except DiscordInstallation.DoesNotExist:
        logger.error("[DISCORD] No active installation for guild %s", guild_id)
        return {'error': f'No active installation for guild {guild_id}'}

    product = installation.product
    connector = DiscordChannelConnector(installation)

    message = await connector.build_agent_message(
        content=workflow_input.content,
        author_id=workflow_input.author_id,
        author_username=workflow_input.author_username,
        channel_id=workflow_input.channel_id,
        message_id=workflow_input.message_id,
        thread_id=workflow_input.thread_id,
    )

    adapter = DiscordResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_id=workflow_input.thread_id,
        organization_id=str(installation.organization_id),
        product_id=str(product.id),
        conversation_id=str(message.conversation_id),
    )

    try:
        await adapter.add_thinking_reaction(workflow_input.message_id)

        agent_config = await resolve_agent_config(
            product=product,
            channel=Channel.DISCORD,
            channel_context={"discord_channel_id": workflow_input.channel_id},
        )

        await adapter.prepare_turn(workflow_input.content)

        service = AgentAnswerServiceReActAsync(
            help_center_config=product,
            organization=installation.organization,
            conversation_id=str(message.conversation_id),
            agent_config=agent_config,
        )

        async for event in service.ask_stream(
            agent_message=message,
        ):
            await adapter.on_event(event)

        await adapter.finalize()

    except Exception as e:
        logger.exception("[DISCORD] Error processing message: %s", e)
        await adapter.send_error(str(e))

    finally:
        await adapter.remove_thinking_reaction(workflow_input.message_id)

    return {
        'guild_id': guild_id,
        'channel_id': workflow_input.channel_id,
        'status': 'completed',
    }
