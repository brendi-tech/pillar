"""
URL routes for MCP OAuth.

Outbound routes (admin dashboard actions):
  /api/admin/oauth/mcp-authorize/   -- start OAuth flow for an MCP tool source
  /api/admin/oauth/mcp-callback/    -- receive callback from external server

Inbound routes (MCP-facing, at domain root):
  Configured in config/urls_mcp.py
"""
from django.urls import path

from apps.mcp_oauth import outbound

urlpatterns = [
    path('mcp-authorize/', outbound.mcp_authorize, name='mcp_oauth_authorize'),
    path('mcp-callback/', outbound.mcp_callback, name='mcp_oauth_callback'),
]
