"""
Tools dispatcher for MCP server.

Routes tool calls to the unified ToolRegistry. Falls back to the product's
server-side Actions for MCP agents, then to external MCP sources (via
slug-namespaced tool names) when a tool isn't in the built-in registry.

Copyright (C) 2025 Pillar Team
"""
import json
import logging
import time
import uuid
from typing import Any, Dict

from .utils import extract_request_metadata

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Product Action helpers (MCP channel fallback)
# ---------------------------------------------------------------------------

def _build_caller_from_request(request) -> 'CallerContext':
    from apps.mcp.services.agent.models import CallerContext

    oauth_identity = getattr(request, 'mcp_oauth_identity', None)
    if oauth_identity:
        return CallerContext(
            channel='mcp',
            external_user_id=oauth_identity.external_user_id or None,
            email=oauth_identity.external_email or None,
            display_name=oauth_identity.external_display_name or None,
        )

    return CallerContext(
        channel='mcp',
        external_user_id=request.META.get('HTTP_X_EXTERNAL_USER_ID') or None,
        email=request.META.get('HTTP_X_USER_EMAIL') or None,
    )


def _format_mcp_result(result: dict) -> Dict[str, Any]:
    """Convert a post_tool_call response dict to MCP content format."""
    if result.get('timed_out'):
        return {
            'content': [{'type': 'text', 'text': 'Error: Tool call timed out'}],
            'isError': True,
        }
    if result.get('connection_error'):
        return {
            'content': [{'type': 'text', 'text': 'Error: Tool endpoint unreachable'}],
            'isError': True,
        }
    if result.get('server_error'):
        error = result.get('error', 'Server error')
        return {
            'content': [{'type': 'text', 'text': f'Error: {error}'}],
            'isError': True,
        }

    raw = result.get('result', result)
    if isinstance(raw, str):
        return {'content': [{'type': 'text', 'text': raw}], 'isError': False}
    if isinstance(raw, dict):
        text = raw.get('text', json.dumps(raw, default=str))
        return {'content': [{'type': 'text', 'text': text}], 'isError': False}
    return {'content': [{'type': 'text', 'text': str(raw)}], 'isError': False}


async def _dispatch_product_tool(
    help_center_config, tool_name: str, arguments: dict, request,
) -> Dict[str, Any] | None:
    """Dispatch a tool call to a product's server-side Action via its ToolEndpoint.

    Returns ``None`` when no matching Action exists (so the caller can raise).
    """
    from apps.products.models.action import Action
    from apps.tools.services.dispatch import get_tool_endpoint, post_tool_call

    action = await Action.objects.filter(
        product=help_center_config,
        name=tool_name,
        tool_type=Action.ToolType.SERVER_SIDE,
        status=Action.Status.PUBLISHED,
    ).afirst()

    if not action:
        return None

    endpoint = await get_tool_endpoint(str(help_center_config.id))
    if not endpoint:
        return {
            'content': [{'type': 'text', 'text': 'Error: No tool endpoint configured for this product'}],
            'isError': True,
        }

    caller = _build_caller_from_request(request)

    result = await post_tool_call(
        endpoint_url=endpoint.endpoint_url,
        call_id=str(uuid.uuid4()),
        tool_name=tool_name,
        arguments=arguments,
        caller=caller,
        timeout=30.0,
        conversation_id=None,
        product=help_center_config,
    )

    return _format_mcp_result(result)


# ---------------------------------------------------------------------------
# External MCP source dispatch
# ---------------------------------------------------------------------------

async def _dispatch_external_mcp_tool(
    tool_name: str, arguments: dict, request, agent,
) -> Dict[str, Any] | None:
    """Dispatch a tool call to an external MCP source by reversing the slug namespace.

    Tool names follow the pattern ``{slug}_{original_name}``.  We iterate
    the agent's attached MCP sources and check if ``tool_name`` starts with
    ``{slug}_``.  If so, the remainder is the original tool name on that
    external server.

    Returns ``None`` when no matching source/tool is found.
    """
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import execute_mcp_tool

    if not agent:
        return None

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]
    if not source_ids:
        return None

    async for source in MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).aiterator():
        slug = source.slug or source.name.lower().replace(" ", "_")
        prefix = f"{slug}_"
        if not tool_name.startswith(prefix):
            continue

        original_name = tool_name[len(prefix):]
        known_names = {
            t.get("name") for t in (source.discovered_tools or [])
        }
        if original_name not in known_names:
            continue

        caller = _build_caller_from_request(request)
        result = await execute_mcp_tool(
            tool_name=original_name,
            arguments=arguments,
            mcp_source=source,
            caller=caller,
        )
        return _format_mcp_result(result)

    return None


# ---------------------------------------------------------------------------
# Public dispatchers
# ---------------------------------------------------------------------------

async def dispatch_tool_call(
    help_center_config, organization, request, params: Dict[str, Any],
    language: str = 'en', agent=None,
) -> Dict[str, Any]:
    """
    Dispatch a tool call to the appropriate Tool instance.

    Built-in tools from the ToolRegistry are tried first. For MCP agents,
    product server-side Actions are tried as a fallback.

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        request: HTTP request object
        params: Tool call parameters with 'name' and 'arguments'
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')
        agent: Optional Agent model instance

    Returns:
        Tool execution result

    Raises:
        ValueError: If tool name is unknown
    """
    from apps.mcp.tools.registry import get_tool_registry
    from apps.mcp.tools.loader import load_all_tools_for_help_center

    tool_name = params.get('name')
    arguments = params.get('arguments', {})

    logger.info(f"[tools_dispatcher] Dispatching tool: {tool_name}")
    start_time = time.time()

    await load_all_tools_for_help_center(help_center_config)

    registry = get_tool_registry()
    tool = registry.get_tool(tool_name, str(help_center_config.id))

    if not tool:
        if agent and getattr(agent, 'channel', None) == 'mcp':
            result = await _dispatch_product_tool(
                help_center_config, tool_name, arguments, request,
            )
            if result is not None:
                execution_time_ms = int((time.time() - start_time) * 1000)
                logger.info(f"[tools_dispatcher] Product tool {tool_name} completed in {execution_time_ms}ms")
                return result

        result = await _dispatch_external_mcp_tool(
            tool_name, arguments, request, agent,
        )
        if result is not None:
            execution_time_ms = int((time.time() - start_time) * 1000)
            logger.info(f"[tools_dispatcher] External MCP tool {tool_name} completed in {execution_time_ms}ms")
            return result

        logger.error(f"[tools_dispatcher] Unknown tool: {tool_name}")
        raise ValueError(f"Unknown tool: {tool_name}")

    try:
        result = await tool.execute(help_center_config, arguments, request=request, language=language)

        execution_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"[tools_dispatcher] Tool {tool_name} completed in {execution_time_ms}ms")

        return result

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[tools_dispatcher] Error executing tool {tool_name}: {e}", exc_info=True)

        return {
            'success': False,
            'error': str(e),
            'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
            'isError': True
        }


async def dispatch_tool_call_stream(
    help_center_config, organization, request, params: Dict[str, Any],
    cancel_event=None, language: str = 'en', agent=None,
):
    """
    Dispatch a tool call with streaming response.

    Uses the unified ToolRegistry and calls execute_stream() for
    tools that support streaming. Falls back to product Actions for
    MCP agents (non-streaming HTTP POST, yielded as a single result).

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        request: HTTP request object
        params: Tool call parameters with 'name' and 'arguments'
        cancel_event: Optional asyncio.Event to signal cancellation
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')
        agent: Optional Agent model instance

    Yields:
        Event dictionaries compatible with SSE/WebSocket format
    """
    from apps.mcp.tools.registry import get_tool_registry
    from apps.mcp.tools.loader import load_all_tools_for_help_center

    call_start = time.time()

    tool_name = params.get('name')
    arguments = params.get('arguments', {})

    logger.info(f"[TIMING:mcp_server] tools_call_stream() called for tool: {tool_name}")

    await load_all_tools_for_help_center(help_center_config)

    registry = get_tool_registry()
    tool = registry.get_tool(tool_name, str(help_center_config.id))

    if not tool:
        if agent and getattr(agent, 'channel', None) == 'mcp':
            result = await _dispatch_product_tool(
                help_center_config, tool_name, arguments, request,
            )
            if result is not None:
                execution_time_ms = int((time.time() - call_start) * 1000)
                logger.info(f"[TIMING:mcp_server] Product tool {tool_name} completed in {execution_time_ms}ms")
                yield {'type': 'result', 'data': result}
                return

        ext_result = await _dispatch_external_mcp_tool(
            tool_name, arguments, request, agent,
        )
        if ext_result is not None:
            execution_time_ms = int((time.time() - call_start) * 1000)
            logger.info(f"[TIMING:mcp_server] External MCP tool {tool_name} completed in {execution_time_ms}ms")
            yield {'type': 'result', 'data': ext_result}
            return

        logger.error(f"[tools_dispatcher] Unknown tool for streaming: {tool_name}")
        yield {'type': 'error', 'message': f'Unknown tool: {tool_name}'}
        return

    try:
        if tool.supports_streaming:
            logger.debug(f"[tools_dispatcher] Using streaming execution for {tool_name}")
            async for event in tool.execute_stream(
                help_center_config, organization, request, arguments, cancel_event=cancel_event, language=language
            ):
                if cancel_event and cancel_event.is_set():
                    logger.info(f"[tools_dispatcher] Tool {tool_name} cancelled")
                    break

                yield event
        else:
            logger.debug(f"[tools_dispatcher] Using non-streaming execution for {tool_name}")
            result = await tool.execute(help_center_config, arguments, request=request, language=language)
            yield {'type': 'result', 'data': result}

        execution_time_ms = int((time.time() - call_start) * 1000)
        logger.info(f"[TIMING:mcp_server] Tool {tool_name} stream completed in {execution_time_ms}ms")

    except Exception as e:
        execution_time_ms = int((time.time() - call_start) * 1000)
        logger.error(f"[tools_dispatcher] Error in streaming tool {tool_name}: {e}", exc_info=True)
        yield {'type': 'error', 'message': f'Error: {str(e)}'}
