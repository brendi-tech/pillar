"""
Tests for streaming event schema and emitter functions.

Verifies that all progress events follow the nested schema:
    {type: 'progress', data: {kind, id, label, status, ...}}
"""
import pytest

from apps.mcp.services.agent.streaming_events import (
    emit_thinking_start,
    emit_thinking_delta,
    emit_thinking_done,
    emit_search_start,
    emit_search_complete,
    emit_generating_start,
    emit_tool_call_start,
    emit_tool_call_complete,
    emit_plan_start,
    emit_plan_complete,
    emit_action_request,
    KIND_THINKING,
    KIND_SEARCH,
    KIND_TOOL_CALL,
    KIND_PLAN,
    KIND_GENERATING,
)


class TestThinkingEvents:
    """Tests for thinking event emitters."""

    def test_thinking_start_has_required_fields(self):
        """emit_thinking_start should return event with all required fields."""
        event = emit_thinking_start()
        
        assert event["type"] == "progress"
        assert "data" in event
        assert event["data"]["kind"] == KIND_THINKING
        assert event["data"]["status"] == "active"
        assert event["data"]["label"] == "Thinking..."
        assert "id" in event["data"]
        assert len(event["data"]["id"]) > 0

    def test_thinking_start_generates_unique_ids(self):
        """Each call to emit_thinking_start should generate a unique ID."""
        event1 = emit_thinking_start()
        event2 = emit_thinking_start()
        
        assert event1["data"]["id"] != event2["data"]["id"]

    def test_thinking_delta_includes_text(self):
        """emit_thinking_delta should include the delta text."""
        start = emit_thinking_start()
        delta = emit_thinking_delta(start["data"]["id"], "Hello world")
        
        assert delta["type"] == "progress"
        assert delta["data"]["id"] == start["data"]["id"]
        assert delta["data"]["text"] == "Hello world"
        assert delta["data"]["status"] == "active"
        assert delta["data"]["kind"] == KIND_THINKING

    def test_thinking_delta_preserves_id(self):
        """emit_thinking_delta should use the provided ID."""
        test_id = "test-thinking-id-123"
        delta = emit_thinking_delta(test_id, "Some text")
        
        assert delta["data"]["id"] == test_id

    def test_thinking_done_marks_complete(self):
        """emit_thinking_done should set status to done."""
        start = emit_thinking_start()
        done = emit_thinking_done(start["data"]["id"])
        
        assert done["type"] == "progress"
        assert done["data"]["id"] == start["data"]["id"]
        assert done["data"]["status"] == "done"
        assert done["data"]["kind"] == KIND_THINKING


class TestSearchEvents:
    """Tests for search event emitters."""

    def test_search_start_includes_query(self):
        """emit_search_start should include the query in label and metadata."""
        event = emit_search_start("how to reset password")
        
        assert event["type"] == "progress"
        assert event["data"]["kind"] == KIND_SEARCH
        assert event["data"]["status"] == "active"
        assert "reset password" in event["data"]["label"]
        assert event["data"]["metadata"]["query"] == "how to reset password"
        assert "id" in event["data"]

    def test_search_complete_without_sources(self):
        """emit_search_complete should work without sources."""
        start = emit_search_start("test query")
        complete = emit_search_complete(start["data"]["id"], 5)
        
        assert complete["type"] == "progress"
        assert complete["data"]["id"] == start["data"]["id"]
        assert complete["data"]["status"] == "done"
        assert complete["data"]["kind"] == KIND_SEARCH
        assert "5" in complete["data"]["label"]
        assert complete["data"]["metadata"]["result_count"] == 5

    def test_search_complete_with_sources(self):
        """emit_search_complete should include sources as children."""
        sources = [
            {"title": "Article 1", "url": "https://example.com/1"},
            {"title": "Article 2", "url": "https://example.com/2"},
        ]
        start = emit_search_start("test")
        complete = emit_search_complete(start["data"]["id"], 2, sources)
        
        assert complete["data"]["status"] == "done"
        assert "children" in complete["data"]
        assert len(complete["data"]["children"]) == 2
        assert complete["data"]["children"][0]["label"] == "Article 1"
        assert complete["data"]["children"][0]["url"] == "https://example.com/1"

    def test_search_complete_limits_children_to_5(self):
        """emit_search_complete should limit children to 5 sources."""
        sources = [{"title": f"Article {i}", "url": f"https://example.com/{i}"} for i in range(10)]
        start = emit_search_start("test")
        complete = emit_search_complete(start["data"]["id"], 10, sources)
        
        assert len(complete["data"]["children"]) == 5

    def test_search_complete_with_query(self):
        """emit_search_complete should include query in label and metadata."""
        start = emit_search_start("create chart")
        complete = emit_search_complete(start["data"]["id"], 0, query="create chart")
        
        assert complete["data"]["status"] == "done"
        assert "create chart" in complete["data"]["label"]
        assert complete["data"]["metadata"]["query"] == "create chart"
        assert complete["data"]["metadata"]["result_count"] == 0

    def test_search_complete_zero_results_shows_query(self):
        """emit_search_complete with 0 results should show query for context."""
        start = emit_search_start("nonexistent feature")
        complete = emit_search_complete(start["data"]["id"], 0, query="nonexistent feature")
        
        # Label should include the query for context when 0 results
        assert "0 results" in complete["data"]["label"]
        assert "nonexistent feature" in complete["data"]["label"]


class TestToolCallEvents:
    """Tests for tool call event emitters."""

    def test_tool_call_start_includes_tool_name(self):
        """emit_tool_call_start should include tool name in label and metadata."""
        event = emit_tool_call_start("get_user_data", {"user_id": 123})
        
        assert event["type"] == "progress"
        assert event["data"]["kind"] == KIND_TOOL_CALL
        assert event["data"]["status"] == "active"
        # Label uses human-readable format (snake_case -> Title case)
        assert "Get user data" in event["data"]["label"]
        assert event["data"]["metadata"]["tool_name"] == "get_user_data"
        assert event["data"]["metadata"]["arguments"] == {"user_id": 123}

    def test_tool_call_start_with_no_arguments(self):
        """emit_tool_call_start should handle no arguments."""
        event = emit_tool_call_start("list_items")
        
        assert event["data"]["metadata"]["arguments"] == {}

    def test_tool_call_start_with_reasoning(self):
        """emit_tool_call_start should include reasoning in text field."""
        reasoning = "The user asked to search for datasets, so I'll call search_datasets."
        event = emit_tool_call_start("search_datasets", {"query": "sales"}, reasoning=reasoning)
        
        assert event["type"] == "progress"
        assert event["data"]["kind"] == KIND_TOOL_CALL
        assert event["data"]["status"] == "active"
        assert event["data"]["text"] == reasoning
        assert event["data"]["metadata"]["tool_name"] == "search_datasets"

    def test_tool_call_start_without_reasoning(self):
        """emit_tool_call_start should not include text field when no reasoning."""
        event = emit_tool_call_start("list_items")
        
        assert "text" not in event["data"]

    def test_tool_call_start_with_empty_reasoning(self):
        """emit_tool_call_start should not include text field for empty reasoning."""
        event = emit_tool_call_start("list_items", reasoning="")
        
        assert "text" not in event["data"]

    def test_tool_call_complete_success(self):
        """emit_tool_call_complete should set status done on success."""
        start = emit_tool_call_start("test_tool")
        complete = emit_tool_call_complete(start["data"]["id"], "test_tool", success=True)
        
        assert complete["type"] == "progress"
        assert complete["data"]["id"] == start["data"]["id"]
        assert complete["data"]["status"] == "done"
        assert complete["data"]["kind"] == KIND_TOOL_CALL
        # Label uses human-readable format
        assert "Test tool" in complete["data"]["label"]

    def test_tool_call_complete_failure(self):
        """emit_tool_call_complete should set status error on failure."""
        start = emit_tool_call_start("test_tool")
        complete = emit_tool_call_complete(start["data"]["id"], "test_tool", success=False)
        
        assert complete["data"]["status"] == "error"
        # Label uses human-readable format
        assert complete["data"]["label"] == "Failed Test tool"

    def test_tool_call_complete_success_label(self):
        """emit_tool_call_complete should show 'Completed' label on success."""
        start = emit_tool_call_start("my_action")
        complete = emit_tool_call_complete(start["data"]["id"], "my_action", success=True)
        
        # Label uses human-readable format
        assert complete["data"]["label"] == "Completed My action"


class TestPlanEvents:
    """Tests for plan event emitters."""

    def test_plan_start_has_required_fields(self):
        """emit_plan_start should return event with all required fields."""
        event = emit_plan_start()
        
        assert event["type"] == "progress"
        assert event["data"]["kind"] == KIND_PLAN
        assert event["data"]["status"] == "active"
        assert "Creating" in event["data"]["label"]
        assert "id" in event["data"]

    def test_plan_complete_without_steps(self):
        """emit_plan_complete should work without steps."""
        start = emit_plan_start()
        complete = emit_plan_complete(start["data"]["id"])
        
        assert complete["type"] == "progress"
        assert complete["data"]["id"] == start["data"]["id"]
        assert complete["data"]["status"] == "done"
        assert complete["data"]["kind"] == KIND_PLAN

    def test_plan_complete_with_steps(self):
        """emit_plan_complete should include steps as children."""
        steps = [
            {"title": "Step 1", "action": "do_something"},
            {"title": "Step 2", "action": "do_another"},
        ]
        start = emit_plan_start()
        complete = emit_plan_complete(start["data"]["id"], steps)
        
        assert complete["data"]["status"] == "done"
        assert "children" in complete["data"]
        assert len(complete["data"]["children"]) == 2
        assert complete["data"]["children"][0]["label"] == "Step 1"
        assert complete["data"]["children"][1]["label"] == "Step 2"

    def test_plan_complete_uses_action_if_no_title(self):
        """emit_plan_complete should use action name if title is missing."""
        steps = [
            {"action": "navigate_to_page"},
        ]
        start = emit_plan_start()
        complete = emit_plan_complete(start["data"]["id"], steps)
        
        assert complete["data"]["children"][0]["label"] == "navigate_to_page"


class TestGeneratingEvents:
    """Tests for generating event emitters."""

    def test_generating_start_has_required_fields(self):
        """emit_generating_start should return event with all required fields."""
        event = emit_generating_start()
        
        assert event["type"] == "progress"
        assert event["data"]["kind"] == KIND_GENERATING
        assert event["data"]["status"] == "active"
        assert "Generating" in event["data"]["label"]
        assert "id" in event["data"]


class TestEventSchemaConsistency:
    """Tests that all events follow the consistent schema."""

    @pytest.mark.parametrize("emitter,args", [
        (emit_thinking_start, ()),
        (emit_search_start, ("query",)),
        (emit_tool_call_start, ("tool_name",)),
        (emit_plan_start, ()),
        (emit_generating_start, ()),
    ])
    def test_all_start_events_have_required_fields(self, emitter, args):
        """All start events should have type, data with kind, id, label, status."""
        event = emitter(*args)
        
        assert event["type"] == "progress"
        assert "data" in event
        assert "kind" in event["data"]
        assert "id" in event["data"]
        assert "label" in event["data"]
        assert "status" in event["data"]
        assert event["data"]["status"] == "active"

    @pytest.mark.parametrize("start_emitter,complete_emitter,start_args,complete_args_extra", [
        (emit_thinking_start, emit_thinking_done, (), ()),
        (emit_search_start, lambda id, *args: emit_search_complete(id, 5, *args), ("query",), ()),
        (emit_tool_call_start, lambda id, *args: emit_tool_call_complete(id, "tool", *args), ("tool_name",), ()),
        (emit_plan_start, emit_plan_complete, (), ()),
    ])
    def test_complete_events_preserve_id(self, start_emitter, complete_emitter, start_args, complete_args_extra):
        """Complete events should use the same ID as their start events."""
        start_event = start_emitter(*start_args)
        event_id = start_event["data"]["id"]
        complete_event = complete_emitter(event_id, *complete_args_extra)
        
        assert complete_event["data"]["id"] == event_id
        assert complete_event["data"]["status"] in ["done", "error"]


class TestActionRequestEvent:
    """Tests for action_request event emitter (unified action execution)."""

    def test_action_request_has_required_fields(self):
        """emit_action_request should return event with all required fields."""
        event = emit_action_request(
            action_name="create_chart",
            parameters={"title": "My Chart"},
            action={"name": "create_chart", "action_type": "api"},
        )
        
        assert event["type"] == "action_request"
        assert event["action_name"] == "create_chart"
        assert event["parameters"] == {"title": "My Chart"}
        assert event["action"] == {"name": "create_chart", "action_type": "api"}

    def test_action_request_with_empty_parameters(self):
        """emit_action_request should handle empty parameters."""
        event = emit_action_request(
            action_name="open_settings",
            parameters={},
        )
        
        assert event["type"] == "action_request"
        assert event["action_name"] == "open_settings"
        assert event["parameters"] == {}
        assert event["action"] == {}

    def test_action_request_with_none_values(self):
        """emit_action_request should handle None parameters and action."""
        event = emit_action_request(
            action_name="test_action",
            parameters=None,
            action=None,
        )
        
        assert event["type"] == "action_request"
        assert event["action_name"] == "test_action"
        assert event["parameters"] == {}
        assert event["action"] == {}

    def test_action_request_preserves_complex_parameters(self):
        """emit_action_request should preserve complex nested parameters."""
        complex_params = {
            "nested": {"a": 1, "b": [1, 2, 3]},
            "list": [{"x": "y"}, {"z": "w"}],
            "string": "test",
        }
        event = emit_action_request(
            action_name="complex_action",
            parameters=complex_params,
        )
        
        assert event["parameters"] == complex_params
