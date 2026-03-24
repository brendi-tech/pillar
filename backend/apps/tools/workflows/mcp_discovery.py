"""
Hatchet workflows for MCP tool and resource discovery.

- tools-mcp-discovery: periodic cron (every 24h) refreshes all active sources.
- tools-mcp-source-refresh: on-demand refresh for a single source (triggered
  on tool call failure or manual refresh).
- tools-mcp-embed-descriptions: background embedding of tool/resource
  descriptions after discovery stores raw schemas.

Discovery stores schemas immediately for fast UI feedback, then fires
the embed task so callers aren't blocked by the embedding loop.
"""
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class MCPDiscoveryInput(BaseModel):
    """Empty input — this is a cron-triggered workflow."""
    pass


@hatchet.task(
    name="tools-mcp-discovery",
    retries=1,
    execution_timeout=timedelta(minutes=10),
    input_validator=MCPDiscoveryInput,
)
async def mcp_discovery_workflow(
    workflow_input: MCPDiscoveryInput,
    context: Context,
):
    """Re-discover tools and resources from all active MCP sources."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import discover_and_store

    sources = await sync_to_async(list)(
        MCPToolSource.objects.filter(is_active=True).select_related("product")
    )

    if not sources:
        logger.info("[MCPDiscovery] No active MCP sources to refresh")
        return {"refreshed": 0}

    results = {"refreshed": 0, "errors": 0}

    for source in sources:
        try:
            await discover_and_store(source)
            results["refreshed"] += 1
        except Exception as exc:
            results["errors"] += 1
            source.discovery_status = "error"
            source.discovery_error = str(exc)[:1000]
            await source.asave(
                update_fields=["discovery_status", "discovery_error"]
            )
            logger.exception(
                "[MCPDiscovery] Failed to refresh %s: %s", source.name, exc
            )

    logger.info(
        "[MCPDiscovery] Refreshed %d sources, %d errors",
        results["refreshed"], results["errors"],
    )
    return results


class MCPSourceRefreshInput(BaseModel):
    """Input for single-source refresh (triggered on failure or manual)."""
    mcp_source_id: str


@hatchet.task(
    name="tools-mcp-source-refresh",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=MCPSourceRefreshInput,
)
async def mcp_source_refresh_workflow(
    workflow_input: MCPSourceRefreshInput,
    context: Context,
):
    """Re-discover tools and resources for a single MCP source."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import discover_and_store

    try:
        source = await MCPToolSource.objects.select_related("product").aget(
            id=workflow_input.mcp_source_id,
        )
    except MCPToolSource.DoesNotExist:
        logger.warning(
            "[MCPSourceRefresh] Source %s not found",
            workflow_input.mcp_source_id,
        )
        return {"error": "not_found"}

    try:
        await discover_and_store(source)
        logger.info("[MCPSourceRefresh] Refreshed %s", source.name)
        return {"refreshed": True}
    except Exception as exc:
        source.discovery_status = "error"
        source.discovery_error = str(exc)[:1000]
        await source.asave(
            update_fields=["discovery_status", "discovery_error"]
        )
        logger.exception(
            "[MCPSourceRefresh] Failed to refresh %s: %s", source.name, exc
        )
        return {"error": str(exc)}


class MCPEmbedDescriptionsInput(BaseModel):
    """Input for background embedding of discovered tool/resource descriptions."""
    mcp_source_id: str


@hatchet.task(
    name="tools-mcp-embed-descriptions",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=MCPEmbedDescriptionsInput,
)
async def mcp_embed_descriptions_workflow(
    workflow_input: MCPEmbedDescriptionsInput,
    context: Context,
):
    """Embed tool/resource descriptions for an MCP source after discovery."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import embed_source_descriptions

    try:
        source = await MCPToolSource.objects.aget(
            id=workflow_input.mcp_source_id,
        )
    except MCPToolSource.DoesNotExist:
        logger.warning(
            "[MCPEmbed] Source %s not found",
            workflow_input.mcp_source_id,
        )
        return {"error": "not_found"}

    try:
        await embed_source_descriptions(source)
        logger.info("[MCPEmbed] Embedded descriptions for %s", source.name)
        return {"embedded": True}
    except Exception as exc:
        logger.exception(
            "[MCPEmbed] Failed to embed descriptions for %s: %s",
            source.name, exc,
        )
        return {"error": str(exc)}
