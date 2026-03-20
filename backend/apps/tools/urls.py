"""
URL patterns for the tools app.

Mounted at /api/tools/ by the main URL config.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.tools.views import (
    EndpointStatusView,
    MCPSourceViewSet,
    ToolRegistrationView,
)

router = DefaultRouter()
router.register(r'mcp-sources', MCPSourceViewSet, basename='mcp-source')

urlpatterns = [
    # SDK-facing (authenticated via SyncSecret Bearer token)
    path('register/', ToolRegistrationView.as_view(), name='tool-register'),

    # Admin-facing (authenticated via JWT)
    path('admin/endpoint/', EndpointStatusView.as_view(), name='tool-endpoint-status'),
    path('admin/', include(router.urls)),
]
