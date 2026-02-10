"""
Session Resumption API endpoints.

Handles checking for resumable sessions and resuming interrupted conversations.
"""
import json
import logging
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.mcp.views.streamable_http import add_cors_headers

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
async def get_conversation_status(request, conversation_id: str):
    """
    Check if a conversation has a resumable interrupted session.
    
    GET /mcp/conversations/{conversation_id}/status
    
    Returns:
        {
            "resumable": true/false,
            "message_id": "uuid",
            "elapsed_ms": 5000,
            "user_message": "Build me a dashboard",
            "partial_response": "I'm creating...",
            "summary": "Executed 2 actions..."
        }
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        return add_cors_headers(response, request)
    
    from apps.mcp.services.session_resumption import get_resumable_session
    
    try:
        session = await get_resumable_session(conversation_id)
        
        if not session:
            response = JsonResponse({"resumable": False})
            return add_cors_headers(response, request)
        
        response = JsonResponse(session)
        return add_cors_headers(response, request)
        
    except Exception as e:
        logger.error(f"[SessionResume] Error getting conversation status: {e}", exc_info=True)
        response = JsonResponse({
            "error": "Failed to get conversation status",
            "message": str(e)
        }, status=500)
        return add_cors_headers(response, request)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
async def resume_conversation(request, conversation_id: str):
    """
    Resume an interrupted conversation.
    
    POST /mcp/conversations/{conversation_id}/resume
    
    Request body:
        {
            "user_context": {...}  // Optional current page context
        }
    
    Returns:
        SSE stream with resumed conversation
    """
    import asyncio
    from django.utils import timezone
    from apps.mcp.services.session_resumption import get_resumable_session, clear_disconnected_status
    from apps.mcp.services.mcp_server import MCPServer
    from apps.mcp.services.mcp_server.utils import get_effective_language
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        return add_cors_headers(response, request)
    
    try:
        # Parse request body
        try:
            body = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            body = {}
        
        user_context = body.get('user_context', {})
        
        # Get the resumable session
        session = await get_resumable_session(conversation_id)
        
        if not session or not session.get("resumable"):
            response = JsonResponse({
                "error": "No resumable session found",
                "resumable": False
            }, status=404)
            return add_cors_headers(response, request)
        
        # Get help center context from request
        help_center_config = getattr(request, 'help_center_config', None)
        organization = getattr(request, 'organization', None)
        
        if not help_center_config:
            response = JsonResponse({
                "error": "Help center context not found"
            }, status=400)
            return add_cors_headers(response, request)
        
        # Simple continuation prompt
        user_message = session.get("user_message", "")
        continuation_prompt = (
            f"{user_message}\n\n"
            "Continue completing the user's request. Don't repeat work already done."
        )
        
        # Clear the disconnected status before starting new stream
        message_id = session.get("message_id")
        if message_id:
            await clear_disconnected_status(message_id)
        
        # Initialize MCP server
        effective_language = get_effective_language(request, help_center_config)
        mcp_server = MCPServer(
            help_center_config=help_center_config,
            organization=organization,
            request=request,
            language=effective_language
        )
        
        # Stream the resumed conversation
        async def resume_stream():
            """Generate SSE events for resumed conversation."""
            from apps.mcp.services.agent import AgentAnswerServiceReActAsync
            from apps.mcp.services.agent.agentic_loop import run_agentic_loop
            
            # Create agent service with saved conversation history
            agent_service = AgentAnswerServiceReActAsync(
                help_center_config=help_center_config,
                organization=organization,
                conversation_history=session.get("llm_messages", []),
                registered_actions=session.get("registered_actions", []),
            )
            
            # Get session ID for query action correlation
            session_id = request.META.get('HTTP_MCP_SESSION_ID', '')
            
            collected_text = []
            
            try:
                async for event in run_agentic_loop(
                    service=agent_service,
                    question=continuation_prompt,
                    session_id=session_id,
                    registered_actions=session.get("registered_actions", []),
                ):
                    event_type = event.get('type')
                    
                    if event_type == 'token':
                        token_text = event.get('text', '')
                        collected_text.append(token_text)
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
                    
                    elif event_type == 'complete':
                        final_text = ''.join(collected_text)
                        result = {
                            'content': [{'type': 'text', 'text': final_text}],
                            'isError': False,
                            'structuredContent': {
                                'resumed': True,
                                'original_message_id': message_id,
                            }
                        }
                        
                        # Include registered actions
                        registered_actions = event.get('registered_actions', [])
                        if registered_actions:
                            result['structuredContent']['registered_actions'] = registered_actions
                        
                        final_response = {
                            'jsonrpc': '2.0',
                            'id': 'resume',
                            'result': result
                        }
                        yield f"data: {json.dumps(final_response)}\n\n"
                        return
                    
                    elif event_type == 'action_request':
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
                        
            except Exception as e:
                logger.error(f"[SessionResume] Error during resume stream: {e}", exc_info=True)
                error_response = {
                    'jsonrpc': '2.0',
                    'id': 'resume',
                    'error': {
                        'code': -32603,
                        'message': 'Error during session resumption',
                        'data': str(e)
                    }
                }
                yield f"data: {json.dumps(error_response)}\n\n"
        
        response = StreamingHttpResponse(
            resume_stream(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return add_cors_headers(response, request)
        
    except Exception as e:
        logger.error(f"[SessionResume] Error resuming conversation: {e}", exc_info=True)
        response = JsonResponse({
            "error": "Failed to resume conversation",
            "message": str(e)
        }, status=500)
        return add_cors_headers(response, request)
