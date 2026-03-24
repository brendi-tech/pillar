"""
CORS utilities for HTTP responses.

Single source of truth for all manual CORS headers across the codebase.
Includes per-product domain restriction enforcement.
"""

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)

# Merged set of allowed headers across all endpoints (SDK, MCP, etc.)
CORS_ALLOW_HEADERS = (
    "Content-Type, Authorization, X-Requested-With, "
    "X-Help-Center-Id, X-Thread-Id, X-Run-Id, "
    "x-customer-id, x-visitor-id, x-session-id, "
    "x-external-user-id, x-user-profile, x-page-url, "
    "Accept-Language, X-Pillar-Platform, X-Pillar-Action-Version, "
    "Mcp-Session-Id, X-Agent-Slug"
)

# Combined set of headers to expose to the browser
CORS_EXPOSE_HEADERS = "X-Run-Id, X-Thread-Id, Mcp-Session-Id"


def is_origin_allowed(origin: str, allowed_domains: list[str]) -> bool:
    """
    Check if a request origin matches any of the allowed domain patterns.

    Supported patterns:
      - Exact domain: "example.com" matches https://example.com
      - Subdomain wildcard: "*.example.com" matches https://sub.example.com
      - Port-specific: "localhost:3000" matches http://localhost:3000
      - Localhost port wildcard: "localhost:*" matches http://localhost:ANY_PORT

    Args:
        origin: The full origin URL (e.g. "https://app.example.com")
        allowed_domains: List of domain patterns from product config

    Returns:
        True if the origin matches at least one allowed domain pattern.
    """
    if not origin or not allowed_domains:
        return False

    try:
        parsed = urlparse(origin)
        origin_hostname = parsed.hostname or ""
        origin_port = parsed.port  # None if not specified
    except Exception:
        return False

    # Build the "host" string as entered by the user (hostname or hostname:port)
    if origin_port:
        origin_host = f"{origin_hostname}:{origin_port}"
    else:
        origin_host = origin_hostname

    for pattern in allowed_domains:
        pattern = pattern.strip().lower()
        if not pattern:
            continue

        # Localhost port wildcard: "localhost:*"
        if pattern == "localhost:*":
            if origin_hostname == "localhost":
                return True
            continue

        # Subdomain wildcard: "*.example.com"
        if pattern.startswith("*."):
            base_domain = pattern[2:]  # "example.com"
            # Match the base domain itself or any subdomain
            if origin_hostname == base_domain:
                return True
            if origin_hostname.endswith(f".{base_domain}"):
                return True
            continue

        # Exact match (with or without port)
        if origin_host == pattern:
            return True

        # Also match if the pattern has no port but the hostname matches
        # e.g. pattern "example.com" should match "https://example.com"
        # (origin_host would be "example.com" since port is default)
        if origin_hostname == pattern:
            return True

    return False


def _get_product_security_config(request: HttpRequest) -> tuple[bool, list[str]]:
    """
    Read domain restriction settings from the resolved product on the request.

    Returns:
        Tuple of (restrict_enabled, allowed_domains).
    """
    product = getattr(request, "product", None)
    if product is None:
        # Also check the legacy attribute name
        product = getattr(request, "help_center_config", None)

    if product is None:
        return False, []

    config = getattr(product, "config", None) or {}
    embed = config.get("embed", {})
    security = embed.get("security", {})

    restrict = security.get("restrictToAllowedDomains", False)
    domains = security.get("allowedDomains", [])

    return restrict, domains


def check_origin_allowed(request: HttpRequest) -> Optional[bool]:
    """
    Check if the request origin is allowed by the product's domain restrictions.

    Returns:
        True if allowed, False if blocked, None if no restrictions are configured.
    """
    restrict, allowed_domains = _get_product_security_config(request)

    if not restrict:
        return None  # No restrictions configured

    origin = request.META.get("HTTP_ORIGIN", "")
    if not origin:
        return True  # No origin header = allow (lenient mode)

    return is_origin_allowed(origin, allowed_domains)


def add_cors_headers(
    response: HttpResponse,
    request: HttpRequest,
    *,
    skip_origin_check: bool = False,
) -> HttpResponse:
    """
    Add CORS headers to response. Single source of truth for all endpoints.

    If the resolved product has domain restrictions enabled, the origin is
    validated against the allowed domains list. If the origin is not allowed,
    CORS headers are omitted and the browser will block the response.

    Args:
        response: The HTTP response to add headers to.
        request: The original HTTP request (used to get origin and product).
        skip_origin_check: If True, skip domain restriction checks
            (used for endpoints that must be accessible from any origin,
            like EmbedConfigView).

    Returns:
        The response with CORS headers added (or without, if origin blocked).
    """
    origin = request.META.get("HTTP_ORIGIN", "")

    if not skip_origin_check:
        allowed = check_origin_allowed(request)
        if allowed is False:
            logger.info(
                "CORS blocked: origin '%s' not in allowed domains", origin
            )
            # Return response without CORS headers — browser will block it
            return response

    # Use the request origin, or "*" if no origin header
    response["Access-Control-Allow-Origin"] = origin or "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = CORS_ALLOW_HEADERS
    response["Access-Control-Allow-Credentials"] = "true"
    response["Access-Control-Expose-Headers"] = CORS_EXPOSE_HEADERS

    return response
