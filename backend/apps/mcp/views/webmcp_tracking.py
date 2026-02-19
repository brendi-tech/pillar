"""
WebMCP execution tracking endpoint.

Tracks tool executions from browser agents calling WebMCP-registered tools.

Copyright (C) 2025 Pillar Team
"""
import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.mcp.services.agent.helpers import log_action_execution
from common.utils.cors import add_cors_headers

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
async def track_webmcp_execution(request):
    """
    Track a WebMCP tool execution.

    POST /mcp/track-webmcp-execution/

    Called by the SDK when a browser agent invokes a WebMCP-registered tool.
    Records the execution to ActionExecutionLog for analytics.

    Headers:
        x-visitor-id: Required - Persistent browser ID from SDK localStorage
        x-session-id: Required - Browser session ID
        x-customer-id: Required - Product key for organization resolution

    Body:
        {
            "tool_name": "create_chart",
            "status": "success" | "failure",
            "duration_ms": 150,
            "error": null,
            "input": {...},
            "session_id": "...",
            "visitor_id": "..."
        }

    Returns:
        {"success": true}
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
    tool_name = data.get('tool_name')
    status = data.get('status')

    if not tool_name:
        response = JsonResponse(
            {'error': 'tool_name is required'},
            status=400
        )
        return add_cors_headers(response, request)

    if status not in ('success', 'failure'):
        response = JsonResponse(
            {'error': 'status must be "success" or "failure"'},
            status=400
        )
        return add_cors_headers(response, request)

    # Log execution using shared helper
    tracked = await log_action_execution(
        action_name=tool_name,
        product_id=str(product.id),
        organization_id=str(organization.id),
        session_id=data.get('session_id', ''),
        status=status,
        error_message=data.get('error', '') or '',
        duration_ms=data.get('duration_ms'),
        metadata={
            'source': 'webmcp',
            'visitor_id': data.get('visitor_id', ''),
            'input': data.get('input'),
        },
    )

    response = JsonResponse({'success': True, 'tracked': tracked})
    return add_cors_headers(response, request)
