"""
Tests for the unified Tool Registry system.

Tests:
1. ToolRegistry - registration, retrieval, and priority
2. Tool base class - schema generation, streaming fallback
3. Builtin tools - import and instantiation
4. Integration with loader
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from django.test import TestCase

from apps.mcp.tools.base import Tool
from apps.mcp.tools.registry import ToolRegistry, get_tool_registry


class MockTool(Tool):
    """Mock tool for testing."""
    name = "mock_tool"
    description = "A mock tool for testing"
    public = True
    supports_streaming = False
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"}
        },
        "required": ["query"]
    }

    async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
        return {"success": True, "query": arguments.get("query")}


class MockPrivateTool(Tool):
    """Mock private tool (not exposed via MCP)."""
    name = "private_tool"
    description = "A private tool"
    public = False
    input_schema = {"type": "object", "properties": {}}

    async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
        return {"success": True}


class MockStreamingTool(Tool):
    """Mock tool with streaming support."""
    name = "streaming_tool"
    description = "A streaming tool"
    public = True
    supports_streaming = True
    input_schema = {"type": "object", "properties": {}}
    annotations = {"readOnlyHint": True}
    meta = {"openai/outputTemplate": "test.html"}

    async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
        return {"success": True}

    async def execute_stream(self, help_center_config, organization, request, arguments, cancel_event=None, language: str = 'en'):
        yield {"type": "token", "text": "Hello "}
        yield {"type": "token", "text": "World"}
        yield {"type": "result", "data": {"success": True}}


class ToolRegistryTests(TestCase):
    """Unit tests for ToolRegistry class."""

    def setUp(self):
        """Create a fresh registry for each test."""
        self.registry = ToolRegistry()

    def test_register_builtin_tool(self):
        """Test registering a built-in tool."""
        tool = MockTool()
        self.registry.register_builtin(tool)

        self.assertEqual(self.registry.get_builtin_count(), 1)
        self.assertIn("mock_tool", [t.name for t in self.registry.get_all_tools()])

    def test_register_help_center_tool(self):
        """Test registering a help-center-specific tool."""
        tool = MockTool()
        config_id = "test-config-123"

        self.registry.register_help_center_tool(config_id, tool)

        # Should be accessible for that config
        all_tools = self.registry.get_all_tools(config_id)
        self.assertIn("mock_tool", [t.name for t in all_tools])

        # Should NOT be accessible for other configs (only builtin)
        other_tools = self.registry.get_all_tools("other-config")
        self.assertNotIn("mock_tool", [t.name for t in other_tools])

    def test_get_tool_priority(self):
        """Test that help-center tools override built-in tools."""
        builtin_tool = MockTool()
        hc_tool = MockTool()
        hc_tool.description = "Help center override"

        config_id = "test-config-789"

        self.registry.register_builtin(builtin_tool)
        self.registry.register_help_center_tool(config_id, hc_tool)

        # Help center tool should take priority
        tool = self.registry.get_tool("mock_tool", config_id)
        self.assertEqual(tool.description, "Help center override")

    def test_get_public_tools_filters_private(self):
        """Test that get_public_tools filters out private tools."""
        public_tool = MockTool()
        private_tool = MockPrivateTool()

        self.registry.register_builtin(public_tool)
        self.registry.register_builtin(private_tool)

        public_tools = self.registry.get_public_tools()
        tool_names = [t.name for t in public_tools]

        self.assertIn("mock_tool", tool_names)
        self.assertNotIn("private_tool", tool_names)

    def test_clear_help_center_tools(self):
        """Test clearing all tools for a help center."""
        config_id = "test-config-clear"

        self.registry.register_help_center_tool(config_id, MockTool())
        self.registry.register_help_center_tool(config_id, MockPrivateTool())

        self.registry.clear_help_center_tools(config_id)

        # Help-center-specific tools should be gone
        # (get_all_tools returns builtin + hc-specific, so should be empty if no builtins)
        tools = self.registry.get_all_tools(config_id)
        self.assertEqual(len(tools), 0)

    def test_has_tool(self):
        """Test checking if a tool exists."""
        self.registry.register_builtin(MockTool())

        self.assertTrue(self.registry.has_tool("mock_tool"))
        self.assertFalse(self.registry.has_tool("nonexistent"))

    def test_get_tool_names(self):
        """Test getting all tool names."""
        self.registry.register_builtin(MockTool())
        self.registry.register_builtin(MockPrivateTool())

        names = self.registry.get_tool_names()

        self.assertIn("mock_tool", names)
        self.assertIn("private_tool", names)


class ToolBaseClassTests(TestCase):
    """Unit tests for Tool base class functionality."""

    def test_to_mcp_schema_basic(self):
        """Test basic MCP schema generation."""
        tool = MockTool()
        schema = tool.to_mcp_schema()

        self.assertEqual(schema["name"], "mock_tool")
        self.assertEqual(schema["description"], "A mock tool for testing")
        self.assertEqual(schema["inputSchema"]["type"], "object")
        self.assertNotIn("annotations", schema)
        self.assertNotIn("_meta", schema)

    def test_to_mcp_schema_with_annotations(self):
        """Test MCP schema includes annotations when present."""
        tool = MockStreamingTool()
        schema = tool.to_mcp_schema()

        self.assertIn("annotations", schema)
        self.assertEqual(schema["annotations"]["readOnlyHint"], True)
        self.assertIn("_meta", schema)
        self.assertEqual(schema["_meta"]["openai/outputTemplate"], "test.html")

    def test_tool_repr(self):
        """Test tool string representation."""
        tool = MockTool()
        repr_str = repr(tool)

        self.assertIn("MockTool", repr_str)
        self.assertIn("mock_tool", repr_str)
        self.assertIn("public=True", repr_str)


@pytest.mark.asyncio
class AsyncToolTests:
    """Async tests for Tool execution."""

    async def test_execute_returns_result(self):
        """Test tool execution returns expected result."""
        tool = MockTool()
        result = await tool.execute(None, {"query": "test"})

        assert result["success"] is True
        assert result["query"] == "test"

    async def test_execute_stream_default_fallback(self):
        """Test default streaming falls back to execute."""
        tool = MockTool()

        events = []
        async for event in tool.execute_stream(None, None, None, {"query": "test"}):
            events.append(event)

        assert len(events) == 1
        assert events[0]["type"] == "result"
        assert events[0]["data"]["success"] is True

    async def test_execute_stream_custom_implementation(self):
        """Test custom streaming implementation."""
        tool = MockStreamingTool()

        events = []
        async for event in tool.execute_stream(None, None, None, {}):
            events.append(event)

        assert len(events) == 3
        assert events[0] == {"type": "token", "text": "Hello "}
        assert events[1] == {"type": "token", "text": "World"}
        assert events[2]["type"] == "result"


class BuiltinToolImportTests(TestCase):
    """Tests that all builtin tools can be imported and instantiated."""

    def test_import_search_tools(self):
        """Test search tools can be imported."""
        from apps.mcp.tools.builtin.search import KeywordSearchTool

        keyword = KeywordSearchTool()

        self.assertEqual(keyword.name, "keyword_search")
        self.assertTrue(keyword.public)
        self.assertTrue(keyword.supports_streaming)

    def test_import_ask_tool(self):
        """Test AskTool can be imported and instantiated."""
        from apps.mcp.tools.builtin.ask import AskTool

        ask = AskTool()

        self.assertEqual(ask.name, "ask")
        self.assertTrue(ask.public)
        self.assertTrue(ask.supports_streaming)


class GetToolRegistryTests(TestCase):
    """Tests for the global registry singleton."""

    def test_get_tool_registry_returns_singleton(self):
        """Test that get_tool_registry returns the same instance."""
        # Reset global registry first
        import apps.mcp.tools.registry as registry_module
        registry_module._registry = None

        registry1 = get_tool_registry()
        registry2 = get_tool_registry()

        self.assertIs(registry1, registry2)

    def test_get_tool_registry_has_builtin_tools(self):
        """Test that registry is initialized with builtin tools."""
        # Reset global registry first
        import apps.mcp.tools.registry as registry_module
        registry_module._registry = None

        registry = get_tool_registry()

        # Should have registered builtin tools
        self.assertGreater(registry.get_builtin_count(), 0)

        # Check for expected help center tools
        self.assertTrue(registry.has_tool("ask"))
        self.assertTrue(registry.has_tool("keyword_search"))
        self.assertTrue(registry.has_tool("suggest_questions"))
