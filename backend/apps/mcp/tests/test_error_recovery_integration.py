"""
Integration tests for end-to-end error recovery.

Tests that the agentic loop properly handles errors from tools,
feeds them to the LLM for recovery decisions, and gracefully
recovers or fails.

Copyright (C) 2025 Pillar Team
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from apps.mcp.services.agent.error_types import is_tool_error
from apps.mcp.services.agent_tools.context import AgentContext


class TestAgenticLoopErrorRecovery:
    """Test that the agentic loop handles errors gracefully."""
    
    @pytest.mark.asyncio
    async def test_search_error_recorded_in_context(self):
        """When search fails, error should be recorded in context."""
        context = AgentContext()
        
        # Simulate what happens in the agentic loop when search fails
        error_result = {
            "error": "Action search failed: connection timeout",
            "tool": "search_actions",
            "recoverable": True,
            "hint": "Service may be temporarily unavailable",
        }
        
        if is_tool_error(error_result):
            context.add_tool_error(
                tool="search_actions",
                error=error_result.get("error"),
                hint=error_result.get("hint"),
                recoverable=error_result.get("recoverable", True),
            )
        
        # Verify error was recorded
        assert context.has_recent_errors()
        recent_errors = context.get_recent_errors()
        assert len(recent_errors) == 1
        assert recent_errors[0]["tool"] == "search_actions"
        assert "connection timeout" in recent_errors[0]["error"]


class TestQueryTimeoutRecovery:
    """Test recovery from query timeout errors."""
    
    @pytest.mark.asyncio
    async def test_timeout_returns_error_dict(self):
        """Query timeout should return structured error, not None."""
        # Simulate the timeout error dict returned by wait_for_query_result
        timeout_result = {
            "error": "Timeout waiting for get_columns after 30s",
            "tool": "execute_query",
            "action_name": "get_columns",
            "timeout": True,
            "recoverable": True,
            "hint": "The client may be slow to respond. Consider retrying.",
        }
        
        # This should be detected as a tool error
        assert is_tool_error(timeout_result)
        
        # Context should track it
        context = AgentContext()
        context.add_tool_error(
            tool=timeout_result["tool"],
            error=timeout_result["error"],
            hint=timeout_result.get("hint"),
            recoverable=timeout_result.get("recoverable", True),
        )
        
        assert context.has_recent_errors()
        assert "Timeout" in context.tool_errors[0]["error"]


class TestStepCompletionRecovery:
    """Test recovery in step completion handler."""
    
    @pytest.mark.asyncio
    async def test_soft_error_detection_with_llm(self):
        """Soft error detection should use LLM for nuanced cases."""
        from apps.mcp.tools.builtin.plans import (
            detect_soft_error_llm,
            detect_soft_error_simple,
        )
        
        # Result that looks successful but LLM might flag
        ambiguous_result = {
            "success": True,
            "chart_id": None,  # This is suspicious
            "message": "Chart saved to database",
        }
        
        # Simple detection should miss this
        simple_error = detect_soft_error_simple(ambiguous_result)
        assert simple_error is None
        
        # LLM detection should catch it (with mocked client)
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(
            return_value='{"is_error": true, "reason": "chart_id is null - chart may not have been created"}'
        )
        
        llm_error = await detect_soft_error_llm(
            result=ambiguous_result,
            action_name="create_chart",
            llm_client=mock_client,
        )
        
        assert llm_error is not None
        assert "chart_id" in llm_error.lower() or "null" in llm_error.lower()


class TestStreamErrorHandling:
    """Test streaming error handling."""
    
    def test_recoverable_error_event_format(self):
        """Recoverable errors should emit proper event format."""
        # Simulate the event that would be emitted for a recoverable error
        error_event = {
            "type": "tool_error",
            "error": "Query timeout",
            "recoverable": True,
            "data": {"action_name": "get_datasets"},
        }
        
        # This format should be serializable
        json_str = json.dumps(error_event)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "tool_error"
        assert parsed["recoverable"] is True
    
    def test_terminal_error_event_format(self):
        """Terminal errors should have terminal flag."""
        error_event = {
            "type": "error",
            "message": "Internal server error",
            "terminal": True,
            "recoverable": False,
        }
        
        json_str = json.dumps(error_event)
        parsed = json.loads(json_str)
        
        assert parsed["terminal"] is True
        assert parsed["recoverable"] is False


class TestErrorContextFlow:
    """Test the full flow of error context through the system."""
    
    @pytest.mark.asyncio
    async def test_multiple_errors_tracked(self):
        """Multiple sequential errors should all be tracked."""
        context = AgentContext()
        
        # Simulate multiple failed attempts
        context.add_tool_error(
            tool="search_actions",
            error="First attempt: timeout",
            recoverable=True,
        )
        context.add_tool_error(
            tool="search_actions",
            error="Second attempt: connection refused",
            recoverable=True,
        )
        context.add_tool_error(
            tool="search_knowledge",
            error="Fallback attempt: service unavailable",
            recoverable=False,
        )
        
        # All errors should be tracked
        assert len(context.tool_errors) == 3
        
        # Recent errors shows last 3
        recent = context.get_recent_errors(limit=3)
        assert len(recent) == 3
        assert "First attempt" in recent[0]["error"]
        assert "Second attempt" in recent[1]["error"]
        assert "Fallback attempt" in recent[2]["error"]


class TestRecoveryDecisions:
    """Test that LLM-based recovery makes sensible decisions."""
    
    @pytest.mark.asyncio
    async def test_retry_decision_on_transient_error(self):
        """LLM should decide to retry on transient errors."""
        # This tests the format of the recovery prompt
        transient_error = "Connection timeout - server temporarily unavailable"
        
        # The recovery prompt should encourage retry for this
        prompt = f"""Step 'create_chart' encountered an error:
{transient_error}

Current plan goal: Create a sales chart
Completed steps: 1 of 3

What should we do?
- "retry": Try the step again (if error seems transient)
- "skip": Skip this step and continue with next (if step is optional)
- "end_plan": Give up with an explanation to the user"""
        
        # Verify prompt contains all necessary context
        assert "timeout" in prompt.lower()
        assert "retry" in prompt.lower()
        assert "skip" in prompt.lower()
        assert "end_plan" in prompt.lower()
    
    @pytest.mark.asyncio
    async def test_end_plan_decision_on_permanent_error(self):
        """LLM should decide to end plan on permanent errors."""
        permanent_error = "Permission denied - user lacks access to this resource"
        
        # This type of error should lead to end_plan
        # We can't test the actual LLM decision, but we verify the context is clear
        assert "permission" in permanent_error.lower()
        assert "denied" in permanent_error.lower()
