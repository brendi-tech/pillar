"""
Integration tests for native tool calling with real API calls.

These tests verify that native tool calling works correctly across all flagship
and budget models from all providers (OpenAI, Anthropic, Google, xAI).

Tests are marked with @pytest.mark.integration and skip if OPENROUTER_API_KEY is not set.

Run with:
    # All integration tests
    pytest backend/apps/mcp/tests/test_native_tool_calling_integration.py -v

    # Only flagship models
    pytest backend/apps/mcp/tests/test_native_tool_calling_integration.py -v -k "flagship"

    # Only budget models
    pytest backend/apps/mcp/tests/test_native_tool_calling_integration.py -v -k "budget"

    # Specific provider
    pytest backend/apps/mcp/tests/test_native_tool_calling_integration.py -v -k "openai"
"""
import pytest
from typing import Dict, List, Optional, Tuple
from django.conf import settings

from common.utils.llm_client import LLMClient
from common.utils.llm_config import LLMConfigService
from apps.mcp.services.agent_tools.definitions import get_tools_for_api


def _has_real_api_key() -> bool:
    """Check if a real OpenRouter API key is configured (not a test/dummy key)."""
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    if not api_key:
        return False
    # Skip if it's a dummy/test key (used in CI)
    if api_key.startswith('sk-or-test') or api_key == 'test-key':
        return False
    # Real OpenRouter keys typically start with sk-or-v1- and are longer
    if len(api_key) < 20:
        return False
    return True


# Skip all tests if no real API key (CI uses dummy keys)
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not _has_real_api_key(),
        reason="OPENROUTER_API_KEY not set or is a test key"
    ),
]


def get_all_test_models() -> List[Tuple[str, str, str]]:
    """
    Get all flagship and budget models for parametrized tests.
    
    Returns:
        List of tuples: (provider, tier, model_name)
        Example: [('openai', 'flagship', 'gpt-5-1'), ('openai', 'budget', 'gpt-4o-mini'), ...]
    """
    models = []
    for provider, tiers in LLMConfigService.PROVIDER_TIERS.items():
        for tier, model_name in tiers.items():
            if tier in ('flagship', 'budget'):
                models.append((provider, tier, model_name))
    return models


# Build test parameters at module load time
ALL_MODELS = get_all_test_models()


# Test IDs for better pytest output
def model_id(param):
    """Generate readable test IDs from model parameters."""
    if isinstance(param, tuple) and len(param) == 3:
        provider, tier, model_name = param
        return f"{provider}-{tier}-{model_name}"
    return str(param)


@pytest.fixture
def llm_client() -> LLMClient:
    """Create an LLMClient instance for tests."""
    return LLMClient()


@pytest.fixture
def tools() -> List[Dict]:
    """Get all tool definitions for testing (core + conditional)."""
    return get_tools_for_api(include_get_article=True, include_interact_with_page=True)


async def get_first_tool_call(
    client: LLMClient,
    messages: List[Dict],
    model: str,
    tools: List[Dict],
) -> Optional[Dict]:
    """
    Stream until we get a tool_call event.
    
    Args:
        client: LLMClient instance
        messages: Messages to send
        model: OpenRouter model path (e.g., 'openai/gpt-5.1')
        tools: Tool definitions
    
    Returns:
        The first tool_call event, or None if no tool call was made
    """
    async for event in client.stream_complete_with_tools_async(
        messages=messages,
        tools=tools,
        model=model,
    ):
        if event.get('type') == 'tool_call':
            return event
        if event.get('type') == 'error':
            raise RuntimeError(f"API error: {event.get('error')}")
    return None


async def get_all_tool_calls(
    client: LLMClient,
    messages: List[Dict],
    model: str,
    tools: List[Dict],
) -> List[Dict]:
    """
    Stream until done and collect all tool_call events.
    
    Args:
        client: LLMClient instance
        messages: Messages to send
        model: OpenRouter model path
        tools: Tool definitions
    
    Returns:
        List of all tool_call events
    """
    tool_calls = []
    async for event in client.stream_complete_with_tools_async(
        messages=messages,
        tools=tools,
        model=model,
    ):
        if event.get('type') == 'tool_call':
            tool_calls.append(event)
        if event.get('type') == 'error':
            raise RuntimeError(f"API error: {event.get('error')}")
    return tool_calls


class TestSearchToolNativeIntegration:
    """Tests for the search tool across all models."""

    @pytest.mark.parametrize("provider,tier,model_name", ALL_MODELS, ids=model_id)
    async def test_search_tool_returns_valid_tool_call(
        self,
        llm_client: LLMClient,
        tools: List[Dict],
        provider: str,
        tier: str,
        model_name: str,
    ):
        """
        Test that each model can call the search tool with valid arguments.
        
        The model should:
        1. Choose to call the search tool
        2. Provide a query argument
        3. Return properly structured tool call event
        """
        openrouter_model = LLMConfigService.get_openrouter_model(model_name)
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant. Use the available tools to help users."},
            {"role": "user", "content": "Find actions related to creating charts"},
        ]
        
        tool_call = await get_first_tool_call(llm_client, messages, openrouter_model, tools)
        
        # Verify tool call was made
        assert tool_call is not None, f"{model_name} did not make a tool call"
        
        # Verify it's a search tool call
        assert tool_call.get('name') == 'search', (
            f"{model_name} called {tool_call.get('name')} instead of search"
        )
        
        # Verify arguments structure
        arguments = tool_call.get('arguments', {})
        assert isinstance(arguments, dict), f"{model_name} arguments is not a dict: {type(arguments)}"
        assert 'query' in arguments, f"{model_name} missing 'query' in arguments: {arguments}"
        assert isinstance(arguments['query'], str), f"{model_name} query is not a string"
        assert len(arguments['query']) > 0, f"{model_name} query is empty"


class TestToolCallStructure:
    """Tests verifying the structure of tool call events."""

    @pytest.mark.parametrize("provider,tier,model_name", ALL_MODELS, ids=model_id)
    async def test_tool_call_has_required_fields(
        self,
        llm_client: LLMClient,
        tools: List[Dict],
        provider: str,
        tier: str,
        model_name: str,
    ):
        """
        Test that tool call events have all required fields.
        
        Required fields:
        - type: 'tool_call'
        - id: non-empty string
        - name: tool name string
        - arguments: parsed dict (not JSON string)
        """
        openrouter_model = LLMConfigService.get_openrouter_model(model_name)
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant. Use tools to help users."},
            {"role": "user", "content": "Search for dashboard actions"},
        ]
        
        tool_call = await get_first_tool_call(llm_client, messages, openrouter_model, tools)
        
        # Must have a tool call
        assert tool_call is not None, f"{model_name} did not make a tool call"
        
        # Verify type field
        assert tool_call.get('type') == 'tool_call', (
            f"{model_name} event type is '{tool_call.get('type')}', expected 'tool_call'"
        )
        
        # Verify id field exists and is non-empty string
        tool_id = tool_call.get('id')
        assert tool_id is not None, f"{model_name} tool call missing 'id' field"
        assert isinstance(tool_id, str), f"{model_name} tool call id is not a string: {type(tool_id)}"
        assert len(tool_id) > 0, f"{model_name} tool call id is empty"
        
        # Verify name field
        name = tool_call.get('name')
        assert name is not None, f"{model_name} tool call missing 'name' field"
        assert isinstance(name, str), f"{model_name} tool call name is not a string"
        assert name in ('search', 'get_article', 'interact_with_page'), (
            f"{model_name} tool call name '{name}' is not a valid tool"
        )
        
        # Verify arguments is a dict (already parsed, not JSON string)
        arguments = tool_call.get('arguments')
        assert arguments is not None, f"{model_name} tool call missing 'arguments' field"
        assert isinstance(arguments, dict), (
            f"{model_name} arguments should be dict, got {type(arguments).__name__}. "
            "This might indicate JSON was not parsed."
        )

    @pytest.mark.parametrize("provider,tier,model_name", ALL_MODELS, ids=model_id)
    async def test_tool_call_arguments_not_raw_json(
        self,
        llm_client: LLMClient,
        tools: List[Dict],
        provider: str,
        tier: str,
        model_name: str,
    ):
        """
        Test that arguments are parsed dicts, not raw JSON strings.
        
        The LLMClient should parse the arguments JSON before yielding the event.
        """
        openrouter_model = LLMConfigService.get_openrouter_model(model_name)
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant. Use the search tool."},
            {"role": "user", "content": "Find chart actions"},
        ]
        
        tool_call = await get_first_tool_call(llm_client, messages, openrouter_model, tools)
        
        assert tool_call is not None, f"{model_name} did not make a tool call"
        
        arguments = tool_call.get('arguments')
        
        # Should be dict, not string
        assert not isinstance(arguments, str), (
            f"{model_name} arguments is a string (raw JSON): {arguments[:100] if len(str(arguments)) > 100 else arguments}"
        )
        
        # Should not have _raw key (indicates parse failure)
        assert '_raw' not in arguments, (
            f"{model_name} arguments contain '_raw' key indicating JSON parse failure"
        )


# =============================================================================
# Model Compatibility Notes (Updated 2026-02-03)
# =============================================================================
#
# All 8 models successfully support native tool calling via OpenRouter.
#
# Model               | Native Tool Calling | Notes
# --------------------|---------------------|----------------------------------------
# gpt-5-1             | ✅ Works            | Flagship. All tools work correctly.
# gpt-4o-mini         | ✅ Works            | Budget. All tools work correctly.
# claude-opus-4.5     | ✅ Works            | Flagship. All tools work correctly.
# claude-haiku-4-5    | ✅ Works            | Budget. All tools work correctly.
# gemini-3-pro        | ✅ Works            | Flagship. Fallback model. Works well.
# gemini-3-flash      | ✅ Works            | Budget. All tools work correctly.
# grok-4              | ✅ Works            | Flagship. Slower first chunk (~19s).
# grok-4-1-fast       | ✅ Works            | Budget. All tools work correctly.
#
# Behavioral Notes:
# - Flagship models (gpt-5-1, gemini-3-pro, grok-4) tend to call search
#   before execute when given an unknown action name. This is correct
#   cautious behavior - they want to verify the action exists first.
# - Budget models tend to be more direct and follow instructions literally.
# - grok-4 has longer time-to-first-chunk but works correctly.
# - All models correctly parse and return arguments as dicts (not strings).
# =============================================================================
