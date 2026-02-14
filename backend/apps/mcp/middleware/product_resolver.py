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
        response = await self.get_response(request)
        return response

    async def process_request(self, request):
        from apps.products.models import Product

        # Skip non-MCP paths for efficiency
        if not request.path.startswith('/mcp'):
            return None

        host = request.get_host().split(':')[0].lower()
        help_center_domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'help.pillar.bot')

        product = None

        # Strategy 1: Subdomain resolution with caching
        if host.endswith(f'.{help_center_domain}'):
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
