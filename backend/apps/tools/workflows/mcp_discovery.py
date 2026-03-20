"""
Hatchet workflow: periodic MCP tool rediscovery.

Runs hourly to refresh tool schemas from active MCP sources.
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
    """Re-discover tools from all active MCP sources."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import discover_and_sync_tools

    sources = await sync_to_async(list)(
        MCPToolSource.objects.filter(is_active=True).select_related("product")
    )

    if not sources:
        logger.info("[MCPDiscovery] No active MCP sources to refresh")
        return {"refreshed": 0}

    results = {"refreshed": 0, "errors": 0}

    for source in sources:
        try:
            await sync_to_async(discover_and_sync_tools)(source)
            results["refreshed"] += 1
        except Exception as exc:
            results["errors"] += 1
            logger.exception(
                "[MCPDiscovery] Failed to refresh %s: %s", source.name, exc
            )

    logger.info("[MCPDiscovery] Refreshed %d sources, %d errors", results["refreshed"], results["errors"])
    return results
