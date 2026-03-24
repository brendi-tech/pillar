"""
Tools registry for MCP server.

Delegates to the unified ToolRegistry for built-in tool definitions,
loads product server-side Actions for MCP agents, and aggregates
tools from external MCP sources with slug-based namespacing.

Copyright (C) 2025 Pillar Team
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from .pagination import paginate_list

logger = logging.getLogger(__name__)


async def build_tools_list(
    help_center_config, agent=None, cursor: str | None = None,
) -> Dict[str, Any]:
    """
    Build list of available tools for MCP.

    Uses the unified ToolRegistry to load built-in tools. When the agent's
    channel is ``mcp``, also includes the product's published server-side
    Actions (filtered by the agent's tool scope) and tools from any
    external MCP sources attached to the agent (namespaced by source slug).

    Supports cursor-based pagination per the MCP spec.

    Args:
        help_center_config: HelpCenterConfig instance
        agent: Optional Agent model instance (resolved by middleware)
        cursor: Opaque pagination cursor from a previous response

    Returns:
        Dict with 'tools' key and optional 'nextCursor'
    """
    from apps.mcp.tools.loader import load_all_tools_for_help_center
    from apps.mcp.tools.registry import get_tool_registry

    logger.info(f"[tools/list] Building tools list for help center: {help_center_config.id if help_center_config else 'None'}")

    if not help_center_config:
        logger.warning("[tools/list] No help center provided, returning empty tools list")
        return {'tools': []}

    try:
        await load_all_tools_for_help_center(help_center_config)

        registry = get_tool_registry()
        public_tools = registry.get_public_tools(str(help_center_config.id))

        tools = [tool.to_mcp_schema() for tool in public_tools]

        if agent and getattr(agent, 'channel', None) == 'mcp':
            product_tools = await _load_product_server_tools(help_center_config, agent)
            builtin_names = {t['name'] for t in tools}
            tools.extend(t for t in product_tools if t['name'] not in builtin_names)

        if agent:
            external_tools = await _load_external_mcp_tools(agent)
            existing_names = {t['name'] for t in tools}
            tools.extend(t for t in external_tools if t['name'] not in existing_names)

        page, next_cursor = paginate_list(tools, cursor)

        logger.info(f"[tools/list] Returning {len(page)} tools for help center {help_center_config.id}")
        result: Dict[str, Any] = {'tools': page}
        if next_cursor is not None:
            result['nextCursor'] = next_cursor
        return result

    except Exception as e:
        logger.error(f"[tools/list] Error building tools list: {e}", exc_info=True)
        return {'tools': []}


async def _load_product_server_tools(help_center_config, agent) -> list[Dict[str, Any]]:
    """Load published server-side Actions for the product, filtered by agent scope."""
    from apps.products.models.action import Action
    from apps.products.services.agent_resolver import (
        filter_tools_for_agent,
        resolve_agent_config_from_agent,
    )

    actions = Action.objects.filter(
        product=help_center_config,
        tool_type=Action.ToolType.SERVER_SIDE,
        status=Action.Status.PUBLISHED,
    )
    action_dicts = [
        {
            'id': str(a.id),
            'name': a.name,
            'description': a.description,
            'tool_type': a.tool_type,
            'data_schema': a.data_schema,
            'channel_compatibility': a.channel_compatibility,
        }
        async for a in actions
    ]

    if not action_dicts:
        return []

    agent_config = await resolve_agent_config_from_agent(agent, help_center_config)
    filtered = filter_tools_for_agent(
        action_dicts,
        channel='mcp',
        tool_scope=agent_config.tool_scope,
        restriction_ids=agent_config.tool_restriction_ids,
        allowance_ids=agent_config.tool_allowance_ids,
    )

    return [_action_to_mcp_schema(a) for a in filtered]


def _action_to_mcp_schema(action_dict: dict) -> Dict[str, Any]:
    """Convert a product Action dict to MCP tool schema format."""
    schema = action_dict.get('data_schema') or {}
    if schema.get('type') == 'object':
        input_schema = schema
    else:
        input_schema = {
            'type': 'object',
            'properties': schema.get('properties', {}),
        }
    return {
        'name': action_dict['name'],
        'description': action_dict.get('description', ''),
        'inputSchema': input_schema,
    }


async def _load_external_mcp_tools(agent) -> list[Dict[str, Any]]:
    """Load tools from external MCP sources attached to this agent.

    Each tool name is prefixed with the source slug to avoid collisions
    across sources and with built-in tools.  Annotations are stored so
    the dispatcher can reverse the mapping at call time.
    """
    from apps.tools.models import MCPToolSource

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]
    if not source_ids:
        return []

    tools: list[Dict[str, Any]] = []

    async for source in MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).aiterator():
        slug = source.slug or source.name.lower().replace(" ", "_")
        for tool_def in source.discovered_tools:
            original_name = tool_def.get("name", "")
            if not original_name:
                continue

            input_schema = tool_def.get("inputSchema", {})
            if not input_schema.get("type"):
                input_schema = {
                    "type": "object",
                    "properties": input_schema.get("properties", {}),
                }

            tools.append({
                "name": f"{slug}_{original_name}",
                "description": tool_def.get("description", ""),
                "inputSchema": input_schema,
                "annotations": {
                    "x-pillar-mcp-source-id": str(source.id),
                    "x-pillar-mcp-source-slug": slug,
                    "x-pillar-mcp-original-name": original_name,
                },
            })

    if tools:
        logger.info(
            "[tools/list] Loaded %d external MCP tool(s) from %d source(s)",
            len(tools), len(source_ids),
        )

    return tools
