"""
Middleware for resolving customer ID from headers or domain.
"""
import logging
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from apps.users.models import Organization

logger = logging.getLogger(__name__)

# Default demo organization ID for development
DEMO_ORGANIZATION_ID = getattr(settings, 'DEMO_ORGANIZATION_ID', '10000000-0000-0000-0000-000000000001')

# Help center domain suffix (e.g., "help.pillar.io")
HELP_CENTER_DOMAIN = getattr(settings, 'HELP_CENTER_DOMAIN', 'help.pillar.io')


class CustomerIdMiddleware(MiddlewareMixin):
    """
    Middleware to resolve customer ID from headers or custom domain.

    Sets request.customer_id, request.customer_organization, and request.product
    for use in views.

    Customer ID can come from:
    1. x-customer-id header (Pillar organization ID or "demo")
    2. Pillar subdomain (e.g., {subdomain}.help.pillar.io)
    3. Custom domain (resolved via Host header) - TODO
    """

    def process_request(self, request):
        """Resolve customer ID and set on request."""
        customer_id = None
        customer_organization = None
        product = None

        # Try x-customer-id header first
        customer_id_header = request.headers.get('x-customer-id')
        if customer_id_header:
            result = self._resolve_from_header(customer_id_header)
            if result:
                customer_id, customer_organization, product = result

        # If not found via header, try subdomain resolution
        if not customer_organization:
            host = request.get_host().split(':')[0]  # Remove port
            result = self._resolve_from_subdomain(host)
            if result:
                customer_id, customer_organization, product = result

        # Set on request for use in views
        request.customer_id = customer_id
        request.customer_organization = customer_organization
        request.product = product
        # Backward compatibility alias
        request.help_center_config = product

        return None

    def _resolve_from_header(self, customer_id_header: str):
        """
        Resolve organization from x-customer-id header.

        The header can be:
        1. "demo" - special case for development
        2. A valid UUID - organization ID
        3. A subdomain string - looked up via Product.subdomain

        Returns tuple of (customer_id, organization, product) or None.
        """
        from apps.products.models import Product
        import uuid

        # Handle "demo" as special case for development
        if customer_id_header.lower() == 'demo':
            try:
                organization = Organization.objects.get(id=DEMO_ORGANIZATION_ID)
                # Get default product for demo org
                product = Product.objects.filter(
                    organization=organization,
                    is_default=True
                ).first()
                return str(organization.id), organization, product
            except Organization.DoesNotExist:
                logger.warning(f"Demo organization not found: {DEMO_ORGANIZATION_ID}")
                return None

        # Check if it looks like a UUID
        is_uuid = False
        try:
            uuid.UUID(customer_id_header)
            is_uuid = True
        except (ValueError, AttributeError):
            pass

        # Try as organization UUID first
        if is_uuid:
            try:
                organization = Organization.objects.get(id=customer_id_header)
                # Get default product
                product = Product.objects.filter(
                    organization=organization,
                    is_default=True
                ).first()
                return str(organization.id), organization, product
            except Organization.DoesNotExist:
                logger.debug(f"Organization not found for UUID: {customer_id_header}")
                # Fall through to subdomain lookup

        # Try as subdomain (e.g., "taste-c1b", "acme")
        try:
            product = Product.objects.select_related(
                'organization'
            ).get(subdomain=customer_id_header)
            organization = product.organization
            logger.debug(f"Resolved subdomain '{customer_id_header}' -> org {organization.id}")
            return str(organization.id), organization, product
        except Product.DoesNotExist:
            logger.warning(f"No product found for customer-id: {customer_id_header}")
            return None

    def _resolve_from_subdomain(self, host: str):
        """
        Resolve organization from subdomain.

        Supports format: {subdomain}.help.pillar.io

        Returns tuple of (customer_id, organization, product) or None.
        """
        from apps.products.models import Product

        # Check if host matches our help center domain pattern
        if not host.endswith(f'.{HELP_CENTER_DOMAIN}'):
            return None

        # Extract subdomain
        subdomain = host[:-len(f'.{HELP_CENTER_DOMAIN}')]

        if not subdomain or '.' in subdomain:
            # Invalid subdomain (empty or has multiple parts)
            return None

        # Look up product by subdomain
        try:
            product = Product.objects.select_related(
                'organization'
            ).get(subdomain=subdomain)

            organization = product.organization
            return str(organization.id), organization, product
        except Product.DoesNotExist:
            logger.warning(f"Product not found for subdomain: {subdomain}")
            return None
