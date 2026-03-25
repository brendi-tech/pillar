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
from apps.mcp_oauth import inbound as mcp_oauth_inbound
from apps.users.views import (
    get_authorization_url,
    oauth_callback,
    select_organization,
)
from common.views import contact_form, early_access_form

# Import webhook views
from apps.knowledge.views import firecrawl_webhook_view
from apps.billing.webhooks import stripe_webhook_view

# Pillar backend SDK view (lazy import to avoid circular imports at module load)
from django.views.decorators.csrf import csrf_exempt

_cached_pillar_view = None

@csrf_exempt
async def _pillar_tools_view(request):
    global _cached_pillar_view
    if _cached_pillar_view is None:
        from apps.tools.pillar_tools import pillar
        _cached_pillar_view = pillar.django_view()
    return await _cached_pillar_view(request)

# Import views for top-level routes
from apps.mcp.views_api import HeadlessChatView, HeadlessChatStreamView
from apps.products.views import ProductViewSet, ActionSyncView, ActionSyncStatusView, EmbedConfigView, AgentEmbedConfigView, CLIInitView, AgentViewSet

# Slack admin view
from apps.integrations.slack.views import SlackInstallationAdminView, SlackInstallAdminView, SlackBYOBAdminView, SlackManifestAdminView
from apps.integrations.discord.views import DiscordInstallationAdminView, DiscordInstallAdminView, DiscordBYOBAdminView, DiscordVerifyAdminView
from apps.integrations.email_channel.views import EmailChannelAdminView
_slack_admin_view = SlackInstallationAdminView.as_view()
_slack_install_admin_view = SlackInstallAdminView.as_view()
_slack_byob_admin_view = SlackBYOBAdminView.as_view()
_slack_manifest_admin_view = SlackManifestAdminView.as_view()
_discord_admin_view = DiscordInstallationAdminView.as_view()
_discord_install_admin_view = DiscordInstallAdminView.as_view()
_discord_byob_admin_view = DiscordBYOBAdminView.as_view()
_discord_verify_admin_view = DiscordVerifyAdminView.as_view()
_email_admin_view = EmailChannelAdminView.as_view()

# Import debug log views
from apps.mcp.views.debug_logs import DebugSessionListView, DebugSessionDetailView, DebugSessionLatestView

# Configs router (alias for products)
configs_router = DefaultRouter()
configs_router.register(r'', ProductViewSet, basename='config')

# Standalone agents router (direct access by agent ID)
standalone_agents_router = DefaultRouter()
standalone_agents_router.register(r'', AgentViewSet, basename='standalone-agent')


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

    # MCP OAuth 2.1 inbound endpoints (for custom domain and subdomain MCP servers)
    path('.well-known/oauth-protected-resource',
         mcp_oauth_inbound.protected_resource_metadata,
         name='mcp_oauth_protected_resource'),
    path('.well-known/oauth-authorization-server',
         mcp_oauth_inbound.authorization_server_metadata,
         name='mcp_oauth_auth_server_metadata'),
    path('register', mcp_oauth_inbound.register_client,
         name='mcp_oauth_register'),
    path('authorize', mcp_oauth_inbound.authorize,
         name='mcp_oauth_authorize'),
    path('oauth/callback', mcp_oauth_inbound.idp_callback,
         name='mcp_oauth_idp_callback'),
    path('token', mcp_oauth_inbound.token,
         name='mcp_oauth_token'),

    # Knowledge API (Product Assistant knowledge sources)
    path('api/admin/knowledge/', include('apps.knowledge.admin.urls')),

    # Knowledge API (Product Assistant knowledge sources)
    path('api/admin/knowledge/', include('apps.knowledge.admin.urls')),

    # New domain-focused APIs
    path('api/admin/products/', include('apps.products.urls')),
    path('api/admin/analytics/', include('apps.analytics.urls')),
    path('api/admin/identity/', include('apps.identity.urls_admin')),
    
    # CLI init endpoint (LLM-powered SDK scaffolding)
    path('api/cli/init/', CLIInitView.as_view(), name='cli-init'),

    # Action sync endpoints for configs (CI/CD code-first action definitions)
    # NOTE: Must be BEFORE configs_router to avoid being consumed by include()
    path('api/admin/configs/<slug:slug>/actions/sync/', ActionSyncView.as_view(), name='config-action-sync'),
    path('api/admin/configs/<slug:slug>/actions/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='config-action-sync-status'),
    # Tool sync endpoints for configs (aliases)
    path('api/admin/configs/<slug:slug>/tools/sync/', ActionSyncView.as_view(), name='config-tool-sync'),
    path('api/admin/configs/<slug:slug>/tools/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='config-tool-sync-status'),
    # Configs endpoint (alias for products - for frontend compatibility)
    path('api/admin/configs/', include(configs_router.urls)),

    # Standalone agent CRUD (GET/PATCH/DELETE by agent ID)
    path('api/admin/agents/', include(standalone_agents_router.urls)),

    # Billing API
    path('api/admin/billing/', include('apps.billing.urls')),

    # Debug session logs (for admin panel debugging)
    path('api/admin/debug/sessions/', DebugSessionListView.as_view(), name='debug-session-list'),
    path('api/admin/debug/sessions/latest/', DebugSessionLatestView.as_view(), name='debug-session-latest'),
    path('api/admin/debug/sessions/<path:filename>/', DebugSessionDetailView.as_view(), name='debug-session-detail'),

    # Public endpoints (no auth required)
    path('api/public/early-access/', early_access_form, name='public-early-access'),
    path('api/public/contact/', contact_form, name='public-contact'),
    path('api/public/identity/', include('apps.identity.urls_public')),

    # Agent Score (public free tool — no auth)
    path('api/public/agent-score/', include('apps.agent_score.urls')),
    
    # SDK embed config (public - for SDK initialization)
    path('api/public/products/<slug:subdomain>/embed-config/', EmbedConfigView.as_view(), name='public-embed-config'),
    path('api/public/agents/<slug:slug>/embed-config/', AgentEmbedConfigView.as_view(), name='public-agent-embed-config'),
    
    # Headless chat API (SDK Bearer token auth)
    path('api/chat/', HeadlessChatView.as_view(), name='headless-chat'),
    path('api/chat/stream/', HeadlessChatStreamView.as_view(), name='headless-chat-stream'),

    # Server-side tools
    path('api/tools/', include('apps.tools.urls')),

    # MCP OAuth (admin-facing outbound OAuth flows)
    path('api/admin/oauth/', include('apps.mcp_oauth.urls')),

    # Pillar SDK webhook endpoint (backend tools)
    path('api/pillar-tools/', _pillar_tools_view),

    # Integrations (Slack, Discord, etc.) — public webhook endpoints
    path('api/integrations/slack/', include('apps.integrations.slack.urls')),
    path('api/integrations/discord/', include('apps.integrations.discord.urls')),
    path('api/integrations/email/', include('apps.integrations.email_channel.urls')),

    # Integrations — admin API (dashboard management)
    path('api/admin/products/<uuid:product_id>/integrations/slack/install/',
         _slack_install_admin_view, name='slack-install-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/slack/byob/',
         _slack_byob_admin_view, name='slack-byob-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/slack/manifest/',
         _slack_manifest_admin_view, name='slack-manifest-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/slack/',
         _slack_admin_view, name='slack-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/discord/install/',
         _discord_install_admin_view, name='discord-install-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/discord/byob/',
         _discord_byob_admin_view, name='discord-byob-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/discord/verify/',
         _discord_verify_admin_view, name='discord-verify-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/discord/',
         _discord_admin_view, name='discord-admin'),
    path('api/admin/products/<uuid:product_id>/integrations/email/',
         _email_admin_view, name='email-admin'),

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
