"""
Hatchet task: discord-handle-message

Processes a Discord message event asynchronously:
1. Load DiscordInstallation and product
2. Build AgentMessage via DiscordChannelConnector
3. Run the agentic loop
4. Post response via DiscordResponseAdapter

Also handles confirmation button clicks (tool_confirm) dispatched from
DiscordInteractionsView. On success the result is posted directly; on
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


class DiscordMessageInput(BaseModel):
    guild_id: str
    channel_id: str
    author_id: str
    author_username: str = ''
    content: str = ''
    message_id: str = ''
    thread_id: str = ''
    is_dm: bool = False
    tool_confirm: Optional[dict] = None
    interaction_token: str = ''
    application_id: str = ''
    installation_id: str = ''


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
        if guild_id:
            installation = await DiscordInstallation.objects.select_related(
                'product', 'organization', 'agent'
            ).aget(guild_id=guild_id, is_active=True)
        elif workflow_input.installation_id:
            installation = await DiscordInstallation.objects.select_related(
                'product', 'organization', 'agent'
            ).aget(id=workflow_input.installation_id, is_active=True)
        else:
            logger.error("[DISCORD] No guild_id or installation_id provided")
            return {'error': 'No guild_id or installation_id provided'}
    except DiscordInstallation.DoesNotExist:
        logger.error(
            "[DISCORD] No active installation for guild=%s installation_id=%s",
            guild_id, workflow_input.installation_id,
        )
        return {'error': 'No active installation found'}

    product = installation.product

    if workflow_input.tool_confirm:
        return await _handle_confirmation(workflow_input, installation, product)

    # Auto-create a thread for new questions in guild channels so each
    # question gets an isolated conversation (no cross-talk, no history bloat).
    thread_id = workflow_input.thread_id
    interaction_token = workflow_input.interaction_token
    should_thread = workflow_input.guild_id and not workflow_input.thread_id

    if should_thread:
        thread_adapter = DiscordResponseAdapter(
            installation=installation,
            channel_id=workflow_input.channel_id,
        )
        try:
            thread_data = None
            if workflow_input.message_id:
                thread_data = await thread_adapter.create_thread(
                    workflow_input.message_id,
                    workflow_input.content[:100] or "Pillar",
                )
            elif workflow_input.interaction_token:
                thread_data = await thread_adapter.create_thread_from_interaction(
                    workflow_input.application_id,
                    workflow_input.interaction_token,
                    workflow_input.content[:100] or "Pillar",
                )
                # Original interaction message was edited to "See thread";
                # clear the token so responses post to the thread via REST.
                interaction_token = ''

            if thread_data:
                thread_id = thread_data["id"]
                from django.core.cache import cache
                cache.set(f"discord_bot_thread:{thread_id}", "1", timeout=86400 * 7)
                logger.info(
                    "[DISCORD] Created thread %s for channel %s",
                    thread_id, workflow_input.channel_id,
                )
        except Exception:
            logger.exception("[DISCORD] Thread creation failed, falling back to channel")
        finally:
            await thread_adapter.close()

    connector = DiscordChannelConnector(installation)

    message = await connector.build_agent_message(
        content=workflow_input.content,
        author_id=workflow_input.author_id,
        author_username=workflow_input.author_username,
        channel_id=workflow_input.channel_id,
        message_id=workflow_input.message_id,
        thread_id=thread_id,
        is_dm=workflow_input.is_dm,
    )

    adapter = DiscordResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_id=thread_id,
        organization_id=str(installation.organization_id),
        product_id=str(product.id),
        conversation_id=str(message.conversation_id),
        interaction_token=interaction_token,
        application_id=workflow_input.application_id,
    )

    try:
        if workflow_input.message_id:
            await adapter.add_thinking_reaction(workflow_input.message_id)

        if installation.agent_id and installation.agent:
            from apps.products.services.agent_resolver import resolve_agent_config_from_agent
            agent_config = await resolve_agent_config_from_agent(
                installation.agent, product, channel=Channel.DISCORD,
            )
        else:
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
        if workflow_input.message_id:
            await adapter.remove_thinking_reaction(workflow_input.message_id)
        await adapter.close()

    return {
        'guild_id': guild_id,
        'channel_id': workflow_input.channel_id,
        'status': 'completed',
    }


def _detect_inner_failure(result: dict) -> str | None:
    """Check a tool-confirm result for inner failures that HTTP-level checks missed.

    Customer endpoints may return HTTP 200 with structured results that
    contain per-item failures (e.g. ``created: false``).  Returns a
    human-readable error string when found, ``None`` otherwise.
    """
    content = result.get('result', result)
    if not isinstance(content, dict):
        return None

    if 'error' in content and isinstance(content['error'], str):
        return content['error']

    for value in content.values():
        if not isinstance(value, list):
            continue
        failures = []
        for item in value:
            if not isinstance(item, dict):
                continue
            if item.get('created') is False or item.get('success') is False:
                error = item.get('error', 'unknown error')
                name = item.get('name') or item.get('id', 'unknown')
                failures.append(f"{name}: {error}")
        if failures:
            return '; '.join(failures)

    return None


async def _handle_confirmation(
    workflow_input: DiscordMessageInput,
    installation,
    product,
):
    """
    Handle a confirmation button click dispatched from DiscordInteractionsView.

    Routes to the correct executor (OpenAPI, MCP, or server-side endpoint)
    based on ``source_meta`` embedded in the confirm payload. On success,
    posts the result directly. On failure, resumes the agentic loop with
    full LLM state so the model can reason about the error.
    """
    from apps.integrations.discord.adapter import DiscordResponseAdapter
    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.channels import Channel
    from apps.mcp.services.agent.models import AgentMessage, CallerContext
    from apps.mcp.services.session_resumption import (
        create_turn_messages,
        finalize_turn,
        get_latest_session,
    )
    from apps.products.services.agent_resolver import resolve_agent_config
    from apps.tools.services.confirm_executor import execute_confirmed_tool

    confirm = workflow_input.tool_confirm
    tool_name = confirm.get('tool_name', '')
    call_id = confirm.get('call_id', '')
    confirm_payload = confirm.get('confirm_payload', {})
    conversation_id = confirm.get('conversation_id')

    source_meta = confirm.get('source_meta') or {}
    source_type = source_meta.get('source_type', 'server')

    adapter = DiscordResponseAdapter(
        installation=installation,
        channel_id=workflow_input.channel_id,
        thread_id=workflow_input.thread_id,
    )

    logger.info(
        "[DISCORD] Handling confirmation: tool=%s, call_id=%s, conversation=%s, "
        "source_type=%s, thread=%s",
        tool_name, call_id, conversation_id, source_type, workflow_input.thread_id,
    )

    caller = CallerContext(channel='discord', channel_user_id=workflow_input.author_id)

    result = await execute_confirmed_tool(
        tool_name=tool_name,
        confirm_payload=confirm_payload,
        source_type=source_type,
        product=product,
        caller=caller,
        conversation_id=conversation_id,
        call_id=call_id,
        openapi_source_id=source_meta.get('openapi_source_id'),
        openapi_operation=source_meta.get('openapi_operation'),
        mcp_source_id=source_meta.get('mcp_source_id'),
        mcp_original_name=source_meta.get('mcp_original_name'),
    )

    is_success = (
        not result.get('timed_out')
        and not result.get('connection_error')
        and not result.get('server_error')
        and result.get('success', True)
    )

    inner_failure = _detect_inner_failure(result) if is_success else None
    if inner_failure:
        is_success = False

    if is_success:
        from apps.integrations.common.formatting import extract_confirm_success

        summary, links = extract_confirm_success(result)
        description = f"✅ **Done** — {summary}"
        if links:
            description += "\n" + " ".join(
                f"[{l['label']}]({l['url']})" for l in links
            )

        embed = {
            "description": description,
            "color": 0x57F287,
            "footer": {"text": "Powered by Pillar"},
        }
        await adapter._send_message(embeds=[embed])
        await adapter.dismiss_deferred_response(
            application_id=workflow_input.application_id,
            interaction_token=workflow_input.interaction_token,
        )
        return {'status': 'completed'}

    # --- Failure path: resume through the LLM ---

    if inner_failure:
        error_msg = inner_failure
    elif result.get('timed_out'):
        error_msg = f"Tool '{tool_name}' timed out."
    elif result.get('connection_error'):
        error_msg = f"Tool '{tool_name}' endpoint is unreachable."
    elif result.get('server_error'):
        error_msg = result.get('error', 'Unknown server error')
    else:
        error_msg = result.get('error', 'Unknown error')

    logger.info(
        "[DISCORD] Confirmation failed for %s: %s — routing to LLM",
        tool_name, error_msg,
    )

    from apps.integrations.discord.formatting import PILLAR_BLURPLE

    status_embed = {
        "description": f"{error_msg}\n\nWorking on it...",
        "color": PILLAR_BLURPLE,
        "footer": {"text": "Powered by Pillar"},
    }
    await adapter._send_message(embeds=[status_embed])

    agent_config = await resolve_agent_config(
        product=product,
        channel=Channel.DISCORD,
        channel_context={"discord_channel_id": workflow_input.channel_id},
    )

    conversation_history = []
    registered_tools = []

    if conversation_id:
        session = await get_latest_session(conversation_id)
        if session:
            conversation_history = session.get('llm_messages', [])
            registered_tools = session.get('registered_tools', [])
            logger.info(
                "[DISCORD] Resumed session: %d messages, %d tools",
                len(conversation_history), len(registered_tools),
            )

    error_text = (
        f"The user confirmed the tool '{tool_name}', but it failed with: "
        f"{error_msg}\n\nHelp the user resolve this. You may retry with "
        f"different parameters or suggest alternatives."
    )

    message = AgentMessage(
        text=error_text,
        channel=Channel.DISCORD,
        conversation_id=conversation_id or '',
        product_id=str(product.id),
        organization_id=str(installation.organization_id),
        caller=caller,
        conversation_history=conversation_history,
        channel_context={
            "guild_id": installation.guild_id,
            "channel_id": workflow_input.channel_id,
            "thread_id": workflow_input.thread_id,
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

    assistant_msg_id = await create_turn_messages(
        conversation_id=conversation_id or '',
        organization_id=str(installation.organization_id),
        product_id=str(product.id),
        user_text=error_text,
        channel='discord',
    )

    try:
        last_checkpoint = {}
        async for event in service.ask_stream(agent_message=message):
            if event.get('type') == 'state_checkpoint':
                last_checkpoint = event
            await adapter.on_event(event)

        await adapter.finalize()
        await adapter.dismiss_deferred_response(
            application_id=workflow_input.application_id,
            interaction_token=workflow_input.interaction_token,
        )

        response_text = adapter._full_response or ''.join(adapter._display_tokens)
        await finalize_turn(
            assistant_message_id=assistant_msg_id,
            response_text=response_text,
            llm_messages=last_checkpoint.get('llm_messages', []),
            registered_tools=last_checkpoint.get('registered_tools', []),
            model_used=last_checkpoint.get('model_used', ''),
        )
    except Exception as e:
        logger.exception("[DISCORD] Error in confirmation recovery: %s", e)
        await adapter.send_error(f"Tool '{tool_name}' failed: {error_msg}")
        await adapter.dismiss_deferred_response(
            application_id=workflow_input.application_id,
            interaction_token=workflow_input.interaction_token,
        )

    return {'status': 'completed'}
