"""
Tests for dynamic action tool registration and execution.

The dynamic action tools feature replaces the generic 'execute' meta-tool with
native LLM tool calls. When actions are discovered via search, they are
registered as native tools that the LLM can call directly with schema enforcement.

Flow:
1. User asks question
2. LLM calls search("chart creation")
3. Search finds actions: test_chart_query, create_chart_api
4. Actions are registered as native tools
5. LLM calls test_chart_query(dataset_id=2) directly (not execute(...))
6. Backend routes to action handler

This improves parameter validation and reduces errors from the LLM.
"""
import pytest

from apps.mcp.services.agent_tools.definitions import (
    _sanitize_schema,
    action_to_tool,
    get_dynamic_tools,
    get_tools_for_api,
)
from apps.mcp.services.agent_tools.context import AgentContext


class TestActionToTool:
    """Tests for action_to_tool() converter function."""

    def test_converts_action_with_full_schema(self):
        """action_to_tool should convert action with data_schema to tool format."""
        action = {
            "name": "test_chart_query",
            "description": "Test a chart query with live data",
            "data_schema": {
                "type": "object",
                "properties": {
                    "dataset_id": {"type": "integer", "description": "Dataset ID"},
                    "metrics": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["dataset_id"],
            },
        }
        
        tool = action_to_tool(action)
        
        assert tool["type"] == "function"
        assert tool["function"]["name"] == "test_chart_query"
        assert tool["function"]["description"] == "Test a chart query with live data"
        assert tool["function"]["parameters"]["type"] == "object"
        assert "dataset_id" in tool["function"]["parameters"]["properties"]
        assert "metrics" in tool["function"]["parameters"]["properties"]
        assert "dataset_id" in tool["function"]["parameters"]["required"]

    def test_converts_action_without_schema(self):
        """action_to_tool should handle actions without data_schema."""
        action = {
            "name": "open_settings",
            "description": "Opens the settings page",
        }
        
        tool = action_to_tool(action)
        
        assert tool["type"] == "function"
        assert tool["function"]["name"] == "open_settings"
        assert tool["function"]["description"] == "Opens the settings page"
        assert tool["function"]["parameters"]["type"] == "object"
        assert tool["function"]["parameters"]["properties"] == {}

    def test_converts_action_with_empty_schema(self):
        """action_to_tool should handle actions with empty data_schema."""
        action = {
            "name": "refresh_data",
            "description": "Refreshes the data",
            "data_schema": {},
        }
        
        tool = action_to_tool(action)
        
        assert tool["function"]["name"] == "refresh_data"
        assert tool["function"]["parameters"]["type"] == "object"
        assert "properties" in tool["function"]["parameters"]

    def test_uses_schema_field_if_data_schema_missing(self):
        """action_to_tool should fall back to 'schema' field."""
        action = {
            "name": "create_item",
            "description": "Creates an item",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                },
                "required": ["name"],
            },
        }
        
        tool = action_to_tool(action)
        
        assert "name" in tool["function"]["parameters"]["properties"]


class TestGetDynamicTools:
    """Tests for get_dynamic_tools() function."""

    def test_combines_core_tools_with_actions(self):
        """get_dynamic_tools should combine core tools with action tools."""
        actions = [
            {"name": "action_one", "description": "First action"},
            {"name": "action_two", "description": "Second action"},
        ]
        
        tools = get_dynamic_tools(actions)
        
        # Should have core tools (search) + 2 action tools
        assert len(tools) == 3
        
        # Verify core tools are present
        tool_names = [t["function"]["name"] for t in tools]
        assert "search" in tool_names
        
        # Verify action tools are present
        assert "action_one" in tool_names
        assert "action_two" in tool_names

    def test_returns_core_tools_when_no_actions(self):
        """get_dynamic_tools should return just core tools when no actions."""
        tools = get_dynamic_tools([])
        
        core_tools = get_tools_for_api()
        assert len(tools) == len(core_tools)
        assert tools == core_tools

    def test_preserves_action_order_core_only(self):
        """get_dynamic_tools should preserve action order (core tools first)."""
        actions = [
            {"name": "z_action", "description": "Z"},
            {"name": "a_action", "description": "A"},
        ]
        
        tools = get_dynamic_tools(actions)
        tool_names = [t["function"]["name"] for t in tools]
        
        # Core tools should come first (search)
        assert tool_names[0] == "search"
        
        # Action tools should preserve their order
        assert tool_names[1] == "z_action"
        assert tool_names[2] == "a_action"

    def test_includes_conditional_tools_when_flagged(self):
        """get_dynamic_tools should include conditional tools when flags are set."""
        actions = [
            {"name": "my_action", "description": "An action"},
        ]
        
        tools = get_dynamic_tools(
            actions,
            include_get_article=True,
            include_interact_with_page=True,
        )
        tool_names = [t["function"]["name"] for t in tools]
        
        # Core + conditional + action
        assert len(tools) == 4
        assert tool_names[0] == "search"
        assert tool_names[1] == "get_article"
        assert tool_names[2] == "interact_with_page"
        assert tool_names[3] == "my_action"

    def test_get_article_only_when_flagged(self):
        """get_dynamic_tools should include get_article only when flagged."""
        tools_without = get_dynamic_tools([])
        tools_with = get_dynamic_tools([], include_get_article=True)
        
        names_without = {t["function"]["name"] for t in tools_without}
        names_with = {t["function"]["name"] for t in tools_with}
        
        assert "get_article" not in names_without
        assert "get_article" in names_with


class TestAgentContextRegisteredActions:
    """Tests for AgentContext registered_actions management."""

    def test_register_actions_as_tools(self):
        """register_actions_as_tools should add actions to registered list."""
        context = AgentContext()
        
        actions = [
            {"name": "action_a", "description": "A"},
            {"name": "action_b", "description": "B"},
        ]
        
        context.register_actions_as_tools(actions)
        
        assert len(context.registered_actions) == 2
        assert context.registered_actions[0]["name"] == "action_a"
        assert context.registered_actions[1]["name"] == "action_b"

    def test_register_actions_deduplicates_by_name(self):
        """register_actions_as_tools should not add duplicate actions."""
        context = AgentContext()
        
        # Register first batch
        context.register_actions_as_tools([
            {"name": "action_a", "description": "A"},
            {"name": "action_b", "description": "B"},
        ])
        
        # Register second batch with overlap
        context.register_actions_as_tools([
            {"name": "action_b", "description": "B updated"},  # Duplicate
            {"name": "action_c", "description": "C"},  # New
        ])
        
        assert len(context.registered_actions) == 3
        names = [a["name"] for a in context.registered_actions]
        assert names == ["action_a", "action_b", "action_c"]
        
        # Original description should be preserved
        action_b = next(a for a in context.registered_actions if a["name"] == "action_b")
        assert action_b["description"] == "B"  # Not "B updated"

    def test_is_action_tool_returns_true_for_registered(self):
        """is_action_tool should return True for registered actions."""
        context = AgentContext()
        context.register_actions_as_tools([
            {"name": "my_action", "description": "My action"},
        ])
        
        assert context.is_action_tool("my_action") is True
        assert context.is_action_tool("unknown_action") is False

    def test_is_action_tool_returns_false_for_base_tools(self):
        """is_action_tool should return False for base tools."""
        context = AgentContext()
        
        assert context.is_action_tool("search") is False

    def test_get_action_tools_returns_openai_format(self):
        """get_action_tools should return tools in OpenAI format."""
        context = AgentContext()
        context.register_actions_as_tools([
            {
                "name": "create_chart",
                "description": "Creates a chart",
                "data_schema": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                },
            },
        ])
        
        tools = context.get_action_tools()
        
        assert len(tools) == 1
        assert tools[0]["type"] == "function"
        assert tools[0]["function"]["name"] == "create_chart"
        assert "title" in tools[0]["function"]["parameters"]["properties"]

    def test_get_action_by_name_finds_action(self):
        """get_action_by_name should find action in found_actions."""
        context = AgentContext()
        context.found_actions = [
            {"name": "action_a", "description": "A"},
            {"name": "action_b", "description": "B"},
        ]
        
        action = context.get_action_by_name("action_b")
        
        assert action is not None
        assert action["name"] == "action_b"

    def test_get_action_by_name_returns_none_for_unknown(self):
        """get_action_by_name should return None for unknown action."""
        context = AgentContext()
        context.found_actions = [
            {"name": "action_a", "description": "A"},
        ]
        
        action = context.get_action_by_name("unknown")
        
        assert action is None

    def test_get_action_by_name_finds_registered_action(self):
        """get_action_by_name should find action in registered_actions."""
        context = AgentContext()
        context.register_actions_as_tools([
            {"name": "restored_action", "description": "From previous turn"},
        ])
        
        action = context.get_action_by_name("restored_action")
        
        assert action is not None
        assert action["name"] == "restored_action"


class TestConditionalToolFlags:
    """Tests for conditional tool unlocking on AgentContext."""

    def test_default_flags_are_false(self):
        """New AgentContext should have conditional tool flags set to False."""
        context = AgentContext()
        assert context.has_page_context is False
        assert context.get_article_unlocked is False

    def test_get_base_tools_core_only_by_default(self):
        """get_base_tools should return only core tools by default."""
        context = AgentContext()
        tools = context.get_base_tools()
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search"}

    def test_get_base_tools_with_page_context(self):
        """get_base_tools should include interact_with_page when has_page_context is True."""
        context = AgentContext()
        context.has_page_context = True
        tools = context.get_base_tools()
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "interact_with_page"}

    def test_get_base_tools_with_get_article_unlocked(self):
        """get_base_tools should include get_article when unlocked."""
        context = AgentContext()
        context.get_article_unlocked = True
        tools = context.get_base_tools()
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "get_article"}

    def test_get_base_tools_with_both_flags(self):
        """get_base_tools should include both conditional tools when both flags set."""
        context = AgentContext()
        context.has_page_context = True
        context.get_article_unlocked = True
        tools = context.get_base_tools()
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "get_article", "interact_with_page"}

    def test_knowledge_results_unlock_get_article(self):
        """Adding knowledge results should unlock get_article."""
        context = AgentContext()
        assert context.get_article_unlocked is False
        
        # Simulate what the agentic loop does after search returns knowledge
        context.add_knowledge_results(
            [{"title": "Test", "url": "https://example.com", "content": "Test content"}],
            "test query",
        )
        # The agentic loop sets this flag after add_knowledge_results
        context.get_article_unlocked = True
        
        tools = context.get_base_tools()
        tool_names = {t["function"]["name"] for t in tools}
        assert "get_article" in tool_names


class TestDynamicToolsIntegration:
    """Integration tests for dynamic action tools in the agentic loop."""

    def test_actions_from_search_become_tools(self):
        """Actions discovered via search should become available as tools."""
        context = AgentContext()
        
        # Simulate search finding actions
        search_results = [
            {
                "name": "test_query",
                "description": "Test a query",
                "action_type": "query",
                "data_schema": {
                    "type": "object",
                    "properties": {
                        "sql": {"type": "string"},
                    },
                    "required": ["sql"],
                },
            },
        ]
        
        # Add to context (as happens in agentic loop)
        context.add_action_results(search_results, "test query")
        context.register_actions_as_tools(search_results)
        
        # Verify action is now a tool
        assert context.is_action_tool("test_query") is True
        
        # Verify tool has correct schema
        tools = context.get_action_tools()
        assert len(tools) == 1
        assert tools[0]["function"]["parameters"]["required"] == ["sql"]

    def test_registered_actions_persist_across_initialization(self):
        """Actions can be passed to a new context for multi-turn persistence."""
        # First turn
        context1 = AgentContext()
        context1.register_actions_as_tools([
            {"name": "action_from_turn_1", "description": "From turn 1"},
        ])
        
        # Get registered actions for persistence
        persisted_actions = context1.registered_actions
        
        # Second turn - create new context with persisted actions
        context2 = AgentContext()
        context2.register_actions_as_tools(persisted_actions)
        
        # Actions should be available
        assert context2.is_action_tool("action_from_turn_1") is True
        assert len(context2.registered_actions) == 1


class TestSanitizeSchema:
    """Tests for _sanitize_schema() Gemini compatibility sanitizer."""

    def test_sanitizes_nested_array_without_items(self):
        """Array of arrays missing inner items should get items added (the exact Gemini failure)."""
        schema = {
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "orderby": {
                                "type": "array",
                                "items": {"type": "array"},  # Missing inner items
                            },
                        },
                    },
                },
            },
        }

        result = _sanitize_schema(schema)

        inner_items = result["properties"]["queries"]["items"]["properties"]["orderby"]["items"]
        assert "items" in inner_items
        assert inner_items["items"] == {"type": "string"}

    def test_sanitizes_object_without_properties(self):
        """Object type without properties should get properties: {} added."""
        schema = {
            "type": "object",
            "properties": {
                "extras": {"type": "object"},  # Missing properties
            },
        }

        result = _sanitize_schema(schema)

        assert result["properties"]["extras"]["properties"] == {}

    def test_sanitizes_deeply_nested_schemas(self):
        """Sanitizer should recurse through 3+ levels of nesting."""
        schema = {
            "type": "object",
            "properties": {
                "level1": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "level2": {
                                "type": "array",
                                "items": {
                                    "type": "array",  # Missing items at level 3
                                },
                            },
                        },
                    },
                },
            },
        }

        result = _sanitize_schema(schema)

        level3 = result["properties"]["level1"]["items"]["properties"]["level2"]["items"]
        assert level3["type"] == "array"
        assert "items" in level3
        assert level3["items"] == {"type": "string"}

    def test_preserves_valid_schemas(self):
        """Schemas that are already complete should pass through unchanged."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "A name"},
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string"},
                    },
                },
            },
            "required": ["name"],
        }

        result = _sanitize_schema(schema)

        assert result["properties"]["name"] == {"type": "string", "description": "A name"}
        assert result["properties"]["tags"]["items"] == {"type": "string"}
        assert result["properties"]["metadata"]["properties"]["key"] == {"type": "string"}
        assert result["required"] == ["name"]

    def test_action_to_tool_applies_sanitization(self):
        """action_to_tool should sanitize schemas before returning."""
        action = {
            "name": "test_action",
            "description": "An action with incomplete schema",
            "data_schema": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",  # Missing items
                    },
                },
            },
        }

        tool = action_to_tool(action)

        params = tool["function"]["parameters"]
        assert "items" in params["properties"]["items"]
        assert params["properties"]["items"]["items"] == {"type": "string"}

    def test_does_not_mutate_original_schema(self):
        """Sanitizer should return a new dict, not mutate the input."""
        schema = {
            "type": "object",
            "properties": {
                "data": {"type": "array"},
            },
        }

        result = _sanitize_schema(schema)

        # Original should be unchanged
        assert "items" not in schema["properties"]["data"]
        # Result should have items added
        assert "items" in result["properties"]["data"]
