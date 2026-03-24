"""
OAuth / OIDC metadata discovery.

Fetches and caches authorization server metadata (RFC 8414),
protected resource metadata (RFC 9728), and OpenID Connect
discovery documents.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)

DISCOVERY_CACHE_TTL = 600  # 10 minutes


@dataclass(frozen=True)
class AuthServerMetadata:
    """Parsed OAuth 2.0 Authorization Server Metadata (RFC 8414)."""

    issuer: str = ''
    authorization_endpoint: str = ''
    token_endpoint: str = ''
    registration_endpoint: str = ''
    scopes_supported: list[str] = field(default_factory=list)
    response_types_supported: list[str] = field(default_factory=list)
    grant_types_supported: list[str] = field(default_factory=list)
    code_challenge_methods_supported: list[str] = field(default_factory=list)
    token_endpoint_auth_methods_supported: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProtectedResourceMetadata:
    """Parsed OAuth 2.0 Protected Resource Metadata (RFC 9728)."""

    resource: str = ''
    authorization_servers: list[str] = field(default_factory=list)
    bearer_methods_supported: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


def _base_url(url: str) -> str:
    """Extract scheme + host from a URL (strip path)."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def discover_auth_server(
    server_url: str,
    *,
    timeout: float = 10.0,
) -> AuthServerMetadata | None:
    """
    Fetch authorization server metadata per RFC 8414.

    Tries ``/.well-known/oauth-authorization-server`` on the base URL.
    Falls back to default endpoint paths if discovery fails.
    """
    base = _base_url(server_url)
    cache_key = f"oauth:as_meta:{base}"

    cached = cache.get(cache_key)
    if cached:
        return AuthServerMetadata(**json.loads(cached))

    well_known = f"{base}/.well-known/oauth-authorization-server"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(well_known)
            if resp.status_code == 200:
                data = resp.json()
                meta = AuthServerMetadata(
                    issuer=data.get('issuer', base),
                    authorization_endpoint=data.get('authorization_endpoint', ''),
                    token_endpoint=data.get('token_endpoint', ''),
                    registration_endpoint=data.get('registration_endpoint', ''),
                    scopes_supported=data.get('scopes_supported', []),
                    response_types_supported=data.get('response_types_supported', []),
                    grant_types_supported=data.get('grant_types_supported', []),
                    code_challenge_methods_supported=data.get(
                        'code_challenge_methods_supported', []
                    ),
                    token_endpoint_auth_methods_supported=data.get(
                        'token_endpoint_auth_methods_supported', []
                    ),
                    raw=data,
                )
                cache.set(cache_key, json.dumps(meta.__dict__), DISCOVERY_CACHE_TTL)
                return meta
    except Exception:
        logger.debug("Auth server discovery failed for %s", well_known, exc_info=True)

    return None


async def discover_protected_resource(
    resource_url: str,
    *,
    timeout: float = 10.0,
) -> ProtectedResourceMetadata | None:
    """Fetch protected resource metadata per RFC 9728."""
    base = _base_url(resource_url)
    well_known = f"{base}/.well-known/oauth-protected-resource"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(well_known)
            if resp.status_code == 200:
                data = resp.json()
                return ProtectedResourceMetadata(
                    resource=data.get('resource', ''),
                    authorization_servers=data.get('authorization_servers', []),
                    bearer_methods_supported=data.get('bearer_methods_supported', []),
                    raw=data,
                )
    except Exception:
        logger.debug(
            "Protected resource discovery failed for %s", well_known, exc_info=True
        )

    return None


async def discover_oidc(
    issuer_url: str,
    *,
    timeout: float = 10.0,
) -> dict[str, Any] | None:
    """
    Fetch OpenID Connect discovery document.

    Used when a customer configures their IdP for inbound OAuth.
    Returns the raw JSON from ``/.well-known/openid-configuration``.
    """
    issuer = issuer_url.rstrip('/')
    cache_key = f"oauth:oidc_meta:{issuer}"

    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    well_known = f"{issuer}/.well-known/openid-configuration"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(well_known)
            if resp.status_code == 200:
                data = resp.json()
                cache.set(cache_key, json.dumps(data), DISCOVERY_CACHE_TTL)
                return data
    except Exception:
        logger.debug("OIDC discovery failed for %s", well_known, exc_info=True)

    return None
