"""
Middleware to resolve Product from Host header.

Resolves the product context from subdomain for MCP requests.

Fully async to avoid blocking the ASGI event loop. Sync middleware
(MiddlewareMixin) funnels all calls through a single-thread executor,
which starves concurrent requests while an SSE stream is active.

Copyright (C) 2025 Pillar Team
"""
import logging
from asgiref.sync import iscoroutinefunction, markcoroutinefunction
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class ProductResolverMiddleware:
    """
    Resolves Product from subdomain.

    Routes:
    - {subdomain}.{HELP_CENTER_DOMAIN} -> Product
    - ?help_center_id={id} -> Direct lookup (development/testing)

    Sets request.product and request.organization on success.

    This middleware is fully async-native to avoid serializing ASGI
    requests through Django's single-thread sync_to_async executor.
    """

    async_capable = True
    sync_capable = False

    CACHE_TTL = 300  # 5 minutes

    def __init__(self, get_response):
        self.get_response = get_response
        if iscoroutinefunction(self.get_response):
            markcoroutinefunction(self)

    async def __call__(self, request):
        await self.process_request(request)

        if (
            request.path.startswith('/mcp/')
            and not getattr(request, 'product', None)
            and not getattr(request, 'mcp_oauth_identity', None)
        ):
            host = request.get_host().split(':')[0].lower()
            oauth_configured = await self._has_oauth_provider(host)
            if oauth_configured:
                from django.http import JsonResponse
                scheme = 'https' if request.is_secure() else 'http'
                base_url = f"{scheme}://{request.get_host()}"
                response = JsonResponse(
                    {'error': 'unauthorized', 'message': 'OAuth authentication required'},
                    status=401,
                )
                response['WWW-Authenticate'] = (
                    f'Bearer resource_metadata="{base_url}/.well-known/oauth-protected-resource"'
                )
                return response

        response = await self.get_response(request)
        return response

    async def _has_oauth_provider(self, host: str) -> bool:
        """Check if an active OAuthProvider exists for the host's product."""
        try:
            from apps.mcp_oauth.models import OAuthProvider
            from apps.products.models.agent import Agent as AgentModel
            from apps.products.models import Product

            help_center_domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'help.pillar.io')

            product = None
            if host.endswith(f'.{help_center_domain}'):
                subdomain = host.replace(f'.{help_center_domain}', '')
                product = await (
                    Product.objects.filter(subdomain=subdomain).afirst()
                )
            else:
                agent = await (
                    AgentModel.objects
                    .select_related('product')
                    .filter(mcp_domain=host, is_active=True)
                    .afirst()
                )
                if agent:
                    product = agent.product

            if not product:
                return False

            return await (
                OAuthProvider.objects
                .filter(product=product, is_active=True)
                .aexists()
            )
        except Exception:
            return False

    async def process_request(self, request):
        from apps.products.models import Product

        # Skip non-MCP paths for efficiency
        if not request.path.startswith('/mcp'):
            return None

        host = request.get_host().split(':')[0].lower()
        help_center_domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'help.pillar.io')

        product = None

        # Strategy 0: Custom MCP domain resolution (agent-level)
        if not host.endswith(f'.{help_center_domain}'):
            from common.cache_keys import CacheKeys
            cache_key = CacheKeys.mcp_host_resolution(host)
            cached = cache.get(cache_key)
            if cached:
                product_id, agent_id = cached.split(':', 1)
                product = await (
                    Product.objects.select_related('organization')
                    .filter(id=product_id)
                    .afirst()
                )
                if product and agent_id:
                    from apps.products.models.agent import Agent as AgentModel
                    agent = await AgentModel.objects.filter(id=agent_id, is_active=True).afirst()
                    if agent:
                        request.agent = agent
            else:
                from apps.products.models.agent import Agent as AgentModel
                agent = await (
                    AgentModel.objects
                    .select_related('product__organization')
                    .filter(mcp_domain=host, is_active=True)
                    .afirst()
                )
                if agent:
                    product = agent.product
                    request.agent = agent
                    cache.set(
                        cache_key,
                        f"{product.id}:{agent.id}",
                        self.CACHE_TTL,
                    )
            if product:
                logger.debug(f"[MCP] Resolved custom domain '{host}' -> {product.name}")

        # Strategy 1: Subdomain resolution with caching
        if not product and host.endswith(f'.{help_center_domain}'):
            subdomain = host.replace(f'.{help_center_domain}', '')
            cache_key = f'mcp:hc:{subdomain}'

            # Try cache first
            config_id = cache.get(cache_key)
            if config_id:
                product = await (
                    Product.objects.select_related('organization')
                    .filter(id=config_id)
                    .afirst()
                )
            else:
                # Cache miss - query database
                product = await (
                    Product.objects.select_related('organization')
                    .filter(subdomain=subdomain)
                    .afirst()
                )
                if product:
                    cache.set(cache_key, str(product.id), self.CACHE_TTL)

            if product:
                logger.debug(f"[MCP] Resolved subdomain '{subdomain}' -> {product.name}")

        # Strategy 2: Query parameter (development/testing)
        if not product:
            config_id = request.GET.get('help_center_id')
            if config_id:
                product = await (
                    Product.objects.select_related('organization')
                    .filter(id=config_id)
                    .afirst()
                )
                if product:
                    logger.debug(f"[MCP] Resolved via query param -> {product.name}")

        # Strategy 3: Header-based (for proxied requests)
        if not product:
            config_id = request.headers.get('X-Help-Center-Id')
            if config_id:
                product = await (
                    Product.objects.select_related('organization')
                    .filter(id=config_id)
                    .afirst()
                )
                if product:
                    logger.debug(f"[MCP] Resolved via header -> {product.name}")

        # Strategy 4: x-customer-id header (subdomain string or org UUID)
        # This handles cases like x-customer-id: pillar-help or x-customer-id: <uuid>
        if not product:
            customer_id = request.headers.get('x-customer-id')
            if customer_id:
                import uuid as uuid_module

                # Check if it's a UUID (org ID)
                is_uuid = False
                try:
                    uuid_module.UUID(customer_id)
                    is_uuid = True
                except (ValueError, AttributeError):
                    pass

                if is_uuid:
                    # It's a UUID - get default product for that org
                    product = await (
                        Product.objects.select_related('organization')
                        .filter(organization_id=customer_id, is_default=True)
                        .afirst()
                    )
                    if product:
                        logger.debug(f"[MCP] Resolved via x-customer-id org UUID '{customer_id}' -> {product.name}")
                else:
                    # Not a UUID - treat as subdomain
                    product = await (
                        Product.objects.select_related('organization')
                        .filter(subdomain=customer_id)
                        .afirst()
                    )
                    if product:
                        logger.debug(f"[MCP] Resolved via x-customer-id subdomain '{customer_id}' -> {product.name}")

        # Strategy 4.5: Bearer token auth (OAuth token or API key)
        if not product:
            auth_header = request.META.get("HTTP_AUTHORIZATION", "")
            if auth_header.startswith("Bearer "):
                token_value = auth_header[7:].strip()

                if not token_value.startswith("sk_live_"):
                    try:
                        from apps.mcp_oauth.auth import validate_mcp_oauth_token
                        oauth_result = await validate_mcp_oauth_token(token_value)
                        if oauth_result:
                            product = oauth_result.product
                            request.mcp_oauth_identity = oauth_result
                            logger.debug(
                                "[MCP] Resolved via OAuth token -> %s (user=%s)",
                                product.name,
                                oauth_result.external_user_id,
                            )
                    except Exception:
                        logger.debug("[MCP] OAuth token validation failed", exc_info=True)

                if not product:
                    from apps.tools.services.auth import authenticate_sdk_request
                    product = await authenticate_sdk_request(request)
                    if product:
                        logger.debug(f"[MCP] Resolved via Bearer token -> {product.name}")

        # Strategy 5: x-agent-slug header (convenience fallback)
        if not product:
            agent_slug = request.headers.get('x-agent-slug')
            if agent_slug:
                from apps.products.models.agent import Agent as AgentModel
                agent = await (
                    AgentModel.objects
                    .select_related('product__organization')
                    .filter(slug=agent_slug, is_active=True)
                    .afirst()
                )
                if agent:
                    product = agent.product
                    request.agent = agent
                    logger.debug(f"[MCP] Resolved via x-agent-slug '{agent_slug}' -> {product.name}")

        # Strategy 1.5: Default MCP agent for product
        # When product is resolved but no specific agent has been set,
        # find the product's default MCP agent (earliest created).
        if product and not getattr(request, 'agent', None):
            from apps.products.models.agent import Agent as AgentModel
            mcp_agent = await (
                AgentModel.objects
                .filter(product=product, channel='mcp', is_active=True)
                .order_by('created_at')
                .afirst()
            )
            if mcp_agent:
                request.agent = mcp_agent

        # Set attributes on request
        if product:
            request.product = product
            request.organization = product.organization
            # Backward compatibility alias (deprecated)
            request.help_center_config = product
        else:
            # Only set to None if not already set by CustomerIdMiddleware
            # This preserves resolution from x-customer-id header
            if not hasattr(request, 'product') or request.product is None:
                request.product = None
            if not hasattr(request, 'help_center_config') or request.help_center_config is None:
                request.help_center_config = None
            if not hasattr(request, 'organization') or request.organization is None:
                # Try to get organization from CustomerIdMiddleware's customer_organization
                request.organization = getattr(request, 'customer_organization', None)

        return None
