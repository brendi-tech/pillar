"""
Async HTTP client for OAuth token operations.

Handles authorization code exchange, token refresh, and
userinfo retrieval against external OAuth/OIDC servers.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 15.0


@dataclass
class TokenResponse:
    """Parsed response from a token endpoint."""

    access_token: str = ''
    refresh_token: str = ''
    token_type: str = 'bearer'
    expires_in: int | None = None
    scope: str = ''
    id_token: str = ''
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        return bool(self.access_token)


async def exchange_code(
    token_endpoint: str,
    code: str,
    redirect_uri: str,
    client_id: str,
    code_verifier: str | None = None,
    client_secret: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> TokenResponse:
    """Exchange an authorization code for tokens."""
    data: dict[str, str] = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': client_id,
    }
    if code_verifier:
        data['code_verifier'] = code_verifier
    if client_secret:
        data['client_secret'] = client_secret

    return await _post_token(token_endpoint, data, timeout)


async def refresh_access_token(
    token_endpoint: str,
    refresh_token: str,
    client_id: str,
    client_secret: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> TokenResponse:
    """Refresh an expired access token."""
    data: dict[str, str] = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
    }
    if client_secret:
        data['client_secret'] = client_secret

    return await _post_token(token_endpoint, data, timeout)


async def fetch_userinfo(
    userinfo_endpoint: str,
    access_token: str,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Fetch user claims from an OAuth/OIDC userinfo endpoint."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                userinfo_endpoint,
                headers={'Authorization': f'Bearer {access_token}'},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        logger.exception("Failed to fetch userinfo from %s", userinfo_endpoint)
        return {}


async def register_client(
    registration_endpoint: str,
    client_name: str,
    redirect_uris: list[str],
    grant_types: list[str] | None = None,
    response_types: list[str] | None = None,
    token_endpoint_auth_method: str = 'none',
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """
    Dynamically register an OAuth client per RFC 7591.

    Returns the registration response (including client_id) or None on failure.
    """
    payload: dict[str, Any] = {
        'client_name': client_name,
        'redirect_uris': redirect_uris,
        'grant_types': grant_types or ['authorization_code'],
        'response_types': response_types or ['code'],
        'token_endpoint_auth_method': token_endpoint_auth_method,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                registration_endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'},
            )
            if resp.status_code in (200, 201):
                return resp.json()
            logger.warning(
                "DCR failed at %s: %s %s",
                registration_endpoint, resp.status_code, resp.text[:200],
            )
    except Exception:
        logger.exception("DCR request failed for %s", registration_endpoint)

    return None


async def _post_token(
    endpoint: str,
    data: dict[str, str],
    timeout: float,
) -> TokenResponse:
    """POST to a token endpoint and parse the response."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                endpoint,
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
            resp.raise_for_status()
            raw = resp.json()
            return TokenResponse(
                access_token=raw.get('access_token', ''),
                refresh_token=raw.get('refresh_token', ''),
                token_type=raw.get('token_type', 'bearer'),
                expires_in=raw.get('expires_in'),
                scope=raw.get('scope', ''),
                id_token=raw.get('id_token', ''),
                raw=raw,
            )
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Token endpoint %s returned %s: %s",
            endpoint, exc.response.status_code, exc.response.text[:300],
        )
        return TokenResponse(raw={'error': str(exc)})
    except Exception as exc:
        logger.exception("Token request to %s failed", endpoint)
        return TokenResponse(raw={'error': str(exc)})
