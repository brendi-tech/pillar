"""
Resources dispatcher for MCP server.

Routes resource read requests to appropriate handlers.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def dispatch_resource_read(help_center_config, organization, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatch a resource read request.

    Supports:
    - knowledge://{help_center_id}/{item_id} - Read knowledge item content

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        params: Request parameters with 'uri'

    Returns:
        Resource content

    Raises:
        ValueError: If URI is invalid or resource not found
    """
    uri = params.get('uri', '')

    if not uri:
        raise ValueError("Resource URI is required")

    logger.info(f"[resources_dispatcher] Reading resource: {uri}")

    # Parse URI
    if uri.startswith('knowledge://'):
        return await _read_knowledge_item(help_center_config, uri)
    else:
        raise ValueError(f"Unknown resource type in URI: {uri}")


async def _read_knowledge_item(help_center_config, uri: str) -> Dict[str, Any]:
    """
    Read a knowledge item resource.

    URI format: knowledge://{help_center_id}/{item_id}
    """
    from apps.knowledge.models import KnowledgeItem

    # Parse URI
    parts = uri.replace('knowledge://', '').split('/')
    if len(parts) != 2:
        raise ValueError(f"Invalid knowledge URI format: {uri}")

    hc_id, item_id = parts

    # Validate help center matches
    if str(help_center_config.id) != hc_id:
        raise ValueError("Knowledge item does not belong to this help center")

    # Get knowledge item
    try:
        item = await KnowledgeItem.objects.select_related('source').aget(
            id=item_id,
            organization_id=help_center_config.organization_id,
            product_id=help_center_config.id,  # Filter by product
            is_active=True,
            status=KnowledgeItem.Status.INDEXED,
        )
    except KnowledgeItem.DoesNotExist:
        raise ValueError(f"Knowledge item not found: {item_id}")

    # Build content in markdown format
    content_parts = [
        f"# {item.title}",
        ""
    ]

    if item.excerpt:
        content_parts.append(f"*{item.excerpt}*")
        content_parts.append("")

    if item.source:
        content_parts.append(f"**Source:** {item.source.name}")
        content_parts.append("")

    if item.url:
        content_parts.append(f"**URL:** {item.url}")
        content_parts.append("")

    # Add content (prefer optimized, fall back to raw)
    body_text = item.optimized_content or item.raw_content or ''
    if body_text:
        content_parts.append(body_text)

    content = "\n".join(content_parts)

    return {
        'contents': [{
            'uri': uri,
            'mimeType': 'text/markdown',
            'text': content
        }]
    }


