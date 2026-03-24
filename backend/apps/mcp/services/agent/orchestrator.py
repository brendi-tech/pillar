"""
Shared orchestration service for the agentic loop.

Provides a channel-agnostic function that runs AgentAnswerServiceReActAsync
with a given ResponseAdapter. All channels (web, MCP, etc.) can use this
instead of duplicating the service-creation and event-dispatch logic.
"""
import asyncio
import logging

from apps.mcp.services.agent.response_adapter import ResponseAdapter
from apps.products.services.agent_resolver import AgentConfig

logger = logging.getLogger(__name__)


async def run_agent_with_adapter(
    adapter: ResponseAdapter,
    product,
    organization,
    query: str,
    conversation_id: str,
    agent_config: AgentConfig,
    conversation_history: list | None = None,
    registered_tools: list | None = None,
    assistant_message_id: str | None = None,
    images: list[dict] | None = None,
    cancel_event: asyncio.Event | None = None,
    language: str = 'en',
    platform: str | None = None,
    version: str | None = None,
    user_context: list | None = None,
    context: dict | None = None,
    user_profile: dict | None = None,
    page_url: str = '',
    session_id: str | None = None,
    external_user_id: str | None = None,
    visitor_id: str | None = None,
    top_k: int = 5,
    user_api_token: str | None = None,
) -> None:
    """Run the agentic loop with a given adapter. Channel-agnostic.

    Callers are responsible for:
    1. Creating the appropriate adapter for the channel
    2. Calling adapter.prepare_turn() or prepare_resume() before this function
    3. Calling this function
    4. Calling adapter.finalize() or finalize_disconnected() after

    This function handles service creation, loop execution, and event
    dispatch to the adapter. It does NOT manage the adapter lifecycle.

    Raises asyncio.CancelledError when cancel_event is set so the caller
    can distinguish cancellation from normal completion.
    """
    from apps.mcp.services.agent import AgentAnswerServiceReActAsync

    service = AgentAnswerServiceReActAsync(
        help_center_config=product,
        organization=organization,
        conversation_history=conversation_history or [],
        registered_tools=registered_tools or [],
        conversation_id=conversation_id,
        assistant_message_id=assistant_message_id,
        agent_config=agent_config,
    )

    async for event in service.ask_stream(
        question=query,
        top_k=top_k,
        cancel_event=cancel_event,
        platform=platform,
        version=version,
        user_context=user_context,
        images=images,
        context=context,
        user_profile=user_profile,
        page_url=page_url,
        session_id=session_id,
        language=language,
        external_user_id=external_user_id,
        visitor_id=visitor_id,
        user_api_token=user_api_token,
    ):
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError("Stream cancelled by client")
        await adapter.on_event(event)
