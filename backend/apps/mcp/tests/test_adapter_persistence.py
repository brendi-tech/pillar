"""
Tests for ResponseAdapter persistence lifecycle.

Covers lazy initialization, prepare_turn/prepare_resume, state checkpoint
capture, complete event handling, debounced flush, finalize_persistence,
and token buffer separation.
"""
import asyncio
import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.agent.response_adapter import ResponseAdapter


class ConcreteAdapter(ResponseAdapter):
    """Minimal adapter that does NOT call super().__init__()."""

    def __init__(self):
        self.events: list = []

    async def on_token(self, text: str) -> None:
        self.events.append(("token", text))

    async def on_sources(self, sources: list[dict]) -> None:
        self.events.append(("sources", sources))

    async def on_progress(self, progress_data: dict) -> None:
        self.events.append(("progress", progress_data))

    async def on_action_request(self, action_name: str, parameters: dict, action: dict) -> None:
        self.events.append(("action_request", action_name, parameters))

    async def on_complete(self, event: dict) -> None:
        self.events.append(("complete", event))

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self.events.append(("error", message))


class PersistenceAdapter(ResponseAdapter):
    """Adapter that calls super().__init__() with persistence params."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.events: list = []

    async def on_token(self, text: str) -> None:
        self.events.append(("token", text))

    async def on_sources(self, sources: list[dict]) -> None:
        pass

    async def on_progress(self, progress_data: dict) -> None:
        pass

    async def on_action_request(self, action_name: str, parameters: dict, action: dict) -> None:
        pass

    async def on_complete(self, event: dict) -> None:
        self.events.append(("complete", event))

    async def on_error(self, message: str, details: dict | None = None) -> None:
        pass


# ---------------------------------------------------------------------------
# Lazy initialization
# ---------------------------------------------------------------------------

class TestLazyInitialization:
    async def test_no_super_call_on_event_still_works(self):
        adapter = ConcreteAdapter()
        await adapter.on_event({"type": "token", "text": "hi"})
        assert adapter.events == [("token", "hi")]

    async def test_no_super_call_finalize_is_noop(self):
        adapter = ConcreteAdapter()
        await adapter.finalize_persistence()
        # No crash, no DB call

    async def test_ensure_persistence_state_idempotent(self):
        adapter = ConcreteAdapter()
        adapter._ensure_persistence_state()
        adapter._persistence_tokens.append("first")
        adapter._ensure_persistence_state()
        assert adapter._persistence_tokens == ["first"]

    async def test_with_super_call_state_initialized_upfront(self):
        adapter = PersistenceAdapter(organization_id='org-1')
        assert hasattr(adapter, '_persistence_tokens')
        assert hasattr(adapter, '_llm_messages')
        assert adapter.organization_id == 'org-1'
        assert adapter._persistence_initialized is True


# ---------------------------------------------------------------------------
# prepare_turn
# ---------------------------------------------------------------------------

class TestPrepareTurn:
    @patch('apps.mcp.services.session_resumption.create_turn_messages', new_callable=AsyncMock)
    async def test_creates_user_and_assistant_messages(self, mock_create):
        mock_create.return_value = 'msg-42'
        adapter = PersistenceAdapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
            channel='slack',
        )
        result = await adapter.prepare_turn('Hello')
        mock_create.assert_called_once_with(
            conversation_id='conv-1',
            organization_id='org-1',
            product_id='prod-1',
            user_text='Hello',
            channel='slack',
        )
        assert result == 'msg-42'

    @patch('apps.mcp.services.session_resumption.create_turn_messages', new_callable=AsyncMock)
    async def test_returns_assistant_message_id(self, mock_create):
        mock_create.return_value = 'msg-99'
        adapter = PersistenceAdapter(organization_id='o', product_id='p', conversation_id='c')
        result = await adapter.prepare_turn('test')
        assert result == 'msg-99'
        assert adapter.assistant_message_id == 'msg-99'

    @patch('apps.mcp.services.session_resumption.create_turn_messages', new_callable=AsyncMock)
    async def test_works_with_empty_org_id(self, mock_create):
        mock_create.return_value = 'msg-1'
        adapter = PersistenceAdapter()
        await adapter.prepare_turn('Hello')
        mock_create.assert_called_once()


# ---------------------------------------------------------------------------
# prepare_resume
# ---------------------------------------------------------------------------

class TestPrepareResume:
    async def test_sets_ids_without_db_call(self):
        adapter = PersistenceAdapter()
        adapter.prepare_resume('conv-5', 'msg-5')
        assert adapter.conversation_id == 'conv-5'
        assert adapter.assistant_message_id == 'msg-5'

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_enables_persistence(self, mock_finalize):
        adapter = PersistenceAdapter()
        adapter.prepare_resume('conv-5', 'msg-5')
        adapter._complete_response = 'done'
        await adapter.finalize_persistence()
        mock_finalize.assert_called_once()


# ---------------------------------------------------------------------------
# on_state_checkpoint
# ---------------------------------------------------------------------------

class TestOnStateCheckpoint:
    def _make_event(self, **overrides):
        event = {
            "type": "state_checkpoint",
            "llm_messages": [{"role": "user", "content": "hi"}],
            "registered_tools": [{"name": "search"}],
            "model_used": "gpt-4",
            "display_trace": [{"kind": "search"}],
        }
        event.update(overrides)
        return event

    async def test_captures_llm_messages(self):
        adapter = PersistenceAdapter()
        await adapter.on_event(self._make_event())
        assert adapter._llm_messages == [{"role": "user", "content": "hi"}]

    async def test_captures_registered_tools(self):
        adapter = PersistenceAdapter()
        await adapter.on_event(self._make_event())
        assert adapter._registered_tools == [{"name": "search"}]

    async def test_captures_model_used(self):
        adapter = PersistenceAdapter()
        await adapter.on_event(self._make_event())
        assert adapter._model_used == "gpt-4"

    async def test_captures_display_trace(self):
        adapter = PersistenceAdapter()
        await adapter.on_event(self._make_event())
        assert adapter._display_trace == [{"kind": "search"}]

    async def test_sets_dirty_flag(self):
        adapter = PersistenceAdapter()
        assert adapter._dirty is False
        await adapter.on_event(self._make_event())
        assert adapter._dirty is True

    async def test_successive_checkpoints_replace(self):
        adapter = PersistenceAdapter()
        await adapter.on_event(self._make_event(model_used="gpt-4"))
        await adapter.on_event(self._make_event(model_used="claude-3"))
        assert adapter._model_used == "claude-3"


# ---------------------------------------------------------------------------
# Complete event capture
# ---------------------------------------------------------------------------

class TestCompleteEventCapture:
    async def test_complete_event_captures_message(self):
        adapter = PersistenceAdapter()
        await adapter.on_event({"type": "complete", "message": "final answer"})
        assert adapter._complete_response == "final answer"

    async def test_complete_event_falls_back_to_persistence_tokens(self):
        adapter = PersistenceAdapter()
        await adapter.on_event({"type": "token", "text": "hello "})
        await adapter.on_event({"type": "token", "text": "world"})
        await adapter.on_event({"type": "complete", "message": ""})
        assert adapter._complete_response == "hello world"

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_finalize_uses_complete_response_not_all_tokens(self, mock_finalize):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._persistence_tokens = ['intermediate', ' ', 'tokens']
        adapter._complete_response = 'final only'
        await adapter.finalize_persistence()
        call_kwargs = mock_finalize.call_args.kwargs
        assert call_kwargs['response_text'] == 'final only'


# ---------------------------------------------------------------------------
# Debounced flush
# ---------------------------------------------------------------------------

class TestDebouncedFlush:
    async def test_no_flush_when_not_dirty(self):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._dirty = False
        await adapter._maybe_flush()
        assert adapter._flush_task is None

    async def test_no_flush_without_assistant_message_id(self):
        adapter = PersistenceAdapter()
        adapter._dirty = True
        await adapter._maybe_flush()
        assert adapter._flush_task is None

    @patch('apps.mcp.services.agent.response_adapter.time')
    async def test_flushes_when_dirty_and_no_previous_flush(self, mock_time):
        mock_time.monotonic.return_value = 100.0
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._dirty = True
        adapter._persistence_tokens = ['hello']

        with patch.object(adapter, '_do_flush', new_callable=AsyncMock) as mock_flush:
            await adapter._maybe_flush()
            assert adapter._flush_task is not None
            await adapter._flush_task
            mock_flush.assert_called_once()

    @patch('apps.mcp.services.agent.response_adapter.time')
    async def test_no_flush_within_2_seconds(self, mock_time):
        mock_time.monotonic.return_value = 100.5
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._dirty = True
        adapter._last_flush_time = 100.0

        with patch.object(adapter, '_do_flush', new_callable=AsyncMock) as mock_flush:
            await adapter._maybe_flush()
            mock_flush.assert_not_called()

    @patch('apps.mcp.services.agent.response_adapter.time')
    async def test_flushes_after_2_seconds(self, mock_time):
        mock_time.monotonic.return_value = 103.0
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._dirty = True
        adapter._last_flush_time = 100.0

        with patch.object(adapter, '_do_flush', new_callable=AsyncMock) as mock_flush:
            await adapter._maybe_flush()
            assert adapter._flush_task is not None
            await adapter._flush_task
            mock_flush.assert_called_once()

    async def test_flush_writes_correct_data(self):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._persistence_tokens = ['hello', ' world']
        adapter._llm_messages = [{"role": "user", "content": "hi"}]
        adapter._registered_tools = [{"name": "search"}]
        adapter._display_trace = [{"kind": "thinking"}]
        adapter._model_used = "gpt-4"

        mock_qs = MagicMock()
        mock_qs.aupdate = AsyncMock()

        with patch('apps.analytics.models.ChatMessage.objects') as mock_objects:
            mock_objects.filter.return_value = mock_qs
            await adapter._do_flush()

            mock_objects.filter.assert_called_once_with(id='msg-1', role='assistant')
            call_kwargs = mock_qs.aupdate.call_args.kwargs
            assert call_kwargs['content'] == 'hello world'
            assert call_kwargs['llm_message']['messages'] == [{"role": "user", "content": "hi"}]
            assert call_kwargs['llm_message']['registered_tools'] == [{"name": "search"}]
            assert call_kwargs['display_trace'] == [{"kind": "thinking"}]
            assert call_kwargs['model_used'] == "gpt-4"

    @patch('apps.mcp.services.agent.response_adapter.time')
    async def test_flush_resets_dirty_flag(self, mock_time):
        mock_time.monotonic.return_value = 100.0
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._dirty = True

        with patch.object(adapter, '_do_flush', new_callable=AsyncMock):
            await adapter._maybe_flush()
            assert adapter._dirty is False
            assert adapter._last_flush_time == 100.0

    async def test_flush_uses_persistence_tokens_not_display(self):
        """_persistence_tokens goes to DB, independent of any subclass display buffer."""
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._persistence_tokens = ['all', ' ', 'tokens']

        mock_qs = MagicMock()
        mock_qs.aupdate = AsyncMock()

        with patch('apps.analytics.models.ChatMessage.objects') as mock_objects:
            mock_objects.filter.return_value = mock_qs
            await adapter._do_flush()

            call_kwargs = mock_qs.aupdate.call_args.kwargs
            assert call_kwargs['content'] == 'all tokens'


# ---------------------------------------------------------------------------
# finalize_persistence
# ---------------------------------------------------------------------------

class TestFinalizePersistence:
    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_awaits_in_flight_flush(self, mock_finalize):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._complete_response = 'done'

        flush_called = False

        async def slow_flush():
            nonlocal flush_called
            await asyncio.sleep(0.01)
            flush_called = True

        adapter._flush_task = asyncio.create_task(slow_flush())
        await adapter.finalize_persistence()
        assert flush_called
        mock_finalize.assert_called_once()

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_final_write_calls_finalize_turn(self, mock_finalize):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._complete_response = 'the answer'
        adapter._llm_messages = [{"role": "assistant", "content": "x"}]
        adapter._registered_tools = [{"name": "t"}]
        adapter._model_used = 'claude-3'

        await adapter.finalize_persistence()
        mock_finalize.assert_called_once_with(
            assistant_message_id='msg-1',
            response_text='the answer',
            llm_messages=[{"role": "assistant", "content": "x"}],
            registered_tools=[{"name": "t"}],
            model_used='claude-3',
        )

    async def test_noop_when_no_assistant_message_id(self):
        adapter = PersistenceAdapter()
        assert adapter.assistant_message_id is None
        await adapter.finalize_persistence()
        # No crash, no DB call

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_marks_completed(self, mock_finalize):
        adapter = PersistenceAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._complete_response = 'done'
        await adapter.finalize_persistence()
        mock_finalize.assert_called_once()


# ---------------------------------------------------------------------------
# Token buffer separation
# ---------------------------------------------------------------------------

class TestTokenBufferSeparation:
    async def test_on_event_token_appends_to_persistence_tokens(self):
        adapter = PersistenceAdapter()
        await adapter.on_event({"type": "token", "text": "hi"})
        assert adapter._persistence_tokens == ["hi"]

    async def test_persistence_tokens_never_cleared(self):
        adapter = PersistenceAdapter()
        await adapter.on_event({"type": "token", "text": "a"})
        await adapter.on_event({"type": "token", "text": "b"})
        assert adapter._persistence_tokens == ["a", "b"]

    async def test_subclass_display_buffer_independent(self):
        """A subclass display buffer can be cleared without affecting _persistence_tokens."""

        class DisplayAdapter(PersistenceAdapter):
            def __init__(self, **kw):
                super().__init__(**kw)
                self._display_tokens: list[str] = []

            async def on_token(self, text: str) -> None:
                self._display_tokens.append(text)

        adapter = DisplayAdapter()
        await adapter.on_event({"type": "token", "text": "a"})
        await adapter.on_event({"type": "token", "text": "b"})
        adapter._display_tokens = []
        assert adapter._persistence_tokens == ["a", "b"]
        assert adapter._display_tokens == []
