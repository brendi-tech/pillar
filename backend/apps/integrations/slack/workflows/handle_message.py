"""
Hatchet task: slack-handle-message

Processes a Slack message event asynchronously:
1. Load SlackInstallation and product
2. Build AgentMessage via SlackChannelConnector
3. Run the agentic loop
4. Post response via SlackResponseAdapter

Also handles confirmation button clicks (tool_confirm) dispatched from
SlackInteractionsView. On success the result is posted directly; on
failure the agentic loop is resumed with full LLM state so it can
reason about the error and retry.
"""
import logging
from datetime import timedelta
from typing import Optional

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class SlackMessageInput(BaseModel):
    team_id: str
    app_id: str = ''
    channel_id: str
    user_id: str
    text: str
    ts: str
    thread_ts: str = ''
    event_type: str
    event_id: str
    tool_confirm: Optional[dict] = None


@hatchet.task(
    name="slack-handle-message",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=SlackMessageInput,
)
async def handle_slack_message(workflow_input: SlackMessageInput, context: Context):
    from apps.integrations.slack.adapter import SlackResponseAdapter
    from apps.integrations.slack.connector import SlackChannelConnector
    from apps.integrations.slack.models import SlackInstallation
    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.channels import Channel
    from apps.products.services.agent_resolver import (
        _build_agent_config,
        resolve_agent_config,
    )

    team_id = workflow_input.team_id
    app_id = workflow_input.app_id

    try:
        lookup = {'team_id': team_id, 'is_active': True}
        if app_id:
            lookup['app_id'] = app_id
        installation = await SlackInstallation.objects.select_related(
            'product', 'organization', 'agent',
        ).aget(**lookup)
    except SlackInstallation.DoesNotExist:
        logger.error("[SLACK] No active installation for team %s app %s", team_id, app_id)
        return {'error': f'No active installation for team {team_id}'}

    product = installation.product

    if workflow_input.tool_confirm:
        return await _handle_confirmation(workflow_input, installation, product)

    connector = SlackChannelConnector(installation)

    thread_ts = workflow_input.thread_ts or None
    logger.info(
        "[SLACK] handle_message: channel=%s, ts=%s, thread_ts=%s (raw=%r), event_type=%s",
        workflow_input.channel_id, workflow_input.ts,
        thread_ts, workflow_input.thread_ts,
        workflow_input.event_type,
    )

    message = await connector.build_agent_message(
        text=workflow_input.text,
        user_id=workflow_input.user_id,
        channel_id=workflow_input.channel_id,
        ts=workflow_input.ts,
        thread_ts=thread_ts,
        event_type=workflow_input.event_type,
    )

    effective_thread_ts = thread_ts or workflow_input.ts
    logger.info(
        "[SLACK] effective_thread_ts=%s (thread_ts=%s, ts=%s)",
        effective_thread_ts, thread_ts, workflow_input.ts,
    )
    adapter = SlackResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_ts=effective_thread_ts,
        organization_id=str(installation.organization_id),
        product_id=str(product.id),
        conversation_id=str(message.conversation_id),
    )

    try:
        await adapter.add_thinking_reaction(workflow_input.ts)

        if installation.agent_id and installation.agent:
            agent_config = _build_agent_config(
                installation.agent, product, Channel.SLACK,
            )
        else:
            agent_config = await resolve_agent_config(
                product=product,
                channel=Channel.SLACK,
                channel_context={"slack_channel_id": workflow_input.channel_id},
            )

        await adapter.prepare_turn(workflow_input.text)

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
        logger.exception("[SLACK] Error processing message: %s", e)
        await adapter.send_error(str(e))

    finally:
        await adapter.remove_thinking_reaction(workflow_input.ts)

    return {
        'team_id': team_id,
        'channel_id': workflow_input.channel_id,
        'status': 'completed',
    }


async def _handle_confirmation(
    workflow_input: SlackMessageInput,
    installation,
    product,
):
    """
    Handle a confirmation button click dispatched from SlackInteractionsView.

    Calls the customer's endpoint with action=tool_confirm. On success,
    posts the result directly to Slack. On failure, resumes the agentic
    loop with full LLM state so the model can reason about the error.
    """
    from apps.integrations.slack.adapter import SlackResponseAdapter
    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.channels import Channel
    from apps.mcp.services.agent.models import AgentMessage, CallerContext
    from apps.mcp.services.session_resumption import get_latest_session
    from apps.products.services.agent_resolver import (
        _build_agent_config,
        resolve_agent_config,
    )
    from apps.tools.services.dispatch import get_tool_endpoint, post_tool_call

    confirm = workflow_input.tool_confirm
    tool_name = confirm.get('tool_name', '')
    call_id = confirm.get('call_id', '')
    confirm_payload = confirm.get('confirm_payload', {})
    conversation_id = confirm.get('conversation_id')

    effective_thread_ts = workflow_input.thread_ts or workflow_input.ts
    adapter = SlackResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_ts=effective_thread_ts,
    )

    logger.info(
        "[SLACK] Handling confirmation: tool=%s, call_id=%s, conversation=%s",
        tool_name, call_id, conversation_id,
    )

    endpoint = await get_tool_endpoint(str(product.id))
    if not endpoint:
        await adapter.send_error(f"No tool endpoint registered for {product.name}.")
        return {'status': 'error', 'error': 'no_endpoint'}

    caller = CallerContext(
        channel_user_id=workflow_input.user_id,
    )

    result = await post_tool_call(
        endpoint_url=endpoint.endpoint_url,
        call_id=call_id,
        tool_name=tool_name,
        arguments={},
        caller=caller,
        timeout=30.0,
        conversation_id=conversation_id,
        product=product,
        action="tool_confirm",
        confirm_payload=confirm_payload,
    )

    is_success = (
        not result.get('timed_out')
        and not result.get('connection_error')
        and not result.get('server_error')
        and result.get('success', True)
    )

    if is_success:
        result_content = result.get('result', '')
        if not isinstance(result_content, str):
            import json
            result_content = json.dumps(result_content, default=str)
        await adapter._post_message(
            blocks=[{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f":white_check_mark: *Done* — {result_content}",
                },
            }],
            fallback_text=f"Done — {result_content}",
        )
        return {'status': 'completed'}

    # --- Failure path: resume through the LLM ---

    if result.get('timed_out'):
        error_msg = f"Tool '{tool_name}' timed out."
    elif result.get('connection_error'):
        error_msg = f"Tool '{tool_name}' endpoint is unreachable."
    elif result.get('server_error'):
        error_msg = result.get('error', 'Unknown server error')
    else:
        error_msg = result.get('error', 'Unknown error')

    logger.info(
        "[SLACK] Confirmation failed for %s: %s — routing to LLM",
        tool_name, error_msg,
    )

    if installation.agent_id and installation.agent:
        agent_config = _build_agent_config(
            installation.agent, product, Channel.SLACK,
        )
    else:
        agent_config = await resolve_agent_config(
            product=product,
            channel=Channel.SLACK,
            channel_context={"slack_channel_id": workflow_input.channel_id},
        )

    conversation_history = []
    registered_tools = []

    if conversation_id:
        session = await get_latest_session(conversation_id)
        if session:
            conversation_history = session.get('llm_messages', [])
            registered_tools = session.get('registered_tools', [])
            logger.info(
                "[SLACK] Resumed session: %d messages, %d tools",
                len(conversation_history), len(registered_tools),
            )

    error_text = (
        f"The user confirmed the tool '{tool_name}', but it failed with: "
        f"{error_msg}\n\nHelp the user resolve this. You may retry with "
        f"different parameters or suggest alternatives."
    )

    message = AgentMessage(
        text=error_text,
        channel=Channel.SLACK,
        conversation_id=conversation_id or '',
        product_id=str(product.id),
        organization_id=str(installation.organization_id),
        caller=caller,
        conversation_history=conversation_history,
        channel_context={
            "team_id": installation.team_id,
            "channel_id": workflow_input.channel_id,
            "thread_ts": effective_thread_ts,
            "ts": workflow_input.ts,
            "event_type": "confirmation_failure",
        },
    )

    service = AgentAnswerServiceReActAsync(
        help_center_config=product,
        organization=installation.organization,
        conversation_id=conversation_id,
        registered_tools=registered_tools,
        agent_config=agent_config,
    )

    adapter = SlackResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_ts=effective_thread_ts,
        organization_id=str(installation.organization_id),
        product_id=str(product.id),
        conversation_id=conversation_id or '',
    )
    await adapter.prepare_turn(error_text)

    try:
        async for event in service.ask_stream(agent_message=message):
            await adapter.on_event(event)

        await adapter.finalize()
    except Exception as e:
        logger.exception("[SLACK] Error in confirmation recovery: %s", e)
        await adapter.send_error(f"Tool '{tool_name}' failed: {error_msg}")

    return {'status': 'completed'}
