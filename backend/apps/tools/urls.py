"""
URL patterns for the tools app.

Mounted at /api/tools/ by the main URL config.
"""
from django.urls import include, path

from rest_framework.routers import DefaultRouter

from apps.tools.views import (
    EndpointStatusView,
    MCPSourceViewSet,
    OpenAPISourceViewSet,
    ToolRegistrationView,
)
from apps.tools.views_oauth import OAuthAuthorizeView, OAuthCallbackView

router = DefaultRouter()
router.register(r'mcp-sources', MCPSourceViewSet, basename='mcp-source')
router.register(r'openapi-sources', OpenAPISourceViewSet, basename='openapi-source')

urlpatterns = [
    # SDK-facing (authenticated via SyncSecret Bearer token)
    path('register/', ToolRegistrationView.as_view(), name='tool-register'),

    # Admin-facing (authenticated via JWT)
    path('admin/endpoint/', EndpointStatusView.as_view(), name='tool-endpoint-status'),
    path('admin/', include(router.urls)),

    # OAuth linking flow (public — validated via link token)
    path('oauth/authorize/<str:link_token>/', OAuthAuthorizeView.as_view(), name='openapi-oauth-authorize'),
    path('oauth/callback/', OAuthCallbackView.as_view(), name='openapi-oauth-callback'),
]
