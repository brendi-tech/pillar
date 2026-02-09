"""
Tests for the MCP tools dispatcher.

Tests:
1. dispatch_tool_call - non-streaming tool execution
2. dispatch_tool_call_stream - streaming tool execution
3. Tool lookup via registry
4. Error handling for unknown tools
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from django.test import TestCase

from apps.mcp.tools.base import Tool


class MockTool(Tool):
    """Mock tool for testing dispatcher."""
    name = "mock_tool"
    description = "A mock tool"
    public = True
    supports_streaming = False
    input_schema = {"type": "object", "properties": {}}

    async def execute(self, help_center_config, arguments, request=None, language='en'):
        return {
            "success": True,
            "result": f"Executed with args: {arguments}"
        }


class MockStreamingTool(Tool):
    """Mock streaming tool for testing."""
    name = "streaming_mock"
    description = "A streaming mock tool"
    public = True
    supports_streaming = True
    input_schema = {"type": "object", "properties": {}}

    async def execute(self, help_center_config, arguments, request=None, language='en'):
        return {"success": True}

    async def execute_stream(self, help_center_config, organization, request, arguments, cancel_event=None, language='en'):
        yield {"type": "token", "text": "Hello"}
        yield {"type": "token", "text": " World"}
        yield {"type": "complete"}


@pytest.mark.asyncio
class TestDispatchToolCall:
    """Tests for dispatch_tool_call function."""

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_dispatch_known_tool(self, mock_get_registry, mock_load_tools):
        """Test dispatching a known tool."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call

        # Setup mocks
        mock_tool = MockTool()
        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = mock_tool
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        # Call dispatcher
        result = await dispatch_tool_call(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "mock_tool", "arguments": {"foo": "bar"}}
        )

        # Verify
        assert result["success"] is True
        assert "bar" in result["result"]
        mock_load_tools.assert_called_once_with(mock_config)
        mock_registry.get_tool.assert_called_with("mock_tool", "test-config-123")

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_dispatch_unknown_tool_raises(self, mock_get_registry, mock_load_tools):
        """Test that unknown tool raises ValueError."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call

        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = None  # Tool not found
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        with pytest.raises(ValueError, match="Unknown tool"):
            await dispatch_tool_call(
                help_center_config=mock_config,
                organization=None,
                request=None,
                params={"name": "nonexistent_tool", "arguments": {}}
            )

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_dispatch_handles_tool_error(self, mock_get_registry, mock_load_tools):
        """Test that tool execution errors are caught and returned."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call

        # Create a tool that raises an exception
        failing_tool = MockTool()
        failing_tool.execute = AsyncMock(side_effect=Exception("Tool exploded"))

        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = failing_tool
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        result = await dispatch_tool_call(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "mock_tool", "arguments": {}}
        )

        assert result["success"] is False
        assert "Tool exploded" in result["error"]
        assert result["isError"] is True


@pytest.mark.asyncio
class TestDispatchToolCallStream:
    """Tests for dispatch_tool_call_stream function."""

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_stream_with_streaming_tool(self, mock_get_registry, mock_load_tools):
        """Test streaming dispatch with a tool that supports streaming."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call_stream

        mock_tool = MockStreamingTool()
        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = mock_tool
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        events = []
        async for event in dispatch_tool_call_stream(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "streaming_mock", "arguments": {}}
        ):
            events.append(event)

        assert len(events) == 3
        assert events[0]["type"] == "token"
        assert events[0]["text"] == "Hello"
        assert events[1]["type"] == "token"
        assert events[1]["text"] == " World"
        assert events[2]["type"] == "complete"

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_stream_fallback_for_non_streaming_tool(self, mock_get_registry, mock_load_tools):
        """Test that non-streaming tools fall back to execute()."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call_stream

        mock_tool = MockTool()  # supports_streaming = False
        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = mock_tool
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        events = []
        async for event in dispatch_tool_call_stream(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "mock_tool", "arguments": {"test": "value"}}
        ):
            events.append(event)

        # Should get a single result event
        assert len(events) == 1
        assert events[0]["type"] == "result"
        assert events[0]["data"]["success"] is True

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_stream_unknown_tool_yields_error(self, mock_get_registry, mock_load_tools):
        """Test that unknown tool yields an error event."""
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call_stream

        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = None
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        events = []
        async for event in dispatch_tool_call_stream(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "nonexistent", "arguments": {}}
        ):
            events.append(event)

        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "Unknown tool" in events[0]["message"]

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center')
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_stream_respects_cancel_event(self, mock_get_registry, mock_load_tools):
        """Test that streaming respects cancellation."""
        import asyncio
        from apps.mcp.services.mcp_server.tools_dispatcher import dispatch_tool_call_stream

        # Create a tool that yields many events
        class SlowStreamingTool(Tool):
            name = "slow_stream"
            description = "Slow streaming tool"
            public = True
            supports_streaming = True
            input_schema = {"type": "object", "properties": {}}

            async def execute(self, help_center_config, arguments, request=None, language='en'):
                return {"success": True}

            async def execute_stream(self, help_center_config, org, request, args, cancel_event=None, language='en'):
                for i in range(10):
                    if cancel_event and cancel_event.is_set():
                        break
                    yield {"type": "token", "text": f"token-{i}"}
                yield {"type": "result", "data": {"success": True}}

        mock_tool = SlowStreamingTool()
        mock_registry = MagicMock()
        mock_registry.get_tool.return_value = mock_tool
        mock_get_registry.return_value = mock_registry
        mock_load_tools.return_value = []

        mock_config = MagicMock()
        mock_config.id = "test-config-123"

        # Create cancel event and set it after a few events
        cancel_event = asyncio.Event()

        events = []
        async for event in dispatch_tool_call_stream(
            help_center_config=mock_config,
            organization=None,
            request=None,
            params={"name": "slow_stream", "arguments": {}},
            cancel_event=cancel_event
        ):
            events.append(event)
            if len(events) >= 3:
                cancel_event.set()

        # Should have stopped before getting all 10 tokens
        assert len(events) < 11
