"""
MCP client for connecting to customer MCP servers.

Handles tool discovery (tools/list) and execution (tools/call) via
Streamable HTTP (JSON-RPC over HTTP POST).
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import TYPE_CHECKING, Any

import httpx
from django.utils import timezone

if TYPE_CHECKING:
    from apps.mcp.services.agent.models import CallerContext
    from apps.tools.models import MCPToolSource

logger = logging.getLogger(__name__)


def _build_auth_headers(source: MCPToolSource) -> dict[str, str]:
    """Construct auth headers based on the source's auth_type."""
    headers: dict[str, str] = {"Content-Type": "application/json"}

    if source.auth_type == "bearer":
        creds = _parse_credentials(source.auth_credentials)
        token = creds.get("token", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"

    elif source.auth_type == "header":
        creds = _parse_credentials(source.auth_credentials)
        header_name = creds.get("header_name", "")
        header_value = creds.get("header_value", "")
        if header_name and header_value:
            headers[header_name] = header_value

    return headers


def _parse_credentials(raw: str) -> dict[str, Any]:
    """Parse auth_credentials — may be JSON string or already a dict."""
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


async def discover_tools(source: MCPToolSource) -> list[dict[str, Any]]:
    """
    Call tools/list on the customer's MCP server and return tool schemas.
    """
    headers = _build_auth_headers(source)

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "tools/list",
        "params": {},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(source.url, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()

    if "error" in result:
        raise RuntimeError(f"MCP tools/list error: {result['error']}")

    tools = result.get("result", {}).get("tools", [])
    return tools


async def execute_mcp_tool(
    *,
    tool_name: str,
    arguments: dict,
    mcp_source: MCPToolSource,
    caller: CallerContext,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """Call a tool on the customer's MCP server via Streamable HTTP."""

    headers = _build_auth_headers(mcp_source)

    headers["X-Pillar-Caller-Id"] = getattr(caller, "external_user_id", "") or ""
    headers["X-Pillar-Caller-Email"] = getattr(caller, "email", "") or ""
    headers["X-Pillar-Caller-Channel"] = getattr(caller, "channel", "web") or "web"
    headers["X-Pillar-Caller-Display-Name"] = getattr(caller, "display_name", "") or ""

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
            response = await client.post(mcp_source.url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()

        if "error" in result:
            return {"success": False, "error": result["error"].get("message", str(result["error"]))}

        content = result.get("result", {}).get("content", [])
        return {"success": True, "result": content}
    except httpx.TimeoutException:
        return {"timed_out": True}
    except httpx.ConnectError:
        return {"connection_error": True}
    except Exception as exc:
        logger.exception("MCP tool call to %s failed: %s", mcp_source.url, exc)
        return {"connection_error": True, "error": str(exc)}


def discover_and_sync_tools(source: MCPToolSource) -> None:
    """
    Synchronous wrapper: discover tools from an MCP source and upsert
    them as Action records in the database.
    """
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        tools = loop.run_until_complete(discover_tools(source))
    finally:
        loop.close()

    _sync_discovered_tools(source, tools)


def _sync_discovered_tools(source: MCPToolSource, tools: list[dict]) -> None:
    """Upsert discovered MCP tools as Action records."""
    from apps.products.models import Action

    source.discovered_tools = tools
    source.last_discovery_at = timezone.now()
    source.discovery_status = "success"
    source.discovery_error = ""
    source.save(update_fields=[
        "discovered_tools", "last_discovery_at",
        "discovery_status", "discovery_error",
    ])

    for tool_def in tools:
        name = tool_def.get("name", "")
        if not name:
            continue

        Action.objects.update_or_create(
            product=source.product,
            name=name,
            source_type=Action.SourceType.MCP,
            defaults={
                "organization": source.organization,
                "description": tool_def.get("description", ""),
                "tool_type": Action.ToolType.SERVER_SIDE,
                "mcp_source": source,
                "data_schema": tool_def.get("inputSchema", {}),
                "channel_compatibility": ["web", "slack", "discord", "email", "api"],
                "status": Action.Status.DRAFT,
            },
        )

    logger.info(
        "MCP discovery for %s: %d tools synced",
        source.name, len(tools),
    )
