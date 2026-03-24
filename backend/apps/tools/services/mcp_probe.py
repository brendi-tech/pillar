"""
Probe an MCP server URL to detect its authentication requirements.

Follows the MCP spec auth discovery flow:
1. Try connecting with no auth (POST initialize)
2. If 200 → no auth needed
3. If 401 → parse WWW-Authenticate for resource_metadata URL
4. Fetch Protected Resource Metadata (RFC 9728) → get authorization_servers
5. Fetch Auth Server Metadata (RFC 8414) → get endpoints + scopes
6. Fall back to well-known URIs if no WWW-Authenticate header
7. If nothing works → assume simple bearer token
"""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Literal

import httpx

from apps.mcp_oauth.discovery import discover_auth_server, discover_protected_resource

logger = logging.getLogger(__name__)

PROBE_TIMEOUT = 10.0


@dataclass
class ProbeResult:
    reachable: bool
    auth_required: bool
    detected_type: Literal["none", "bearer", "oauth"]
    authorization_endpoint: str = ""
    token_endpoint: str = ""
    registration_endpoint: str = ""
    scopes_supported: list[str] = field(default_factory=list)
    code_challenge_methods_supported: list[str] = field(default_factory=list)
    resource_metadata_url: str = ""
    error: str = ""


def _extract_resource_metadata_url(www_authenticate: str) -> str | None:
    """Extract resource_metadata URL from a WWW-Authenticate header value."""
    match = re.search(r'resource_metadata="([^"]+)"', www_authenticate)
    return match.group(1) if match else None


def _extract_scope(www_authenticate: str) -> str | None:
    """Extract scope hint from a WWW-Authenticate header value."""
    match = re.search(r'scope="([^"]+)"', www_authenticate)
    return match.group(1) if match else None


async def probe_mcp_server(url: str) -> ProbeResult:
    """
    Probe an MCP server to detect auth requirements.

    Returns a ProbeResult with detected auth type and any OAuth metadata.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "pillar-probe", "version": "1.0"},
        },
    }

    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.ConnectError as exc:
        return ProbeResult(
            reachable=False,
            auth_required=False,
            detected_type="none",
            error=f"Could not connect: {exc}",
        )
    except httpx.TimeoutException:
        return ProbeResult(
            reachable=False,
            auth_required=False,
            detected_type="none",
            error="Connection timed out",
        )
    except Exception as exc:
        return ProbeResult(
            reachable=False,
            auth_required=False,
            detected_type="none",
            error=str(exc)[:500],
        )

    if response.status_code == 200:
        return ProbeResult(
            reachable=True,
            auth_required=False,
            detected_type="none",
        )

    if response.status_code not in (401, 403):
        return ProbeResult(
            reachable=True,
            auth_required=False,
            detected_type="none",
            error=f"Unexpected status {response.status_code}",
        )

    www_auth = response.headers.get("www-authenticate", "")
    resource_metadata_url = _extract_resource_metadata_url(www_auth)
    scope_hint = _extract_scope(www_auth)

    # Step 3: Try resource_metadata URL from WWW-Authenticate header first
    if resource_metadata_url:
        result = await _discover_oauth_from_resource_metadata(
            resource_metadata_url, scope_hint
        )
        if result:
            return result

    # Step 4: Fall back to well-known URIs relative to the server URL
    result = await _discover_oauth_from_well_known(url, scope_hint)
    if result:
        return result

    # No OAuth metadata found — assume simple bearer token
    return ProbeResult(
        reachable=True,
        auth_required=True,
        detected_type="bearer",
    )


async def _discover_oauth_from_resource_metadata(
    resource_metadata_url: str,
    scope_hint: str | None,
) -> ProbeResult | None:
    """Fetch protected resource metadata, then auth server metadata."""
    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            resp = await client.get(resource_metadata_url)
            if resp.status_code != 200:
                return None
            data = resp.json()
    except Exception:
        logger.debug("Failed to fetch resource metadata from %s", resource_metadata_url)
        return None

    auth_servers = data.get("authorization_servers", [])
    if not auth_servers:
        return None

    as_meta = await discover_auth_server(auth_servers[0], timeout=PROBE_TIMEOUT)
    if not as_meta or not as_meta.authorization_endpoint:
        return None

    scopes = as_meta.scopes_supported or []
    if scope_hint and not scopes:
        scopes = scope_hint.split()

    return ProbeResult(
        reachable=True,
        auth_required=True,
        detected_type="oauth",
        authorization_endpoint=as_meta.authorization_endpoint,
        token_endpoint=as_meta.token_endpoint,
        registration_endpoint=as_meta.registration_endpoint or "",
        scopes_supported=scopes,
        code_challenge_methods_supported=as_meta.code_challenge_methods_supported or [],
        resource_metadata_url=resource_metadata_url,
    )


async def _discover_oauth_from_well_known(
    server_url: str,
    scope_hint: str | None,
) -> ProbeResult | None:
    """Try well-known URIs (RFC 9728 then RFC 8414) relative to the server URL."""
    resource_meta = await discover_protected_resource(
        server_url, timeout=PROBE_TIMEOUT
    )
    auth_server_url = server_url
    if resource_meta and resource_meta.authorization_servers:
        auth_server_url = resource_meta.authorization_servers[0]

    as_meta = await discover_auth_server(auth_server_url, timeout=PROBE_TIMEOUT)
    if not as_meta or not as_meta.authorization_endpoint:
        return None

    scopes = as_meta.scopes_supported or []
    if scope_hint and not scopes:
        scopes = scope_hint.split()

    return ProbeResult(
        reachable=True,
        auth_required=True,
        detected_type="oauth",
        authorization_endpoint=as_meta.authorization_endpoint,
        token_endpoint=as_meta.token_endpoint,
        registration_endpoint=as_meta.registration_endpoint or "",
        scopes_supported=scopes,
        code_challenge_methods_supported=as_meta.code_challenge_methods_supported or [],
    )
