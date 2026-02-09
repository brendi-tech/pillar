"""
Health check endpoints for MCP service.
Async implementations for use with async middleware stack.

Copyright (C) 2025 Pillar Team
"""
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.cache import cache
from django.db import connection
from asgiref.sync import sync_to_async
from apps.mcp.services.server_info_service import server_info_service

logger = logging.getLogger(__name__)


@require_http_methods(["GET"])
async def index(request):
    """
    Service info endpoint - returns MCP service information and capabilities.

    For JSON-RPC requests, use the root /mcp/ endpoint instead.
    """
    help_center_config = getattr(request, 'help_center_config', None)

    # Use centralized service to build response
    response_data = await sync_to_async(
        server_info_service.get_landing_page_response
    )(help_center_config=help_center_config)

    # Always pretty print for browser
    json_dumps_params = {'indent': 2}

    # Return with appropriate status code (400 if no help center context)
    status_code = 400 if 'error' in response_data else 200
    response = JsonResponse(response_data, status=status_code, json_dumps_params=json_dumps_params)

    # Add CORS headers
    response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response['Access-Control-Allow-Credentials'] = 'true'

    return response


@require_http_methods(["GET"])
async def health(request):
    """Basic health check - service is up."""
    pretty = request.GET.get('pretty', '').lower() in ('true', '1', 'yes')
    json_dumps_params = {'indent': 2} if pretty else {}

    return JsonResponse({
        'status': 'healthy',
        'service': 'pillar-help-center-mcp'
    }, json_dumps_params=json_dumps_params)


@require_http_methods(["GET"])
async def readiness(request):
    """
    Readiness check - service is ready to serve requests.
    Checks database and cache connectivity.
    """
    checks = {
        'database': False,
        'cache': False,
    }

    # Check database
    try:
        @sync_to_async
        def check_db():
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')

        await check_db()
        checks['database'] = True
    except Exception:
        pass

    # Check cache
    try:
        await cache.aset('health_check_mcp', 'ok', 10)
        result = await cache.aget('health_check_mcp')
        checks['cache'] = result == 'ok'
    except Exception:
        pass

    all_ready = all(checks.values())
    status_code = 200 if all_ready else 503

    pretty = request.GET.get('pretty', '').lower() in ('true', '1', 'yes')
    json_dumps_params = {'indent': 2} if pretty else {}

    return JsonResponse({
        'status': 'ready' if all_ready else 'not_ready',
        'checks': checks
    }, status=status_code, json_dumps_params=json_dumps_params)
