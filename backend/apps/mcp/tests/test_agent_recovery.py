"""
Tests for agent recovery logic and smart defaults.

Tests the smart default action selection logic.
Recovery always falls back to search (the safe default).
The model responds directly via content tokens (no respond tool).
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from apps.mcp.services.agent.recovery import (
    get_smart_default_action,
    try_recovery_llm,
    build_state_summary,
    _summarize_query_results,
    _summarize_knowledge,
)


class TestSmartDefaultAction:
    """Tests for get_smart_default_action function."""
    
    def test_no_context_searches(self):
        """With no context, should default to unified search."""
        questions = [
            "How do I configure SSO?",
            "What is the API rate limit?",
            "Open settings",
            "Create a new project",
        ]
        
        for question in questions:
            result = get_smart_default_action(question=question, iteration=0)
            # Simplified recovery defaults to search
            assert result["tool"] == "search", f"Failed for: {question}"
    
    def test_no_context_always_searches(self):
        """With no context at any iteration, should default to search."""
        # Test various iterations - should always search when no context
        for iteration in [0, 1, 2, 5]:
            result = get_smart_default_action(
                question="Do something",
                iteration=iteration,
            )
            assert result["tool"] == "search", f"Failed for iteration {iteration}"
    
    def test_with_found_tools_executes(self):
        """When tools are found, should execute the top one."""
        found_tools = [
            {"name": "open_settings", "description": "Open settings page"},
            {"name": "view_profile", "description": "View user profile"},
        ]
        
        result = get_smart_default_action(
            question="Open my settings",
            iteration=1,
            found_tools=found_tools,
        )
        
        assert result["tool"] == "execute"
        assert result["arguments"]["action_name"] == "open_settings"
        assert result["arguments"]["parameters"] == {}
    
    def test_with_found_knowledge_searches(self):
        """When knowledge is found but no tool calls, should search for more context."""
        found_knowledge = [
            {"title": "Password Reset Guide", "content": "To reset your password..."},
        ]
        
        result = get_smart_default_action(
            question="How do I reset my password?",
            iteration=1,
            found_knowledge=found_knowledge,
        )
        
        # Now falls back to search (model will respond directly on next turn)
        assert result["tool"] == "search"
    
    def test_with_query_results_searches(self):
        """When query results exist but no tool calls, should search for more context."""
        query_results = [
            {"action_name": "list_orders", "result": [{"id": 1}, {"id": 2}, {"id": 3}]},
        ]
        
        result = get_smart_default_action(
            question="Show my orders",
            iteration=1,
            query_results=query_results,
        )
        
        # Now falls back to search (model will respond directly on next turn)
        assert result["tool"] == "search"
    
    def test_later_iteration_no_context_searches(self):
        """Later iterations with no context should search."""
        result = get_smart_default_action(
            question="What is this?",
            iteration=2,
            found_tools=None,
            found_knowledge=None,
        )
        
        # Simplified recovery defaults to search
        assert result["tool"] == "search"
    
    def test_priority_order_tools_first(self):
        """Found tools should take priority (to continue work, not short-circuit)."""
        query_results = [{"action_name": "test", "result": {"data": "value"}}]
        found_knowledge = [{"title": "Doc", "content": "Content"}]
        found_tools = [{"name": "action", "description": "Action"}]
        
        result = get_smart_default_action(
            question="Test",
            iteration=1,
            query_results=query_results,
            found_knowledge=found_knowledge,
            found_tools=found_tools,
        )
        
        # Actions take priority - execute to continue work
        assert result["tool"] == "execute"
        assert result["arguments"]["action_name"] == "action"

    def test_no_respond_tool_in_recovery(self):
        """Recovery should never return respond as a tool."""
        # Test all combinations of context
        test_cases = [
            {"found_knowledge": [{"title": "Doc", "content": "C"}]},
            {"query_results": [{"action_name": "q", "result": [1, 2]}]},
            {"found_knowledge": [{"title": "Doc", "content": "C"}], "query_results": [{"action_name": "q", "result": [1]}]},
            {},
        ]
        
        for kwargs in test_cases:
            result = get_smart_default_action(question="Test", iteration=1, **kwargs)
            assert result["tool"] != "respond", f"Recovery returned respond for kwargs={kwargs}"


class TestTryRecoveryLLM:
    """Tests for try_recovery_llm function."""
    
    @pytest.mark.asyncio
    async def test_returns_search(self):
        """Should return search when LLM suggests it."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="search")
        
        result = await try_recovery_llm(
            llm_client=mock_client,
            question="Open settings",
            state_summary="Iteration 0",
            error_type="empty_response",
        )
        
        assert result is not None
        assert result["tool"] == "search"
    
    @pytest.mark.asyncio
    async def test_returns_none_for_unknown(self):
        """Should return None for unrecognized suggestions (let smart default handle)."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="skip")
        
        result = await try_recovery_llm(
            llm_client=mock_client,
            question="Test",
            state_summary="Test",
            error_type="test",
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_returns_none_on_timeout(self):
        """Should return None on timeout."""
        mock_client = MagicMock()
        
        async def slow_response(*args, **kwargs):
            await asyncio.sleep(10)
            return "search"
        
        mock_client.complete_async = AsyncMock(side_effect=slow_response)
        
        result = await try_recovery_llm(
            llm_client=mock_client,
            question="Test",
            state_summary="Test",
            error_type="test",
            timeout=0.1,
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        """Should return None on exception."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(side_effect=Exception("API Error"))
        
        result = await try_recovery_llm(
            llm_client=mock_client,
            question="Test",
            state_summary="Test",
            error_type="test",
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_returns_none_on_empty_response(self):
        """Should return None on empty response."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="")
        
        result = await try_recovery_llm(
            llm_client=mock_client,
            question="Test",
            state_summary="Test",
            error_type="test",
        )
        
        assert result is None


class TestBuildStateSummary:
    """Tests for build_state_summary function."""
    
    def test_basic_summary(self):
        """Should include iteration number."""
        summary = build_state_summary(iteration=0)
        assert "Iteration 0" in summary
        assert "No context" in summary
    
    def test_with_actions(self):
        """Should include tool names."""
        summary = build_state_summary(
            iteration=1,
            found_tools=[
                {"name": "open_settings"},
                {"name": "view_profile"},
            ],
        )
        assert "open_settings" in summary
        assert "view_profile" in summary
    
    def test_with_knowledge(self):
        """Should include knowledge titles."""
        summary = build_state_summary(
            iteration=1,
            found_knowledge=[
                {"title": "Getting Started Guide"},
            ],
        )
        assert "Getting Started" in summary
    
    def test_with_query_results(self):
        """Should mention query results count."""
        summary = build_state_summary(
            iteration=1,
            query_results=[{"result": {}}, {"result": {}}],
        )
        assert "2 query result" in summary


class TestSummarizeQueryResults:
    """Tests for _summarize_query_results function."""
    
    def test_empty_results(self):
        """Should handle empty results."""
        result = _summarize_query_results([])
        assert "No data" in result
    
    def test_list_result(self):
        """Should count items in list results."""
        results = [{"action_name": "list_users", "result": [{}, {}, {}]}]
        result = _summarize_query_results(results)
        assert "3 items" in result
        assert "list_users" in result
    
    def test_dict_result(self):
        """Should list keys in dict results."""
        results = [{"action_name": "get_user", "result": {"name": "John", "email": "j@e.com"}}]
        result = _summarize_query_results(results)
        assert "name" in result or "email" in result
    
    def test_empty_list_result(self):
        """Should handle empty list result."""
        results = [{"action_name": "list_items", "result": []}]
        result = _summarize_query_results(results)
        assert "no items" in result.lower()


class TestSummarizeKnowledge:
    """Tests for _summarize_knowledge function."""
    
    def test_empty_knowledge(self):
        """Should handle empty knowledge list."""
        result = _summarize_knowledge("test", [])
        assert "couldn't find" in result.lower()
    
    def test_includes_title_and_content(self):
        """Should include title and content."""
        knowledge = [
            {"title": "API Documentation", "content": "The API supports REST and GraphQL."},
        ]
        result = _summarize_knowledge("How do I use the API?", knowledge)
        assert "API Documentation" in result
        assert "REST" in result
    
    def test_preserves_full_content(self):
        """Should preserve full content without truncation (avoids losing info)."""
        long_content = "x" * 2000
        knowledge = [{"title": "Long Doc", "content": long_content}]
        result = _summarize_knowledge("test", knowledge)
        # Content should NOT be truncated - LLM needs full context
        assert long_content in result
        assert "Long Doc" in result
