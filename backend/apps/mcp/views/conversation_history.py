"""
Conversation history endpoints for retrieving past conversations.

Enables users to see and continue their conversation history.
Visitors are identified by x-visitor-id header, with optional
x-external-user-id for cross-device history.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Optional

from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.analytics.models import ChatConversation, ChatMessage, Visitor
from apps.analytics.services.visitor_service import get_visitor_service
from common.utils.cors import add_cors_headers

logger = logging.getLogger(__name__)


# Use shared CORS utility
_add_cors_headers = add_cors_headers


def _extract_gcs_path(signed_url: str) -> Optional[str]:
    """Extract the storage path from a GCS signed URL.

    GCS signed URLs look like:
        https://storage.googleapis.com/{bucket}/{path}?X-Goog-Algorithm=...

    Returns the path portion, or None if the URL doesn't match.
    """
    bucket_name = getattr(settings, 'GS_BUCKET_NAME', 'pillar-storage')
    prefix = f'https://storage.googleapis.com/{bucket_name}/'
    if not signed_url.startswith(prefix):
        return None
    # Everything after the bucket prefix, up to the query string
    path_and_query = signed_url[len(prefix):]
    path = path_and_query.split('?', 1)[0]
    return path if path else None


def _refresh_image_urls(images: list[dict]) -> list[dict]:
    """Re-sign image URLs so they aren't expired when serving history.

    For each image dict:
    - If ``path`` is present, generate a fresh signed URL from it.
    - If only ``url`` exists (legacy), try to extract the GCS path and re-sign.
    - Non-GCS / local dev URLs are returned unchanged.
    """
    storage_backend = getattr(settings, 'STORAGE_BACKEND', 'local')
    if storage_backend not in ('gcs', 's3'):
        return images  # local dev -- URLs don't expire

    refreshed = []
    for img in images:
        img = dict(img)  # shallow copy so we don't mutate the DB object
        path = img.get('path')
        if not path:
            # Legacy: try to extract path from the signed URL
            path = _extract_gcs_path(img.get('url', ''))
        if path:
            try:
                img['url'] = default_storage.url(path)
                img['path'] = path  # ensure path is always present going forward
            except Exception as e:
                logger.warning(f"[ConversationHistory] Failed to re-sign image {path}: {e}")
        refreshed.append(img)
    return refreshed


async def _resolve_visitor(
    organization_id: str,
    visitor_id: str,
    external_user_id: Optional[str] = None,
) -> Optional[Visitor]:
    """
    Resolve visitor for history lookup.
    
    Priority:
    1. If external_user_id provided, find visitor by external_user_id ONLY
       (no fallback - identified users should only see their own history)
    2. Otherwise, find visitor by visitor_id (anonymous case)
    """
    # Identified user case - use ONLY external_user_id
    if external_user_id:
        try:
            return await Visitor.objects.aget(
                organization_id=organization_id,
                external_user_id=external_user_id,
            )
        except Visitor.DoesNotExist:
            # User is identified but has no visitor record yet
            # Return None - don't fall back to visitor_id
            return None
        except Exception as e:
            logger.warning(f"[ConversationHistory] Failed to resolve visitor by external_user_id: {e}")
            return None
    
    # Anonymous case - use visitor_id
    if not visitor_id:
        return None
    
    try:
        return await Visitor.objects.aget(
            organization_id=organization_id,
            visitor_id=visitor_id,
        )
    except Visitor.DoesNotExist:
        return None
    except Exception as e:
        logger.warning(f"[ConversationHistory] Failed to resolve visitor by visitor_id: {e}")
        return None


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
async def list_conversations(request):
    """
    List conversation history for a visitor.
    
    GET /mcp/conversations/
    
    Headers:
        x-visitor-id: Required - Persistent browser ID from SDK
        x-external-user-id: Optional - Client's authenticated user ID
    
    Query params:
        limit: Max conversations to return (default: 20, max: 50)
    
    Returns:
        {
            "conversations": [
                {
                    "id": "uuid",
                    "title": "How do I export data?",
                    "startedAt": "2024-01-15T10:30:00Z",
                    "lastMessageAt": "2024-01-15T10:32:00Z",
                    "messageCount": 4
                }
            ]
        }
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=200)
        return _add_cors_headers(response, request)
    
    # Get help center context from middleware
    help_center_config = getattr(request, 'help_center_config', None)
    organization = getattr(request, 'organization', None)
    
    if not help_center_config or not organization:
        response = JsonResponse(
            {'error': 'Help center context not available'},
            status=403
        )
        return _add_cors_headers(response, request)
    
    # Get analytics context from middleware
    analytics = getattr(request, 'analytics', {})
    visitor_id = analytics.get('visitor_id', '')
    external_user_id = analytics.get('external_user_id', '')
    
    if not visitor_id:
        response = JsonResponse(
            {'error': 'x-visitor-id header required'},
            status=400
        )
        return _add_cors_headers(response, request)
    
    # Resolve visitor
    visitor = await _resolve_visitor(
        organization_id=str(organization.id),
        visitor_id=visitor_id,
        external_user_id=external_user_id or None,
    )
    
    if not visitor:
        # No visitor record yet - return empty history
        response = JsonResponse({'conversations': []})
        return _add_cors_headers(response, request)
    
    # Get query params
    try:
        limit = min(int(request.GET.get('limit', 20)), 50)
    except (ValueError, TypeError):
        limit = 20
    
    # Query conversations with message counts in a single query (avoids N+1)
    conversations_qs = ChatConversation.objects.filter(
        visitor=visitor,
        product=help_center_config,
        logging_enabled=True,
    ).annotate(
        message_count=Count('messages')
    ).order_by('-last_message_at').values(
        'id', 'title', 'started_at', 'last_message_at', 'message_count'
    )[:limit]

    conversations = []
    async for conv in conversations_qs:
        conversations.append({
            'id': str(conv['id']),
            'title': conv['title'] or 'Untitled conversation',
            'startedAt': conv['started_at'].isoformat() if conv['started_at'] else None,
            'lastMessageAt': conv['last_message_at'].isoformat() if conv['last_message_at'] else None,
            'messageCount': conv['message_count'],
        })
    
    response = JsonResponse({'conversations': conversations})
    return _add_cors_headers(response, request)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
async def get_conversation(request, conversation_id: str):
    """
    Get a single conversation with messages.
    
    GET /mcp/conversations/{conversation_id}/
    
    Headers:
        x-visitor-id: Required - Persistent browser ID from SDK
        x-external-user-id: Optional - Client's authenticated user ID
    
    Returns:
        {
            "id": "uuid",
            "title": "How do I export data?",
            "startedAt": "2024-01-15T10:30:00Z",
            "lastMessageAt": "2024-01-15T10:32:00Z",
            "messageCount": 4,
            "messages": [
                {
                    "id": "uuid",
                    "role": "user",
                    "content": "How do I export data?",
                    "timestamp": "2024-01-15T10:30:00Z"
                },
                ...
            ]
        }
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=200)
        return _add_cors_headers(response, request)
    
    # Get help center context from middleware
    help_center_config = getattr(request, 'help_center_config', None)
    organization = getattr(request, 'organization', None)
    
    if not help_center_config or not organization:
        response = JsonResponse(
            {'error': 'Help center context not available'},
            status=403
        )
        return _add_cors_headers(response, request)
    
    # Get analytics context from middleware
    analytics = getattr(request, 'analytics', {})
    visitor_id = analytics.get('visitor_id', '')
    external_user_id = analytics.get('external_user_id', '')
    
    if not visitor_id:
        response = JsonResponse(
            {'error': 'x-visitor-id header required'},
            status=400
        )
        return _add_cors_headers(response, request)
    
    # Resolve visitor
    visitor = await _resolve_visitor(
        organization_id=str(organization.id),
        visitor_id=visitor_id,
        external_user_id=external_user_id or None,
    )
    
    if not visitor:
        response = JsonResponse(
            {'error': 'Conversation not found'},
            status=404
        )
        return _add_cors_headers(response, request)
    
    # Get conversation
    try:
        conversation = await ChatConversation.objects.aget(
            id=conversation_id,
            visitor=visitor,
            product=help_center_config,
        )
    except ChatConversation.DoesNotExist:
        response = JsonResponse(
            {'error': 'Conversation not found'},
            status=404
        )
        return _add_cors_headers(response, request)
    
    # Get messages (exclude tool role from display)
    messages = []
    async for msg in ChatMessage.objects.filter(
        conversation=conversation
    ).order_by('timestamp'):
        # Skip tool messages - they're internal to the agentic loop
        if msg.role == 'tool':
            continue
        
        display_trace = msg.display_trace or []
        display_trace_types = [s.get('step_type') for s in display_trace] if display_trace else []
        
        # Debug logging for display_trace
        logger.info(
            f"[get_conversation] Message {msg.id}: role={msg.role}, "
            f"content_len={len(msg.content or '')}, "
            f"display_trace_steps={len(display_trace)}, types={display_trace_types}"
        )
            
        message_data = {
            'id': str(msg.id),
            'role': msg.role,
            'content': msg.content,
            'timestamp': msg.timestamp.isoformat() if msg.timestamp else None,
            # Display field - human-readable timeline for UI
            'display_trace': display_trace,
        }
        # Include images for user messages (re-sign so URLs aren't expired)
        if msg.role == 'user' and msg.images:
            message_data['images'] = _refresh_image_urls(msg.images)
        messages.append(message_data)

    logger.info(f"[get_conversation] Returning {len(messages)} messages for conversation {conversation_id}")

    response = JsonResponse({
        'id': str(conversation.id),
        'title': conversation.title or 'Untitled conversation',
        'startedAt': conversation.started_at.isoformat() if conversation.started_at else None,
        'lastMessageAt': conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        'messageCount': len(messages),
        'messages': messages,
    })
    return _add_cors_headers(response, request)
