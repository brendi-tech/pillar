"""
Shared mixins for knowledge admin views.
"""
import uuid

from rest_framework.exceptions import ValidationError

from apps.products.models import Product


class ProductResolveMixin:
    """
    Mixin that resolves a Product from the ``?product=`` query parameter,
    accepting either a UUID (from the dashboard) or a subdomain slug
    (from the CLI).
    """

    def _resolve_product(self) -> Product:
        product_param = self.request.query_params.get('product')
        if not product_param:
            raise ValidationError({'product': 'Product ID is required.'})

        user_orgs = self.request.user.organizations.all()

        try:
            uuid.UUID(product_param)
            product = Product.objects.filter(
                id=product_param, organization__in=user_orgs
            ).first()
        except ValueError:
            product = Product.objects.filter(
                subdomain=product_param, organization__in=user_orgs
            ).first()

        if not product:
            raise ValidationError({
                'product': 'Invalid product or product does not belong to your organization.'
            })

        return product
