"""
OpenAPI tool executor — builds and sends HTTP requests to customer APIs
based on parsed OpenAPI operation definitions.
"""
from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

import httpx
from django.utils import timezone

if TYPE_CHECKING:
    from apps.mcp.services.agent.models import CallerContext
    from apps.tools.models import OpenAPIToolSource, UserToolCredential

logger = logging.getLogger(__name__)


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


def _build_org_auth_headers(source: OpenAPIToolSource) -> dict[str, str]:
    """Build auth headers from org-level credentials on the source."""
    headers: dict[str, str] = {}
    creds = _parse_credentials(source.auth_credentials)

    if source.auth_type == "bearer":
        token = creds.get("token", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"

    elif source.auth_type == "api_key":
        header_name = creds.get("header_name", "Authorization")
        header_value = creds.get("header_value", "")
        if header_value:
            headers[header_name] = header_value

    elif source.auth_type == "oauth2_client_credentials":
        token = creds.get("access_token", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"

    return headers


def _build_url(base_url: str, path_template: str, path_params: dict[str, str]) -> str:
    """Substitute path parameters into the URL template."""
    url = path_template
    for name, value in path_params.items():
        url = url.replace(f"{{{name}}}", str(value))
    base = base_url.rstrip("/")
    if not url.startswith("/"):
        url = "/" + url
    return base + url


async def execute_openapi_call(
    *,
    source: OpenAPIToolSource,
    operation: dict[str, Any],
    arguments: dict[str, Any],
    user_credential: UserToolCredential | None = None,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    """
    Execute an HTTP call based on an OpenAPI operation definition.

    Returns a dict with:
    - success: bool
    - result: response body (on success)
    - error: error message (on failure)
    - status_code: HTTP status code
    - auth_required: True if 401 and no credential / refresh failed
    """
    method = operation.get("method", "GET").upper()
    path_template = operation.get("path", "/")
    params_meta = operation.get("parameters_meta", {})

    path_params: dict[str, str] = {}
    query_params: dict[str, str] = {}
    header_params: dict[str, str] = {}
    body_params: dict[str, Any] = {}

    for arg_name, arg_value in arguments.items():
        location = params_meta.get(arg_name, "body")
        if location == "path":
            path_params[arg_name] = str(arg_value)
        elif location == "query":
            query_params[arg_name] = str(arg_value)
        elif location == "header":
            header_params[arg_name] = str(arg_value)
        else:
            body_params[arg_name] = arg_value

    url = _build_url(source.base_url, path_template, path_params)

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    headers.update(header_params)

    has_auth = False
    if user_credential and user_credential.is_active and not user_credential.is_expired:
        headers["Authorization"] = f"{user_credential.token_type} {user_credential.access_token}"
        has_auth = True
    elif source.auth_type in ("bearer", "api_key", "oauth2_client_credentials"):
        org_headers = _build_org_auth_headers(source)
        headers.update(org_headers)
        has_auth = bool(org_headers)

    request_kwargs: dict[str, Any] = {
        "method": method,
        "url": url,
        "headers": headers,
        "params": query_params or None,
    }

    if method in ("POST", "PUT", "PATCH") and body_params:
        request_kwargs["json"] = body_params

    auth_label = "user_credential" if (user_credential and has_auth) else (
        source.auth_type if has_auth else "none"
    )
    logger.info(
        "[OpenAPI] %s %s (source=%s, auth=%s, timeout=%ss)",
        method, url, source.name, auth_label, timeout_seconds,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.request(**request_kwargs)

            if response.status_code == 401 and user_credential:
                refreshed = await _try_refresh_user_token(source, user_credential)
                if refreshed:
                    headers["Authorization"] = (
                        f"{user_credential.token_type} {user_credential.access_token}"
                    )
                    request_kwargs["headers"] = headers
                    response = await client.request(**request_kwargs)
                else:
                    return {
                        "success": False,
                        "auth_required": True,
                        "status_code": 401,
                        "error": "Authentication expired. Please re-connect your account.",
                    }

            logger.info(
                "[OpenAPI] Response %s %s -> HTTP %d (%dB)",
                method, url, response.status_code, len(response.content),
            )

            if response.status_code == 401 and not user_credential:
                return {
                    "success": False,
                    "auth_required": True,
                    "status_code": 401,
                    "error": "Authentication required.",
                }

            try:
                result_body = response.json()
            except Exception:
                result_body = response.text

            if response.is_success:
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "result": result_body,
                }
            else:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": f"API returned {response.status_code}",
                    "result": result_body,
                }

    except httpx.TimeoutException:
        logger.warning(
            "[OpenAPI] TIMEOUT %s %s after %ss (source=%s, auth=%s)",
            method, url, timeout_seconds, source.name, auth_label,
        )
        return {"success": False, "timed_out": True, "error": f"Request to {method} {url} timed out after {timeout_seconds}s"}
    except httpx.ConnectError as exc:
        logger.warning(
            "[OpenAPI] CONNECT_ERROR %s %s (source=%s): %s",
            method, url, source.name, exc,
        )
        return {"success": False, "connection_error": True, "error": f"Could not connect to {url}: {exc}"}
    except Exception as exc:
        logger.exception("[OpenAPI] ERROR %s %s (source=%s)", method, url, source.name)
        return {"success": False, "connection_error": True, "error": str(exc)}


async def _try_refresh_user_token(
    source: OpenAPIToolSource,
    credential: UserToolCredential,
) -> bool:
    """Attempt to refresh an expired user OAuth token. Returns True on success."""
    if not credential.refresh_token or not source.oauth_token_endpoint:
        credential.is_active = False
        await credential.asave(update_fields=["is_active"])
        return False

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_data = {
                "grant_type": "refresh_token",
                "refresh_token": credential.refresh_token,
                "client_id": source.oauth_client_id,
            }
            if source.oauth_client_secret:
                token_data["client_secret"] = source.oauth_client_secret

            response = await client.post(
                source.oauth_token_endpoint,
                data=token_data,
            )

        if response.status_code != 200:
            logger.warning(
                "Token refresh failed for %s (HTTP %s)",
                credential, response.status_code,
            )
            credential.is_active = False
            await credential.asave(update_fields=["is_active"])
            return False

        token_resp = response.json()
        credential.access_token = token_resp["access_token"]
        if token_resp.get("refresh_token"):
            credential.refresh_token = token_resp["refresh_token"]
        credential.token_type = token_resp.get("token_type", "Bearer")
        if token_resp.get("expires_in"):
            credential.expires_at = timezone.now() + timedelta(seconds=token_resp["expires_in"])
        credential.is_active = True
        await credential.asave(update_fields=[
            "access_token", "refresh_token", "token_type",
            "expires_at", "is_active",
        ])
        logger.info("Refreshed user token for %s", credential)
        return True

    except Exception:
        logger.exception("Token refresh error for %s", credential)
        credential.is_active = False
        await credential.asave(update_fields=["is_active"])
        return False
