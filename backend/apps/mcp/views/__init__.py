"""
MCP views.
"""
from apps.mcp.views import streamable_http
from apps.mcp.views import health
from apps.mcp.views import image_upload
from apps.mcp.views import identify
from apps.mcp.views import conversation_history
from apps.mcp.views import webmcp_tracking

__all__ = ['streamable_http', 'health', 'image_upload', 'identify', 'conversation_history', 'webmcp_tracking']
