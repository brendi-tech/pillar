"""
Tests for multi-turn conversation history persistence and loading.

Covers:
- _build_state_checkpoint: building checkpoint events for flush
- _load_conversation_history: loading and replaying messages from DB
  (including new dict format {messages, registered_tools} and legacy list format)
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.agent.agentic_loop import _build_state_checkpoint


class _AsyncIter:
    """Helper to create an async iterator from a list of items."""
    def __init__(self, items):
        self._items = list(items)
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item


# =============================================================================
# Fixtures: realistic message arrays that mirror the agentic loop
# =============================================================================

def _system_message():
    return {"role": "system", "content": "You are an AI assistant for Superset."}


def _user_message(text="Build me a chart about names"):
    return {"role": "user", "content": text}


def _assistant_tool_call(tool_name, arguments, tool_call_id="tc_001", content=None):
    """Standard assistant message with a tool call."""
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [{
            "id": tool_call_id,
            "type": "function",
            "function": {
                "name": tool_name,
                "arguments": json.dumps(arguments),
            },
        }],
    }


def _tool_result(tool_call_id, content):
    """Standard tool result message."""
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
    }


def _mock_agent_context(registered_tools=None, total_prompt=100, total_completion=50, peak_pct=0.25):
    """Create a mock AgentContext for checkpoint tests."""
    ctx = MagicMock()
    ctx.registered_tools = registered_tools or []
    ctx.token_budget = MagicMock()
    ctx.token_budget.total_prompt_tokens = total_prompt
    ctx.token_budget.total_completion_tokens = total_completion
    ctx.token_budget.peak_occupancy_pct = peak_pct
    return ctx


# =============================================================================
# Tests: _build_state_checkpoint
# =============================================================================

class TestBuildStateCheckpoint:
    """Tests for _build_state_checkpoint()."""

    def test_captures_turn_messages_from_start_idx(self):
        """Checkpoint includes only messages from turn_start_idx onward."""
        messages = [
            _system_message(),
            _user_message(),
            # turn_start_idx = 2
            _assistant_tool_call("search", {"query": "names"}, "tc_001"),
            _tool_result("tc_001", "Found results"),
        ]
        ctx = _mock_agent_context()
        checkpoint = _build_state_checkpoint(messages, 2, [], ctx, "gpt-4")

        assert checkpoint["type"] == "state_checkpoint"
        assert len(checkpoint["llm_messages"]) == 2
        assert checkpoint["llm_messages"][0]["role"] == "assistant"
        assert checkpoint["llm_messages"][1]["role"] == "tool"

    def test_includes_display_trace(self):
        """Checkpoint includes the full display_trace."""
        trace = [{"step_type": "thinking", "content": "reasoning..."}]
        ctx = _mock_agent_context()
        checkpoint = _build_state_checkpoint([], 0, trace, ctx, "gpt-4")

        assert checkpoint["display_trace"] == trace

    def test_includes_registered_tools(self):
        """Checkpoint includes registered tools from context."""
        actions = [{"name": "open_settings"}]
        ctx = _mock_agent_context(registered_tools=actions)
        checkpoint = _build_state_checkpoint([], 0, [], ctx, "gpt-4")

        assert checkpoint["registered_tools"] == actions

    def test_includes_token_metrics(self):
        """Checkpoint includes token usage and model info."""
        ctx = _mock_agent_context(total_prompt=500, total_completion=200, peak_pct=0.45)
        checkpoint = _build_state_checkpoint([], 0, [], ctx, "claude-4")

        assert checkpoint["model_used"] == "claude-4"
        assert checkpoint["prompt_tokens"] == 500
        assert checkpoint["completion_tokens"] == 200
        assert checkpoint["peak_context_occupancy"] == 0.45

    def test_handles_no_token_budget(self):
        """Checkpoint handles missing token budget gracefully."""
        ctx = MagicMock()
        ctx.registered_tools = []
        ctx.token_budget = None
        checkpoint = _build_state_checkpoint([], 0, [], ctx, "gpt-4")

        assert checkpoint["prompt_tokens"] is None
        assert checkpoint["completion_tokens"] is None
        assert checkpoint["peak_context_occupancy"] is None

    def test_empty_messages_produces_empty_llm_messages(self):
        """Checkpoint with empty messages and turn_start_idx=0 yields empty list."""
        ctx = _mock_agent_context()
        checkpoint = _build_state_checkpoint([], 0, [], ctx, "gpt-4")
        assert checkpoint["llm_messages"] == []

    def test_turn_start_idx_at_end_produces_empty_slice(self):
        """turn_start_idx past the end of messages produces empty llm_messages."""
        messages = [_system_message(), _user_message()]
        ctx = _mock_agent_context()
        checkpoint = _build_state_checkpoint(messages, 5, [], ctx, "gpt-4")
        assert checkpoint["llm_messages"] == []

    def test_full_multi_step_checkpoint(self):
        """Checkpoint with multiple tool calls captures entire turn."""
        messages = [
            _system_message(),
            _user_message(),
            # turn_start_idx = 2
            _assistant_tool_call("search", {"query": "names"}, "tc_001", content="Let me search."),
            _tool_result("tc_001", "Found results"),
            _assistant_tool_call("get_article", {"slug": "names"}, "tc_002"),
            _tool_result("tc_002", "Article content here"),
            {"role": "assistant", "content": "Here's what I found."},
        ]
        trace = [
            {"step_type": "thinking", "content": "reasoning"},
            {"step_type": "tool_call", "tool": "search"},
            {"step_type": "tool_result", "tool": "search"},
            {"step_type": "tool_call", "tool": "get_article"},
            {"step_type": "tool_result", "tool": "get_article"},
        ]
        ctx = _mock_agent_context(
            registered_tools=[{"name": "create_chart"}],
            total_prompt=1200,
            total_completion=400,
            peak_pct=0.67,
        )
        checkpoint = _build_state_checkpoint(messages, 2, trace, ctx, "claude-4")

        assert len(checkpoint["llm_messages"]) == 5
        assert checkpoint["llm_messages"][0]["role"] == "assistant"
        assert checkpoint["llm_messages"][-1]["role"] == "assistant"
        assert len(checkpoint["display_trace"]) == 5
        assert checkpoint["registered_tools"] == [{"name": "create_chart"}]
        assert checkpoint["model_used"] == "claude-4"
        assert checkpoint["prompt_tokens"] == 1200
        assert checkpoint["completion_tokens"] == 400
        assert checkpoint["peak_context_occupancy"] == 0.67


# =============================================================================
# Tests: _load_conversation_history (uses mock DB)
# =============================================================================

class TestLoadConversationHistory:
    """Tests for AskTool._load_conversation_history()."""

    def _make_mock_message(self, role, content, llm_message=None, display_trace=None):
        """Create a mock ChatMessage object."""
        msg = MagicMock()
        msg.id = "msg-test-id"
        msg.role = role
        msg.content = content
        msg.llm_message = llm_message
        msg.display_trace = display_trace or []
        return msg

    def _mock_queryset(self, items):
        """Create a mock Django queryset that supports async for."""
        mock_qs = MagicMock()
        mock_qs.filter.return_value.order_by.return_value = _AsyncIter(items)
        return mock_qs

    @pytest.mark.asyncio
    async def test_loads_user_messages_as_plain_content(self):
        """User messages become simple {role: 'user', content: ...} dicts."""
        user_msg = self._make_mock_message("user", "Build me a chart")

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([user_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        assert len(result) == 1
        assert result[0] == {"role": "user", "content": "Build me a chart"}

    @pytest.mark.asyncio
    async def test_loads_new_dict_format(self):
        """New dict format {messages: [...], registered_tools: [...]} is loaded correctly."""
        turn_messages = [
            _assistant_tool_call("search", {"query": "names"}, "tc_001"),
            _tool_result("tc_001", "Found results"),
            {"role": "assistant", "content": "Here are the results."},
        ]
        llm_data = {
            "messages": turn_messages,
            "registered_tools": [{"name": "open_settings"}],
        }
        assistant_msg = self._make_mock_message("assistant", "Here are the results.", llm_message=llm_data)

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        assert len(result) == 3
        assert result[0]["role"] == "assistant"
        assert "tool_calls" in result[0]
        assert result[1]["role"] == "tool"
        assert result[2] == {"role": "assistant", "content": "Here are the results."}

    @pytest.mark.asyncio
    async def test_loads_legacy_list_format(self):
        """Legacy list format (list of message dicts) is still supported."""
        turn_messages = [
            _assistant_tool_call("search", {"query": "names"}, "tc_001"),
            _tool_result("tc_001", "Found results"),
            {"role": "assistant", "content": "I found birth_names."},
        ]
        assistant_msg = self._make_mock_message(
            "assistant",
            "I found birth_names.",
            llm_message=turn_messages,
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        assert len(result) == 3
        assert result[2] == {"role": "assistant", "content": "I found birth_names."}

    @pytest.mark.asyncio
    async def test_empty_llm_message_falls_back_to_content(self):
        """Empty/null llm_message falls back to plain text content."""
        assistant_msg = self._make_mock_message(
            "assistant",
            "Simple text response.",
            llm_message=None,
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Simple text response."}

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_conversation_id(self):
        """Returns empty list when conversation_id is None."""
        from apps.mcp.tools.builtin.ask import AskTool
        tool = AskTool.__new__(AskTool)
        result = await tool._load_conversation_history(None)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_messages(self):
        """Returns empty list when no messages exist for the conversation."""
        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        assert result == []

    @pytest.mark.asyncio
    async def test_dict_format_with_empty_messages_list(self):
        """Dict format with empty messages list falls back to plain content."""
        llm_data = {"messages": [], "registered_tools": []}
        assistant_msg = self._make_mock_message(
            "assistant", "Hello from assistant", llm_message=llm_data
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # Empty messages list means nothing to extend, so no messages from this entry
        # (the dict format says "messages" is the truth -- empty means 0 messages)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_empty_dict_llm_message_falls_back(self):
        """An empty dict {} (no 'messages' key) falls back to plain content."""
        assistant_msg = self._make_mock_message(
            "assistant", "Plain response", llm_message={}
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # {} has no "messages" key so it falls through to the else/fallback
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Plain response"}

    @pytest.mark.asyncio
    async def test_multi_turn_user_and_assistant(self):
        """Multiple user and assistant messages load in order."""
        user1 = self._make_mock_message("user", "First question")
        assistant1_msgs = [
            {"role": "assistant", "content": "First answer"},
        ]
        assistant1 = self._make_mock_message(
            "assistant", "First answer",
            llm_message={"messages": assistant1_msgs, "registered_tools": []},
        )
        user2 = self._make_mock_message("user", "Follow up question")
        assistant2_msgs = [
            _assistant_tool_call("search", {"query": "followup"}, "tc_002"),
            _tool_result("tc_002", "Found it"),
            {"role": "assistant", "content": "Here you go."},
        ]
        assistant2 = self._make_mock_message(
            "assistant", "Here you go.",
            llm_message={"messages": assistant2_msgs, "registered_tools": [{"name": "chart"}]},
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([user1, assistant1, user2, assistant2])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # user1 + 1 assistant msg + user2 + 3 assistant msgs = 6
        assert len(result) == 6
        assert result[0] == {"role": "user", "content": "First question"}
        assert result[1] == {"role": "assistant", "content": "First answer"}
        assert result[2] == {"role": "user", "content": "Follow up question"}
        assert result[3]["role"] == "assistant"
        assert "tool_calls" in result[3]
        assert result[4]["role"] == "tool"
        assert result[5] == {"role": "assistant", "content": "Here you go."}

    @pytest.mark.asyncio
    async def test_empty_list_llm_message_falls_back(self):
        """Empty list [] as llm_message falls back to plain content."""
        assistant_msg = self._make_mock_message(
            "assistant", "Fallback content", llm_message=[]
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # Empty list is falsy, so it falls back to plain content
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Fallback content"}
