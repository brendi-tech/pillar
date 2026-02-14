"""
User identification endpoints for SDK.

Enables clients to identify users when they log in, merging anonymous
conversation history with their authenticated account.

Copyright (C) 2025 Pillar Team
"""
import json
import logging
from typing import Optional

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.analytics.services.visitor_service import get_visitor_service
from common.utils.cors import add_cors_headers

logger = logging.getLogger(__name__)



@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
async def identify(request):
    """
    Identify the current user.

    POST /mcp/identify/

    Called when a user logs in to the client application. Links the anonymous
    visitor (identified by x-visitor-id) to the authenticated user ID, enabling
    cross-device conversation history.

    If the visitor has anonymous conversations, they are merged into the
    authenticated user's history.

    Headers:
        x-visitor-id: Required - Persistent browser ID from SDK localStorage
        x-customer-id: Required - Product key for organization resolution

    Body:
        {
            "userId": "client-user-123",  // Required - Client's authenticated user ID
            "name": "John Doe",           // Optional - User's display name
            "email": "john@example.com",  // Optional - User's email
            "metadata": {...}             // Optional - Additional metadata
        }

    Returns:
        {
            "success": true,
            "visitorId": "uuid"  // Internal visitor record ID
        }
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=200)
        return add_cors_headers(response, request)

    # Get product context from middleware
    product = getattr(request, 'product', None)
    organization = getattr(request, 'organization', None)

    if not product or not organization:
        response = JsonResponse(
            {'error': 'Product context not available'},
            status=403
        )
        return add_cors_headers(response, request)

    # Get analytics context from middleware
    analytics = getattr(request, 'analytics', {})
    visitor_id = analytics.get('visitor_id', '')

    if not visitor_id:
        response = JsonResponse(
            {'error': 'x-visitor-id header required'},
            status=400
        )
        return add_cors_headers(response, request)

    # Parse request body
    try:
        data = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        response = JsonResponse(
            {'error': 'Invalid JSON body'},
            status=400
        )
        return add_cors_headers(response, request)

    # Validate required fields
    user_id = data.get('userId')
    if not user_id:
        response = JsonResponse(
            {'error': 'userId is required'},
            status=400
        )
        return add_cors_headers(response, request)

    # Merge visitor records (links anonymous to authenticated)
    try:
        visitor = await get_visitor_service().merge_visitors(
            organization_id=str(organization.id),
            visitor_id=visitor_id,
            external_user_id=user_id,
            name=data.get('name', ''),
            email=data.get('email', ''),
            metadata=data.get('metadata', {}),
        )

        logger.info(
            f"[Identify] User identified: visitor_id={visitor_id[:8]}..., "
            f"external_user_id={user_id}, org={organization.id}"
        )

        response = JsonResponse({
            'success': True,
            'visitorId': str(visitor.id),
        })
        return add_cors_headers(response, request)

    except Exception as e:
        logger.error(f"[Identify] Failed to identify user: {e}", exc_info=True)
        response = JsonResponse(
            {'error': 'Failed to identify user'},
            status=500
        )
        return add_cors_headers(response, request)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
async def logout(request):
    """
    Clear user identity (logout).

    POST /mcp/logout/

    Called when a user logs out of the client application. This does NOT delete
    the visitor record or conversations - it simply acknowledges the logout.
    The SDK will stop sending x-external-user-id on subsequent requests.

    Future conversations will be tracked under a new anonymous visitor record
    (using the same visitor_id from localStorage).

    Headers:
        x-visitor-id: Required - Persistent browser ID from SDK localStorage
        x-customer-id: Required - Product key for organization resolution

    Returns:
        {
            "success": true
        }
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=200)
        return add_cors_headers(response, request)

    # Get product context from middleware
    product = getattr(request, 'product', None)
    organization = getattr(request, 'organization', None)

    if not product or not organization:
        response = JsonResponse(
            {'error': 'Product context not available'},
            status=403
        )
        return add_cors_headers(response, request)

    # Get analytics context from middleware
    analytics = getattr(request, 'analytics', {})
    visitor_id = analytics.get('visitor_id', '')

    if not visitor_id:
        response = JsonResponse(
            {'error': 'x-visitor-id header required'},
            status=400
        )
        return add_cors_headers(response, request)

    logger.info(
        f"[Logout] User logged out: visitor_id={visitor_id[:8]}..., "
        f"org={organization.id}"
    )

    # Simply acknowledge the logout
    # The SDK stops sending x-external-user-id, so future requests are anonymous
    response = JsonResponse({'success': True})
    return add_cors_headers(response, request)
