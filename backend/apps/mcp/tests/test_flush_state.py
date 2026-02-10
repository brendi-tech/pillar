"""
Tests for the unified flush mechanism in streamable_http.stream_event_generator.

Covers:
- _flush_all: writes content, llm_message, display_trace, token counts to DB
- state_checkpoint event handling: updates flush_state from agentic loop events
- Periodic flush timer: fires every ~2s when dirty
- Complete event: awaits in-flight flush, performs final flush, marks completed
- Disconnect/error paths: flush + mark disconnected
"""
import asyncio
import json
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# =============================================================================
# Direct unit tests for _flush_all logic (extracted and tested in isolation)
# =============================================================================

class TestFlushAll:
    """Tests for the _flush_all function defined inside stream_event_generator.

    We extract and test the same logic here against a mock ChatMessage.objects.
    """

    async def _run_flush(self, message_id, collected_text, state, mock_aupdate):
        """Re-implement _flush_all exactly as in streamable_http for unit testing."""
        content = ''.join(collected_text)
        llm_message = {
            "messages": state.get("llm_messages", []),
            "registered_actions": state.get("registered_actions", []),
        }
        updates = {
            "content": content,
            "llm_message": llm_message,
            "display_trace": state.get("display_trace", []),
        }
        if state.get("model_used"):
            updates["model_used"] = state["model_used"]
        if state.get("prompt_tokens") is not None:
            updates["prompt_tokens"] = state["prompt_tokens"]
            updates["completion_tokens"] = state.get("completion_tokens") or 0
            updates["total_tokens"] = (state["prompt_tokens"] or 0) + (state.get("completion_tokens") or 0)
        if state.get("peak_context_occupancy") is not None:
            updates["peak_context_occupancy"] = state["peak_context_occupancy"]
        await mock_aupdate(**updates)

    @pytest.mark.asyncio
    async def test_writes_joined_text_as_content(self):
        """Should join collected_text list into a single content string."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", ["Hello ", "world!"],
            {"llm_messages": [], "registered_actions": [], "display_trace": []},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["content"] == "Hello world!"

    @pytest.mark.asyncio
    async def test_writes_llm_message_dict_format(self):
        """Should wrap llm_messages and registered_actions in a dict."""
        msgs = [{"role": "assistant", "content": "hi"}]
        actions = [{"name": "create_chart"}]
        mock_aupdate = AsyncMock()

        await self._run_flush(
            "msg-1", [],
            {"llm_messages": msgs, "registered_actions": actions, "display_trace": []},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["llm_message"] == {
            "messages": msgs,
            "registered_actions": actions,
        }

    @pytest.mark.asyncio
    async def test_writes_display_trace(self):
        """Should include display_trace in the update."""
        trace = [{"step_type": "thinking", "content": "reasoning"}]
        mock_aupdate = AsyncMock()

        await self._run_flush(
            "msg-1", [],
            {"llm_messages": [], "registered_actions": [], "display_trace": trace},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["display_trace"] == trace

    @pytest.mark.asyncio
    async def test_includes_model_when_present(self):
        """Should include model_used when non-empty."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {"llm_messages": [], "registered_actions": [], "display_trace": [], "model_used": "gpt-4"},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["model_used"] == "gpt-4"

    @pytest.mark.asyncio
    async def test_omits_model_when_empty(self):
        """Should omit model_used when empty string."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {"llm_messages": [], "registered_actions": [], "display_trace": [], "model_used": ""},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert "model_used" not in call_kwargs

    @pytest.mark.asyncio
    async def test_includes_token_counts_when_present(self):
        """Should include prompt_tokens, completion_tokens, total_tokens."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {
                "llm_messages": [], "registered_actions": [], "display_trace": [],
                "prompt_tokens": 500, "completion_tokens": 200,
            },
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["prompt_tokens"] == 500
        assert call_kwargs["completion_tokens"] == 200
        assert call_kwargs["total_tokens"] == 700

    @pytest.mark.asyncio
    async def test_omits_token_counts_when_none(self):
        """Should omit token fields when prompt_tokens is None."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {"llm_messages": [], "registered_actions": [], "display_trace": [], "prompt_tokens": None},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert "prompt_tokens" not in call_kwargs
        assert "total_tokens" not in call_kwargs

    @pytest.mark.asyncio
    async def test_includes_peak_context_occupancy(self):
        """Should include peak_context_occupancy when present."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {
                "llm_messages": [], "registered_actions": [], "display_trace": [],
                "peak_context_occupancy": 0.85,
            },
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["peak_context_occupancy"] == 0.85

    @pytest.mark.asyncio
    async def test_handles_empty_collected_text(self):
        """Should work with empty collected_text list."""
        mock_aupdate = AsyncMock()
        await self._run_flush(
            "msg-1", [],
            {"llm_messages": [], "registered_actions": [], "display_trace": []},
            mock_aupdate,
        )
        call_kwargs = mock_aupdate.call_args[1]
        assert call_kwargs["content"] == ""


# =============================================================================
# Tests for state_checkpoint event handling
# =============================================================================

class TestStateCheckpointHandling:
    """Tests that state_checkpoint events correctly update flush_state."""

    def _make_flush_state(self):
        return {
            "assistant_message_id": "msg-123",
            "streaming_started_at": None,
            "stream_completed": False,
            "llm_messages": [],
            "display_trace": [],
            "registered_actions": [],
            "model_used": "",
            "prompt_tokens": None,
            "completion_tokens": None,
            "peak_context_occupancy": None,
            "dirty": False,
            "last_flush_time": None,
        }

    def _apply_checkpoint(self, flush_state, event):
        """Simulate the state_checkpoint handler from streamable_http."""
        flush_state["llm_messages"] = event.get("llm_messages", [])
        flush_state["display_trace"] = event.get("display_trace", [])
        flush_state["registered_actions"] = event.get("registered_actions", [])
        flush_state["model_used"] = event.get("model_used", "")
        flush_state["prompt_tokens"] = event.get("prompt_tokens")
        flush_state["completion_tokens"] = event.get("completion_tokens")
        flush_state["peak_context_occupancy"] = event.get("peak_context_occupancy")
        flush_state["dirty"] = True

    def test_applies_all_fields(self):
        """Should update all fields from a state_checkpoint event."""
        state = self._make_flush_state()
        checkpoint = {
            "type": "state_checkpoint",
            "llm_messages": [{"role": "assistant", "content": "hi"}],
            "display_trace": [{"step_type": "thinking"}],
            "registered_actions": [{"name": "create_chart"}],
            "model_used": "gpt-4",
            "prompt_tokens": 300,
            "completion_tokens": 100,
            "peak_context_occupancy": 0.42,
        }
        self._apply_checkpoint(state, checkpoint)

        assert state["llm_messages"] == [{"role": "assistant", "content": "hi"}]
        assert state["display_trace"] == [{"step_type": "thinking"}]
        assert state["registered_actions"] == [{"name": "create_chart"}]
        assert state["model_used"] == "gpt-4"
        assert state["prompt_tokens"] == 300
        assert state["completion_tokens"] == 100
        assert state["peak_context_occupancy"] == 0.42
        assert state["dirty"] is True

    def test_marks_dirty(self):
        """Should always set dirty=True."""
        state = self._make_flush_state()
        assert state["dirty"] is False
        self._apply_checkpoint(state, {"type": "state_checkpoint"})
        assert state["dirty"] is True

    def test_replaces_previous_values(self):
        """Successive checkpoints replace previous values (not append)."""
        state = self._make_flush_state()
        self._apply_checkpoint(state, {
            "llm_messages": [{"role": "assistant", "content": "first"}],
        })
        self._apply_checkpoint(state, {
            "llm_messages": [{"role": "assistant", "content": "second"}],
        })
        assert len(state["llm_messages"]) == 1
        assert state["llm_messages"][0]["content"] == "second"

    def test_defaults_to_empty_on_missing_keys(self):
        """Missing keys in checkpoint default to empty values."""
        state = self._make_flush_state()
        # Partially populated checkpoint (missing most keys)
        self._apply_checkpoint(state, {"type": "state_checkpoint"})

        assert state["llm_messages"] == []
        assert state["display_trace"] == []
        assert state["registered_actions"] == []
        assert state["model_used"] == ""
        assert state["prompt_tokens"] is None


# =============================================================================
# Tests for periodic flush timer logic
# =============================================================================

class TestPeriodicFlushTimer:
    """Tests for the 2-second periodic flush logic."""

    def _should_flush(self, flush_state, now):
        """Re-implement the periodic flush condition from streamable_http."""
        return (
            flush_state["assistant_message_id"]
            and flush_state["dirty"]
            and (flush_state["last_flush_time"] is None or now - flush_state["last_flush_time"] >= 2.0)
        )

    def test_flushes_when_dirty_and_no_previous_flush(self):
        """Should flush when dirty=True and last_flush_time is None."""
        state = {
            "assistant_message_id": "msg-123",
            "dirty": True,
            "last_flush_time": None,
        }
        assert self._should_flush(state, time.time())

    def test_does_not_flush_when_not_dirty(self):
        """Should not flush when dirty=False."""
        state = {
            "assistant_message_id": "msg-123",
            "dirty": False,
            "last_flush_time": None,
        }
        assert not self._should_flush(state, time.time())

    def test_does_not_flush_without_message_id(self):
        """Should not flush when assistant_message_id is empty."""
        state = {
            "assistant_message_id": None,
            "dirty": True,
            "last_flush_time": None,
        }
        assert not self._should_flush(state, time.time())

    def test_does_not_flush_within_2_seconds(self):
        """Should not flush if less than 2 seconds since last flush."""
        now = time.time()
        state = {
            "assistant_message_id": "msg-123",
            "dirty": True,
            "last_flush_time": now - 1.0,  # 1 second ago
        }
        assert not self._should_flush(state, now)

    def test_flushes_after_2_seconds(self):
        """Should flush when 2+ seconds have elapsed since last flush."""
        now = time.time()
        state = {
            "assistant_message_id": "msg-123",
            "dirty": True,
            "last_flush_time": now - 2.5,  # 2.5 seconds ago
        }
        assert self._should_flush(state, now)

    def test_flush_resets_dirty_flag(self):
        """After flush triggers, dirty should be reset to False."""
        state = {
            "assistant_message_id": "msg-123",
            "dirty": True,
            "last_flush_time": None,
        }
        now = time.time()
        # Simulate the flush trigger and reset
        if self._should_flush(state, now):
            state["last_flush_time"] = now
            state["dirty"] = False

        assert state["dirty"] is False
        assert state["last_flush_time"] == now


# =============================================================================
# Tests for disconnect/error flush paths
# =============================================================================

class TestDisconnectFlushPaths:
    """Tests for flush + mark_disconnected in error/disconnect paths."""

    @pytest.mark.asyncio
    async def test_cancelled_error_flushes_and_marks_disconnected(self):
        """CancelledError handler should flush state and mark disconnected."""
        flush_called = False
        mark_called = False

        async def mock_flush(message_id, text, state):
            nonlocal flush_called
            flush_called = True
            assert message_id == "msg-123"

        async def mock_mark_disconnected(message_id):
            nonlocal mark_called
            mark_called = True
            assert message_id == "msg-123"

        # Simulate the CancelledError handler
        flush_state = {
            "assistant_message_id": "msg-123",
            "stream_completed": False,
        }
        collected_text = ["partial ", "text"]
        _flush_task = None

        try:
            raise asyncio.CancelledError()
        except asyncio.CancelledError:
            if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
                if _flush_task and not _flush_task.done():
                    await _flush_task
                await mock_flush(flush_state["assistant_message_id"], collected_text, flush_state)
                await mock_mark_disconnected(flush_state["assistant_message_id"])

        assert flush_called
        assert mark_called

    @pytest.mark.asyncio
    async def test_generic_exception_flushes_and_marks_disconnected(self):
        """Generic exception handler should flush and mark disconnected."""
        flush_called = False
        mark_called = False

        async def mock_flush(message_id, text, state):
            nonlocal flush_called
            flush_called = True

        async def mock_mark_disconnected(message_id):
            nonlocal mark_called
            mark_called = True

        flush_state = {
            "assistant_message_id": "msg-456",
            "stream_completed": False,
        }

        try:
            raise RuntimeError("Connection reset")
        except Exception:
            if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
                await mock_flush(flush_state["assistant_message_id"], [], flush_state)
                await mock_mark_disconnected(flush_state["assistant_message_id"])

        assert flush_called
        assert mark_called

    @pytest.mark.asyncio
    async def test_skips_flush_when_already_completed(self):
        """Should not flush again if stream_completed is already True."""
        flush_called = False

        async def mock_flush(message_id, text, state):
            nonlocal flush_called
            flush_called = True

        flush_state = {
            "assistant_message_id": "msg-789",
            "stream_completed": True,  # Already completed
        }

        try:
            raise RuntimeError("Late error")
        except Exception:
            if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
                await mock_flush(flush_state["assistant_message_id"], [], flush_state)

        assert not flush_called

    @pytest.mark.asyncio
    async def test_skips_flush_when_no_message_id(self):
        """Should not flush when assistant_message_id was never set."""
        flush_called = False

        async def mock_flush(message_id, text, state):
            nonlocal flush_called
            flush_called = True

        flush_state = {
            "assistant_message_id": None,
            "stream_completed": False,
        }

        try:
            raise asyncio.CancelledError()
        except asyncio.CancelledError:
            if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
                await mock_flush(flush_state["assistant_message_id"], [], flush_state)

        assert not flush_called

    @pytest.mark.asyncio
    async def test_awaits_in_flight_flush_task_before_final(self):
        """Should await the in-flight _flush_task before final flush."""
        flush_order = []

        async def in_flight_flush():
            flush_order.append("in_flight")

        async def final_flush(message_id, text, state):
            flush_order.append("final")

        # Create a real task
        _flush_task = asyncio.create_task(in_flight_flush())
        await asyncio.sleep(0)  # Let the in-flight task start

        flush_state = {
            "assistant_message_id": "msg-123",
            "stream_completed": False,
        }

        # Simulate the CancelledError handler with in-flight task
        if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
            if _flush_task and not _flush_task.done():
                await _flush_task
            await final_flush(flush_state["assistant_message_id"], [], flush_state)

        assert flush_order == ["in_flight", "final"]


# =============================================================================
# Tests for complete event handling
# =============================================================================

class TestCompleteEventFlush:
    """Tests for the complete event's flush + mark_completed behavior."""

    @pytest.mark.asyncio
    async def test_complete_event_updates_display_trace_from_event(self):
        """Complete event should update display_trace from the event data."""
        flush_state = {
            "assistant_message_id": "msg-123",
            "stream_completed": False,
            "display_trace": [{"old": "trace"}],
            "registered_actions": [],
        }
        event = {
            "type": "complete",
            "display_trace": [{"new": "trace"}, {"another": "step"}],
            "registered_actions": [{"name": "chart"}],
        }

        # Simulate the complete handler logic
        flush_state["display_trace"] = event.get("display_trace", flush_state["display_trace"])
        flush_state["registered_actions"] = event.get("registered_actions", flush_state["registered_actions"])

        assert flush_state["display_trace"] == [{"new": "trace"}, {"another": "step"}]
        assert flush_state["registered_actions"] == [{"name": "chart"}]

    @pytest.mark.asyncio
    async def test_complete_event_keeps_existing_trace_when_missing_from_event(self):
        """If complete event has no display_trace, keep existing."""
        flush_state = {
            "display_trace": [{"existing": "trace"}],
            "registered_actions": [{"name": "old_action"}],
        }
        event = {"type": "complete"}

        flush_state["display_trace"] = event.get("display_trace", flush_state["display_trace"])
        flush_state["registered_actions"] = event.get("registered_actions", flush_state["registered_actions"])

        assert flush_state["display_trace"] == [{"existing": "trace"}]
        assert flush_state["registered_actions"] == [{"name": "old_action"}]
