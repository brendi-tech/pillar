"""
Abstract base class for channel-specific response adapters.

The agentic loop yields channel-agnostic event dicts. Each channel
implements a ResponseAdapter that knows how to present those events
to the user on that channel. Adapters sit *outside* the loop -- the
loop remains a pure async generator.

Usage:
    async for event in run_agentic_loop(service, message):
        await adapter.on_event(event)
"""
import asyncio
import logging
import time
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

FLUSH_INTERVAL_SECONDS = 2.0


class ResponseAdapter(ABC):
    """
    Translates agentic loop events into channel-appropriate output.

    Adapters can be stateful -- they accumulate tokens, buffer sources,
    and decide when/how to flush output to the channel.

    Optionally manages persistence lifecycle (turn creation, incremental
    flushing, and finalization) so individual workflows don't have to.
    Adapters that don't call ``super().__init__()`` still work -- persistence
    state is lazily initialized on first ``on_event()`` call.
    """

    def __init__(
        self,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
        channel: str = '',
    ):
        self.organization_id = organization_id
        self.product_id = product_id
        self.conversation_id = conversation_id
        self.channel = channel
        self._ensure_persistence_state()

    def _ensure_persistence_state(self):
        """Lazily initialize persistence state.

        Safe to call multiple times -- skips if already initialized.
        Allows adapters that don't call super().__init__() to still
        work when on_event() or finalize_persistence() are called.
        """
        if hasattr(self, '_persistence_initialized'):
            return
        self._persistence_initialized = True
        self._persistence_tokens: list[str] = []
        self._llm_messages: list = []
        self._registered_tools: list = []
        self._model_used: str = ''
        self._display_trace: list = []
        self._dirty: bool = False
        self._last_flush_time: float | None = None
        self._flush_task: asyncio.Task | None = None
        self._complete_response: str = ''
        if not hasattr(self, 'assistant_message_id'):
            self.assistant_message_id: str | None = None
        if not hasattr(self, 'organization_id'):
            self.organization_id = ''
        if not hasattr(self, 'product_id'):
            self.product_id = ''
        if not hasattr(self, 'conversation_id'):
            self.conversation_id = ''
        if not hasattr(self, 'channel'):
            self.channel = ''

    # ── Persistence lifecycle ──────────────────────────────────────────

    async def prepare_turn(self, user_text: str, channel: str = '') -> str:
        """Create user + assistant ChatMessage rows for this turn.

        Returns the assistant_message_id.
        """
        self._ensure_persistence_state()
        from apps.mcp.services.session_resumption import create_turn_messages

        ch = channel or self.channel
        self.assistant_message_id = await create_turn_messages(
            conversation_id=self.conversation_id,
            organization_id=self.organization_id,
            product_id=self.product_id,
            user_text=user_text,
            channel=ch,
        )
        return self.assistant_message_id

    def prepare_resume(self, conversation_id: str, assistant_message_id: str):
        """Set IDs for an existing turn without creating DB rows."""
        self._ensure_persistence_state()
        self.conversation_id = conversation_id
        self.assistant_message_id = assistant_message_id

    def on_state_checkpoint(self, event: dict):
        """Capture LLM state from a state_checkpoint event."""
        self._llm_messages = event.get('llm_messages', [])
        self._registered_tools = event.get('registered_tools', [])
        self._model_used = event.get('model_used', '')
        self._display_trace = event.get('display_trace', [])
        self._dirty = True

    async def _maybe_flush(self):
        """Debounced incremental flush for crash safety."""
        if not self._dirty or not self.assistant_message_id:
            return

        now = time.monotonic()
        if self._last_flush_time and (now - self._last_flush_time) < FLUSH_INTERVAL_SECONDS:
            return

        if self._flush_task and not self._flush_task.done():
            return

        self._dirty = False
        self._last_flush_time = now
        self._flush_task = asyncio.create_task(self._do_flush())

    async def _do_flush(self):
        """Write current state to the assistant ChatMessage row."""
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

        try:
            await ChatMessage.objects.filter(
                id=self.assistant_message_id, role='assistant',
            ).aupdate(**updates)
        except Exception:
            logger.exception(
                "[AdapterFlush] Failed to flush state for message %s",
                self.assistant_message_id,
            )

    async def finalize_persistence(self):
        """Final persistence write. No-op if prepare_turn was never called."""
        self._ensure_persistence_state()
        if not self.assistant_message_id:
            return

        if self._flush_task and not self._flush_task.done():
            try:
                await self._flush_task
            except Exception:
                pass

        from apps.mcp.services.session_resumption import finalize_turn

        await finalize_turn(
            assistant_message_id=self.assistant_message_id,
            response_text=self._complete_response,
            llm_messages=self._llm_messages,
            registered_tools=self._registered_tools,
            model_used=self._model_used,
        )

    # ── Abstract interface ─────────────────────────────────────────────

    @abstractmethod
    async def on_token(self, text: str) -> None:
        """Handle a streamed text delta."""
        ...

    @abstractmethod
    async def on_sources(self, sources: list[dict]) -> None:
        """Handle retrieved knowledge sources."""
        ...

    @abstractmethod
    async def on_progress(self, progress_data: dict) -> None:
        """Handle a progress event (thinking, search, tool_call, etc.)."""
        ...

    @abstractmethod
    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict,
        tool_call_id: str = '',
    ) -> None:
        """Handle a request to execute a client-side tool."""
        ...

    @abstractmethod
    async def on_complete(self, event: dict) -> None:
        """Handle run completion. Called once at the end."""
        ...

    @abstractmethod
    async def on_error(self, message: str, details: dict | None = None) -> None:
        """Handle an error."""
        ...

    async def on_event(self, event: dict) -> None:
        """
        Default event dispatcher. Routes events to typed handlers
        and captures persistence state (tokens, checkpoints, completion).
        """
        self._ensure_persistence_state()
        event_type = event.get("type", "")

        if event_type == "token":
            self._persistence_tokens.append(event.get("text", ""))
            await self.on_token(event.get("text", ""))
        elif event_type == "sources":
            await self.on_sources(event.get("sources", []))
        elif event_type == "progress":
            await self.on_progress(event.get("data", {}))
        elif event_type == "action_request":
            await self.on_action_request(
                event.get("action_name", ""),
                event.get("parameters", {}),
                event.get("action", {}),
                event.get("tool_call_id", ""),
            )
        elif event_type == "complete":
            self._complete_response = (
                event.get('message', '') or ''.join(self._persistence_tokens)
            )
            await self.on_complete(event)
        elif event_type == "error":
            await self.on_error(event.get("message", "Unknown error"))
        elif event_type == "debug":
            await self.on_debug(event)
        elif event_type == "conversation_started":
            await self.on_conversation_started(event)
        elif event_type == "token_usage":
            await self.on_token_usage(event)
        elif event_type == "confirmation_request":
            source_meta = {}
            for _key in (
                "source_type", "openapi_source_id", "openapi_operation",
                "mcp_source_id", "mcp_original_name",
            ):
                if _key in event:
                    source_meta[_key] = event[_key]
            await self.on_confirmation_request(
                event.get("tool_name", ""),
                event.get("call_id", ""),
                event.get("title", ""),
                event.get("message", ""),
                event.get("details"),
                event.get("confirm_payload", {}),
                event.get("conversation_id"),
                source_meta=source_meta or None,
            )
        elif event_type == "plan.created":
            await self.on_plan(event)
        elif event_type == "state_checkpoint":
            self.on_state_checkpoint(event)

        await self._maybe_flush()

    # Optional hooks with default no-ops
    async def on_confirmation_request(
        self,
        tool_name: str,
        call_id: str,
        title: str,
        message: str,
        details: dict | None,
        confirm_payload: dict,
        conversation_id: str | None = None,
        source_meta: dict | None = None,
    ) -> None:
        """Handle a tool requesting user confirmation before executing."""
        pass

    async def on_debug(self, event: dict) -> None:
        pass

    async def on_conversation_started(self, event: dict) -> None:
        pass

    async def on_token_usage(self, event: dict) -> None:
        pass

    async def on_plan(self, event: dict) -> None:
        pass
