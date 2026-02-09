"""
ASGI config for Help Center MCP Server.

This is a lightweight ASGI application specifically for the MCP server,
running on a dedicated port (8004) separate from the main Help Center backend.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

# Set MCP-specific settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.mcp')

# Initialize Django ASGI application
# MCP uses HTTP streaming (SSE), so no WebSocket support needed
#
# ASGIDisconnectMiddleware wraps the app to detect client disconnects (browser
# tab close, hard refresh) via the ASGI receive channel. It must be the
# outermost layer so it has direct access to the raw receive channel.
# See: apps/mcp/middleware/disconnect_detection.py
from apps.mcp.middleware.disconnect_detection import ASGIDisconnectMiddleware

application = ASGIDisconnectMiddleware(get_asgi_application())




