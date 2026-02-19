"""
URL configuration for MCP app.

Copyright (C) 2025 Pillar Team
"""
from django.urls import path
from apps.mcp.views import streamable_http, health, image_upload, identify, conversation_history, session_resume, telemetry, webmcp_tracking

urlpatterns = [
    # Main MCP endpoint - handles both JSON-RPC and SSE streaming
    path('', streamable_http.streamable_http, name='mcp_streamable_http'),

    # OTLP trace proxy - accepts browser SDK spans and forwards to Cloud Trace
    path('telemetry/v1/traces', telemetry.otlp_traces_proxy, name='mcp_otlp_traces'),

    # Health check endpoints
    path('health/', health.health, name='mcp_health'),
    path('health/ready/', health.readiness, name='mcp_readiness'),

    # Service info endpoint
    path('info', health.index, name='mcp_info'),

    # Image upload for conversations
    path('upload-image/', image_upload.upload_image, name='mcp_upload_image'),

    # User identification endpoints
    path('identify/', identify.identify, name='mcp_identify'),
    path('logout/', identify.logout, name='mcp_logout'),

    # Conversation history endpoints
    path('conversations/', conversation_history.list_conversations, name='mcp_list_conversations'),
    path('conversations/<str:conversation_id>/', conversation_history.get_conversation, name='mcp_get_conversation'),
    
    # Session resumption - status check (resume now flows through the ask tool)
    path('conversations/<str:conversation_id>/status/', session_resume.get_conversation_status, name='mcp_conversation_status'),

    # WebMCP execution tracking
    path('track-webmcp-execution/', webmcp_tracking.track_webmcp_execution, name='mcp_track_webmcp_execution'),
]
