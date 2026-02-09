"""
Tests for the MCP tools loader and build_tools_list.

Tests:
1. load_all_tools_for_help_center - loads builtin tools for a help center
2. build_tools_list - returns MCP schema format
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from django.test import TestCase


@pytest.mark.asyncio
class TestLoadAllToolsForHelpCenter:
    """Tests for load_all_tools_for_help_center function."""

    @patch('apps.mcp.tools.loader.get_tool_registry')
    async def test_clears_and_reloads_config_tools(self, mock_get_registry):
        """Test that load_all_tools_for_help_center clears existing tools first."""
        from apps.mcp.tools.loader import load_all_tools_for_help_center

        mock_registry = MagicMock()
        mock_registry.get_all_tools.return_value = []
        mock_get_registry.return_value = mock_registry

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        await load_all_tools_for_help_center(mock_config)

        # Should clear help center tools before loading
        mock_registry.clear_help_center_tools.assert_called_once_with("test-config-123")

    @patch('apps.mcp.tools.loader.get_tool_registry')
    async def test_returns_all_tools_for_help_center(self, mock_get_registry):
        """Test that load_all_tools_for_help_center returns tools from registry."""
        from apps.mcp.tools.loader import load_all_tools_for_help_center
        from apps.mcp.tools.base import Tool

        # Create a mock tool
        class MockTool(Tool):
            name = "test_tool"
            description = "Test description"
            public = True
            input_schema = {"type": "object", "properties": {}}

            async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
                return {"success": True}

        mock_tool = MockTool()
        mock_registry = MagicMock()
        mock_registry.get_all_tools.return_value = [mock_tool]
        mock_get_registry.return_value = mock_registry

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        result = await load_all_tools_for_help_center(mock_config)

        assert len(result) == 1
        assert result[0].name == "test_tool"
        mock_registry.get_all_tools.assert_called_with("test-config-123")


@pytest.mark.asyncio
class TestBuildToolsList:
    """Tests for build_tools_list function."""

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_returns_tools_dict(self, mock_get_registry, mock_load_tools):
        """Test that build_tools_list returns proper format."""
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list
        from apps.mcp.tools.base import Tool

        # Create a mock tool
        class MockTool(Tool):
            name = "test_tool"
            description = "Test description"
            public = True
            input_schema = {"type": "object", "properties": {}}

            async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
                return {"success": True}

        mock_tool = MockTool()
        mock_registry = MagicMock()
        mock_registry.get_public_tools.return_value = [mock_tool]
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        result = await build_tools_list(mock_config)

        assert "tools" in result
        assert len(result["tools"]) == 1
        assert result["tools"][0]["name"] == "test_tool"
        assert result["tools"][0]["description"] == "Test description"
        assert "inputSchema" in result["tools"][0]

    async def test_returns_empty_for_no_config(self):
        """Test that build_tools_list returns empty list when no config."""
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list

        result = await build_tools_list(None)

        assert result == {"tools": []}

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_includes_annotations_and_meta(self, mock_get_registry, mock_load_tools):
        """Test that tools with annotations/meta include them in schema."""
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list
        from apps.mcp.tools.base import Tool

        class AnnotatedTool(Tool):
            name = "annotated_tool"
            description = "Tool with metadata"
            public = True
            input_schema = {"type": "object", "properties": {}}
            annotations = {"readOnlyHint": True, "categories": ["test"]}
            meta = {"openai/outputTemplate": "test.html"}

            async def execute(self, help_center_config, arguments, request=None, language: str = 'en'):
                return {"success": True}

        mock_tool = AnnotatedTool()
        mock_registry = MagicMock()
        mock_registry.get_public_tools.return_value = [mock_tool]
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        result = await build_tools_list(mock_config)

        tool_schema = result["tools"][0]
        assert "annotations" in tool_schema
        assert tool_schema["annotations"]["readOnlyHint"] is True
        assert "_meta" in tool_schema
        assert tool_schema["_meta"]["openai/outputTemplate"] == "test.html"

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    async def test_handles_load_error_gracefully(self, mock_load_tools):
        """Test that errors during loading return empty tools list."""
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list

        mock_load_tools.side_effect = Exception("Database error")

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        result = await build_tools_list(mock_config)

        # Should return empty list, not crash
        assert result == {"tools": []}
