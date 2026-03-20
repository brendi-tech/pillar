"""
Tests for session_resumption.py -- status transitions and resumable session lookup.

Covers:
- mark_completed: sets streaming_status='completed' with optional latency_ms
- mark_disconnected: sets streaming_status='disconnected'
- clear_disconnected_status: flips status back to 'completed'
- get_resumable_session: finds disconnected sessions, delegates to load_conversation_history
- load_conversation_history: stitches full history from ChatMessage rows
- get_latest_session: thin wrapper returning the shape for recovery paths
"""
import pytest
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.session_resumption import (
    mark_completed,
    mark_disconnected,
    clear_disconnected_status,
    create_turn_messages,
    finalize_turn,
    get_resumable_session,
    get_latest_session,
    load_conversation_history,
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
    """Tests for get_resumable_session().

    History fields (llm_messages, registered_tools) are now sourced from
    load_conversation_history; these tests mock that function and focus
    on the metadata extraction and delegation.
    """

    def _mock_queryset_chain(self, assistant_msg=None, user_msg=None):
        """Build a mock ChatMessage.objects that supports the chained calls."""
        mock_qs = MagicMock()

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
    async def test_returns_session_with_history_from_load(self):
        """Should combine metadata from the message with history from load_conversation_history."""
        assistant_msg = _mock_message(
            display_trace=[{"step_type": "thinking", "content": "reasoning"}],
        )
        user_msg = _mock_message(content="Help me with settings")
        user_msg.role = "user"

        fake_history = {
            "messages": [{"role": "user", "content": "Help me with settings"}],
            "registered_tools": [{"name": "open_settings"}],
        }

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=user_msg)
        with patch("apps.analytics.models.ChatMessage") as MockCM, \
             patch(
                 "apps.mcp.services.session_resumption.load_conversation_history",
                 new_callable=AsyncMock,
                 return_value=fake_history,
             ):
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result is not None
        assert result["resumable"] is True
        assert result["llm_messages"] == fake_history["messages"]
        assert result["registered_tools"] == [{"name": "open_settings"}]
        assert "registered_actions" not in result
        assert result["display_trace"] == [{"step_type": "thinking", "content": "reasoning"}]
        assert result["user_message"] == "Help me with settings"
        assert result["partial_response"] == "Partial response so far..."

    @pytest.mark.asyncio
    async def test_calculates_elapsed_ms(self):
        """Should compute elapsed_ms from streaming_started_at."""
        from django.utils import timezone

        started = timezone.now() - timedelta(seconds=30)
        assistant_msg = _mock_message(streaming_started_at=started)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM, \
             patch(
                 "apps.mcp.services.session_resumption.load_conversation_history",
                 new_callable=AsyncMock,
                 return_value={"messages": [], "registered_tools": []},
             ):
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result["elapsed_ms"] > 29000
        assert result["elapsed_ms"] < 32000

    @pytest.mark.asyncio
    async def test_elapsed_ms_zero_when_no_started_at(self):
        """Should return 0 elapsed_ms when streaming_started_at is None."""
        assistant_msg = _mock_message(streaming_started_at=None)

        mock_qs = self._mock_queryset_chain(assistant_msg=assistant_msg, user_msg=None)
        with patch("apps.analytics.models.ChatMessage") as MockCM, \
             patch(
                 "apps.mcp.services.session_resumption.load_conversation_history",
                 new_callable=AsyncMock,
                 return_value={"messages": [], "registered_tools": []},
             ):
            MockCM.objects = mock_qs
            result = await get_resumable_session("conv-123")

        assert result["elapsed_ms"] == 0


# =============================================================================
# Shared async-iterator helper for load_conversation_history / get_latest_session
# =============================================================================

def _make_chat_msg(role, content="", llm_message=None):
    msg = MagicMock()
    msg.role = role
    msg.content = content
    msg.llm_message = llm_message
    msg.id = f"msg-{id(msg)}"
    msg.conversation_id = "conv-123"
    return msg


def _mock_chat_queryset(messages):
    """Mock ChatMessage.objects.filter(...).order_by('timestamp') as an async iterator."""
    mock_qs = MagicMock()

    class AsyncIter:
        def __init__(self, items):
            self._items = list(items)
            self._idx = 0
        def __aiter__(self):
            return self
        async def __anext__(self):
            if self._idx >= len(self._items):
                raise StopAsyncIteration
            item = self._items[self._idx]
            self._idx += 1
            return item

    mock_filtered = MagicMock()
    mock_filtered.order_by.return_value = AsyncIter(messages)
    mock_qs.filter.return_value = mock_filtered
    return mock_qs


# =============================================================================
# Tests: load_conversation_history
# =============================================================================

class TestLoadConversationHistory:
    """Tests for load_conversation_history() -- the shared history loader."""

    @pytest.mark.asyncio
    async def test_returns_empty_for_none_conversation_id(self):
        result = await load_conversation_history(None)
        assert result == {"messages": [], "registered_tools": []}

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_messages(self):
        mock_qs = _mock_chat_queryset([])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")
        assert result == {"messages": [], "registered_tools": []}

    @pytest.mark.asyncio
    async def test_stitches_user_and_assistant_turns(self):
        """Should iterate all ChatMessages and stitch user + assistant turns."""
        user1 = _make_chat_msg("user", content="Create a plan called Pro")
        assistant1_turn = [
            {"role": "assistant", "tool_calls": [{"id": "tc_1", "function": {"name": "search"}}]},
            {"role": "tool", "tool_call_id": "tc_1", "content": "results"},
            {"role": "assistant", "tool_calls": [{"id": "tc_2", "function": {"name": "create_plan"}}]},
        ]
        assistant1 = _make_chat_msg(
            "assistant",
            llm_message={
                "messages": assistant1_turn,
                "registered_tools": [{"name": "create_plan"}, {"name": "list_plans"}],
            },
        )

        mock_qs = _mock_chat_queryset([user1, assistant1])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.Role = MagicMock()
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")

        assert len(result["messages"]) == 4  # 1 user + 3 assistant turn
        assert result["messages"][0] == {"role": "user", "content": "Create a plan called Pro"}
        assert result["messages"][1:] == assistant1_turn
        assert result["registered_tools"] == [{"name": "create_plan"}, {"name": "list_plans"}]

    @pytest.mark.asyncio
    async def test_multi_turn_conversation(self):
        """Should combine multiple user/assistant turns into one history."""
        user1 = _make_chat_msg("user", content="Hi")
        turn1 = [{"role": "assistant", "content": "Hello!"}]
        assistant1 = _make_chat_msg("assistant", llm_message={"messages": turn1, "registered_tools": []})

        user2 = _make_chat_msg("user", content="Create a plan")
        turn2 = [
            {"role": "assistant", "tool_calls": [{"id": "tc_1", "function": {"name": "create_plan"}}]},
        ]
        assistant2 = _make_chat_msg(
            "assistant",
            llm_message={
                "messages": turn2,
                "registered_tools": [{"name": "create_plan"}],
            },
        )

        mock_qs = _mock_chat_queryset([user1, assistant1, user2, assistant2])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.Role = MagicMock()
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")

        assert len(result["messages"]) == 4  # user1 + turn1 + user2 + turn2
        assert result["registered_tools"] == [{"name": "create_plan"}]

    @pytest.mark.asyncio
    async def test_legacy_list_format(self):
        """Should handle legacy list-format llm_message."""
        legacy_turns = [
            {"role": "assistant", "content": "Let me search."},
            {"role": "tool", "tool_call_id": "tc_1", "content": "results"},
        ]
        assistant = _make_chat_msg("assistant", llm_message=legacy_turns)

        mock_qs = _mock_chat_queryset([assistant])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.Role = MagicMock()
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")

        assert result["messages"] == legacy_turns
        assert result["registered_tools"] == []

    @pytest.mark.asyncio
    async def test_fallback_to_plain_content(self):
        """Should use msg.content when llm_message has no 'messages' key."""
        assistant = _make_chat_msg(
            "assistant", content="Simple answer", llm_message={},
        )

        mock_qs = _mock_chat_queryset([assistant])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.Role = MagicMock()
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")

        assert result["messages"] == [{"role": "assistant", "content": "Simple answer"}]

    @pytest.mark.asyncio
    async def test_registered_tools_from_latest_assistant(self):
        """registered_tools should reflect the most recent assistant message."""
        a1 = _make_chat_msg("assistant", llm_message={
            "messages": [{"role": "assistant", "content": "first"}],
            "registered_tools": [{"name": "old_tool"}],
        })
        a2 = _make_chat_msg("assistant", llm_message={
            "messages": [{"role": "assistant", "content": "second"}],
            "registered_tools": [{"name": "new_tool"}],
        })

        mock_qs = _mock_chat_queryset([a1, a2])
        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.Role = MagicMock()
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.objects = mock_qs
            result = await load_conversation_history("conv-123")

        assert result["registered_tools"] == [{"name": "new_tool"}]


# =============================================================================
# Tests: get_latest_session
# =============================================================================

class TestGetLatestSession:
    """get_latest_session() delegates to load_conversation_history()."""

    @pytest.mark.asyncio
    async def test_returns_none_when_no_messages(self):
        with patch(
            "apps.mcp.services.session_resumption.load_conversation_history",
            new_callable=AsyncMock,
            return_value={"messages": [], "registered_tools": []},
        ):
            result = await get_latest_session("conv-123")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_session_dict(self):
        fake_messages = [{"role": "user", "content": "hi"}]
        fake_tools = [{"name": "search"}]
        with patch(
            "apps.mcp.services.session_resumption.load_conversation_history",
            new_callable=AsyncMock,
            return_value={"messages": fake_messages, "registered_tools": fake_tools},
        ):
            result = await get_latest_session("conv-123")

        assert result is not None
        assert result["llm_messages"] == fake_messages
        assert result["registered_tools"] == fake_tools
        assert result["conversation_id"] == "conv-123"


# =============================================================================
# Tests: create_turn_messages
# =============================================================================

class TestCreateTurnMessages:
    """Tests for create_turn_messages() -- creates user + assistant ChatMessage rows."""

    @pytest.mark.asyncio
    async def test_creates_user_and_assistant_messages(self):
        """Should call acreate twice: once for user, once for assistant."""
        mock_qs = MagicMock()
        mock_qs.acreate = AsyncMock()

        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.StreamingStatus.STREAMING = "streaming"

            result = await create_turn_messages(
                conversation_id="conv-abc",
                organization_id="org-1",
                product_id="prod-1",
                user_text="Hello world",
                channel="slack",
            )

        assert mock_qs.acreate.call_count == 2

        user_call = mock_qs.acreate.call_args_list[0]
        assert user_call[1]["conversation_id"] == "conv-abc"
        assert user_call[1]["role"] == "user"
        assert user_call[1]["content"] == "Hello world"
        assert user_call[1]["organization_id"] == "org-1"
        assert user_call[1]["product_id"] == "prod-1"

        assistant_call = mock_qs.acreate.call_args_list[1]
        assert assistant_call[1]["role"] == "assistant"
        assert assistant_call[1]["content"] == ""
        assert assistant_call[1]["streaming_status"] == "streaming"

        assert isinstance(result, str)
        assert len(result) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_returns_assistant_message_id(self):
        """The returned ID should match the assistant message's id."""
        created_ids = []
        mock_qs = MagicMock()

        async def capture_acreate(**kwargs):
            created_ids.append(kwargs.get("id"))

        mock_qs.acreate = AsyncMock(side_effect=capture_acreate)

        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            MockCM.Role.USER = "user"
            MockCM.Role.ASSISTANT = "assistant"
            MockCM.StreamingStatus.STREAMING = "streaming"

            result = await create_turn_messages(
                conversation_id="conv-1",
                organization_id="org-1",
                product_id="prod-1",
                user_text="test",
            )

        assert result == created_ids[1]


# =============================================================================
# Tests: finalize_turn
# =============================================================================

class TestFinalizeTurn:
    """Tests for finalize_turn() -- persists final state to assistant ChatMessage."""

    @pytest.mark.asyncio
    async def test_updates_assistant_message(self):
        """Should call aupdate with content, llm_message, and streaming_status."""
        mock_qs = _mock_aupdate()

        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await finalize_turn(
                assistant_message_id="ast-123",
                response_text="Here is the answer.",
                llm_messages=[{"role": "assistant", "content": "Here is the answer."}],
                registered_tools=[{"name": "search"}],
            )

        mock_qs.filter.assert_called_once_with(id="ast-123", role="assistant")
        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert call_kwargs["content"] == "Here is the answer."
        assert call_kwargs["streaming_status"] == "completed"
        assert call_kwargs["llm_message"]["messages"] == [
            {"role": "assistant", "content": "Here is the answer."}
        ]
        assert call_kwargs["llm_message"]["registered_tools"] == [{"name": "search"}]

    @pytest.mark.asyncio
    async def test_includes_model_used_when_provided(self):
        """Should include model_used in the update when non-empty."""
        mock_qs = _mock_aupdate()

        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await finalize_turn(
                assistant_message_id="ast-456",
                response_text="answer",
                llm_messages=[],
                registered_tools=[],
                model_used="gpt-4o",
            )

        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert call_kwargs["model_used"] == "gpt-4o"

    @pytest.mark.asyncio
    async def test_omits_model_used_when_empty(self):
        """Should not include model_used when it's empty."""
        mock_qs = _mock_aupdate()

        with patch("apps.analytics.models.ChatMessage") as MockCM:
            MockCM.objects = mock_qs
            await finalize_turn(
                assistant_message_id="ast-789",
                response_text="answer",
                llm_messages=[],
                registered_tools=[],
                model_used="",
            )

        call_kwargs = mock_qs.filter.return_value.aupdate.call_args[1]
        assert "model_used" not in call_kwargs
