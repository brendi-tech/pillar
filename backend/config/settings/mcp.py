"""
MCP Server settings for local development.

Lightweight settings for the dedicated MCP server running on port 8004.
Inherits from development settings but removes unnecessary components.
"""
from .development import *

# Remove unnecessary apps - MCP server doesn't need admin, auth, etc.
INSTALLED_APPS = [
    app for app in INSTALLED_APPS 
    if app not in [
        'django.contrib.admin',  # No admin interface needed
        'django.contrib.messages',  # No user messaging needed
        'django.contrib.sessions',  # No sessions needed
    ]
]

# Override middleware for MCP - lightweight stack for public endpoints
# MCP server is public, no user authentication/sessions needed
# NOTE: CorsMiddleware MUST come before CommonMiddleware to handle preflight requests
# before CommonMiddleware potentially returns early (e.g., 301 redirects)
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    # MCP-specific middleware for help center resolution
    'apps.mcp.middleware.help_center_resolver.HelpCenterResolverMiddleware',
    # Analytics middleware for SDK header extraction (visitor_id, session_id, etc.)
    'apps.analytics.middleware.AnalyticsMiddleware',
]

# Use MCP-specific URL configuration
ROOT_URLCONF = 'config.urls_mcp'

# Disable browsable API for MCP (JSON only)
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
    'rest_framework.renderers.JSONRenderer',
]

# ASGI application
ASGI_APPLICATION = 'config.asgi_mcp.application'

print(f"🔌 Running MCP server in development mode on {ROOT_URLCONF}")




