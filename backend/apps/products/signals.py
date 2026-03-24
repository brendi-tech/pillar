"""
Product signals - auto-create related resources when products are created.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.products.models.product import Product

logger = logging.getLogger(__name__)


def _generate_unique_agent_slug(base_name: str) -> str:
    """Generate a unique agent slug from a name, trying the clean name first."""
    from common.services.subdomain_generator import SubdomainGeneratorService
    from apps.products.models.agent import Agent

    base_slug = SubdomainGeneratorService.sanitize_subdomain(base_name)
    if len(base_slug) < 3:
        base_slug = f"agent-{base_slug}" if base_slug else "agent"

    existing = set(
        Agent.objects.values_list('slug', flat=True)
    )
    return SubdomainGeneratorService.ensure_unique_subdomain(
        base_slug, existing
    )


@receiver(post_save, sender=Product)
def create_web_agent_for_product(sender, instance: Product, created: bool, **kwargs):
    """Auto-create a web agent when a new product is created."""
    if not created:
        return

    from apps.products.models.agent import Agent

    if Agent.objects.filter(product=instance, channel='web').exists():
        return

    slug = _generate_unique_agent_slug(instance.name)

    Agent.objects.create(
        organization=instance.organization,
        product=instance,
        name=instance.name,
        slug=slug,
        channel='web',
        is_active=True,
    )
    logger.info(f"Auto-created web agent (slug={slug}) for product {instance.id}")


@receiver(post_save, sender=Product)
def create_mcp_agent_for_product(sender, instance: Product, created: bool, **kwargs):
    """Auto-create an MCP agent when a new product is created."""
    if not created:
        return

    from apps.products.models.agent import Agent

    if Agent.objects.filter(product=instance, channel='mcp').exists():
        return

    Agent.objects.create(
        organization=instance.organization,
        product=instance,
        name=f"{instance.name} MCP",
        channel='mcp',
        is_active=True,
        include_suggested_followups=False,
    )
    logger.info(f"Auto-created MCP agent for product {instance.id}")
