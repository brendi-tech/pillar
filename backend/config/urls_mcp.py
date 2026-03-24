"""
URL configuration for Help Center MCP Server.

This is a minimal URL configuration that only includes MCP endpoints.
Used by the dedicated MCP server running on port 8004.

Copyright (C) 2025 Pillar Team
"""
from django.urls import path, include
from django.http import JsonResponse

from apps.mcp_oauth import inbound


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

    # OAuth 2.1 endpoints (at domain root per MCP spec)
    path('.well-known/oauth-protected-resource',
         inbound.protected_resource_metadata,
         name='mcp_oauth_protected_resource'),
    path('.well-known/oauth-authorization-server',
         inbound.authorization_server_metadata,
         name='mcp_oauth_auth_server_metadata'),
    path('register', inbound.register_client, name='mcp_oauth_register'),
    path('authorize', inbound.authorize, name='mcp_oauth_authorize'),
    path('oauth/callback', inbound.idp_callback, name='mcp_oauth_idp_callback'),
    path('token', inbound.token, name='mcp_oauth_token'),
]




