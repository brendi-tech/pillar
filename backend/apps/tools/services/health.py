"""
Endpoint and MCP source health utilities.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def is_endpoint_healthy(product_id: str) -> bool:
    """Check if the product has a healthy tool endpoint."""
    from apps.tools.models import ToolEndpoint

    endpoint = await (
        ToolEndpoint.objects
        .filter(product_id=product_id, is_active=True)
        .afirst()
    )
    if endpoint is None:
        return False
    return endpoint.last_ping_success


async def is_mcp_source_healthy(mcp_source_id: str) -> bool:
    """Check if an MCP source is reachable."""
    from apps.tools.models import MCPToolSource

    source = await (
        MCPToolSource.objects
        .filter(id=mcp_source_id, is_active=True)
        .afirst()
    )
    if source is None:
        return False
    return source.last_ping_success
