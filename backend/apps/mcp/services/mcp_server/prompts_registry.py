"""
Prompts registry for MCP server.

Loads prompt definitions from external MCP sources attached to the
resolved agent and serves them via prompts/list and prompts/get.

Copyright (C) 2025 Pillar Team
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from .pagination import paginate_list

logger = logging.getLogger(__name__)

SLUG_SEPARATOR = "__"


async def list_prompts(
    help_center_config,
    agent=None,
    cursor: str | None = None,
) -> Dict[str, Any]:
    """
    List available prompts from product skills and external MCP sources.

    Product skills are listed first (no namespace prefix). External MCP
    prompts are namespaced with the source slug to avoid collisions
    across multiple external servers (e.g. ``acme__code_review``).

    Supports cursor-based pagination per the MCP spec.

    Args:
        help_center_config: HelpCenterConfig instance
        agent: Optional Agent model instance (resolved by middleware)
        cursor: Opaque pagination cursor from a previous response

    Returns:
        Dict with 'prompts' key and optional 'nextCursor'
    """
    prompts: list[Dict[str, Any]] = []

    product_skills = await _load_product_skills(help_center_config)
    prompts.extend(product_skills)

    if agent:
        external = await _load_external_mcp_prompts(agent)
        prompts.extend(external)

    page, next_cursor = paginate_list(prompts, cursor)

    result: Dict[str, Any] = {'prompts': page}
    if next_cursor is not None:
        result['nextCursor'] = next_cursor
    return result


async def get_prompt(
    params: Dict[str, Any],
    agent=None,
    help_center_config=None,
) -> Dict[str, Any]:
    """
    Get a specific prompt by name.

    Checks product skills first (no namespace), then falls back to
    external MCP sources via the namespaced format (``slug__name``).

    Args:
        params: Request parameters with 'name' and optional 'arguments'
        agent: Optional Agent model instance
        help_center_config: Optional product for skill lookup

    Returns:
        Prompt content with 'description' and 'messages'.

    Raises:
        ValueError: If the prompt name is invalid or the source is not found
    """
    from apps.tools.models import MCPToolSource, RegisteredSkill
    from apps.tools.services.mcp_client import get_mcp_prompt

    name = params.get("name", "")
    arguments = params.get("arguments")

    # Check product skills first (no namespace separator)
    if help_center_config and SLUG_SEPARATOR not in name:
        try:
            skill = await RegisteredSkill.objects.aget(
                product=help_center_config,
                name=name,
                is_active=True,
            )
            return {
                'description': skill.description,
                'messages': [{
                    'role': 'user',
                    'content': {'type': 'text', 'text': skill.content},
                }],
            }
        except RegisteredSkill.DoesNotExist:
            pass

    if SLUG_SEPARATOR not in name:
        raise ValueError(f"Unknown prompt: {name}")

    slug, original_name = name.split(SLUG_SEPARATOR, 1)

    if not agent:
        raise ValueError(f"Unknown prompt: {name}")

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]
    if not source_ids:
        raise ValueError(f"Unknown prompt: {name}")

    matched_source = None
    async for src in MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).aiterator():
        src_slug = src.slug or src.name.lower().replace(" ", "_")
        if src_slug == slug:
            matched_source = src
            break

    if not matched_source:
        raise ValueError(f"Unknown prompt: {name}")

    result = await get_mcp_prompt(
        prompt_name=original_name,
        arguments=arguments,
        mcp_source=matched_source,
    )

    if result.get("timed_out"):
        raise ValueError(f"Prompt request timed out for: {name}")
    if result.get("connection_error"):
        raise ValueError(
            f"Could not reach MCP source for prompt: {name}"
        )
    if not result.get("success"):
        error = result.get("error", "Unknown error")
        raise ValueError(f"Prompt error: {error}")

    return result["result"]


async def _load_product_skills(help_center_config) -> list[Dict[str, Any]]:
    """Load registered skills as MCP prompts for this product."""
    from apps.tools.models import RegisteredSkill

    prompts: list[Dict[str, Any]] = []

    async for skill in RegisteredSkill.objects.filter(
        product=help_center_config,
        is_active=True,
    ).aiterator():
        prompts.append({
            'name': skill.name,
            'description': skill.description,
        })

    if prompts:
        logger.info(
            "[prompts/list] Loaded %d product skill(s) as prompts",
            len(prompts),
        )

    return prompts


async def _load_external_mcp_prompts(agent) -> list[Dict[str, Any]]:
    """Load prompts from external MCP sources attached to this agent.

    Each prompt name is prefixed with ``{slug}__`` so the dispatcher
    can route get requests back to the correct source.
    """
    from apps.tools.models import MCPToolSource

    source_ids = [
        pk async for pk in agent.mcp_sources.values_list('id', flat=True)
    ]
    if not source_ids:
        return []

    prompts: list[Dict[str, Any]] = []

    async for source in MCPToolSource.objects.filter(
        id__in=source_ids,
        is_active=True,
        discovery_status=MCPToolSource.DiscoveryStatus.SUCCESS,
    ).aiterator():
        slug = source.slug or source.name.lower().replace(" ", "_")
        for prompt_def in (source.discovered_prompts or []):
            original_name = prompt_def.get("name", "")
            if not original_name:
                continue
            prompts.append({
                'name': f'{slug}{SLUG_SEPARATOR}{original_name}',
                'title': prompt_def.get("title", ""),
                'description': prompt_def.get("description", ""),
                'arguments': prompt_def.get("arguments", []),
            })

    if prompts:
        logger.info(
            "[prompts/list] Loaded %d external MCP prompt(s) from %d source(s)",
            len(prompts), len(source_ids),
        )

    return prompts
