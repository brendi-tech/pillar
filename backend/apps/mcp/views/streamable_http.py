"""
MCP Streamable HTTP endpoint - unified JSON-RPC handler with streaming support.

Implements MCP specification 2025-06-18 with streamable HTTP transport.
Adapted for Help Center backend.

See: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http

Copyright (C) 2025 Pillar Team
"""
import logging
import json
import asyncio
from typing import Optional
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from asgiref.sync import sync_to_async

from apps.mcp.services.jsonrpc_handler import JSONRPCHandler, JSONRPCError
from apps.mcp.services.mcp_server import MCPServer
from apps.mcp.services.mcp_server.utils import get_effective_language

logger = logging.getLogger(__name__)

async def handle_client_log(params: dict, context: dict = None):
    """
    Handle client-side log forwarded from the SDK.
    
    Allows the SDK to send console logs to the server for debugging.
    Logs are written to:
    1. Server console (standard Django logging)
    2. Client session log file in logs/client-sessions/ (if enabled)
    
    Client log files are separate from agent session logs but linked
    via session ID in the header for easy correlation.
    
    Args:
        params: {
            level: 'log' | 'warn' | 'error',
            message: str,
            data?: Any,
            timestamp?: str (ISO format)
        }
        context: Request context with session_id
        
    Returns:
        Acknowledgment of receipt
    """
    from datetime import datetime
    from pathlib import Path
    from django.conf import settings
    
    level = params.get('level', 'log')
    message = params.get('message', '')
    data = params.get('data')
    timestamp = params.get('timestamp', '')
    session_id = context.get('session_id') if context else None
    
    # Build log message for console
    session_prefix = f"[{session_id[:8]}...]" if session_id else "[no-session]"
    ts_prefix = f"[{timestamp}]" if timestamp else ""
    data_suffix = f" | data: {json.dumps(data, default=str)[:200]}" if data else ""
    
    full_message = f"[CLIENT {level.upper()}] {session_prefix} {ts_prefix} {message}{data_suffix}"
    
    # Log to Django console
    if level == 'error':
        logger.error(full_message)
    elif level == 'warn':
        logger.warning(full_message)
    else:
        logger.info(full_message)
    
    # Write to client session log file (separate folder from agent logs)
    logged_to_file = False
    config = getattr(settings, 'AGENT_SESSION_LOGGING', {})
    if config.get('enabled', False) and session_id:
        try:
            # Client logs go in logs/client-sessions/ (parallel to agent-sessions/)
            base_log_dir = Path(settings.BASE_DIR) / 'logs'
            client_log_dir = base_log_dir / 'client-sessions'
            
            # Organize by month like agent sessions
            month_folder = datetime.now().strftime("%Y-%m")
            month_dir = client_log_dir / month_folder
            month_dir.mkdir(parents=True, exist_ok=True)
            
            # Filename with descending sort prefix for newest-first sorting, then session ID for lookup
            # Format: {sort_prefix}_{session_id_prefix}_{date}.txt
            now = datetime.now()
            sort_prefix = 9999999999 - int(now.timestamp())
            log_filename = f"{sort_prefix}_{session_id[:8]}_{now.strftime('%Y%m%d')}.txt"
            log_file = month_dir / log_filename
            
            # Check if file needs header (new file)
            is_new_file = not log_file.exists()
            
            with open(log_file, 'a', encoding='utf-8') as f:
                if is_new_file:
                    # Write header with session metadata
                    f.write("=" * 80 + "\n")
                    f.write("CLIENT SESSION LOG\n")
                    f.write("=" * 80 + "\n\n")
                    f.write(f"Session ID:      {session_id}\n")
                    f.write(f"Created:         {datetime.now().isoformat()}\n")
                    
                    # Link to corresponding agent session log
                    agent_log_dir = config.get('log_dir', base_log_dir / 'agent-sessions')
                    if isinstance(agent_log_dir, str):
                        agent_log_dir = Path(agent_log_dir)
                    matching_agent_logs = list(agent_log_dir.glob(f"**/*{session_id[:8]}*.txt"))
                    if matching_agent_logs:
                        agent_log = max(matching_agent_logs, key=lambda f: f.stat().st_mtime)
                        f.write(f"Agent Log:       {agent_log}\n")
                    else:
                        f.write(f"Agent Log:       (not found yet)\n")
                    
                    f.write("\n" + "=" * 80 + "\n")
                    f.write("LOGS\n")
                    f.write("=" * 80 + "\n\n")
                
                # Write log entry
                level_marker = {'log': 'LOG', 'warn': 'WARN', 'error': 'ERR'}.get(level, 'LOG')
                ts = timestamp or datetime.now().isoformat()
                f.write(f"[{ts}] [{level_marker}] {message}\n")
                if data:
                    f.write(f"    Data: {json.dumps(data, default=str)[:500]}\n")
            
            logged_to_file = True
        except Exception as e:
            logger.warning(f"[CLIENT LOG] Failed to write to file: {e}")
    
    return {'received': True, 'logged_to_file': logged_to_file}


async def handle_client_log_batch(params: dict, context: dict = None):
    """
    Handle a batch of client-side logs forwarded from the SDK.
    
    The SDK buffers logs and sends them every 5 seconds to reduce
    network requests. This handler processes all logs in the batch.
    
    Args:
        params: {
            logs: Array of {level, message, data?, timestamp?}
        }
        context: Request context with session_id
        
    Returns:
        Acknowledgment with count of logs received
    """
    logs = params.get('logs', [])
    
    if not logs:
        return {'received': True, 'count': 0}
    
    session_id = context.get('session_id') if context else None
    logger.info(f"[CLIENT LOG BATCH] Received {len(logs)} logs | session: {session_id[:8] if session_id else 'none'}...")
    
    # Process each log using the single-log handler
    logged_count = 0
    for log in logs:
        # Each log entry has: level, message, data, timestamp
        log_params = {
            'level': log.get('level', 'log'),
            'message': log.get('message', ''),
            'data': log.get('data'),
            'timestamp': log.get('timestamp', ''),
        }
        result = await handle_client_log(log_params, context)
        if result.get('received'):
            logged_count += 1
    
    return {'received': True, 'count': logged_count}


async def handle_action_result(params: dict, context: dict = None):
    """
    Handle action result from client SDK.
    
    Called when a query action (type=query or returns_data=true) completes
    execution on the client and sends its result back to the agent for
    further reasoning.
    
    This function signals the waiting agentic loop via signal_query_result(),
    which sets an asyncio.Event that the loop is waiting on.
    
    Args:
        params: {action_name: str, result: Any, tool_call_id: str}
        context: Request context with session_id
        
    Returns:
        Acknowledgment of receipt with signaled status
    """
    action_name = params.get('action_name')
    result = params.get('result')
    tool_call_id = params.get('tool_call_id')
    session_id = context.get('session_id') if context else None
    
    result_info = (
        list(result.keys()) if isinstance(result, dict) 
        else type(result).__name__
    )
    
    logger.info(
        f"[action/result] Received result for action: {action_name} "
        f"| session: {session_id[:8] if session_id else 'none'}... "
        f"| tool_call_id: {tool_call_id} "
        f"| result: {result_info}"
    )
    
    signaled = False
    if session_id and action_name and tool_call_id:
        # Signal the waiting agentic loop
        from apps.mcp.services.agent.helpers import signal_query_result
        signaled = signal_query_result(session_id, action_name, result, tool_call_id)
    else:
        logger.warning(
            f"[action/result] Missing session_id, action_name, or tool_call_id, cannot signal"
        )
    
    return {
        'received': True,
        'action_name': action_name,
        'tool_call_id': tool_call_id,
        'signaled': signaled,
    }


# NOTE: handle_step_result removed - execute_step superseded by action_request


async def handle_cancel_notification(params: dict, context: dict = None):
    """
    Handle cancellation request from client SDK.

    Called when the user clicks the Stop button to cancel an in-progress
    streaming request. Signals the StreamRegistry to set the cancel event,
    which propagates through the agentic loop and closes the LLM stream.

    Args:
        params: {request_id: str} - the JSON-RPC request ID of the stream to cancel
        context: Request context (unused)

    Returns:
        Acknowledgment with cancelled status
    """
    from apps.mcp.services.stream_registry import stream_registry

    request_id = params.get('request_id')
    if request_id:
        cancelled = stream_registry.cancel(str(request_id))
        logger.info(f"[Cancel] request_id={request_id} cancelled={cancelled}")
        return {'cancelled': cancelled}

    logger.warning("[Cancel] Missing request_id in cancellation request")
    return {'cancelled': False}


def add_cors_headers(response, request):
    """Add CORS headers to response."""
    response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Mcp-Session-Id, X-Help-Center-Id'
    response['Access-Control-Allow-Credentials'] = 'true'
    response['Access-Control-Expose-Headers'] = 'Mcp-Session-Id'
    return response


def get_session_id(request) -> Optional[str]:
    """Extract MCP session ID from request headers."""
    return request.META.get('HTTP_MCP_SESSION_ID')


def set_session_id(response, session_id: Optional[str]):
    """Set MCP session ID in response headers."""
    if session_id:
        response['Mcp-Session-Id'] = session_id
    return response


async def stream_event_generator(mcp_server: MCPServer, request_data: dict, session_id: Optional[str] = None, request=None):
    """
    Generate SSE events for streaming AI responses using JSON-RPC 2.0 format.

    Yields SSE-formatted events following JSON-RPC 2.0 over Streamable HTTP transport (MCP 2025-06-18):
    - Progress notifications (tokens) as JSON-RPC notifications
    - Final response as JSON-RPC response with request ID

    Handles client disconnection by saving interrupt state for session resumption.

    Args:
        mcp_server: MCPServer instance with help center context
        request_data: Parsed JSON-RPC request
        session_id: Optional MCP session ID for stateful interactions
        request: Django request object (ASGIRequest) for disconnect detection

    Yields:
        SSE-formatted event strings with JSON-RPC messages
    """
    from django.utils import timezone
    from apps.mcp.services.session_resumption import mark_completed, mark_disconnected
    
    request_id = request_data.get('id')
    method = request_data.get('method')
    params = request_data.get('params', {})
    
    # Unified flush state -- one dict, one periodic writer
    flush_state = {
        "assistant_message_id": None,
        "streaming_started_at": timezone.now(),
        "stream_completed": False,
        # Updated by state_checkpoint events and token events
        "llm_messages": [],
        "display_trace": [],
        "registered_actions": [],
        "model_used": "",
        "prompt_tokens": None,
        "completion_tokens": None,
        "peak_context_occupancy": None,
        "dirty": False,
        "last_flush_time": None,
    }
    _flush_task: asyncio.Task | None = None

    async def _flush_all(message_id: str, collected_text: list, state: dict):
        """Write content + llm_message + display_trace to DB in one update."""
        from apps.analytics.models import ChatMessage
        content = ''.join(collected_text)
        llm_message = {
            "messages": state.get("llm_messages", []),
            "registered_actions": state.get("registered_actions", []),
        }
        updates = {
            "content": content,
            "llm_message": llm_message,
            "display_trace": state.get("display_trace", []),
        }
        if state.get("model_used"):
            updates["model_used"] = state["model_used"]
        if state.get("prompt_tokens") is not None:
            updates["prompt_tokens"] = state["prompt_tokens"]
            updates["completion_tokens"] = state.get("completion_tokens") or 0
            updates["total_tokens"] = (state["prompt_tokens"] or 0) + (state.get("completion_tokens") or 0)
        if state.get("peak_context_occupancy") is not None:
            updates["peak_context_occupancy"] = state["peak_context_occupancy"]
        await ChatMessage.objects.filter(id=message_id, role='assistant').aupdate(**updates)

    # Validate streaming is requested for tools/call
    if method != 'tools/call':
        error_response = {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': JSONRPCError.METHOD_NOT_FOUND,
                'message': 'Only tools/call method supports streaming',
                'data': f'Method {method} cannot be streamed'
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"
        return

    # Extract tool call parameters
    tool_name = params.get('name')
    arguments = params.get('arguments', {})

    if not tool_name:
        error_response = {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': JSONRPCError.INVALID_PARAMS,
                'message': 'Missing tool name',
                'data': 'tools/call requires "name" parameter'
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"
        return

    # Register stream for cancellation support
    from apps.mcp.services.stream_registry import stream_registry

    stream_id = str(request_id) if request_id else f"stream-{id(request_data)}"
    cancel_event = stream_registry.register(stream_id)

    # Bridge ASGI disconnect detection to cancel_event.
    # When ASGIDisconnectMiddleware detects a client disconnect (browser tab
    # close, hard refresh), it sets disconnect_event on the ASGI scope.
    # This monitor task polls that event and sets cancel_event, which is
    # already checked every 100ms by wait_for_query_result and at the top
    # of each agentic loop iteration.
    disconnect_monitor_task = None
    if request and hasattr(request, 'scope'):
        disconnect_event = request.scope.get('_disconnect_event')
        if disconnect_event:
            async def _monitor_disconnect():
                """Wait for ASGI disconnect signal then set cancel_event."""
                while not disconnect_event.is_set():
                    await asyncio.sleep(0.1)
                cancel_event.set()
                logger.info(
                    f"[Streamable HTTP] Stream {stream_id} disconnect detected via ASGI"
                )
            disconnect_monitor_task = asyncio.create_task(_monitor_disconnect())

    try:
        # Stream tool execution
        import time
        event_count = 0
        collected_text = []
        final_sources = None
        final_actions = None
        final_structured_content = {}
        stream_start_time = time.time()

        logger.info(f"[TIMING:streamable_http] Starting tool stream for {tool_name}")

        async for event in mcp_server.tools_call_stream({'name': tool_name, 'arguments': arguments}, cancel_event=cancel_event):
            # Check for cancellation
            if cancel_event.is_set():
                logger.info(f"[Streamable HTTP] Stream {stream_id} cancelled by user")
                cancel_notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'cancelled',
                            'message': 'Stream cancelled by user'
                        }
                    }
                }
                yield f"data: {json.dumps(cancel_notification)}\n\n"
                break

            # Log first event timing
            if event_count == 0:
                first_event_time = time.time()
                logger.info(f"[TIMING:streamable_http] First event received (+{(first_event_time - stream_start_time)*1000:.1f}ms)")

            event_count += 1
            event_type = event.get('type')
            logger.debug(f"[SSE DEBUG] Event {event_count}: type={event_type}, keys={list(event.keys())}")

            if event_type == 'state_checkpoint':
                # Internal event -- update flush_state, don't yield to client
                flush_state["llm_messages"] = event.get("llm_messages", [])
                flush_state["display_trace"] = event.get("display_trace", [])
                flush_state["registered_actions"] = event.get("registered_actions", [])
                flush_state["model_used"] = event.get("model_used", "")
                flush_state["prompt_tokens"] = event.get("prompt_tokens")
                flush_state["completion_tokens"] = event.get("completion_tokens")
                flush_state["peak_context_occupancy"] = event.get("peak_context_occupancy")
                flush_state["dirty"] = True

            elif event_type == 'token':
                # Stream text tokens
                token_text = event.get('text', '')
                collected_text.append(token_text)
                flush_state["dirty"] = True
                logger.debug(f"[SSE DEBUG] Received token event ({len(token_text)} chars): {token_text[:80]}...")

                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'token',
                            'token': token_text
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)

            elif event_type == 'progress':
                # Unified progress event handler - expects nested structure with 'data' key
                progress_data = event.get('data', {})
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': progress_data
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)

            elif event_type == 'debug':
                # Debug event for SDK DebugPanel - forward as progress notification
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'type': 'debug',
                            'event': event.get('event', 'server:event'),
                            'data': event.get('data', {}),
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)

            elif event_type == 'sources':
                # Store sources for final response
                final_sources = event.get('sources', [])
                logger.debug(f"[SSE DEBUG] Received sources event ({len(final_sources)} sources)")

            elif event_type == 'actions':
                # Store actions for final response
                final_actions = event.get('actions', [])
                logger.debug(f"[SSE DEBUG] Received actions event ({len(final_actions)} actions)")

            elif event_type == 'conversation_started':
                # Track assistant message ID for flush
                flush_state["assistant_message_id"] = event.get('assistant_message_id', '')
                
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'conversation_started',
                            'conversation_id': event.get('conversation_id', ''),
                            'assistant_message_id': event.get('assistant_message_id', ''),
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)
                logger.info(f"[SSE DEBUG] Sent conversation_started (conv_id: {event.get('conversation_id', '')[:8]}...)")

            elif event_type == 'token_usage':
                # Token usage update - sent after each LLM iteration for context gauge
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'token_usage',
                            **event.get('data', {}),
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)

            elif event_type == 'plan.created':
                # Store plan for final response
                plan = event.get('plan', {})
                final_structured_content['plan'] = plan
                logger.info(f"[SSE DEBUG] Received plan.created event (plan_id: {plan.get('id')}, steps: {len(plan.get('steps', []))})")

            # NOTE: 'query_request' handler removed - superseded by 'action_request'

            elif event_type == 'action_request':
                # Action request - agent wants SDK to execute an action
                action_name = event.get('action_name', '')
                
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'action_request',
                            'action_name': action_name,
                            'parameters': event.get('parameters', {}),
                            'action': event.get('action', {}),
                            'tool_call_id': event.get('tool_call_id', ''),
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)
                logger.info(f"[SSE DEBUG] Sent action_request for action: {action_name} (tool_call_id: {event.get('tool_call_id')})")

            elif event_type == 'execute_step':
                # Execute step - agent wants client to execute a plan step
                # Action request - agent wants SDK to execute an action
                # This is the unified action execution event from the agentic loop
                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'action_request',
                            'action_name': event.get('action_name', ''),
                            'parameters': event.get('parameters', {}),
                            'action': event.get('action', {}),
                            'tool_call_id': event.get('tool_call_id', ''),
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)
                logger.info(f"[SSE DEBUG] Sent action_request for action: {event.get('action_name')} (tool_call_id: {event.get('tool_call_id')})")

            # NOTE: 'execute_step' handler removed - superseded by 'action_request'

            elif event_type == 'search_results_batch':
                # Stream batch of search results
                batch_results = event.get('results', [])
                source = event.get('source', 'unknown')
                count = event.get('count', len(batch_results))

                notification = {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {
                            'kind': 'search_results_batch',
                            'results': batch_results,
                            'source': source,
                            'count': count
                        }
                    }
                }
                yield f"data: {json.dumps(notification)}\n\n"
                await asyncio.sleep(0)

            elif event_type == 'search_complete':
                # Search complete - send final response
                total_results = event.get('total_results', 0)
                query = event.get('query', '')
                results = event.get('results', [])

                if total_results > 0:
                    text = f"Found {total_results} result{'s' if total_results != 1 else ''} for '{query}'."
                else:
                    text = f"No results found for '{query}'."

                final_response = {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [{'type': 'text', 'text': text}],
                        'isError': False,
                        'structuredContent': {
                            'results': results,
                            'total_results': total_results,
                            'query': query
                        }
                    }
                }

                yield f"data: {json.dumps(final_response)}\n\n"
                return

            elif event_type == 'complete':
                # Streaming complete - build and send final response
                logger.info(f"[SSE DEBUG] Received 'complete' signal - building final response")
                flush_state["stream_completed"] = True

                final_text = ''.join(collected_text)

                result = {
                    'content': [{'type': 'text', 'text': final_text}],
                    'isError': False
                }

                # Build structured content
                structured_content = {}
                if final_sources:
                    structured_content['sources'] = final_sources
                if final_actions:
                    structured_content['actions'] = final_actions

                for key, data in final_structured_content.items():
                    structured_content[key] = data
                
                # Include registered_actions for SDK persistence (dynamic action tools)
                registered_actions = event.get('registered_actions', [])
                if registered_actions:
                    structured_content['registered_actions'] = registered_actions
                    logger.info(f"[SSE DEBUG] Including {len(registered_actions)} registered actions for SDK")

                if structured_content:
                    result['structuredContent'] = structured_content
                    logger.info(f"[SSE DEBUG] Final structuredContent keys: {list(structured_content.keys())}")

                # Send final result
                final_response = {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': result
                }

                yield f"data: {json.dumps(final_response)}\n\n"
                
                # Final flush + mark completed
                if flush_state.get("assistant_message_id"):
                    # Await in-flight flush to prevent race
                    if _flush_task and not _flush_task.done():
                        await _flush_task
                    # Pull final state from complete event
                    flush_state["display_trace"] = event.get("display_trace", flush_state["display_trace"])
                    flush_state["registered_actions"] = event.get("registered_actions", flush_state["registered_actions"])
                    await _flush_all(flush_state["assistant_message_id"], collected_text, flush_state)
                    latency_ms = int((time.time() - stream_start_time) * 1000)
                    await mark_completed(flush_state["assistant_message_id"], latency_ms=latency_ms)
                
                logger.debug(f"[Streamable HTTP] Stream complete. Events sent: {event_count + 1}")
                return

            elif event_type == 'error':
                # Stream error - check if recoverable
                error_message = event.get('message', 'Stream error')
                is_recoverable = event.get('recoverable', False)
                is_terminal = event.get('terminal', True)
                
                if is_recoverable and not is_terminal:
                    # Recoverable error - emit as tool_error event so agent can decide
                    logger.info(f"[SSE DEBUG] Recoverable error, forwarding to agent: {error_message}")
                    tool_error_event = {
                        'type': 'tool_error',
                        'error': error_message,
                        'recoverable': True,
                        'data': event.get('data'),
                    }
                    yield f"data: {json.dumps(tool_error_event)}\n\n"
                    # Don't return - continue streaming so agent can attempt recovery
                else:
                    # Terminal error - flush + mark disconnected so row isn't stuck as 'streaming'
                    logger.warning(f"[SSE DEBUG] Terminal error, ending stream: {error_message}")
                    if flush_state.get("assistant_message_id"):
                        if _flush_task and not _flush_task.done():
                            await _flush_task
                        await _flush_all(flush_state["assistant_message_id"], collected_text, flush_state)
                        await mark_disconnected(flush_state["assistant_message_id"])
                    error_response = {
                        'jsonrpc': '2.0',
                        'id': request_id,
                        'error': {
                            'code': JSONRPCError.INTERNAL_ERROR,
                            'message': error_message,
                            'data': event.get('data')
                        }
                    }
                    yield f"data: {json.dumps(error_response)}\n\n"
                    return

            elif event_type == 'result':
                # Non-streaming result wrapper (final response)
                result_data = event.get('data', {})
                response = {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': result_data
                }
                yield f"data: {json.dumps(response)}\n\n"
                return

            # Periodic flush (~2s) -- fire-and-forget, snapshot values
            now = time.time()
            if (
                flush_state["assistant_message_id"]
                and flush_state["dirty"]
                and (flush_state["last_flush_time"] is None or now - flush_state["last_flush_time"] >= 2.0)
            ):
                flush_state["last_flush_time"] = now
                flush_state["dirty"] = False
                # Snapshot collected_text as a shallow copy so the task is safe
                snap_text = list(collected_text)
                snap_state = dict(flush_state)
                _flush_task = asyncio.create_task(
                    _flush_all(flush_state["assistant_message_id"], snap_text, snap_state)
                )

        # Fallback: stream ended without 'complete' event (disconnect or exhausted generator)
        if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
            if _flush_task and not _flush_task.done():
                await _flush_task
            await _flush_all(flush_state["assistant_message_id"], collected_text, flush_state)
            await mark_disconnected(flush_state["assistant_message_id"])
            flush_state["stream_completed"] = True
            logger.info(f"[Streamable HTTP] Stream {stream_id} ended without complete -- flushed + marked disconnected")

    except asyncio.CancelledError:
        cancel_event.set()
        logger.info(f"[Streamable HTTP] Stream {stream_id} cancelled (client disconnect)")
        if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
            if _flush_task and not _flush_task.done():
                await _flush_task
            await _flush_all(flush_state["assistant_message_id"], collected_text, flush_state)
            await mark_disconnected(flush_state["assistant_message_id"])
        raise
        
    except Exception as e:
        logger.error(f"Streamable HTTP streaming error: {e}", exc_info=True)
        
        # Flush + mark disconnected so the row isn't stuck as 'streaming'
        if flush_state.get("assistant_message_id") and not flush_state.get("stream_completed"):
            if _flush_task and not _flush_task.done():
                await _flush_task
            await _flush_all(flush_state["assistant_message_id"], collected_text, flush_state)
            await mark_disconnected(flush_state["assistant_message_id"])
        
        error_response = {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': JSONRPCError.INTERNAL_ERROR,
                'message': 'Internal server error during streaming',
                'data': str(e)
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"
    finally:
        # Cancel the disconnect monitor task if it's still running
        if disconnect_monitor_task:
            disconnect_monitor_task.cancel()
        # Always cleanup stream from registry
        stream_registry.cleanup(stream_id)
        logger.debug(f"[Streamable HTTP] Stream {stream_id} cleaned up from registry")


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
async def streamable_http(request):
    """
    MCP Streamable HTTP endpoint - unified transport for MCP protocol.

    Implements MCP specification 2025-06-18 with streamable HTTP transport.
    This endpoint supports both standard JSON-RPC requests and streaming SSE responses
    on the same route, with session management via Mcp-Session-Id header.

    Help center context is resolved via HelpCenterResolverMiddleware from Host header.
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        return add_cors_headers(response, request)

    # Handle GET - return service info (browser-friendly)
    if request.method == 'GET':
        try:
            from apps.mcp.services.server_info_service import server_info_service
            help_center_config = getattr(request, 'help_center_config', None)
            logger.info(f"[Streamable HTTP GET] Help center resolved: {help_center_config}")

            # Wrap the sync DB call in sync_to_async
            response_data = await sync_to_async(
                server_info_service.get_landing_page_response
            )(help_center_config=help_center_config)

            # Always pretty print for GET
            json_dumps_params = {'indent': 2}

            status_code = 400 if 'error' in response_data else 200
            response = JsonResponse(response_data, status=status_code, json_dumps_params=json_dumps_params)
            return add_cors_headers(response, request)
        except Exception as e:
            logger.error(f"[Streamable HTTP GET] Error generating response: {e}", exc_info=True)
            return JsonResponse({
                'error': 'Internal Server Error',
                'message': str(e),
                'type': type(e).__name__
            }, status=500)

    # Extract session ID from headers
    session_id = get_session_id(request)

    # Parse JSON body
    try:
        request_data = json.loads(request.body)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        response = JsonResponse({
            'jsonrpc': '2.0',
            'id': None,
            'error': {
                'code': JSONRPCError.PARSE_ERROR,
                'message': 'Parse error',
                'data': str(e)
            }
        }, status=400)
        response = set_session_id(response, session_id)
        return add_cors_headers(response, request)

    # Get help center from middleware or request params
    help_center_config = getattr(request, 'help_center_config', None)
    organization = getattr(request, 'organization', None)

    # Fallback: allow help_center_id in params for development
    if not help_center_config and isinstance(request_data, dict):
        params = request_data.get('params', {})
        if isinstance(params, dict) and 'help_center_id' in params:
            from apps.products.models import Product
            try:
                help_center_config = await Product.objects.select_related('organization').aget(
                    id=params['help_center_id']
                )
                organization = help_center_config.organization
            except Product.DoesNotExist:
                logger.warning(f"Help center not found: {params['help_center_id']}")

    # Determine if streaming is requested
    accept_header = request.META.get('HTTP_ACCEPT', '')
    wants_stream = 'text/event-stream' in accept_header

    # Check if params explicitly request streaming
    params = request_data.get('params', {})
    if isinstance(params, dict) and params.get('stream'):
        wants_stream = True

    # Check method - only tools/call supports streaming
    method = request_data.get('method')

    if wants_stream and method == 'tools/call':
        # Return SSE stream
        logger.info(f"[Streamable HTTP] Starting SSE stream for {method} | request_id: {request_data.get('id')}")

        # Determine effective language for AI responses
        effective_language = get_effective_language(request, help_center_config)

        # Initialize MCP server with help center context
        mcp_server = MCPServer(
            help_center_config=help_center_config,
            organization=organization,
            request=request,
            language=effective_language
        )

        response = StreamingHttpResponse(
            stream_event_generator(mcp_server, request_data, session_id, request=request),
            content_type='text/event-stream; charset=utf-8'
        )
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate, no-transform'
        response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
        response['Connection'] = 'keep-alive'
        response._has_been_logged = True
        response = set_session_id(response, session_id)
        return add_cors_headers(response, request)

    # Standard JSON-RPC request
    logger.debug(f"[Streamable HTTP] Processing {method} | help_center: {help_center_config.id if help_center_config else 'None'}")

    # Determine effective language for AI responses
    effective_language = get_effective_language(request, help_center_config)

    # Initialize MCP server with help center context
    mcp_server = MCPServer(
        help_center_config=help_center_config,
        organization=organization,
        request=request,
        language=effective_language
    )

    # Initialize JSON-RPC handler
    handler = JSONRPCHandler()

    # Register MCP methods
    handler.register('initialize', mcp_server.initialize)
    handler.register('notifications/initialized', mcp_server.notifications_initialized)
    handler.register('ping', mcp_server.ping)
    handler.register('tools/list', mcp_server.tools_list)
    handler.register('tools/call', mcp_server.tools_call)
    handler.register('resources/list', mcp_server.resources_list)
    handler.register('resources/read', mcp_server.resources_read)
    handler.register('prompts/list', mcp_server.prompts_list)
    handler.register('prompts/get', mcp_server.prompts_get)
    
    # Query Action result handler (for actions with returns_data=true)
    handler.register('action/result', handle_action_result)
    
    # NOTE: step/result handler removed - execute_step superseded by action_request
    
    # Stream cancellation handler (for Stop button)
    handler.register('notifications/cancel', handle_cancel_notification)

    # Client log handlers (for SDK console log forwarding)
    handler.register('client/log', handle_client_log)
    handler.register('client/log-batch', handle_client_log_batch)

    # Handle request
    context = {
        'help_center_config': help_center_config,
        'organization': organization,
        'request': request,
        'session_id': session_id
    }

    # Handle request (handler is now async)
    response_data = await handler.handle_request(request_data, context)
    logger.debug(f"[Streamable HTTP] {method} completed | size: {len(str(response_data)) if response_data else 0} bytes")

    # If response_data is None, this was a notification - return 200 OK with empty response
    if response_data is None:
        response = JsonResponse({}, status=200)
        response = set_session_id(response, session_id)
        return add_cors_headers(response, request)

    # Check if pretty printing is requested
    pretty = request.GET.get('pretty', '').lower() in ('true', '1', 'yes')
    json_dumps_params = {'indent': 2} if pretty else {}

    # Convert to Django response and add headers
    response = handler.create_django_response(response_data, json_dumps_params=json_dumps_params)
    response = set_session_id(response, session_id)
    return add_cors_headers(response, request)
