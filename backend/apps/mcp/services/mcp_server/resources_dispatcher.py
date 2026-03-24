"""
Resources dispatcher for MCP server.

Routes resource read requests to appropriate handlers, including
proxying reads to external MCP sources via ``mcp-source://`` URIs.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def dispatch_resource_read(
    help_center_config, organization, params: Dict[str, Any],
    agent=None, request=None,
) -> Dict[str, Any]:
    """
    Dispatch a resource read request.

    Supports:
    - knowledge://{help_center_id}/{item_id} - Read knowledge item content
    - mcp-source://{slug}/{original_uri} - Read from external MCP source

    Args:
        help_center_config: HelpCenterConfig instance
        organization: Organization instance
        params: Request parameters with 'uri'
        agent: Optional Agent model instance (for external MCP source reads)
        request: Optional HTTP request object (for caller context)

    Returns:
        Resource content

    Raises:
        ValueError: If URI is invalid or resource not found
    """
    uri = params.get('uri', '')

    if not uri:
        raise ValueError("Resource URI is required")

    logger.info(f"[resources_dispatcher] Reading resource: {uri}")

    if uri.startswith('knowledge://'):
        return await _read_knowledge_item(help_center_config, uri)
    elif uri.startswith('skill://'):
        return await _read_skill(help_center_config, uri)
    elif uri.startswith('mcp-source://'):
        return await _read_external_mcp_resource(uri, agent, request)
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


async def _read_skill(help_center_config, uri: str) -> Dict[str, Any]:
    """Read a registered skill resource.

    URI format: ``skill://{product_id}/{skill_name}``
    """
    from apps.tools.models import RegisteredSkill

    remainder = uri[len('skill://'):]
    parts = remainder.split('/', 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid skill URI format: {uri}")

    product_id, skill_name = parts

    if str(help_center_config.id) != product_id:
        raise ValueError("Skill does not belong to this product")

    try:
        skill = await RegisteredSkill.objects.aget(
            product=help_center_config,
            name=skill_name,
            is_active=True,
        )
    except RegisteredSkill.DoesNotExist:
        raise ValueError(f"Skill not found: {skill_name}")

    return {
        'contents': [{
            'uri': uri,
            'mimeType': 'text/markdown',
            'text': skill.content,
        }]
    }


async def _read_external_mcp_resource(
    uri: str, agent, request,
) -> Dict[str, Any]:
    """Read a resource from an external MCP source.

    URI format: ``mcp-source://{slug}/{original_uri}``

    The slug is used to look up the correct ``MCPToolSource`` among
    the agent's attached sources, then the original URI is forwarded
    via ``mcp_client.read_mcp_resource``.
    """
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import read_mcp_resource

    remainder = uri[len('mcp-source://'):]
    slash_idx = remainder.find('/')
    if slash_idx < 0:
        raise ValueError(f"Invalid mcp-source URI format: {uri}")

    slug = remainder[:slash_idx]
    original_uri = remainder[slash_idx + 1:]

    if not slug or not original_uri:
        raise ValueError(f"Invalid mcp-source URI format: {uri}")

    if not agent:
        raise ValueError("No agent context available for external resource read")

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]

    source = await MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).filter(
        models_Q_slug_or_name(slug),
    ).afirst()

    if not source:
        raise ValueError(f"MCP source not found for slug: {slug}")

    from apps.mcp.services.mcp_server.tools_dispatcher import (
        _build_caller_from_request,
    )
    caller = _build_caller_from_request(request) if request else _default_caller()

    result = await read_mcp_resource(
        uri=original_uri,
        mcp_source=source,
        caller=caller,
    )

    if result.get('timed_out'):
        raise ValueError(f"External MCP resource read timed out: {original_uri}")
    if result.get('connection_error'):
        raise ValueError(f"External MCP source unreachable: {slug}")
    if not result.get('success'):
        error = result.get('error', 'Unknown error')
        raise ValueError(f"External MCP resource read failed: {error}")

    contents = result.get('contents', [])
    rewritten = []
    for c in contents:
        rewritten.append({
            **c,
            'uri': uri,
        })

    return {'contents': rewritten}


def models_Q_slug_or_name(slug: str):
    """Build a Q filter matching slug field or slugified name."""
    from django.db.models import Q
    return Q(slug=slug) | Q(slug='', name__iexact=slug.replace('_', ' '))


def _default_caller():
    """Fallback CallerContext when no request is available."""
    from apps.mcp.services.agent.models import CallerContext
    return CallerContext(channel='mcp')

