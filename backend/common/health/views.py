"""
Health check views.
"""
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema, OpenApiResponse
from asgiref.sync import sync_to_async
import logging

logger = logging.getLogger(__name__)


@csrf_exempt  # Health checks don't need CSRF protection
@extend_schema(
    operation_id='health_check',
    tags=['Health'],
    summary='Health Check',
    description='Basic health check to verify the backend service is up and running.',
    responses={
        200: OpenApiResponse(
            response={'type': 'object', 'properties': {'status': {'type': 'string'}, 'service': {'type': 'string'}}},
            description='Service is healthy'
        ),
    }
)
async def health_check(request):
    """
    Basic health check endpoint (async for ASGI compatibility).
    Returns 200 if the service is up.
    Note: Exempt from CSRF and works over HTTP for container health checks.
    """
    return JsonResponse({
        'status': 'healthy',
        'service': 'help-center-backend'
    })


@csrf_exempt  # Health checks don't need CSRF protection
@extend_schema(
    operation_id='readiness_check',
    tags=['Health'],
    summary='Readiness Check',
    description='Readiness check that verifies database and cache connectivity.',
    responses={
        200: OpenApiResponse(
            response={'type': 'object', 'properties': {'status': {'type': 'string'}, 'checks': {'type': 'object'}}},
            description='Service is ready'
        ),
        503: OpenApiResponse(
            response={'type': 'object', 'properties': {'status': {'type': 'string'}, 'checks': {'type': 'object'}}},
            description='Service is not ready'
        ),
    }
)
async def readiness_check(request):
    """
    Readiness check endpoint (async for ASGI compatibility).
    Verifies database and cache connectivity.
    Note: Exempt from CSRF and works over HTTP for container health checks.
    """
    checks = {
        'database': False,
        'cache': False,
    }
    errors = {}

    # Check database (wrap sync DB operations in sync_to_async)
    try:
        @sync_to_async
        def check_db():
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')

        await check_db()
        checks['database'] = True
    except Exception as e:
        error_msg = f"Database connection failed: {str(e)}"
        logger.error(error_msg)
        errors['database'] = error_msg

    # Check cache (wrap sync cache operations in sync_to_async)
    try:
        @sync_to_async
        def check_cache():
            cache.set('health_check', 'ok', 10)
            return cache.get('health_check') == 'ok'

        checks['cache'] = await check_cache()
    except Exception as e:
        error_msg = f"Cache connection failed: {str(e)}"
        logger.error(error_msg)
        errors['cache'] = error_msg

    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503

    response_data = {
        'status': 'ready' if all_healthy else 'not_ready',
        'checks': checks
    }

    # Include error details in response for debugging
    if errors:
        response_data['errors'] = errors

    return JsonResponse(response_data, status=status_code)
