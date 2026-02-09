"""
Capabilities summary for agent prompts.

Builds a summary of available actions for a product, helping the agent
understand what capabilities exist before searching.
"""
import logging
from typing import Optional

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache TTL: 5 minutes
CAPABILITIES_CACHE_TTL = 300


async def build_capabilities_summary(
    help_center_config,
    context: Optional[dict] = None,
) -> str:
    """
    Build a summary of available capabilities (actions) for this site.
    
    Informs the agent upfront what actions exist so it can:
    - Know what's possible before searching
    - Avoid hallucinating non-existent features
    - Proactively suggest relevant actions
    
    Results are cached per-product for 5 minutes.
    
    Args:
        help_center_config: Product/HelpCenterConfig instance
        context: Optional user context for future filtering (userRole, etc.)
    
    Returns:
        Formatted capabilities summary block, or empty string if no actions.
    """
    from apps.products.models import Action
    
    product_id = str(help_center_config.id)
    cache_key = f"capabilities_summary_{product_id}"
    
    # Check cache first
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    # Build fresh summary
    try:
        # Use Django's async ORM with async for iteration
        queryset = Action.objects.filter(
            product=help_center_config,
            status=Action.Status.PUBLISHED,
        ).values(
            'name', 'description', 'action_type', 'required_context'
        )
        action_list = [action async for action in queryset]
        
        if not action_list:
            cache.set(cache_key, "", CAPABILITIES_CACHE_TTL)
            return ""
        
        # Group by type
        by_type = {
            'navigation': [],
            'trigger': [],
            'query': [],
            'modal': [],
            'external': [],
        }
        
        for action in action_list:
            action_type = action.get('action_type', 'trigger')
            if action_type in by_type:
                by_type[action_type].append(action)
            else:
                by_type['trigger'].append(action)
        
        # Build summary
        parts = ["<<available_capabilities>>"]
        
        # Navigation actions
        if by_type['navigation']:
            names = [a['name'] for a in by_type['navigation'][:8]]
            more = f" (+{len(by_type['navigation']) - 8} more)" if len(by_type['navigation']) > 8 else ""
            parts.append(f"<navigation_actions>{', '.join(names)}{more}</navigation_actions>")
        
        # Trigger/mutation actions
        if by_type['trigger']:
            names = [a['name'] for a in by_type['trigger'][:8]]
            more = f" (+{len(by_type['trigger']) - 8} more)" if len(by_type['trigger']) > 8 else ""
            parts.append(f"<trigger_actions>{', '.join(names)}{more}</trigger_actions>")
        
        # Modal actions
        if by_type['modal']:
            names = [a['name'] for a in by_type['modal'][:5]]
            more = f" (+{len(by_type['modal']) - 5} more)" if len(by_type['modal']) > 5 else ""
            parts.append(f"<modal_actions>{', '.join(names)}{more}</modal_actions>")
        
        # Query actions (data fetching)
        if by_type['query']:
            names = [a['name'] for a in by_type['query'][:5]]
            more = f" (+{len(by_type['query']) - 5} more)" if len(by_type['query']) > 5 else ""
            parts.append(f"<query_actions>{', '.join(names)}{more}</query_actions>")
        
        # External actions
        if by_type['external']:
            names = [a['name'] for a in by_type['external'][:3]]
            more = f" (+{len(by_type['external']) - 3} more)" if len(by_type['external']) > 3 else ""
            parts.append(f"<external_actions>{', '.join(names)}{more}</external_actions>")
        
        # Total count
        total = len(action_list)
        parts.append(f"<total_actions>{total}</total_actions>")
        
        # Note about context-restricted actions
        restricted_count = sum(1 for a in action_list if a.get('required_context'))
        if restricted_count > 0:
            parts.append(f"<note>{restricted_count} actions require specific user roles/contexts</note>")
        
        parts.append("<</available_capabilities>>")
        
        summary = "\n".join(parts) + "\n"
        cache.set(cache_key, summary, CAPABILITIES_CACHE_TTL)
        
        logger.info(f"[Capabilities] Built summary for product {product_id}: {total} actions")
        return summary
        
    except Exception as e:
        logger.error(f"[Capabilities] Error building summary: {e}", exc_info=True)
        return ""


def invalidate_capabilities_cache(product_id: str) -> None:
    """
    Invalidate the cached capabilities summary for a product.
    
    Call this when actions are synced/updated.
    
    Args:
        product_id: Product UUID as string
    """
    cache_key = f"capabilities_summary_{product_id}"
    cache.delete(cache_key)
    logger.info(f"[Capabilities] Invalidated cache for product {product_id}")
