"""
Headless chat API -- lets customer backends send messages to the
agentic loop with API key auth and get JSON or SSE responses.

POST /api/chat/           → JSON response (non-streaming)
POST /api/chat/stream/    → SSE stream (text/event-stream)

Authorization: Bearer sk_live_...
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from django.http import JsonResponse, StreamingHttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage, CallerContext
from apps.mcp.services.agent.response_adapter import ResponseAdapter
from apps.tools.services.auth import authenticate_sdk_request
from common.throttles import HeadlessChatThrottle

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _build_headless_context(request):
    """Shared auth + input parsing for both sync and streaming views."""
    product = await authenticate_sdk_request(request)
    if product is None:
        return None, None, None, "Invalid or missing API key"

    data = request.data
    message_text = data.get("message", "").strip()
    if not message_text:
        return None, None, None, '"message" field is required'

    conversation_id = data.get("conversation_id") or str(uuid.uuid4())
    caller_data = data.get("caller", {})
    language = data.get("language", "en")

    caller = CallerContext(
        channel=caller_data.get("channel", "api"),
        channel_user_id=caller_data.get("channel_user_id"),
        external_user_id=caller_data.get("external_user_id"),
        email=caller_data.get("email"),
        display_name=caller_data.get("display_name"),
        user_profile=caller_data.get("user_profile", {}),
        user_api_token=caller_data.get("user_api_token"),
    )

    from apps.mcp.services.agent.answer_service import AgentAnswerServiceReActAsync
    from apps.products.services.agent_resolver import resolve_agent_config

    organization = product.organization
    agent_config = await resolve_agent_config(
        product=product, channel=Channel.API,
    )

    service = AgentAnswerServiceReActAsync(
        help_center_config=product,
        organization=organization,
        conversation_id=conversation_id,
        agent_config=agent_config,
    )

    agent_message = AgentMessage(
        text=message_text,
        channel=Channel.API,
        conversation_id=conversation_id,
        product_id=str(product.id),
        organization_id=str(organization.id) if organization else "",
        caller=caller,
        language=language,
    )

    return service, agent_message, conversation_id, None


# ---------------------------------------------------------------------------
# Response adapters
# ---------------------------------------------------------------------------

class JSONResponseAdapter(ResponseAdapter):
    """Collects agentic loop events into a dict for JSON serialization."""

    def __init__(
        self,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
    ) -> None:
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel='api',
        )
        self._tokens: list[str] = []
        self._sources: list[dict] = []
        self._actions: list[dict] = []
        self._confirmations: list[dict] = []
        self._progress_events: list[dict] = []
        self._token_usage: dict | None = None
        self._error: str | None = None

    async def on_token(self, text: str) -> None:
        self._tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        self._progress_events.append(progress_data)

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        self._actions.append({
            "action_name": action_name,
            "parameters": parameters,
        })

    async def on_confirmation_request(
        self, tool_name: str, call_id: str, title: str, message: str,
        details: dict | None, confirm_payload: dict,
        conversation_id: str | None = None,
    ) -> None:
        self._confirmations.append({
            "tool_name": tool_name,
            "call_id": call_id,
            "title": title,
            "message": message,
            "details": details,
            "confirm_payload": confirm_payload,
        })

    async def on_token_usage(self, event: dict) -> None:
        self._token_usage = {
            "input_tokens": event.get("prompt_tokens"),
            "output_tokens": event.get("completion_tokens"),
            "model": event.get("model_name"),
        }

    async def on_complete(self, event: dict) -> None:
        pass

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self._error = message

    def to_dict(self) -> dict:
        result: dict = {
            "response": "".join(self._tokens),
        }
        if self._sources:
            result["sources"] = self._sources
        if self._actions:
            result["actions"] = self._actions
        if self._confirmations:
            result["confirmation_requests"] = self._confirmations
        if self._progress_events:
            result["progress_events"] = self._progress_events
        if self._token_usage:
            result["usage"] = self._token_usage
        if self._error:
            result["error"] = self._error
        return result


class SSEResponseAdapter(ResponseAdapter):
    """Writes agentic loop events as SSE events into an async queue."""

    def __init__(
        self,
        queue: asyncio.Queue,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
    ) -> None:
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel='api',
        )
        self._queue = queue

    def _send(self, event: str, data: dict) -> None:
        self._queue.put_nowait(f"event: {event}\ndata: {json.dumps(data)}\n\n")

    async def on_token(self, text: str) -> None:
        self._send("token", {"token": text})

    async def on_sources(self, sources: list[dict]) -> None:
        self._send("sources", {"sources": sources})

    async def on_progress(self, progress_data: dict) -> None:
        self._send("progress", progress_data)

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        self._send("action_request", {
            "action_name": action_name,
            "parameters": parameters,
        })

    async def on_confirmation_request(
        self, tool_name: str, call_id: str, title: str, message: str,
        details: dict | None, confirm_payload: dict,
        conversation_id: str | None = None,
    ) -> None:
        self._send("confirmation_request", {
            "tool_name": tool_name,
            "call_id": call_id,
            "title": title,
            "message": message,
            "details": details,
            "confirm_payload": confirm_payload,
        })

    async def on_token_usage(self, event: dict) -> None:
        self._send("usage", {
            "input_tokens": event.get("prompt_tokens"),
            "output_tokens": event.get("completion_tokens"),
            "model": event.get("model_name"),
        })

    async def on_complete(self, event: dict) -> None:
        self._send("complete", {
            "response": event.get("full_response", ""),
        })

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self._send("error", {"message": message})


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class HeadlessChatView(APIView):
    """
    API-key-authenticated chat endpoint.
    Runs the full agentic loop and returns a JSON response (non-streaming).
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [HeadlessChatThrottle]

    async def post(self, request):
        service, agent_message, conversation_id, error = (
            await _build_headless_context(request)
        )
        if error:
            status = 401 if "API key" in error else 400
            return JsonResponse({"error": error}, status=status)

        adapter = JSONResponseAdapter(
            organization_id=agent_message.organization_id,
            product_id=agent_message.product_id,
            conversation_id=conversation_id,
        )
        await adapter.prepare_turn(agent_message.text)

        try:
            async for event in service.ask_stream(
                agent_message=agent_message,
            ):
                await adapter.on_event(event)
        except Exception:
            logger.exception("[HeadlessChat] Error running agentic loop")
            return JsonResponse(
                {"error": "Internal error processing your request"},
                status=500,
            )

        await adapter.finalize_persistence()

        result = adapter.to_dict()
        result["conversation_id"] = conversation_id

        return JsonResponse(result)


class HeadlessChatStreamView(APIView):
    """
    API-key-authenticated SSE streaming chat endpoint.
    Returns a text/event-stream with token, sources, progress, and complete events.
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [HeadlessChatThrottle]

    async def post(self, request):
        service, agent_message, conversation_id, error = (
            await _build_headless_context(request)
        )
        if error:
            status = 401 if "API key" in error else 400
            return JsonResponse({"error": error}, status=status)

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        adapter = SSEResponseAdapter(
            queue,
            organization_id=agent_message.organization_id,
            product_id=agent_message.product_id,
            conversation_id=conversation_id,
        )
        await adapter.prepare_turn(agent_message.text)

        async def _run_loop():
            try:
                adapter._send("conversation", {"conversation_id": conversation_id})
                async for event in service.ask_stream(
                    agent_message=agent_message,
                ):
                    await adapter.on_event(event)
            except Exception:
                logger.exception("[HeadlessChatStream] Error running agentic loop")
                adapter._send("error", {"message": "Internal error processing your request"})
            finally:
                await adapter.finalize_persistence()
                await queue.put(None)

        async def _event_generator():
            task = asyncio.ensure_future(_run_loop())
            try:
                while True:
                    chunk = await queue.get()
                    if chunk is None:
                        break
                    yield chunk
            finally:
                if not task.done():
                    task.cancel()

        response = StreamingHttpResponse(
            _event_generator(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
