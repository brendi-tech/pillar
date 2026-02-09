"""
Tests for generic tool call validation.

Tests the validate_tool_call function that validates tool calls
against their schemas before execution. This prevents broken payloads
from being sent to the client SDK.

Updated for simplified architecture:
- search: Find actions and documentation
- get_article: Get full article content
- interact_with_page: Interact with page elements

Note: The respond tool was removed. The model responds directly via content tokens.
Note: The execute tool was removed in favor of dynamic action tools.
"""
import pytest

from apps.mcp.services.agent_tools.definitions import (
    validate_tool_call,
    get_tool_by_name,
    AGENT_TOOLS,
)


class TestValidateToolCall:
    """Tests for validate_tool_call function."""

    def test_valid_search(self):
        """Valid search call should pass."""
        result = validate_tool_call("search", {"query": "open settings"})
        assert result["valid"] is True

    def test_valid_search_with_limit(self):
        """Valid search call with limit should pass."""
        result = validate_tool_call("search", {
            "query": "how to configure SSO?",
            "limit": 10,
        })
        assert result["valid"] is True

    def test_respond_is_unknown(self):
        """Respond is no longer a tool — should fail as unknown."""
        result = validate_tool_call("respond", {"message": "Hello, how can I help?"})
        assert result["valid"] is False
        assert "Unknown tool" in result["error"]

    def test_missing_required_param_search(self):
        """Missing required parameter in search should fail."""
        result = validate_tool_call("search", {})
        assert result["valid"] is False
        assert "Missing required parameters" in result["error"]
        assert "query" in result["error"]
        assert "hint" in result

    def test_empty_required_param(self):
        """Empty required parameter should fail."""
        result = validate_tool_call("search", {"query": ""})
        assert result["valid"] is False
        assert "cannot be empty" in result["error"]
        assert "query" in result["error"]

    def test_none_required_param(self):
        """None value for required parameter should fail."""
        result = validate_tool_call("search", {"query": None})
        assert result["valid"] is False
        assert "cannot be empty" in result["error"]

    def test_unknown_tool(self):
        """Unknown tool name should fail."""
        result = validate_tool_call("unknown_tool", {"foo": "bar"})
        assert result["valid"] is False
        assert "Unknown tool" in result["error"]
        assert "hint" in result
        assert "search" in result["hint"]

    def test_unknown_parameters(self):
        """Unknown parameters should fail."""
        result = validate_tool_call("search", {
            "query": "test",
            "unknown_param": "value"
        })
        assert result["valid"] is False
        assert "Unknown parameters" in result["error"]
        assert "unknown_param" in result["error"]

    def test_wrong_type_string_param(self):
        """Wrong type for string parameter should fail."""
        result = validate_tool_call("search", {"query": 123})
        assert result["valid"] is False
        assert "must be a string" in result["error"]

    def test_null_arguments(self):
        """None arguments should be converted to empty dict."""
        result = validate_tool_call("search", None)
        assert result["valid"] is False
        assert "Missing required parameters" in result["error"]

    def test_non_dict_arguments(self):
        """Non-dict arguments should fail."""
        result = validate_tool_call("search", "not a dict")
        assert result["valid"] is False
        assert "must be an object" in result["error"]

    def test_optional_params_allowed(self):
        """Optional parameters should be accepted."""
        result = validate_tool_call("search", {
            "query": "test",
            "limit": 10
        })
        assert result["valid"] is True


class TestGetToolByName:
    """Tests for get_tool_by_name helper."""

    def test_existing_tool_search(self):
        """Should return tool definition for search."""
        tool = get_tool_by_name("search")
        assert tool is not None
        assert tool["name"] == "search"

    def test_respond_no_longer_exists(self):
        """Respond tool was removed — should return None."""
        tool = get_tool_by_name("respond")
        assert tool is None

    def test_nonexistent_tool(self):
        """Should return None for nonexistent tool."""
        tool = get_tool_by_name("nonexistent")
        assert tool is None

    def test_old_tools_dont_exist(self):
        """Old tools from previous architectures should not exist."""
        # These tools were removed in the simplification
        assert get_tool_by_name("search_actions") is None
        assert get_tool_by_name("search_knowledge") is None
        assert get_tool_by_name("execute_query") is None
        assert get_tool_by_name("get_action_details") is None
        assert get_tool_by_name("create_plan") is None
        assert get_tool_by_name("execute_step") is None
        # execute was replaced by dynamic action tools
        assert get_tool_by_name("execute") is None
        # respond was removed — model responds directly
        assert get_tool_by_name("respond") is None


class TestAgentToolsSchema:
    """Tests to verify AGENT_TOOLS schema structure."""

    def test_all_tools_combined(self):
        """AGENT_TOOLS should contain all core + conditional tools for validation."""
        assert len(AGENT_TOOLS) == 3
        tool_names = [tool["name"] for tool in AGENT_TOOLS]
        assert set(tool_names) == {"search", "get_article", "interact_with_page"}

    def test_all_tools_have_required_fields(self):
        """All tools should have name, description, and parameters."""
        for tool in AGENT_TOOLS:
            assert "name" in tool, f"Tool missing 'name'"
            assert "description" in tool, f"Tool {tool.get('name')} missing 'description'"
            assert "parameters" in tool, f"Tool {tool.get('name')} missing 'parameters'"

    def test_all_tools_have_valid_parameters(self):
        """All tools should have valid parameter definitions."""
        for tool in AGENT_TOOLS:
            params = tool["parameters"]
            assert params["type"] == "object", f"Tool {tool['name']} params not an object"
            assert "properties" in params, f"Tool {tool['name']} missing properties"

    def test_search_tool_schema(self):
        """Search tool should have correct schema."""
        tool = get_tool_by_name("search")
        assert "query" in tool["parameters"]["required"]
        assert "query" in tool["parameters"]["properties"]
        assert "limit" in tool["parameters"]["properties"]
