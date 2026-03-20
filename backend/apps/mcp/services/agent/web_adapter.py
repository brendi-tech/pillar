"""
WebResponseAdapter -- adapter for the web SDK (ask.py) channel.

Uses a queue-based output model: event handlers push dicts to an
asyncio.Queue, and the ``events()`` async generator yields them.
The transport layer (streamable_http.py) reads from ``events()``
and formats them as SSE/JSON-RPC.

Persistence is managed entirely within the adapter:
- ``prepare_turn`` creates conversation + user + assistant rows
  via ConversationLoggingService (with full web analytics metadata)
- ``prepare_resume`` sets IDs for an existing interrupted session
- ``finalize`` marks completed and triggers billing
- ``finalize_disconnected`` marks disconnected (resumable)
"""
import asyncio
import logging
import time
import uuid
from typing import Any, Optional

from apps.mcp.services.agent.response_adapter import ResponseAdapter

logger = logging.getLogger(__name__)


class WebResponseAdapter(ResponseAdapter):
    """Adapter for the web SDK channel with queue-based event output."""

    def __init__(
        self,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
        channel: str = 'web',
        request_metadata: dict[str, Any] | None = None,
    ):
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel=channel,
        )
        self._request_metadata = request_metadata or {}
        self._output_queue: asyncio.Queue = asyncio.Queue()
        self._stream_start_time: float = time.time()

        self._prompt_tokens: int | None = None
        self._completion_tokens: int | None = None
        self._peak_context_occupancy: float | None = None

    # ── Turn lifecycle ─────────────────────────────────────────────────

    async def prepare_turn(
        self,
        user_text: str,
        images: list[dict] | None = None,
    ) -> str:
        """Create conversation + messages via ConversationLoggingService.

        Pushes ``conversation_started`` to the queue immediately after
        the DB rows are created.

        Returns the assistant_message_id.
        """
        from apps.analytics.services import ConversationLoggingService
        from apps.mcp.services.image_summary_service import get_cached_summary

        self._ensure_persistence_state()
        meta = self._request_metadata

        conv_id = self.conversation_id or str(uuid.uuid4())
        self.conversation_id = conv_id
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())
        self.assistant_message_id = assistant_msg_id

        enriched_images = None
        if images:
            enriched_images = []
            for img in images:
                enriched = {**img}
                summary = get_cached_summary(img.get('url', ''))
                if summary:
                    enriched['summary'] = summary
                enriched_images.append(enriched)

        await ConversationLoggingService().create_conversation_and_user_message(
            conversation_id=conv_id,
            user_message_id=user_msg_id,
            assistant_message_id=assistant_msg_id,
            organization_id=self.organization_id,
            product_id=self.product_id,
            question=user_text,
            images=enriched_images,
            query_type='ask',
            page_url=meta.get('page_url', ''),
            user_agent=meta.get('user_agent', ''),
            ip_address=meta.get('ip_address'),
            referer=meta.get('referer', ''),
            external_session_id=meta.get('external_session_id', ''),
            skip_analytics=meta.get('skip_analytics', False),
            visitor_id=meta.get('visitor_id', ''),
            external_user_id=meta.get('external_user_id', ''),
        )

        await self._output_queue.put({
            'type': 'conversation_started',
            'conversation_id': conv_id,
            'assistant_message_id': assistant_msg_id,
        })

        return assistant_msg_id

    async def prepare_resume(
        self,
        conversation_id: str,
        assistant_message_id: str,
    ):
        """Set IDs for an existing turn (resume) and create a new assistant row."""
        from apps.analytics.models import ChatMessage as ChatMessageModel

        self._ensure_persistence_state()
        self.conversation_id = conversation_id
        self.assistant_message_id = assistant_message_id

        await ChatMessageModel.objects.acreate(
            id=assistant_message_id,
            organization_id=self.organization_id,
            product_id=self.product_id,
            conversation_id=conversation_id,
            role=ChatMessageModel.Role.ASSISTANT,
            content='',
            streaming_status=ChatMessageModel.StreamingStatus.STREAMING,
        )

        await self._output_queue.put({
            'type': 'conversation_started',
            'conversation_id': conversation_id,
            'assistant_message_id': assistant_message_id,
        })

    # ── Event handlers (push to queue) ─────────────────────────────────

    async def on_token(self, text: str) -> None:
        await self._output_queue.put({'type': 'token', 'text': text})

    async def on_sources(self, sources: list[dict]) -> None:
        await self._output_queue.put({'type': 'sources', 'sources': sources})

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict,
        tool_call_id: str = '',
    ) -> None:
        await self._output_queue.put({
            'type': 'action_request',
            'action_name': action_name,
            'parameters': parameters,
            'action': action,
            'tool_call_id': tool_call_id,
        })

    async def on_complete(self, event: dict) -> None:
        complete_event = dict(event)
        complete_event['conversation_id'] = self.conversation_id
        complete_event['assistant_message_id'] = self.assistant_message_id
        await self._output_queue.put(complete_event)

    async def on_error(self, message: str, details: dict | None = None) -> None:
        await self._output_queue.put({'type': 'error', 'message': message})

    async def on_progress(self, progress_data: dict) -> None:
        await self._output_queue.put({'type': 'progress', 'data': progress_data})

    async def on_confirmation_request(
        self,
        tool_name: str,
        call_id: str,
        title: str,
        message: str,
        details: dict | None,
        confirm_payload: dict,
        conversation_id: str | None = None,
    ) -> None:
        await self._output_queue.put({
            'type': 'confirmation_request',
            'tool_name': tool_name,
            'call_id': call_id,
            'title': title,
            'message': message,
            'details': details,
            'confirm_payload': confirm_payload,
            'conversation_id': conversation_id or self.conversation_id,
        })

    async def on_plan(self, event: dict) -> None:
        await self._output_queue.put(event)

    async def on_token_usage(self, event: dict) -> None:
        await self._output_queue.put(event)

    async def on_debug(self, event: dict) -> None:
        await self._output_queue.put(event)

    async def on_conversation_started(self, event: dict) -> None:
        pass

    # ── State checkpoint override (capture web-specific fields) ────────

    def on_state_checkpoint(self, event: dict):
        super().on_state_checkpoint(event)
        self._prompt_tokens = event.get('prompt_tokens')
        self._completion_tokens = event.get('completion_tokens')
        self._peak_context_occupancy = event.get('peak_context_occupancy')

    # ── Incremental flush override (include token counts) ──────────────

    async def _do_flush(self):
        """Write current state including web-specific token counts."""
        from apps.analytics.models import ChatMessage

        updates = {
            "content": ''.join(self._persistence_tokens),
            "llm_message": {
                "messages": list(self._llm_messages),
                "registered_tools": list(self._registered_tools),
            },
        }
        if self._display_trace:
            updates["display_trace"] = list(self._display_trace)
        if self._model_used:
            updates["model_used"] = self._model_used
        if self._prompt_tokens is not None:
            updates["prompt_tokens"] = self._prompt_tokens
            updates["completion_tokens"] = self._completion_tokens or 0
            updates["total_tokens"] = (
                (self._prompt_tokens or 0) + (self._completion_tokens or 0)
            )
        if self._peak_context_occupancy is not None:
            updates["peak_context_occupancy"] = self._peak_context_occupancy

        try:
            await ChatMessage.objects.filter(
                id=self.assistant_message_id, role='assistant',
            ).aupdate(**updates)
        except Exception:
            logger.exception(
                "[WebAdapterFlush] Failed to flush state for message %s",
                self.assistant_message_id,
            )

    # ── Events generator ───────────────────────────────────────────────

    async def events(self):
        """Async generator that yields events until None sentinel."""
        while True:
            event = await self._output_queue.get()
            if event is None:
                return
            yield event

    # ── Finalize (completion + billing) ────────────────────────────────

    async def finalize(self) -> None:
        """Persist final state, mark completed, trigger billing, close queue."""
        await self.finalize_persistence()
        if self.assistant_message_id:
            from apps.mcp.services.session_resumption import mark_completed
            latency_ms = int((time.time() - self._stream_start_time) * 1000)
            await mark_completed(self.assistant_message_id, latency_ms=latency_ms)
        await self._output_queue.put(None)

    async def finalize_disconnected(self) -> None:
        """Persist final state, mark disconnected (resumable), close queue."""
        await self.finalize_persistence()
        if self.assistant_message_id:
            from apps.mcp.services.session_resumption import mark_disconnected
            await mark_disconnected(self.assistant_message_id)
        await self._output_queue.put(None)
