"""
Resources registry for MCP server.

Builds and returns the list of available resources (knowledge items).

Copyright (C) 2025 Pillar Team
"""
from typing import Dict, Any


async def build_resources_list(help_center_config, organization) -> Dict[str, Any]:
    """
    Build list of available resources for MCP.

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance

    Returns:
        Dict with 'resources' key containing list of resource descriptors
    """
    if not help_center_config:
        return {
            'resources': [],
            'metadata': {
                'message': 'No help center context available',
                'hint': 'Resources are help-center-specific. Ensure the request includes proper help center identification.'
            }
        }

    from apps.knowledge.models import KnowledgeItem

    resources = []

    # Get indexed knowledge items for this product
    items = KnowledgeItem.objects.filter(
        organization_id=help_center_config.organization_id,
        product_id=help_center_config.id,  # Filter by product
        is_active=True,
        status=KnowledgeItem.Status.INDEXED,
    ).select_related('source').order_by('-updated_at')[:100]

    async for item in items.aiterator():
        description = item.excerpt or f'Knowledge item: {item.title}'

        resources.append({
            'uri': f'knowledge://{help_center_config.id}/{item.id}',
            'name': item.title,
            'description': description,
            'mimeType': 'text/markdown',
            'metadata': {
                'type': 'knowledge_item',
                'itemType': item.item_type,
                'url': item.url or '',
                'sourceName': item.source.name if item.source else None,
                'createdAt': item.created_at.isoformat() if item.created_at else None,
                'updatedAt': item.updated_at.isoformat() if item.updated_at else None,
                'helpCenterName': help_center_config.name,
                'annotations': {
                    'readOnlyHint': True,
                    'contentFormat': 'markdown',
                    'searchable': True
                }
            }
        })

    # Get count by item type
    page_count = await KnowledgeItem.objects.filter(
        organization_id=help_center_config.organization_id,
        product_id=help_center_config.id,  # Filter by product
        is_active=True,
        status=KnowledgeItem.Status.INDEXED,
        item_type=KnowledgeItem.ItemType.PAGE,
    ).acount()

    snippet_count = await KnowledgeItem.objects.filter(
        organization_id=help_center_config.organization_id,
        product_id=help_center_config.id,  # Filter by product
        is_active=True,
        status=KnowledgeItem.Status.INDEXED,
        item_type=KnowledgeItem.ItemType.SNIPPET,
    ).acount()

    # Return resources with summary metadata
    return {
        'resources': resources,
        'metadata': {
            'totalCount': len(resources),
            'helpCenterName': help_center_config.name if help_center_config else 'Unknown',
            'types': {
                'pages': page_count,
                'snippets': snippet_count,
            },
            'description': (
                f'Available resources from {help_center_config.name if help_center_config else "this server"} Help Center. '
                f'Use resources/read with a resource URI to get the full content. '
                f'All content is provided in markdown format and is searchable via the "ask" tool.'
            )
        }
    }
