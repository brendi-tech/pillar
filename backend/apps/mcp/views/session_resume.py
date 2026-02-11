"""
Session Resumption API endpoints.

Status check endpoint — resume itself now flows through the ask tool pipeline.
"""
import logging
from django.http import JsonResponse
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
