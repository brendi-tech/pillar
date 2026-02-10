"""
Tests for session_resumption.py -- status transitions and resumable session lookup.

Covers:
- mark_completed: sets streaming_status='completed' with optional latency_ms
- mark_disconnected: sets streaming_status='disconnected'
- clear_disconnected_status: flips status back to 'completed'
- get_resumable_session: finds disconnected sessions, reads llm_message dict/list, builds response
"""
import pytest
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.session_resumption import (
    mark_completed,
    mark_disconnected,
    clear_disconnected_status,
    get_resumable_session,
)


# =============================================================================
# Helpers
# =============================================================================

def _mock_aupdate(return_value=1):
    """Create a mock queryset chain: .filter(...).aupdate(...) -> int."""
    mock_qs = MagicMock()
    mock_qs.filter.return_value = MagicMock()
    mock_qs.filter.return_value.aupdate = AsyncMock(return_value=return_value)
    return mock_qs


def _mock_message(
    id="msg-123",
    conversation_id="conv-456",
    content="Partial response so far...",
    llm_message=None,
    display_trace=None,
    streaming_started_at=None,
):
    msg = MagicMock()
    msg.id = id
    msg.conversation_id = conversation_id
    msg.content = content
    msg.llm_message = llm_message
    msg.display_trace = display_trace or []
    msg.streaming_started_at = streaming_started_at
    return msg


# =============================================================================
# Tests: mark_completed
# =============================================================================

class TestMarkCompleted:
    """Tests for mark_completed()."""

    @pytest.mark.asyncio
    async def test_sets_completed_status(self):
        """Should call aupdate with streaming_status='completed'."""
        mock_qs = _mock_aupdate()
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await mark_completed("msg-123")

        mock_qs.filter.assert_called_once_with(id="msg-123", role='assistant')
        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert call_kwargs["streaming_status"] == "completed"

    @pytest.mark.asyncio
    async def test_includes_latency_when_provided(self):
        """Should include latency_ms in the update when provided."""
        mock_qs = _mock_aupdate()
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await mark_completed("msg-123", latency_ms=1500)

        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert call_kwargs["latency_ms"] == 1500

    @pytest.mark.asyncio
    async def test_omits_latency_when_none(self):
        """Should not include latency_ms when it's None."""
        mock_qs = _mock_aupdate()
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await mark_completed("msg-123")

        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert "latency_ms" not in call_kwargs


# =============================================================================
# Tests: mark_disconnected
# =============================================================================

class TestMarkDisconnected:
    """Tests for mark_disconnected()."""

    @pytest.mark.asyncio
    async def test_sets_disconnected_status(self):
        """Should call aupdate with streaming_status='disconnected'."""
        mock_qs = _mock_aupdate()
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await mark_disconnected("msg-789")

        mock_qs.filter.assert_called_once_with(id="msg-789", role='assistant')
        mock_qs.filter.return_value.aupdate.assert_called_once_with(
            streaming_status='disconnected',
        )


# =============================================================================
# Tests: clear_disconnected_status
# =============================================================================

class TestClearDisconnectedStatus:
    """Tests for clear_disconnected_status()."""

    @pytest.mark.asyncio
    async def test_sets_status_to_completed(self):
        """Should flip status from disconnected to completed."""
        mock_qs = _mock_aupdate()
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await clear_disconnected_status("msg-abc")

        # No role guard -- message could be any role
        mock_qs.filter.assert_called_once_with(id="msg-abc")
        mock_qs.filter.return_value.aupdate.assert_called_once_with(
            streaming_status='completed',
        )


# =============================================================================
# Tests: get_resumable_session
# =============================================================================

class TestGetResumableSession:
    """Tests for get_resumable_session()."""

    def _mock_queryset_chain(self, assistant_msg=None, user_msg=None):
        """Build a mock ChatMessage.objects that supports the chained calls."""
        mock_qs = MagicMock()

        # Build different return values per .filter() kwargs
        def filter_side_effect(**kwargs):
            mock_filtered = MagicMock()
            if kwargs.get("streaming_status") == "disconnected":
                mock_filtered.order_by.return_value.afirst = AsyncMock(return_value=assistant_msg)
            elif kwargs.get("role") == "user":
                mock_filtered.order_by.return_value.afirst = AsyncMock(return_value=user_msg)
            else:
                mock_filtered.order_by.return_value.afirst = AsyncMock(return_value=None)
            return mock_filtered

        mock_qs.filter = MagicMock(side_effect=filter_side_effect)
        return mock_qs

    @pytest.mark.asyncio
    async def test_returns_none_when_no_disconnected_session(self):
        """Should return None if no disconnected assistant message exists."""
        mock_qs = self._mock_queryset_chain(assistant_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_session_with_dict_llm_message(self):
        """Should read new dict format {messages: [...], registered_actions: [...]}."""
        turn_messages = [
            {"role": "assistant", "tool_calls": [{"id": "tc_1", "type": "function", "function": {"name": "search", "arguments": "{}"}}]},
            {"role": "tool", "tool_call_id": "tc_1", "content": "results"},
        ]
        llm_data = {
            "messages": turn_messages,
            "registered_actions": [{"name": "open_settings"}],
        }
        assistant_msg = _mock_message(
            llm_message=llm_data,
            display_trace=[{"step_type": "thinking", "content": "reasoning"}],
        )
        user_msg = _mock_message(content="Help me with settings")
        user_msg.role = "user"

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=user_msg)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result is not None
        assert result["resumable"] is True
        assert result["llm_messages"] == turn_messages
        assert result["registered_actions"] == [{"name": "open_settings"}]
        assert result["display_trace"] == [{"step_type": "thinking", "content": "reasoning"}]
        assert result["user_message"] == "Help me with settings"
        assert result["partial_response"] == "Partial response so far..."

    @pytest.mark.asyncio
    async def test_returns_session_with_legacy_list_llm_message(self):
        """Should handle legacy list format (list of message dicts) as llm_messages."""
        turn_messages = [
            {"role": "assistant", "content": "Let me search."},
            {"role": "tool", "tool_call_id": "tc_1", "content": "results"},
        ]
        assistant_msg = _mock_message(llm_message=turn_messages)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result is not None
        # Legacy list format is returned directly as llm_messages
        assert result["llm_messages"] == turn_messages
        # No registered_actions from a list-format llm_message
        assert result["registered_actions"] == []

    @pytest.mark.asyncio
    async def test_returns_session_with_null_llm_message(self):
        """Should handle null/empty llm_message gracefully."""
        assistant_msg = _mock_message(llm_message=None)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result is not None
        assert result["llm_messages"] == []
        assert result["registered_actions"] == []
        assert result["user_message"] == ""

    @pytest.mark.asyncio
    async def test_calculates_elapsed_ms(self):
        """Should compute elapsed_ms from streaming_started_at."""
        from django.utils import timezone

        started = timezone.now() - timedelta(seconds=30)
        assistant_msg = _mock_message(streaming_started_at=started)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        # Should be ~30000ms, allow some tolerance
        assert result["elapsed_ms"] > 29000
        assert result["elapsed_ms"] < 32000

    @pytest.mark.asyncio
    async def test_elapsed_ms_zero_when_no_started_at(self):
        """Should return 0 elapsed_ms when streaming_started_at is None."""
        assistant_msg = _mock_message(streaming_started_at=None)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result["elapsed_ms"] == 0
