"""
URL configuration for Help Center Backend.

Copyright (C) 2025 Pillar Team

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, JsonResponse
from rest_framework.routers import DefaultRouter
from .admin_views import (
    AdminSpectacularAPIView,
    AdminSpectacularRedocView,
    AdminSpectacularSwaggerView,
)
from .admin_redis import redis_manager_view, redis_delete_key, redis_delete_pattern
from common.auth_views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LogoutView,
)
from apps.users.views import (
    get_authorization_url,
    oauth_callback,
    select_organization,
)
from common.views import contact_form, early_access_form

# Import webhook views
from apps.knowledge.views import firecrawl_webhook_view
from apps.billing.webhooks import stripe_webhook_view

# Import views for top-level routes
from apps.products.views import ProductViewSet, ActionSyncView, ActionSyncStatusView, EmbedConfigView, CLIInitView

# Import debug log views
from apps.mcp.views.debug_logs import DebugSessionListView, DebugSessionDetailView, DebugSessionLatestView

# Configs router (alias for products)
configs_router = DefaultRouter()
configs_router.register(r'', ProductViewSet, basename='config')


def root_view(request):
    """Welcome endpoint for root URL."""
    return JsonResponse({
        'message': 'Welcome to Help Center API',
        'version': '1.0',
        'documentation': '/api/docs/',
        'health': '/health/',
    })


def robots_txt(request):
    """Disallow all crawling on the API subdomain."""
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain")


urlpatterns = [
    # Root welcome endpoint
    path('', root_view, name='root'),
    path('robots.txt', robots_txt, name='robots-txt'),

    # Admin
    path('admin/redis/', redis_manager_view, name='admin-redis-manager'),
    path('admin/redis/delete-key/', redis_delete_key, name='admin-redis-delete-key'),
    path('admin/redis/delete-pattern/', redis_delete_pattern, name='admin-redis-delete-pattern'),
    path('admin/', admin.site.urls),

    # Health check
    path('health/', include('common.health.urls')),

    # API Documentation (admin/superuser only)
    path('api/schema/', AdminSpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', AdminSpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', AdminSpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Authentication
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth_logout'),
    
    # OAuth Authentication
    path('api/auth/oauth/authorize/', get_authorization_url, name='oauth_authorize'),
    path('api/auth/oauth/callback/', oauth_callback, name='oauth_callback'),
    path('api/auth/oauth/select-organization/', select_organization, name='oauth_select_organization'),

    # Users API
    path('api/users/', include('apps.users.urls')),

    # MCP Server - Public MCP endpoints
    path('mcp/', include('apps.mcp.urls')),

    # Knowledge API (Product Assistant knowledge sources)
    path('api/admin/knowledge/', include('apps.knowledge.admin.urls')),

    # Knowledge API (Product Assistant knowledge sources)
    path('api/admin/knowledge/', include('apps.knowledge.admin.urls')),

    # New domain-focused APIs
    path('api/admin/products/', include('apps.products.urls')),
    path('api/admin/analytics/', include('apps.analytics.urls')),
    
    # CLI init endpoint (LLM-powered SDK scaffolding)
    path('api/cli/init/', CLIInitView.as_view(), name='cli-init'),

    # Action sync endpoint for configs (CI/CD code-first action definitions)
    # NOTE: Must be BEFORE configs_router to avoid being consumed by include()
    path('api/admin/configs/<slug:slug>/actions/sync/', ActionSyncView.as_view(), name='config-action-sync'),
    # Action sync status endpoint for configs (polling async jobs)
    path('api/admin/configs/<slug:slug>/actions/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='config-action-sync-status'),
    # Configs endpoint (alias for products - for frontend compatibility)
    path('api/admin/configs/', include(configs_router.urls)),

    # Billing API
    path('api/admin/billing/', include('apps.billing.urls')),

    # Debug session logs (for admin panel debugging)
    path('api/admin/debug/sessions/', DebugSessionListView.as_view(), name='debug-session-list'),
    path('api/admin/debug/sessions/latest/', DebugSessionLatestView.as_view(), name='debug-session-latest'),
    path('api/admin/debug/sessions/<path:filename>/', DebugSessionDetailView.as_view(), name='debug-session-detail'),

    # Public endpoints (no auth required)
    path('api/public/early-access/', early_access_form, name='public-early-access'),
    path('api/public/contact/', contact_form, name='public-contact'),

    # Agent Score (public free tool — no auth)
    path('api/public/agent-score/', include('apps.agent_score.urls')),
    
    # SDK embed config (public - for SDK initialization)
    path('api/public/products/<slug:subdomain>/embed-config/', EmbedConfigView.as_view(), name='public-embed-config'),
    
    # Webhooks (no auth - signature verified)
    path('api/v1/webhooks/firecrawl/', firecrawl_webhook_view, name='firecrawl-webhook'),
    path('api/v1/webhooks/stripe/', stripe_webhook_view, name='stripe-webhook'),
]

# Development-only endpoints
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Customize admin site
admin.site.site_header = "Help Center Administration"
admin.site.site_title = "Help Center Admin"
admin.site.index_title = "Welcome to Help Center Administration"
