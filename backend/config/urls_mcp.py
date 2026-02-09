"""
URL configuration for Help Center MCP Server.

This is a minimal URL configuration that only includes MCP endpoints.
Used by the dedicated MCP server running on port 8004.

Copyright (C) 2025 Pillar Team
"""
from django.urls import path, include
from django.http import JsonResponse


def root_view(request):
    """Welcome endpoint for MCP server root URL."""
    return JsonResponse({
        'service': 'Help Center MCP Server',
        'version': '1.0',
        'mcp_endpoint': '/mcp/',
        'health': '/mcp/health/',
    })


urlpatterns = [
    # Root welcome endpoint
    path('', root_view, name='root'),

    # Health check (available at root for container health checks)
    path('health/', include('common.health.urls')),

    # MCP Server endpoints
    path('mcp/', include('apps.mcp.urls')),
]




