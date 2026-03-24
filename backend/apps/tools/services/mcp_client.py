"""
MCP client for connecting to customer MCP servers.

Handles tool/resource/prompt discovery and execution via
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
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

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

    elif source.auth_type == "oauth":
        creds = _parse_credentials(source.auth_credentials)
        access_token = creds.get("access_token", "")
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

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


async def _initialize_session(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
) -> str | None:
    """
    Perform the MCP Streamable HTTP session handshake.

    Sends initialize, then an initialized notification.
    Returns the Mcp-Session-Id from the server (if provided).
    """
    init_payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "pillar", "version": "1.0"},
        },
    }

    resp = await client.post(url, json=init_payload, headers=headers)
    resp.raise_for_status()

    session_id = resp.headers.get("mcp-session-id")

    # Send initialized notification (no id = notification, no response expected)
    notify_headers = {**headers}
    if session_id:
        notify_headers["Mcp-Session-Id"] = session_id

    notify_payload = {
        "jsonrpc": "2.0",
        "method": "notifications/initialized",
    }
    notify_resp = await client.post(url, json=notify_payload, headers=notify_headers)
    # Notifications may return 200 or 202; both are fine
    if notify_resp.status_code >= 400:
        logger.warning(
            "initialized notification returned %s for %s",
            notify_resp.status_code, url,
        )

    return session_id


async def _paginated_list(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    method: str,
    result_key: str,
    max_pages: int = 50,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Follow cursor-based pagination on an MCP list endpoint.

    Collects all items across pages by following ``nextCursor`` until
    exhausted or ``max_pages`` is reached (safety cap against buggy servers).

    Returns (all_items, last_jsonrpc_response) so callers can inspect
    error details from the final response.
    """
    all_items: list[dict[str, Any]] = []
    cursor: str | None = None
    result: dict[str, Any] = {}

    for _ in range(max_pages):
        params: dict[str, Any] = {}
        if cursor is not None:
            params["cursor"] = cursor

        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
            "params": params,
        }

        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        result = _parse_jsonrpc_response(response)

        if "error" in result:
            return all_items, result

        result_body = result.get("result", {})
        page_items = result_body.get(result_key, [])
        all_items.extend(page_items)

        cursor = result_body.get("nextCursor")
        if not cursor:
            break

    return all_items, result


async def _init_session_with_retry(
    source: MCPToolSource,
    client: httpx.AsyncClient,
    headers: dict[str, str],
) -> tuple[str | None, dict[str, str]]:
    """Initialize an MCP session, retrying once with a refreshed OAuth token on 401."""
    if source.auth_type == "oauth":
        try:
            session_id = await _initialize_session(client, source.url, headers)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                refreshed = await _try_oauth_refresh(source)
                if refreshed:
                    headers = _build_auth_headers(source)
                    session_id = await _initialize_session(client, source.url, headers)
                else:
                    raise
            else:
                raise
    else:
        session_id = await _initialize_session(client, source.url, headers)

    list_headers = {**headers}
    if session_id:
        list_headers["Mcp-Session-Id"] = session_id
    return session_id, list_headers


async def discover_tools(source: MCPToolSource) -> list[dict[str, Any]]:
    """
    Call tools/list on the customer's MCP server and return tool schemas.

    Follows the full Streamable HTTP lifecycle:
    initialize -> initialized -> tools/list (with pagination).
    """
    headers = _build_auth_headers(source)

    async with httpx.AsyncClient(timeout=30) as client:
        _, list_headers = await _init_session_with_retry(source, client, headers)

        all_tools, last_result = await _paginated_list(
            client, source.url, list_headers,
            method="tools/list", result_key="tools",
        )

    if "error" in last_result:
        raise RuntimeError(f"MCP tools/list error: {last_result['error']}")

    return all_tools


async def discover_resources(source: MCPToolSource) -> list[dict[str, Any]]:
    """
    Call resources/list on the customer's MCP server and return resource descriptors.

    Follows the full Streamable HTTP lifecycle:
    initialize -> initialized -> resources/list (with pagination).

    Returns an empty list if the server does not support resources.
    """
    headers = _build_auth_headers(source)

    async with httpx.AsyncClient(timeout=30) as client:
        _, list_headers = await _init_session_with_retry(source, client, headers)

        all_resources, last_result = await _paginated_list(
            client, source.url, list_headers,
            method="resources/list", result_key="resources",
        )

    if "error" in last_result:
        error = last_result["error"]
        error_code = error.get("code") if isinstance(error, dict) else None
        if error_code == -32601:
            logger.info("MCP server %s does not support resources/list", source.name)
            return []
        raise RuntimeError(f"MCP resources/list error: {error}")

    return all_resources


async def discover_prompts(source: MCPToolSource) -> list[dict[str, Any]]:
    """
    Call prompts/list on the customer's MCP server and return prompt definitions.

    Follows the full Streamable HTTP lifecycle:
    initialize -> initialized -> prompts/list (with pagination).

    Returns an empty list if the server does not support prompts.
    """
    headers = _build_auth_headers(source)

    async with httpx.AsyncClient(timeout=30) as client:
        _, list_headers = await _init_session_with_retry(source, client, headers)

        all_prompts, last_result = await _paginated_list(
            client, source.url, list_headers,
            method="prompts/list", result_key="prompts",
        )

    if "error" in last_result:
        error = last_result["error"]
        error_code = error.get("code") if isinstance(error, dict) else None
        if error_code == -32601:
            logger.info("MCP server %s does not support prompts/list", source.name)
            return []
        raise RuntimeError(f"MCP prompts/list error: {error}")

    return all_prompts


async def get_mcp_prompt(
    *,
    prompt_name: str,
    arguments: dict[str, str] | None = None,
    mcp_source: MCPToolSource,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """Proxy a prompts/get call to the customer's MCP server."""

    headers = _build_auth_headers(mcp_source)

    params: dict[str, Any] = {"name": prompt_name}
    if arguments:
        params["arguments"] = arguments

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "prompts/get",
        "params": params,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
            try:
                session_id = await _initialize_session(client, mcp_source.url, headers)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 401 and mcp_source.auth_type == "oauth":
                    refreshed = await _try_oauth_refresh(mcp_source)
                    if refreshed:
                        headers = _build_auth_headers(mcp_source)
                        session_id = await _initialize_session(client, mcp_source.url, headers)
                    else:
                        return {"success": False, "error": "OAuth token expired"}
                else:
                    raise

            call_headers = {**headers}
            if session_id:
                call_headers["Mcp-Session-Id"] = session_id

            response = await client.post(mcp_source.url, json=payload, headers=call_headers)
            response.raise_for_status()
            result = _parse_jsonrpc_response(response)

        if "error" in result:
            return {"success": False, "error": result["error"].get("message", str(result["error"]))}

        return {"success": True, "result": result.get("result", {})}
    except httpx.TimeoutException:
        return {"timed_out": True}
    except httpx.ConnectError:
        return {"connection_error": True}
    except Exception as exc:
        logger.exception("MCP prompts/get to %s failed: %s", mcp_source.url, exc)
        return {"connection_error": True, "error": str(exc)}


async def read_mcp_resource(
    *,
    uri: str,
    mcp_source: MCPToolSource,
    caller: CallerContext,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """Read a resource from the customer's MCP server via Streamable HTTP."""

    headers = _build_auth_headers(mcp_source)

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "resources/read",
        "params": {"uri": uri},
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
            try:
                session_id = await _initialize_session(client, mcp_source.url, headers)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 401 and mcp_source.auth_type == "oauth":
                    refreshed = await _try_oauth_refresh(mcp_source)
                    if refreshed:
                        headers = _build_auth_headers(mcp_source)
                        session_id = await _initialize_session(client, mcp_source.url, headers)
                    else:
                        return {"success": False, "error": "OAuth token expired"}
                else:
                    raise

            call_headers = {**headers}
            if session_id:
                call_headers["Mcp-Session-Id"] = session_id
            call_headers["X-Pillar-Caller-Id"] = getattr(caller, "external_user_id", "") or ""
            call_headers["X-Pillar-Caller-Email"] = getattr(caller, "email", "") or ""
            call_headers["X-Pillar-Caller-Channel"] = getattr(caller, "channel", "web") or "web"
            call_headers["X-Pillar-Caller-Display-Name"] = getattr(caller, "display_name", "") or ""

            response = await client.post(mcp_source.url, json=payload, headers=call_headers)
            response.raise_for_status()
            result = _parse_jsonrpc_response(response)

        if "error" in result:
            return {"success": False, "error": result["error"].get("message", str(result["error"]))}

        contents = result.get("result", {}).get("contents", [])
        return {"success": True, "contents": contents}
    except httpx.TimeoutException:
        return {"timed_out": True}
    except httpx.ConnectError:
        return {"connection_error": True}
    except Exception as exc:
        logger.exception("MCP resources/read to %s failed: %s", mcp_source.url, exc)
        return {"connection_error": True, "error": str(exc)}


def _parse_jsonrpc_response(response: httpx.Response) -> dict[str, Any]:
    """Parse a JSON-RPC response, handling both JSON and SSE formats."""
    content_type = response.headers.get("content-type", "")

    if "text/event-stream" in content_type:
        # Parse SSE: extract JSON from "data:" lines
        for line in response.text.splitlines():
            if line.startswith("data:"):
                data_str = line[len("data:"):].strip()
                if data_str:
                    return json.loads(data_str)
        raise RuntimeError("No data in SSE response")

    return response.json()


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

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }

    timeout_s = timeout_ms / 1000
    logger.info(
        "[MCP] tools/call %s on %s (source=%s, auth=%s, timeout=%ss)",
        tool_name, mcp_source.url, mcp_source.name, mcp_source.auth_type, timeout_s,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            try:
                session_id = await _initialize_session(client, mcp_source.url, headers)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 401 and mcp_source.auth_type == "oauth":
                    refreshed = await _try_oauth_refresh(mcp_source)
                    if refreshed:
                        headers = _build_auth_headers(mcp_source)
                        session_id = await _initialize_session(client, mcp_source.url, headers)
                    else:
                        logger.warning(
                            "[MCP] AUTH_ERROR %s on %s: OAuth token expired, refresh failed",
                            tool_name, mcp_source.url,
                        )
                        return {
                            "success": False,
                            "auth_error": True,
                            "error": "OAuth token expired. Re-authorization is required.",
                        }
                elif exc.response.status_code == 401:
                    logger.warning(
                        "[MCP] AUTH_ERROR %s on %s: HTTP 401 (auth_type=%s)",
                        tool_name, mcp_source.url, mcp_source.auth_type,
                    )
                    return {
                        "success": False,
                        "auth_error": True,
                        "error": "Authentication credentials are invalid or expired.",
                    }
                else:
                    raise

            call_headers = {**headers}
            if session_id:
                call_headers["Mcp-Session-Id"] = session_id
            call_headers["X-Pillar-Caller-Id"] = getattr(caller, "external_user_id", "") or ""
            call_headers["X-Pillar-Caller-Email"] = getattr(caller, "email", "") or ""
            call_headers["X-Pillar-Caller-Channel"] = getattr(caller, "channel", "web") or "web"
            call_headers["X-Pillar-Caller-Display-Name"] = getattr(caller, "display_name", "") or ""

            response = await client.post(mcp_source.url, json=payload, headers=call_headers)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 401:
                    logger.warning(
                        "[MCP] AUTH_ERROR %s on %s: HTTP 401 on tools/call",
                        tool_name, mcp_source.url,
                    )
                    return {
                        "success": False,
                        "auth_error": True,
                        "error": "Authentication credentials are invalid or expired.",
                    }
                raise
            result = _parse_jsonrpc_response(response)

        if "error" in result:
            error_msg = result["error"].get("message", str(result["error"]))
            logger.warning("[MCP] RPC_ERROR %s on %s: %s", tool_name, mcp_source.url, error_msg)
            return {"success": False, "error": error_msg}

        content = result.get("result", {}).get("content", [])
        logger.info("[MCP] OK %s on %s (%d content blocks)", tool_name, mcp_source.url, len(content))
        return {"success": True, "result": content}
    except httpx.TimeoutException:
        logger.warning(
            "[MCP] TIMEOUT %s on %s after %ss (source=%s)",
            tool_name, mcp_source.url, timeout_s, mcp_source.name,
        )
        return {"timed_out": True}
    except httpx.ConnectError as exc:
        logger.warning(
            "[MCP] CONNECT_ERROR %s on %s (source=%s): %s",
            tool_name, mcp_source.url, mcp_source.name, exc,
        )
        return {"connection_error": True}
    except Exception as exc:
        logger.exception("[MCP] ERROR %s on %s (source=%s)", tool_name, mcp_source.url, mcp_source.name)
        return {"connection_error": True, "error": str(exc)}


def _derive_requires_confirmation(tool_def: dict) -> bool:
    """Derive requires_confirmation from MCP tool annotations.

    Uses annotations when available, defaults to False when absent.
    """
    annotations = tool_def.get("annotations") or {}
    if annotations.get("readOnlyHint") is True:
        return False
    if annotations.get("destructiveHint") is True:
        return True
    return False


async def _sync_tool_configs(source: MCPToolSource, tools: list[dict]) -> None:
    """Sync MCPToolConfig rows to match discovered tools.

    Creates new rows for new tools, removes rows for tools that no longer
    exist, and preserves user-modified rows for tools that still exist.
    """
    from apps.tools.models import MCPToolConfig

    existing = {
        cfg.tool_name: cfg
        async for cfg in MCPToolConfig.objects.filter(mcp_source=source)
    }
    discovered_names = {t["name"] for t in tools if t.get("name")}

    stale_names = set(existing.keys()) - discovered_names
    if stale_names:
        await MCPToolConfig.objects.filter(
            mcp_source=source, tool_name__in=stale_names,
        ).adelete()

    new_tools = [t for t in tools if t.get("name") and t["name"] not in existing]
    if new_tools:
        await MCPToolConfig.objects.abulk_create([
            MCPToolConfig(
                mcp_source=source,
                tool_name=t["name"],
                is_enabled=True,
                requires_confirmation=_derive_requires_confirmation(t),
            )
            for t in new_tools
        ])

    logger.info(
        "MCP tool configs synced for %s: %d new, %d removed, %d kept",
        source.name, len(new_tools), len(stale_names),
        len(discovered_names & set(existing.keys())),
    )


async def discover_and_store(source: MCPToolSource) -> None:
    """
    Discover tools, resources, and prompts from an MCP source and persist
    them immediately. Fires a background Hatchet task to embed descriptions
    so callers aren't blocked by the embedding loop.

    No Action rows are created -- schemas and embeddings live entirely
    on MCPToolSource.discovered_tools / discovered_resources /
    discovered_prompts.
    """
    import asyncio

    tools_task = discover_tools(source)
    resources_task = _discover_resources_safe(source)
    prompts_task = _discover_prompts_safe(source)

    tools, resources, prompts = await asyncio.gather(
        tools_task, resources_task, prompts_task,
    )

    source.discovered_tools = tools
    source.discovered_resources = resources or []
    source.discovered_prompts = prompts or []
    source.last_discovery_at = timezone.now()
    source.discovery_status = "success"
    source.discovery_error = ""
    await source.asave()

    await _sync_tool_configs(source, tools)

    logger.info(
        "MCP discovery for %s: %d tools, %d resources, %d prompts stored",
        source.name, len(tools), len(source.discovered_resources),
        len(source.discovered_prompts),
    )

    from common.task_router import TaskRouter
    TaskRouter.execute(
        "tools-mcp-embed-descriptions",
        mcp_source_id=str(source.id),
    )


async def _discover_resources_safe(source: MCPToolSource) -> list[dict]:
    """Discover resources, returning empty list on any failure."""
    try:
        return await discover_resources(source)
    except Exception as exc:
        logger.info(
            "MCP resource discovery for %s skipped: %s", source.name, exc,
        )
        return []


async def _discover_prompts_safe(source: MCPToolSource) -> list[dict]:
    """Discover prompts, returning empty list on any failure."""
    try:
        return await discover_prompts(source)
    except Exception as exc:
        logger.info(
            "MCP prompt discovery for %s skipped: %s", source.name, exc,
        )
        return []


async def embed_source_descriptions(source: MCPToolSource) -> None:
    """Embed tool/resource descriptions concurrently and persist.

    Designed to run in a background Hatchet task after discovery has
    already stored the raw schemas.  Items that already have an
    ``_description_embedding`` key are skipped so this is idempotent.
    """
    import asyncio

    from common.services.embedding_service import get_embedding_service

    service = get_embedding_service()
    sem = asyncio.Semaphore(20)

    async def _embed(text: str) -> list[float]:
        async with sem:
            return await service.embed_query_async(text)

    tools = source.discovered_tools or []
    resources = source.discovered_resources or []

    tasks: list[tuple[dict, str, asyncio.Task]] = []

    for tool_def in tools:
        if "_description_embedding" in tool_def:
            continue
        desc = tool_def.get("description", "")
        if desc:
            tasks.append((tool_def, "_description_embedding", asyncio.ensure_future(_embed(desc))))

    for res in resources:
        if "_description_embedding" in res:
            continue
        text = res.get("description") or res.get("name", "")
        if text:
            tasks.append((res, "_description_embedding", asyncio.ensure_future(_embed(text))))

    if not tasks:
        logger.info("MCP embed for %s: nothing to embed", source.name)
        return

    results = await asyncio.gather(*(t for _, _, t in tasks), return_exceptions=True)

    embedded = 0
    for (item, key, _), result in zip(tasks, results):
        if isinstance(result, Exception):
            logger.warning("Embedding failed for %s item: %s", source.name, result)
            continue
        item[key] = result
        embedded += 1

    await source.asave(update_fields=["discovered_tools", "discovered_resources"])

    logger.info(
        "MCP embed for %s: %d/%d descriptions embedded",
        source.name, embedded, len(tasks),
    )


async def _try_oauth_refresh(source: MCPToolSource) -> bool:
    """
    Attempt to refresh an expired OAuth token for an MCP source.

    Returns True if refresh succeeded and source.auth_credentials was updated.
    """
    from apps.mcp_oauth.token_client import refresh_access_token

    creds = _parse_credentials(source.auth_credentials)
    refresh_token = creds.get("refresh_token", "")
    if not refresh_token or not source.oauth_token_endpoint or not source.oauth_client_id:
        return False

    try:
        token_resp = await refresh_access_token(
            token_endpoint=source.oauth_token_endpoint,
            refresh_token=refresh_token,
            client_id=source.oauth_client_id,
        )
        if not token_resp.is_valid:
            source.oauth_status = "expired"
            await source.asave(update_fields=["oauth_status"])
            return False

        from datetime import timedelta

        source.auth_credentials = json.dumps({
            "access_token": token_resp.access_token,
            "refresh_token": token_resp.refresh_token or refresh_token,
            "token_type": token_resp.token_type,
        })
        source.oauth_status = "authorized"
        if token_resp.expires_in:
            source.oauth_token_expires_at = timezone.now() + timedelta(
                seconds=token_resp.expires_in
            )
        await source.asave(update_fields=[
            "auth_credentials", "oauth_status", "oauth_token_expires_at",
        ])
        logger.info("OAuth token refreshed for MCP source %s", source.name)
        return True
    except Exception:
        logger.exception("OAuth token refresh failed for %s", source.name)
        return False
