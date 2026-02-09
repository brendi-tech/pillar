"""
Tools dispatcher for MCP server.

Routes tool calls to the unified ToolRegistry.

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging
import time
from typing import Dict, Any

from .utils import extract_request_metadata

logger = logging.getLogger(__name__)


async def dispatch_tool_call(
    help_center_config, organization, request, params: Dict[str, Any], language: str = 'en'
) -> Dict[str, Any]:
    """
    Dispatch a tool call to the appropriate Tool instance.

    Uses the unified ToolRegistry to find and execute tools.

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        request: HTTP request object
        params: Tool call parameters with 'name' and 'arguments'
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')

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

    # Ensure tools are loaded for this help center
    await load_all_tools_for_help_center(help_center_config)

    # Get tool from registry
    registry = get_tool_registry()
    tool = registry.get_tool(tool_name, str(help_center_config.id))

    if not tool:
        logger.error(f"[tools_dispatcher] Unknown tool: {tool_name}")
        raise ValueError(f"Unknown tool: {tool_name}")

    try:
        # Execute the tool
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
    help_center_config, organization, request, params: Dict[str, Any], cancel_event=None, language: str = 'en'
):
    """
    Dispatch a tool call with streaming response.

    Uses the unified ToolRegistry and calls execute_stream() for
    tools that support streaming.

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        request: HTTP request object
        params: Tool call parameters with 'name' and 'arguments'
        cancel_event: Optional asyncio.Event to signal cancellation
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')

    Yields:
        Event dictionaries compatible with SSE/WebSocket format
    """
    from apps.mcp.tools.registry import get_tool_registry
    from apps.mcp.tools.loader import load_all_tools_for_help_center

    call_start = time.time()

    tool_name = params.get('name')
    arguments = params.get('arguments', {})

    logger.info(f"[TIMING:mcp_server] tools_call_stream() called for tool: {tool_name}")

    # Ensure tools are loaded for this help center
    await load_all_tools_for_help_center(help_center_config)

    # Get tool from registry
    registry = get_tool_registry()
    tool = registry.get_tool(tool_name, str(help_center_config.id))

    if not tool:
        logger.error(f"[tools_dispatcher] Unknown tool for streaming: {tool_name}")
        yield {'type': 'error', 'message': f'Unknown tool: {tool_name}'}
        return

    success = True
    error_message = ''
    was_cancelled = False

    try:
        if tool.supports_streaming:
            # Use streaming execution
            logger.debug(f"[tools_dispatcher] Using streaming execution for {tool_name}")
            async for event in tool.execute_stream(
                help_center_config, organization, request, arguments, cancel_event=cancel_event, language=language
            ):
                # Check for cancellation
                if cancel_event and cancel_event.is_set():
                    logger.info(f"[tools_dispatcher] Tool {tool_name} cancelled")
                    was_cancelled = True
                    break

                # Track errors from stream
                if event.get('type') == 'error':
                    success = False
                    error_message = event.get('message', 'Unknown error')

                yield event
        else:
            # Fall back to non-streaming execution
            logger.debug(f"[tools_dispatcher] Using non-streaming execution for {tool_name}")
            result = await tool.execute(help_center_config, arguments, request=request, language=language)
            success = result.get('success', True)
            if not success:
                error_message = result.get('error', '')
            yield {'type': 'result', 'data': result}

        execution_time_ms = int((time.time() - call_start) * 1000)
        logger.info(f"[TIMING:mcp_server] Tool {tool_name} stream completed in {execution_time_ms}ms")

    except Exception as e:
        execution_time_ms = int((time.time() - call_start) * 1000)
        logger.error(f"[tools_dispatcher] Error in streaming tool {tool_name}: {e}", exc_info=True)
        yield {'type': 'error', 'message': f'Error: {str(e)}'}
