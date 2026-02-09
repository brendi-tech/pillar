"""
Tests for native tool calling implementation.

Verifies that:
1. Tool definitions are in the correct OpenAI function-calling format
2. Message helpers produce valid native format messages
3. LLMClient tool calling method handles streaming correctly
4. Content tokens are forwarded correctly (no respond tool)
"""
import json
import pytest

from apps.mcp.services.agent_tools.definitions import (
    get_tools_for_api,
    get_tool_by_name,
    validate_tool_call,
)
from apps.mcp.services.prompts.agentic_prompts import (
    build_agentic_prompt,
    format_assistant_tool_call_message,
    format_assistant_tool_calls_message,
    format_tool_result_message_native,
    format_search_result_content,
    format_execute_result_content,
)


class TestToolDefinitionsOpenAI:
    """Tests for OpenAI function-calling format tool definitions via get_tools_for_api()."""

    def test_get_tools_for_api_core_only(self):
        """get_tools_for_api() with no flags should return only core tools."""
        tools = get_tools_for_api()
        assert len(tools) == 1  # search only (respond removed)
        
        for tool in tools:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]
        
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search"}

    def test_get_tools_for_api_with_all_conditional(self):
        """get_tools_for_api() with all flags should return all conditional tools plus core."""
        tools = get_tools_for_api(
            include_get_article=True,
            include_interact_with_page=True,
        )
        assert len(tools) == 3  # search, get_article, interact_with_page
        
        for tool in tools:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]

    def test_search_tool_definition(self):
        """Search tool should have correct parameters."""
        tools = get_tools_for_api()
        search_tool = next(t for t in tools if t["function"]["name"] == "search")
        
        params = search_tool["function"]["parameters"]
        assert params["type"] == "object"
        assert "query" in params["properties"]
        assert "limit" in params["properties"]
        assert "query" in params["required"]

    def test_execute_tool_removed(self):
        """Execute tool should NOT be in any tools (replaced by dynamic action tools)."""
        tools = get_tools_for_api(include_get_article=True, include_interact_with_page=True)
        execute_tools = [t for t in tools if t["function"]["name"] == "execute"]
        assert len(execute_tools) == 0, "execute tool should be removed - actions are now native tools"

    def test_respond_tool_removed(self):
        """Respond tool should NOT be in any tools (model responds directly via content tokens)."""
        tools = get_tools_for_api(include_get_article=True, include_interact_with_page=True)
        respond_tools = [t for t in tools if t["function"]["name"] == "respond"]
        assert len(respond_tools) == 0, "respond tool should be removed - model responds via content tokens"

    def test_get_tools_for_api_returns_correct_format(self):
        """get_tools_for_api should return tools in the OpenAI function-calling format."""
        tools = get_tools_for_api(
            include_get_article=True,
            include_interact_with_page=True,
        )
        
        assert len(tools) == 3  # search, get_article, interact_with_page
        assert all(t["type"] == "function" for t in tools)
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "get_article", "interact_with_page"}

    def test_get_tools_for_api_get_article_only(self):
        """get_tools_for_api with only get_article flag should include 2 tools."""
        tools = get_tools_for_api(include_get_article=True)
        
        assert len(tools) == 2
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "get_article"}

    def test_get_tools_for_api_interact_with_page_only(self):
        """get_tools_for_api with only interact_with_page flag should include 2 tools."""
        tools = get_tools_for_api(include_interact_with_page=True)
        
        assert len(tools) == 2
        tool_names = {t["function"]["name"] for t in tools}
        assert tool_names == {"search", "interact_with_page"}


class TestNativeMessageFormat:
    """Tests for native tool calling message format helpers."""

    def test_build_agentic_prompt_structure(self):
        """build_agentic_prompt should create proper message structure."""
        messages = build_agentic_prompt(
            question="How do I create a dashboard?",
            site_context="TestApp",
        )
        
        # Should have system + user messages
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        
        # User message should contain the question
        assert "How do I create a dashboard?" in messages[1]["content"]

    def test_build_agentic_prompt_includes_narration_instruction(self):
        """build_agentic_prompt should include the narration instruction."""
        messages = build_agentic_prompt(
            question="Help me",
            site_context="TestApp",
        )
        
        system_content = messages[0]["content"]
        assert "Before calling a tool, briefly explain" in system_content
        assert "respond directly to the user without calling any tools" in system_content

    def test_build_agentic_prompt_no_respond_tool(self):
        """build_agentic_prompt should not mention respond as a tool."""
        messages = build_agentic_prompt(
            question="Help me",
            site_context="TestApp",
        )
        
        system_content = messages[0]["content"]
        # Should NOT have "- respond:" as a tool listing
        assert "- respond:" not in system_content

    def test_build_agentic_prompt_includes_context(self):
        """build_agentic_prompt should include environment and capabilities."""
        messages = build_agentic_prompt(
            question="Help me",
            site_context="TestApp",
            environment="User is on the settings page",
            capabilities="Can create dashboards, charts",
            product_guidance="Always be helpful",
        )
        
        system_content = messages[0]["content"]
        assert "settings page" in system_content
        assert "create dashboards" in system_content
        assert "Always be helpful" in system_content

    def test_format_assistant_tool_call_message(self):
        """format_assistant_tool_call_message should create proper structure."""
        msg = format_assistant_tool_call_message(
            tool_name="search",
            arguments={"query": "test query"},
            tool_call_id="call_123",
        )
        
        assert msg["role"] == "assistant"
        assert msg["content"] is None
        assert len(msg["tool_calls"]) == 1
        
        tool_call = msg["tool_calls"][0]
        assert tool_call["id"] == "call_123"
        assert tool_call["type"] == "function"
        assert tool_call["function"]["name"] == "search"
        
        # Arguments should be JSON string
        args = json.loads(tool_call["function"]["arguments"])
        assert args["query"] == "test query"

    def test_format_assistant_tool_call_message_with_content(self):
        """format_assistant_tool_call_message should include content when provided."""
        msg = format_assistant_tool_call_message(
            tool_name="search",
            arguments={"query": "test query"},
            tool_call_id="call_123",
            content="Let me search for that.",
        )
        
        assert msg["role"] == "assistant"
        assert msg["content"] == "Let me search for that."
        assert len(msg["tool_calls"]) == 1

    def test_format_tool_result_message_native(self):
        """format_tool_result_message_native should create proper structure."""
        msg = format_tool_result_message_native(
            tool_call_id="call_123",
            result_content="Found 3 results",
        )
        
        assert msg["role"] == "tool"
        assert msg["tool_call_id"] == "call_123"
        assert msg["content"] == "Found 3 results"

    def test_format_search_result_content(self):
        """format_search_result_content should format actions and knowledge."""
        content = format_search_result_content(
            query="create dashboard",
            actions=[
                {"name": "create_dashboard", "description": "Creates a new dashboard", "action_type": "trigger"},
            ],
            knowledge=[
                {"title": "Dashboard Guide", "content": "Here's how to create dashboards..."},
            ],
        )
        
        assert "create dashboard" in content
        assert "Actions (1 found)" in content
        assert "create_dashboard" in content
        assert "Knowledge (1 found)" in content
        assert "Dashboard Guide" in content

    def test_format_search_result_content_no_results(self):
        """format_search_result_content should handle no results gracefully."""
        content = format_search_result_content(
            query="nonexistent feature",
            actions=[],
            knowledge=[],
        )
        
        assert "No results found" in content

    def test_format_execute_result_content_success(self):
        """format_execute_result_content should format successful execution."""
        content = format_execute_result_content(
            action_name="create_dashboard",
            success=True,
            result={"id": 123, "name": "My Dashboard"},
        )
        
        assert "completed successfully" in content
        assert "create_dashboard" in content
        assert "123" in content

    def test_format_execute_result_content_failure(self):
        """format_execute_result_content should format failed execution."""
        content = format_execute_result_content(
            action_name="create_dashboard",
            success=False,
            error="Permission denied",
        )
        
        assert "failed" in content
        assert "Permission denied" in content


class TestToolValidation:
    """Tests for tool call validation with native format."""

    def test_validate_search_with_valid_args(self):
        """validate_tool_call should accept valid search arguments."""
        result = validate_tool_call("search", {"query": "test"})
        assert result["valid"] is True

    def test_validate_search_missing_query(self):
        """validate_tool_call should reject search without query."""
        result = validate_tool_call("search", {})
        assert result["valid"] is False
        assert "query" in result["error"].lower() or "missing" in result["error"].lower()

    def test_validate_execute_is_unknown_tool(self):
        """execute is no longer a base tool - should be rejected as unknown."""
        # NOTE: execute was removed - actions are now registered as native tools
        result = validate_tool_call("execute", {"action_name": "test_action"})
        assert result["valid"] is False
        assert "unknown" in result["error"].lower()

    def test_validate_respond_is_unknown_tool(self):
        """respond is no longer a tool - should be rejected as unknown."""
        result = validate_tool_call("respond", {"message": "Hello!"})
        assert result["valid"] is False
        assert "unknown" in result["error"].lower()

    def test_validate_unknown_tool(self):
        """validate_tool_call should reject unknown tools."""
        result = validate_tool_call("unknown_tool", {})
        assert result["valid"] is False
        assert "unknown" in result["error"].lower()


class TestParallelToolCalls:
    """Tests for parallel tool call handling."""

    def test_format_assistant_tool_calls_message_multiple(self):
        """format_assistant_tool_calls_message should handle multiple tools."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_1", "tool_name": "search", "arguments": {"query": "dashboards"}},
            {"tool_call_id": "call_2", "tool_name": "search", "arguments": {"query": "charts"}},
        ])
        
        assert msg["role"] == "assistant"
        assert msg["content"] is None
        assert len(msg["tool_calls"]) == 2
        
        # First tool call
        assert msg["tool_calls"][0]["id"] == "call_1"
        assert msg["tool_calls"][0]["type"] == "function"
        assert msg["tool_calls"][0]["function"]["name"] == "search"
        args1 = json.loads(msg["tool_calls"][0]["function"]["arguments"])
        assert args1["query"] == "dashboards"
        
        # Second tool call
        assert msg["tool_calls"][1]["id"] == "call_2"
        assert msg["tool_calls"][1]["type"] == "function"
        assert msg["tool_calls"][1]["function"]["name"] == "search"
        args2 = json.loads(msg["tool_calls"][1]["function"]["arguments"])
        assert args2["query"] == "charts"

    def test_format_assistant_tool_calls_message_single(self):
        """format_assistant_tool_calls_message should work with single tool."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_1", "tool_name": "search", "arguments": {"query": "test"}},
        ])
        
        assert msg["role"] == "assistant"
        assert msg["content"] is None
        assert len(msg["tool_calls"]) == 1
        assert msg["tool_calls"][0]["id"] == "call_1"
        assert msg["tool_calls"][0]["function"]["name"] == "search"

    def test_format_assistant_tool_calls_message_with_content(self):
        """format_assistant_tool_calls_message should include content when provided."""
        msg = format_assistant_tool_calls_message(
            [
                {"tool_call_id": "call_1", "tool_name": "search", "arguments": {"query": "test"}},
            ],
            content="Let me look that up for you.",
        )
        
        assert msg["role"] == "assistant"
        assert msg["content"] == "Let me look that up for you."
        assert len(msg["tool_calls"]) == 1

    def test_format_assistant_tool_calls_message_mixed_tools(self):
        """format_assistant_tool_calls_message should handle mixed tool types."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_1", "tool_name": "search", "arguments": {"query": "users"}},
            {"tool_call_id": "call_2", "tool_name": "get_article", "arguments": {"slug": "getting-started"}},
        ])
        
        assert len(msg["tool_calls"]) == 2
        assert msg["tool_calls"][0]["function"]["name"] == "search"
        assert msg["tool_calls"][1]["function"]["name"] == "get_article"

    def test_format_assistant_tool_calls_message_preserves_order(self):
        """format_assistant_tool_calls_message should preserve tool call order."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_a", "tool_name": "search", "arguments": {"query": "first"}},
            {"tool_call_id": "call_b", "tool_name": "search", "arguments": {"query": "second"}},
            {"tool_call_id": "call_c", "tool_name": "search", "arguments": {"query": "third"}},
        ])
        
        assert len(msg["tool_calls"]) == 3
        assert msg["tool_calls"][0]["id"] == "call_a"
        assert msg["tool_calls"][1]["id"] == "call_b"
        assert msg["tool_calls"][2]["id"] == "call_c"

    def test_format_assistant_tool_calls_matches_openai_format(self):
        """format_assistant_tool_calls_message output should match OpenAI tool_calls format."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_123", "tool_name": "search", "arguments": {"query": "test"}},
        ])
        
        # Verify structure matches OpenAI format
        assert "role" in msg
        assert "content" in msg
        assert "tool_calls" in msg
        
        tc = msg["tool_calls"][0]
        assert "id" in tc
        assert "type" in tc
        assert tc["type"] == "function"
        assert "function" in tc
        assert "name" in tc["function"]
        assert "arguments" in tc["function"]
        
        # Arguments must be a JSON string, not a dict
        assert isinstance(tc["function"]["arguments"], str)

    def test_format_assistant_tool_calls_empty_arguments(self):
        """format_assistant_tool_calls_message should handle empty arguments."""
        msg = format_assistant_tool_calls_message([
            {"tool_call_id": "call_1", "tool_name": "search", "arguments": {}},
        ])
        
        assert len(msg["tool_calls"]) == 1
        args = json.loads(msg["tool_calls"][0]["function"]["arguments"])
        assert args == {}

    def test_parallel_tool_result_messages_have_matching_ids(self):
        """Each tool result message should have matching tool_call_id."""
        # Simulate parallel tool calls
        tool_calls = [
            {"tool_call_id": "call_1", "tool_name": "search", "arguments": {"query": "a"}},
            {"tool_call_id": "call_2", "tool_name": "search", "arguments": {"query": "b"}},
        ]
        
        # Create assistant message
        assistant_msg = format_assistant_tool_calls_message(tool_calls)
        
        # Create corresponding tool result messages
        result_msgs = [
            format_tool_result_message_native(tool_call_id="call_1", result_content="Results for a"),
            format_tool_result_message_native(tool_call_id="call_2", result_content="Results for b"),
        ]
        
        # Verify IDs match between assistant tool_calls and result messages
        assistant_ids = {tc["id"] for tc in assistant_msg["tool_calls"]}
        result_ids = {msg["tool_call_id"] for msg in result_msgs}
        
        assert assistant_ids == result_ids
        assert assistant_ids == {"call_1", "call_2"}


class TestModelFallback:
    """Tests for model fallback mechanism when native tool calling fails."""

    @pytest.mark.asyncio
    async def test_fallback_triggered_on_primary_failure(self):
        """When primary model fails, fallback model is tried."""
        from unittest.mock import MagicMock, patch
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        call_count = 0
        
        async def mock_stream_with_tools(*args, **kwargs):
            """Mock that fails on first call, succeeds on second."""
            nonlocal call_count
            call_count += 1
            
            if call_count == 1:
                # First call (primary model) - raise exception
                raise Exception("Primary model failed")
            else:
                # Second call (fallback model) - succeed
                yield {'type': 'tool_call', 'name': 'search', 'arguments': {'query': 'test'}, 'id': 'call_123'}
                yield {'type': 'done', 'usage': {'prompt_tokens': 100, 'completion_tokens': 50}}
        
        # Create mock service
        mock_service = MagicMock()
        mock_service.model_name = "test/primary-model"
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream_with_tools
        
        # Create mock context with token budget
        mock_context = MagicMock()
        mock_context.token_budget = MagicMock()
        mock_context.token_budget.should_compact = False
        
        # Mock LLMConfigService at the source module
        with patch('common.utils.llm_config.LLMConfigService') as mock_config:
            mock_config.get_model.return_value = 'gemini-3-pro'
            mock_config.get_model_info.return_value = {'openrouter_model': 'google/gemini-3-pro-preview'}
            
            # Collect events
            events = []
            async for event in agent_decide_tool_native(
                service=mock_service,
                messages=[{"role": "user", "content": "test"}],
                context=mock_context,
                iteration=0,
            ):
                events.append(event)
        
        # Verify fallback was called (call_count should be 2)
        assert call_count == 2
        
        # Verify we got a tool_decision event from the fallback
        tool_decisions = [e for e in events if e.get('type') == 'tool_decision']
        assert len(tool_decisions) == 1
        assert tool_decisions[0]['tool'] == 'search'

    @pytest.mark.asyncio
    async def test_fallback_uses_google_flagship(self):
        """Fallback uses google/gemini-3-pro-preview model."""
        from unittest.mock import MagicMock, patch
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        models_used = []
        
        async def mock_stream_with_tools(*args, **kwargs):
            """Track which model was used."""
            model = kwargs.get('model')
            models_used.append(model)
            
            if len(models_used) == 1:
                # First call fails
                raise Exception("Primary failed")
            else:
                # Second call succeeds with content tokens (direct response)
                yield {'type': 'token', 'content': 'Hello'}
                yield {'type': 'done', 'usage': {}}
        
        mock_service = MagicMock()
        mock_service.model_name = "openai/gpt-5.1"
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream_with_tools
        
        mock_context = MagicMock()
        mock_context.token_budget = None
        
        with patch('common.utils.llm_config.LLMConfigService') as mock_config:
            mock_config.get_model.return_value = 'gemini-3-pro'
            mock_config.get_model_info.return_value = {'openrouter_model': 'google/gemini-3-pro-preview'}
            
            async for _ in agent_decide_tool_native(
                service=mock_service,
                messages=[],
                context=mock_context,
                iteration=0,
            ):
                pass
        
        # First call should have no model override (None = use primary)
        assert models_used[0] is None
        # Second call should use Google flagship
        assert models_used[1] == 'google/gemini-3-pro-preview'

    @pytest.mark.asyncio
    async def test_fallback_failure_yields_error_content(self):
        """When both primary and fallback fail, error content token is yielded."""
        from unittest.mock import MagicMock, patch
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        async def mock_stream_always_fails(*args, **kwargs):
            """Mock async generator that always fails after first iteration."""
            raise Exception("Model failed")
            yield  # noqa: unreachable
        
        mock_service = MagicMock()
        mock_service.model_name = "test/model"
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream_always_fails
        
        mock_context = MagicMock()
        mock_context.token_budget = None
        
        with patch('common.utils.llm_config.LLMConfigService') as mock_config:
            mock_config.get_model.return_value = 'gemini-3-pro'
            mock_config.get_model_info.return_value = {'openrouter_model': 'google/gemini-3-pro-preview'}
            
            events = []
            async for event in agent_decide_tool_native(
                service=mock_service,
                messages=[],
                context=mock_context,
                iteration=0,
            ):
                events.append(event)
        
        # Should yield a content_token error (not a tool_decision for respond)
        assert len(events) == 1
        assert events[0]['type'] == 'content_token'
        assert 'error' in events[0]['content'].lower()

    @pytest.mark.asyncio
    async def test_no_fallback_on_cancellation(self):
        """Cancellation does not trigger fallback."""
        from unittest.mock import MagicMock, patch
        import asyncio
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        call_count = 0
        
        async def mock_stream_with_cancel_check(*args, **kwargs):
            """Mock async generator that simulates cancellation."""
            nonlocal call_count
            call_count += 1
            
            # Simulate receiving some events then hitting a cancel check
            yield {'type': 'thinking', 'content': 'Starting...'}
            
            # Simulate the cancel_event being checked and raising CancelledError
            raise asyncio.CancelledError("Operation cancelled by user")
        
        mock_service = MagicMock()
        mock_service.model_name = "test/model"
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream_with_cancel_check
        
        mock_context = MagicMock()
        mock_context.token_budget = None
        
        with patch('common.utils.llm_config.LLMConfigService') as mock_config:
            mock_config.get_model.return_value = 'gemini-3-pro'
            mock_config.get_model_info.return_value = {'openrouter_model': 'google/gemini-3-pro-preview'}
            
            events = []
            async for event in agent_decide_tool_native(
                service=mock_service,
                messages=[],
                context=mock_context,
                iteration=0,
            ):
                events.append(event)
        
        # Should only call once (no fallback on cancellation)
        assert call_count == 1
        
        # Should have thinking event but no tool_decision (early return on cancellation)
        assert len([e for e in events if e.get('type') == 'tool_decision']) == 0


class TestContentTokenForwarding:
    """Tests for content token forwarding (replaces RespondMessageExtractor tests)."""

    @pytest.mark.asyncio
    async def test_content_tokens_forwarded(self):
        """Content tokens from the model should be forwarded as content_token events."""
        from unittest.mock import MagicMock
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        async def mock_stream(*args, **kwargs):
            yield {'type': 'token', 'content': 'Hello '}
            yield {'type': 'token', 'content': 'world!'}
            yield {'type': 'done', 'usage': {}, 'finish_reason': 'stop'}
        
        mock_service = MagicMock()
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream
        
        mock_context = MagicMock()
        mock_context.token_budget = None
        
        events = []
        async for event in agent_decide_tool_native(
            service=mock_service,
            messages=[],
            context=mock_context,
            iteration=0,
        ):
            events.append(event)
        
        content_events = [e for e in events if e.get('type') == 'content_token']
        assert len(content_events) == 2
        assert content_events[0]['content'] == 'Hello '
        assert content_events[1]['content'] == 'world!'

    @pytest.mark.asyncio
    async def test_content_tokens_with_tool_calls(self):
        """Model can produce content tokens alongside tool calls (narration)."""
        from unittest.mock import MagicMock
        
        from apps.mcp.services.agent.agentic_loop import agent_decide_tool_native
        
        async def mock_stream(*args, **kwargs):
            # Model writes narration first, then calls a tool
            yield {'type': 'token', 'content': 'Let me search for that.'}
            yield {'type': 'tool_call', 'name': 'search', 'arguments': {'query': 'test'}, 'id': 'call_1'}
            yield {'type': 'done', 'usage': {}, 'finish_reason': 'stop'}
        
        mock_service = MagicMock()
        mock_service.llm_client = MagicMock()
        mock_service.llm_client.stream_complete_with_tools_async = mock_stream
        
        mock_context = MagicMock()
        mock_context.token_budget = None
        
        events = []
        async for event in agent_decide_tool_native(
            service=mock_service,
            messages=[],
            context=mock_context,
            iteration=0,
        ):
            events.append(event)
        
        # Should have both content tokens and tool decisions
        content_events = [e for e in events if e.get('type') == 'content_token']
        tool_events = [e for e in events if e.get('type') == 'tool_decision']
        
        assert len(content_events) == 1
        assert content_events[0]['content'] == 'Let me search for that.'
        assert len(tool_events) == 1
        assert tool_events[0]['tool'] == 'search'
