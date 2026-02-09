"""
Tests for multi-turn conversation history persistence and loading.

Covers:
- _extract_turn_messages: extracting turn-specific messages for persistence
- _load_conversation_history: loading and replaying messages from DB
- End-to-end: persist → load round-trip produces correct LLM messages
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.agent.agentic_loop import _extract_turn_messages


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


def _assistant_parallel_tool_calls(calls, content=None):
    """Assistant message with multiple parallel tool calls."""
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [
            {
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["name"],
                    "arguments": json.dumps(tc["arguments"]),
                },
            }
            for tc in calls
        ],
    }


def _tool_result(tool_call_id, content):
    """Standard tool result message."""
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
    }


# =============================================================================
# Tests: _extract_turn_messages
# =============================================================================

class TestExtractTurnMessages:
    """Tests for _extract_turn_messages()."""

    def test_extracts_single_tool_call_turn(self):
        """Extracts a simple turn with one tool call + result + final response."""
        messages = [
            _system_message(),
            _user_message(),
            # Turn starts here (idx=2)
            _assistant_tool_call("search", {"query": "names"}, "tc_001",
                                 content="Let me search for that."),
            _tool_result("tc_001", "Found 4 results for 'names'"),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="Here are the results.")

        assert len(result) == 3  # tool_call msg + tool result + final response
        assert result[0]["role"] == "assistant"
        assert result[0]["tool_calls"][0]["function"]["name"] == "search"
        assert result[1]["role"] == "tool"
        assert result[1]["content"] == "Found 4 results for 'names'"
        assert result[2]["role"] == "assistant"
        assert result[2]["content"] == "Here are the results."

    def test_extracts_multi_iteration_turn(self):
        """Extracts a turn with multiple tool call rounds (search → query → response)."""
        messages = [
            _system_message(),
            _user_message(),
            # Turn starts here (idx=2)
            # Iteration 1: search
            _assistant_tool_call("search", {"query": "names"}, "tc_001"),
            _tool_result("tc_001", '{"actions": ["search_datasets"]}'),
            # Iteration 2: parallel dataset searches
            _assistant_parallel_tool_calls([
                {"id": "tc_002", "name": "search_datasets", "arguments": {"query": "names"}},
                {"id": "tc_003", "name": "search_datasets", "arguments": {"query": "final"}},
            ], content="Let me search for datasets."),
            _tool_result("tc_002", '{"datasets": [{"id": 2, "name": "birth_names"}]}'),
            _tool_result("tc_003", '{"datasets": []}'),
            # Iteration 3: get columns
            _assistant_tool_call("get_dataset_columns", {"dataset_id": 2}, "tc_004"),
            _tool_result("tc_004", '{"columns": ["name", "gender", "num"]}'),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="I found the birth_names dataset.")

        # 7 tool interaction messages + 1 final response
        assert len(result) == 8
        # First message is assistant with search tool call
        assert result[0]["tool_calls"][0]["function"]["name"] == "search"
        # Last message is the final response
        assert result[-1] == {"role": "assistant", "content": "I found the birth_names dataset."}
        # All tool results are present
        tool_results = [m for m in result if m["role"] == "tool"]
        assert len(tool_results) == 4

    def test_extracts_direct_response_no_tools(self):
        """When the model responds directly without tools, only the final response is extracted."""
        messages = [
            _system_message(),
            _user_message("Hello!"),
            # No tool calls — turn_start_idx = 2, nothing appended to messages
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="Hi! How can I help?")

        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Hi! How can I help?"}

    def test_preserves_parallel_tool_calls(self):
        """Parallel tool calls in a single assistant message are preserved correctly."""
        messages = [
            _system_message(),
            _user_message(),
            _assistant_parallel_tool_calls([
                {"id": "tc_a", "name": "get_columns", "arguments": {"dataset_id": 2}},
                {"id": "tc_b", "name": "get_sample", "arguments": {"dataset_id": 2, "limit": 10}},
            ]),
            _tool_result("tc_a", '{"columns": ["name", "num"]}'),
            _tool_result("tc_b", '{"sample": [{"name": "Aaron", "num": 369}]}'),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="Here's what I found.")

        assert len(result) == 4  # 1 assistant + 2 tool results + 1 final
        assert len(result[0]["tool_calls"]) == 2
        assert result[0]["tool_calls"][0]["function"]["name"] == "get_columns"
        assert result[0]["tool_calls"][1]["function"]["name"] == "get_sample"

    def test_preserves_narration_content_on_tool_calls(self):
        """The model's narration text alongside tool calls is preserved."""
        messages = [
            _system_message(),
            _user_message(),
            _assistant_tool_call("search", {"query": "charts"}, "tc_001",
                                 content="Let me search for chart-related capabilities."),
            _tool_result("tc_001", "Found results"),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="Done.")

        assert result[0]["content"] == "Let me search for chart-related capabilities."

    def test_does_not_include_system_or_user_messages(self):
        """Only this turn's tool interactions are included, not system/user/history."""
        messages = [
            _system_message(),
            # Previous turn history
            {"role": "user", "content": "What datasets exist?"},
            {"role": "assistant", "content": "I found birth_names."},
            # Current turn
            _user_message("Make a bar chart"),
            # Turn starts here (idx=4)
            _assistant_tool_call("create_bar_chart", {"name": "Top Names"}, "tc_001"),
            _tool_result("tc_001", '{"chart_id": 42}'),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=4, final_content="Chart created!")

        assert len(result) == 3
        # No system, user, or previous-turn messages
        roles = [m["role"] for m in result]
        assert "system" not in roles
        assert "user" not in roles

    def test_empty_final_content_not_appended(self):
        """If final_content is empty string, no empty assistant message is appended."""
        messages = [
            _system_message(),
            _user_message(),
            _assistant_tool_call("search", {"query": "x"}, "tc_001"),
            _tool_result("tc_001", "results"),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="")

        assert len(result) == 2  # Only tool_call + result, no empty response
        assert result[-1]["role"] == "tool"

    def test_returns_list_not_slice(self):
        """The returned value is an independent list, not a view into the original."""
        messages = [
            _system_message(),
            _user_message(),
            _assistant_tool_call("search", {"query": "x"}, "tc_001"),
            _tool_result("tc_001", "results"),
        ]

        result = _extract_turn_messages(messages, turn_start_idx=2, final_content="Done.")

        # Mutating the result should not affect original messages
        result.append({"role": "user", "content": "extra"})
        assert len(messages) == 4  # Original unchanged


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
    async def test_loads_assistant_with_list_llm_message(self):
        """Assistant messages with list llm_message are extended into history."""
        turn_messages = [
            _assistant_tool_call("search_datasets", {"query": "names"}, "tc_001"),
            _tool_result("tc_001", '{"datasets": [{"id": 2}]}'),
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

        # All 3 turn messages should be extended into history
        assert len(result) == 3
        assert result[0]["role"] == "assistant"
        assert "tool_calls" in result[0]
        assert result[1]["role"] == "tool"
        assert result[2] == {"role": "assistant", "content": "I found birth_names."}

    @pytest.mark.asyncio
    async def test_legacy_dict_llm_message_falls_back_to_content(self):
        """Old-format dict llm_message falls back to plain text content."""
        legacy_llm_message = {
            "type": "message",
            "role": "assistant",
            "id": "msg_abc",
            "status": "completed",
            "content": [{"type": "output_text", "text": "Old format response."}],
        }
        assistant_msg = self._make_mock_message(
            "assistant",
            "Old format response.",
            llm_message=legacy_llm_message,
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # Should fall back to plain content, not the broken OpenRouter format
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Old format response."}

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
    async def test_skips_tool_role_messages(self):
        """Tool-role ChatMessage rows are skipped (data is in assistant's llm_message)."""
        user_msg = self._make_mock_message("user", "Hello")
        tool_msg = self._make_mock_message("tool", "some tool result")
        assistant_msg = self._make_mock_message(
            "assistant",
            "Response.",
            llm_message=[{"role": "assistant", "content": "Response."}],
        )

        with patch("apps.analytics.models.ChatMessage") as MockChatMessage:
            MockChatMessage.Role.USER = "user"
            MockChatMessage.Role.ASSISTANT = "assistant"
            MockChatMessage.Role.TOOL = "tool"
            MockChatMessage.objects = self._mock_queryset([user_msg, tool_msg, assistant_msg])

            from apps.mcp.tools.builtin.ask import AskTool
            tool = AskTool.__new__(AskTool)
            result = await tool._load_conversation_history("conv-123")

        # Tool message should be skipped, only user + assistant's turn messages
        roles = [m["role"] for m in result]
        assert roles == ["user", "assistant"]

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


# =============================================================================
# Tests: round-trip (extract → load produces correct conversation)
# =============================================================================

class TestTurnHistoryRoundTrip:
    """
    Tests that the full persist→load cycle produces a correct conversation.
    
    Simulates: Turn 1 agent runs, we extract turn messages, then on Turn 2
    we load them back and verify the LLM gets the right context.
    """

    def test_round_trip_preserves_tool_context(self):
        """
        Simulates the birth_names scenario:
        Turn 1 discovers dataset, inspects columns, gets sample data.
        The extracted messages should give Turn 2 full context.
        """
        # Simulate Turn 1's messages array after agentic loop
        columns_result = json.dumps({
            "success": True,
            "id": 2,
            "name": "birth_names",
            "columns": [
                {"name": "name", "type": "VARCHAR(255)"},
                {"name": "gender", "type": "VARCHAR(16)"},
                {"name": "num", "type": "BIGINT"},
                {"name": "ds", "type": "DATETIME"},
            ],
            "metrics": [
                {"name": "count", "expression": "COUNT(*)"},
                {"name": "sum__num", "expression": "SUM(num)"},
            ],
        })
        sample_result = json.dumps({
            "success": True,
            "sample": [
                {"name": "Aaron", "num": 369, "gender": "boy"},
                {"name": "Amy", "num": 494, "gender": "girl"},
            ],
        })

        messages = [
            _system_message(),
            _user_message("Build me a chart about names"),
            # turn_start_idx = 2
            # Iteration 1: search
            _assistant_tool_call("search", {"query": "names dataset"}, "tc_search",
                                 content="Let me search for relevant datasets."),
            _tool_result("tc_search", "Actions found: search_datasets, get_dataset_columns"),
            # Iteration 2: search datasets
            _assistant_tool_call("search_datasets", {"query": "names"}, "tc_sd",
                                 content="Let me search for datasets."),
            _tool_result("tc_sd", json.dumps({
                "datasets": [{"id": 2, "name": "birth_names"}],
            })),
            # Iteration 3: parallel columns + sample
            _assistant_parallel_tool_calls([
                {"id": "tc_cols", "name": "get_dataset_columns", "arguments": {"dataset_id": 2}},
                {"id": "tc_samp", "name": "get_sample_data", "arguments": {"dataset_id": 2, "limit": 5}},
            ], content="Let me explore that dataset."),
            _tool_result("tc_cols", columns_result),
            _tool_result("tc_samp", sample_result),
        ]

        final_response = (
            "I found the **birth_names** dataset with columns: name, gender, num, ds.\n"
            "Would you like a bar chart of top names by total births?"
        )

        # Extract turn messages (what gets persisted)
        turn_messages = _extract_turn_messages(messages, turn_start_idx=2, final_content=final_response)

        # Verify structure
        assert len(turn_messages) == 8  # 3 assistant + 4 tool results + 1 final

        # Verify all tool results are present with full data
        tool_results = [m for m in turn_messages if m["role"] == "tool"]
        assert len(tool_results) == 4

        # The columns data should be in there verbatim
        cols_msg = next(m for m in tool_results if m["tool_call_id"] == "tc_cols")
        assert "birth_names" in cols_msg["content"]
        assert "VARCHAR(255)" in cols_msg["content"]

        # The sample data should be in there
        samp_msg = next(m for m in tool_results if m["tool_call_id"] == "tc_samp")
        assert "Aaron" in samp_msg["content"]

        # Final response is last
        assert turn_messages[-1] == {"role": "assistant", "content": final_response}

        # Now simulate Turn 2: build_agentic_prompt would do:
        # messages = [system] + conversation_history + [user_turn2]
        # The conversation_history would be:
        # [user_turn1] + turn_messages (from llm_message) + [user_turn2]
        turn2_messages = [
            _system_message(),
            _user_message("Build me a chart about names"),  # Turn 1 user
            *turn_messages,                                  # Turn 1 assistant (from DB)
            _user_message("Top baby names by total births"),  # Turn 2 user
        ]

        # Verify the LLM now sees the full context
        # It should know about birth_names (id=2), its columns, and sample data
        all_content = " ".join(
            m.get("content", "") or ""
            for m in turn2_messages
        )
        assert "birth_names" in all_content
        assert "VARCHAR(255)" in all_content
        assert "Aaron" in all_content
        assert "COUNT(*)" in all_content

        # Verify tool_calls are present (LLM needs these for conversation coherence)
        assistant_with_tools = [
            m for m in turn2_messages
            if m.get("role") == "assistant" and m.get("tool_calls")
        ]
        assert len(assistant_with_tools) == 3  # search, search_datasets, parallel cols+sample

    def test_round_trip_simple_text_response(self):
        """Turn with no tool calls just produces a single assistant message."""
        messages = [
            _system_message(),
            _user_message("Hello!"),
        ]

        turn_messages = _extract_turn_messages(messages, turn_start_idx=2, final_content="Hi! How can I help?")

        assert turn_messages == [{"role": "assistant", "content": "Hi! How can I help?"}]

        # On next turn, this extends correctly
        turn2_messages = [
            _system_message(),
            _user_message("Hello!"),
            *turn_messages,
            _user_message("What datasets do you have?"),
        ]

        roles = [m["role"] for m in turn2_messages]
        assert roles == ["system", "user", "assistant", "user"]

    def test_round_trip_all_messages_standard_format(self):
        """All extracted messages use standard chat completions format (no provider-specific fields)."""
        messages = [
            _system_message(),
            _user_message(),
            _assistant_tool_call("search", {"query": "test"}, "tc_001"),
            _tool_result("tc_001", "results"),
        ]

        turn_messages = _extract_turn_messages(messages, turn_start_idx=2, final_content="Done.")

        for msg in turn_messages:
            # Every message must have 'role'
            assert "role" in msg
            # No OpenRouter Responses API fields
            assert "type" not in msg or msg.get("type") == "function"  # type only on tool_calls items
            assert "status" not in msg
            assert "id" not in msg or msg["role"] != "assistant"  # no top-level id on assistant msgs
            # Assistant messages have either content or tool_calls (or both)
            if msg["role"] == "assistant":
                has_content = bool(msg.get("content"))
                has_tools = bool(msg.get("tool_calls"))
                assert has_content or has_tools
