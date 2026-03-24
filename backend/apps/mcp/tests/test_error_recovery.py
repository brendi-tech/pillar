"""
Tests for LLM-based error recovery patterns.

Tests that tools return structured errors instead of empty/None,
that errors are properly tracked in context, and that the LLM
receives error information for recovery decisions.

Copyright (C) 2025 Pillar Team
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from apps.mcp.services.agent.error_types import (
    ToolError,
    is_tool_error,
    format_error_for_llm,
    create_error_result,
)
from apps.mcp.services.agent_tools.context import AgentContext


class TestToolErrorTypes:
    """Tests for error_types.py helper functions."""
    
    def test_tool_error_dataclass(self):
        """ToolError should hold structured error data."""
        error = ToolError(
            error="Search failed",
            tool="search_actions",
            recoverable=True,
            hint="Try again later",
        )
        
        assert error.error == "Search failed"
        assert error.tool == "search_actions"
        assert error.recoverable is True
        assert error.hint == "Try again later"
    
    def test_tool_error_to_dict(self):
        """ToolError should serialize to dict."""
        error = ToolError(
            error="Timeout",
            tool="execute_query",
            recoverable=True,
            hint="Client may be slow",
        )
        
        result = error.to_dict()
        
        assert result["error"] == "Timeout"
        assert result["tool"] == "execute_query"
        assert result["recoverable"] is True
        assert result["hint"] == "Client may be slow"
    
    def test_is_tool_error_with_tool_error_instance(self):
        """is_tool_error should detect ToolError instances."""
        error = ToolError(error="Test", tool="test")
        assert is_tool_error(error) is True
    
    def test_is_tool_error_with_error_dict(self):
        """is_tool_error should detect error dicts."""
        error_dict = {"error": "Search failed", "tool": "search_actions"}
        assert is_tool_error(error_dict) is True
    
    def test_is_tool_error_with_empty_error(self):
        """is_tool_error should return False for empty error string."""
        error_dict = {"error": "", "tool": "search_actions"}
        assert is_tool_error(error_dict) is False
    
    def test_is_tool_error_with_none_error(self):
        """is_tool_error should return False for None error."""
        error_dict = {"error": None, "tool": "search_actions"}
        assert is_tool_error(error_dict) is False
    
    def test_is_tool_error_with_normal_result(self):
        """is_tool_error should return False for normal results."""
        normal_list = [{"name": "action1"}, {"name": "action2"}]
        assert is_tool_error(normal_list) is False
        
        normal_dict = {"name": "action1", "score": 0.9}
        assert is_tool_error(normal_dict) is False
    
    def test_format_error_for_llm_basic(self):
        """format_error_for_llm should create readable error message."""
        error = {"error": "Connection timeout", "recoverable": True}
        
        result = format_error_for_llm(error, "search_knowledge")
        
        assert "search_knowledge" in result
        assert "Connection timeout" in result
        assert "recoverable" in result.lower()
    
    def test_format_error_for_llm_with_hint(self):
        """format_error_for_llm should include hint when present."""
        error = {
            "error": "Search failed",
            "hint": "Try a more specific query",
            "recoverable": True,
        }
        
        result = format_error_for_llm(error, "search_actions")
        
        assert "Try a more specific query" in result
    
    def test_create_error_result(self):
        """create_error_result should create standardized error dict."""
        result = create_error_result(
            error="Database unavailable",
            tool="search_knowledge",
            recoverable=True,
            hint="Service may be restarting",
        )
        
        assert result["error"] == "Database unavailable"
        assert result["tool"] == "search_knowledge"
        assert result["recoverable"] is True
        assert result["hint"] == "Service may be restarting"


class TestAgentContextErrorTracking:
    """Tests for error tracking in AgentContext."""
    
    def test_add_tool_error(self):
        """AgentContext should track tool errors."""
        context = AgentContext()
        
        context.add_tool_error(
            tool="search_actions",
            error="Search failed: connection timeout",
            hint="Retry may succeed",
            recoverable=True,
        )
        
        assert len(context.tool_errors) == 1
        assert context.tool_errors[0]["tool"] == "search_actions"
        assert context.tool_errors[0]["error"] == "Search failed: connection timeout"
        assert context.tool_errors[0]["hint"] == "Retry may succeed"
        assert context.tool_errors[0]["recoverable"] is True
        assert "timestamp" in context.tool_errors[0]
    
    def test_add_tool_error_also_tracks_in_tool_calls(self):
        """Tool errors should also appear in tool_calls history."""
        context = AgentContext()
        
        context.add_tool_error(
            tool="search_knowledge",
            error="Service unavailable",
        )
        
        assert len(context.tool_calls) == 1
        assert context.tool_calls[0]["tool"] == "search_knowledge"
        assert context.tool_calls[0]["success"] is False
        assert context.tool_calls[0]["error"] == "Service unavailable"
    
    def test_get_recent_errors(self):
        """get_recent_errors should return most recent errors."""
        context = AgentContext()
        
        # Add 5 errors
        for i in range(5):
            context.add_tool_error(tool=f"tool_{i}", error=f"Error {i}")
        
        # Get last 3
        recent = context.get_recent_errors(limit=3)
        
        assert len(recent) == 3
        assert recent[0]["tool"] == "tool_2"
        assert recent[1]["tool"] == "tool_3"
        assert recent[2]["tool"] == "tool_4"
    
    def test_get_recent_errors_empty(self):
        """get_recent_errors should return empty list when no errors."""
        context = AgentContext()
        
        recent = context.get_recent_errors()
        
        assert recent == []
    
    def test_has_recent_errors(self):
        """has_recent_errors should return True when errors exist."""
        context = AgentContext()
        
        assert context.has_recent_errors() is False
        
        context.add_tool_error(tool="test", error="Test error")
        
        assert context.has_recent_errors() is True


class TestExecutorErrorReturns:
    """Tests that executor returns error dicts instead of empty lists."""
    
    @pytest.mark.asyncio
    async def test_search_actions_returns_empty_on_partial_failure(self):
        """execute_search_actions gracefully handles individual search failures."""
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor
        
        executor = AgentToolExecutor(
            product=MagicMock(id="test-product"),
            organization=MagicMock(id="test-org"),
        )
        
        with patch(
            "apps.products.services.action_search_service.action_search_service.search_with_metadata",
            new_callable=AsyncMock,
            side_effect=Exception("Database connection failed"),
        ):
            result = await executor.execute_search_actions("test query")
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    @pytest.mark.asyncio
    async def test_search_knowledge_returns_error_on_exception(self):
        """execute_search_knowledge should return error dict on exception."""
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor
        
        executor = AgentToolExecutor(
            product=MagicMock(id="test-product"),
            organization=MagicMock(id="test-org"),
        )
        
        with patch(
            "apps.knowledge.services.KnowledgeRAGServiceAsync",
            side_effect=Exception("Vector database unavailable"),
        ):
            result = await executor.execute_search_knowledge("test query")
        
        # Should return error dict, not empty list
        assert isinstance(result, dict)
        assert "error" in result
        assert "Vector database unavailable" in result["error"]
        assert result["tool"] == "search_knowledge"
        assert result["recoverable"] is True


class TestSoftErrorDetection:
    """Tests for LLM-based soft error detection."""
    
    def test_detect_soft_error_simple_success_false(self):
        """Should detect explicit success=False."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_simple
        
        result = {"success": False, "message": "Chart creation failed"}
        
        error = detect_soft_error_simple(result)
        
        assert error is not None
        assert "Chart creation failed" in error
    
    def test_detect_soft_error_simple_explicit_error(self):
        """Should detect explicit error field."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_simple
        
        result = {"success": True, "error": "Query returned no data"}
        
        error = detect_soft_error_simple(result)
        
        assert error is not None
        assert "Query returned no data" in error
    
    def test_detect_soft_error_simple_validation_errors(self):
        """Should detect validation_errors array."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_simple
        
        result = {"success": True, "validation_errors": ["Field required", "Invalid format"]}
        
        error = detect_soft_error_simple(result)
        
        assert error is not None
        assert "Validation errors" in error
    
    def test_detect_soft_error_simple_no_error(self):
        """Should return None for successful results."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_simple
        
        result = {"success": True, "id": 123, "name": "Test Chart"}
        
        error = detect_soft_error_simple(result)
        
        assert error is None
    
    @pytest.mark.asyncio
    async def test_detect_soft_error_llm_explicit_failure(self):
        """LLM detection should short-circuit on explicit failure."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_llm
        
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock()
        
        result = {"success": False, "error": "Access denied"}
        
        error = await detect_soft_error_llm(
            result=result,
            action_name="create_chart",
            llm_client=mock_client,
        )
        
        # Should detect without calling LLM
        assert error is not None
        assert "Access denied" in error
        mock_client.complete_async.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_detect_soft_error_llm_detects_issue(self):
        """LLM detection should catch nuanced errors."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_llm
        
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(
            return_value='{"is_error": true, "reason": "Chart ID is null"}'
        )
        
        result = {"success": True, "chart_id": None, "message": "Chart saved"}
        
        error = await detect_soft_error_llm(
            result=result,
            action_name="create_chart",
            llm_client=mock_client,
        )
        
        assert error is not None
        assert "Chart ID is null" in error
    
    @pytest.mark.asyncio
    async def test_detect_soft_error_llm_success(self):
        """LLM detection should return None for successful results."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_llm
        
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(
            return_value='{"is_error": false, "reason": ""}'
        )
        
        result = {"success": True, "chart_id": 123, "name": "Test"}
        
        error = await detect_soft_error_llm(
            result=result,
            action_name="create_chart",
            llm_client=mock_client,
        )
        
        assert error is None
    
    @pytest.mark.asyncio
    async def test_detect_soft_error_llm_timeout(self):
        """LLM detection should return None on timeout (assume success)."""
        from apps.mcp.tools.builtin.plans import detect_soft_error_llm
        
        mock_client = MagicMock()
        
        async def slow_response(*args, **kwargs):
            await asyncio.sleep(10)
            return '{"is_error": true}'
        
        mock_client.complete_async = AsyncMock(side_effect=slow_response)
        
        result = {"success": True, "id": 123}
        
        error = await detect_soft_error_llm(
            result=result,
            action_name="test",
            llm_client=mock_client,
            timeout=0.1,
        )
        
        # Should return None (assume success) on timeout
        assert error is None
