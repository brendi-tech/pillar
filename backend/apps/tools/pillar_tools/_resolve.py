"""Product context resolution from ToolContext."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.products.models import Product
    from pillar import ToolContext


async def resolve_product(ctx: ToolContext) -> Product:
    """Resolve the Product (with organization) from ToolContext.product_id."""
    from apps.products.models import Product as ProductModel

    if not ctx.product_id:
        raise ValueError("No product_id in context")
    return await ProductModel.objects.select_related("organization").aget(id=ctx.product_id)
