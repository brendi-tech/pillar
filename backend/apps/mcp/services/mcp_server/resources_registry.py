"""
Resources registry for MCP server.

Builds and returns the list of available resources (knowledge items
and resources from external MCP sources).

Copyright (C) 2025 Pillar Team
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from .pagination import paginate_list

logger = logging.getLogger(__name__)


async def build_resources_list(
    help_center_config,
    organization,
    agent=None,
    cursor: str | None = None,
) -> Dict[str, Any]:
    """
    Build list of available resources for MCP.

    Includes knowledge items and, when an agent with attached MCP sources
    is provided, resources from those external servers (namespaced with
    ``mcp-source://{slug}/`` URIs).

    Supports cursor-based pagination per the MCP spec.

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        agent: Optional Agent model instance (resolved by middleware)
        cursor: Opaque pagination cursor from a previous response

    Returns:
        Dict with 'resources' key and optional 'nextCursor'
    """
    if not help_center_config:
        return {'resources': []}

    from apps.knowledge.models import KnowledgeItem

    resources: list[Dict[str, Any]] = []

    items = KnowledgeItem.objects.filter(
        organization_id=help_center_config.organization_id,
        product_id=help_center_config.id,
        is_active=True,
        status=KnowledgeItem.Status.INDEXED,
    ).select_related('source').order_by('-updated_at')

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

    skill_resources = await _load_skill_resources(help_center_config)
    resources.extend(skill_resources)

    if agent:
        external = await _load_external_mcp_resources(agent)
        resources.extend(external)

    page, next_cursor = paginate_list(resources, cursor)

    result: Dict[str, Any] = {'resources': page}
    if next_cursor is not None:
        result['nextCursor'] = next_cursor
    return result


async def _load_skill_resources(help_center_config) -> list[Dict[str, Any]]:
    """Load registered skills as MCP resources for this product."""
    from apps.tools.models import RegisteredSkill

    resources: list[Dict[str, Any]] = []

    async for skill in RegisteredSkill.objects.filter(
        product=help_center_config,
        is_active=True,
    ).aiterator():
        resources.append({
            'uri': f'skill://{help_center_config.id}/{skill.name}',
            'name': skill.name,
            'description': skill.description,
            'mimeType': 'text/markdown',
            'metadata': {
                'type': 'skill',
                'annotations': {
                    'readOnlyHint': True,
                    'contentFormat': 'markdown',
                },
            },
        })

    if resources:
        logger.info(
            "[resources/list] Loaded %d product skill(s) as resources",
            len(resources),
        )

    return resources


async def _load_external_mcp_resources(agent) -> list[Dict[str, Any]]:
    """Load resources from external MCP sources attached to this agent.

    Each resource URI is rewritten to ``mcp-source://{slug}/{original_uri}``
    so the dispatcher can route reads back to the correct source.
    """
    from apps.tools.models import MCPToolSource

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]
    if not source_ids:
        return []

    resources: list[Dict[str, Any]] = []

    async for source in MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).aiterator():
        slug = source.slug or source.name.lower().replace(" ", "_")
        for res in (source.discovered_resources or []):
            original_uri = res.get("uri", "")
            if not original_uri:
                continue
            resources.append({
                'uri': f'mcp-source://{slug}/{original_uri}',
                'name': res.get("name", ""),
                'description': res.get("description", ""),
                'mimeType': res.get("mimeType", "application/octet-stream"),
                'metadata': {
                    'type': 'mcp_source_resource',
                    'sourceName': source.name,
                    'sourceSlug': slug,
                    'originalUri': original_uri,
                    'annotations': {
                        'readOnlyHint': True,
                        'x-pillar-mcp-source-id': str(source.id),
                    },
                },
            })

    if resources:
        logger.info(
            "[resources/list] Loaded %d external MCP resource(s) from %d source(s)",
            len(resources), len(source_ids),
        )

    return resources
