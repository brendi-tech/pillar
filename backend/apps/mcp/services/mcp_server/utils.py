"""
Utility functions for MCP server.

Provides:
- Request metadata extraction (user_agent, ip, session, referer)

Copyright (C) 2025 Pillar Team
"""
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class RequestMetadata:
    """
    Metadata extracted from HTTP request or WebSocket scope.

    Used for consistent logging across all MCP entry points.
    """
    user_agent: str
    ip_address: str
    session_id: str
    referer: str
    visitor_id: str = ''
    external_user_id: str = ''


def get_client_ip(request) -> str:
    """
    Get client IP from request.

    Handles X-Forwarded-For for proxied requests (Cloud Run, load balancers).

    Args:
        request: HTTP request object or None

    Returns:
        Client IP address string, empty string if unavailable
    """
    if not request:
        return ''
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def extract_request_metadata(
    request=None,
    scope: Optional[Dict[str, Any]] = None,
    fallback_user_agent: str = 'Unknown'
) -> RequestMetadata:
    """
    Extract analytics metadata from HTTP request or WebSocket scope.

    Handles multiple input types:
    - Django HTTP request (has META dict)
    - WebSocket scope (has headers list of tuples)
    - None (returns fallback values)

    Args:
        request: Django HTTP request object (optional)
        scope: WebSocket scope dict (optional, used if request is None)
        fallback_user_agent: Default user_agent if not found

    Returns:
        RequestMetadata with extracted values
    """
    if request is not None:
        # Extract from Django HTTP request
        # Analytics context is set by AnalyticsMiddleware
        analytics = getattr(request, 'analytics', {})
        return RequestMetadata(
            user_agent=request.META.get('HTTP_USER_AGENT', fallback_user_agent),
            ip_address=get_client_ip(request),
            session_id=_get_session_id_from_request(request),
            referer=request.META.get('HTTP_REFERER', ''),
            visitor_id=analytics.get('visitor_id', ''),
            external_user_id=analytics.get('external_user_id', ''),
        )

    if scope is not None:
        # Extract from WebSocket scope
        return _extract_from_websocket_scope(scope, fallback_user_agent)

    # No request context available
    return RequestMetadata(
        user_agent=fallback_user_agent,
        ip_address='',
        session_id='',
        referer='',
        visitor_id='',
        external_user_id='',
    )


def _get_session_id_from_request(request) -> str:
    """
    Get session ID from request.

    Checks multiple sources in order:
    1. Query param: ?session_id=xxx
    2. Header: Mcp-Session-Id (MCP protocol standard)
    3. Header: X-Session-Id (legacy/alternative)
    4. Django session key (if session middleware is active)
    """
    # Query param
    session_id = request.GET.get('session_id', '')
    if session_id:
        return session_id

    # MCP session header (standard MCP protocol)
    session_id = request.META.get('HTTP_MCP_SESSION_ID', '')
    if session_id:
        logger.debug(f"[SessionID] Extracted from Mcp-Session-Id header: {session_id[:8]}...")
        return session_id

    # Legacy/alternative header
    session_id = request.META.get('HTTP_X_SESSION_ID', '')
    if session_id:
        return session_id

    # Django session
    if hasattr(request, 'session') and request.session.session_key:
        return request.session.session_key

    logger.debug("[SessionID] No session_id found in request headers")
    return ''


def _extract_from_websocket_scope(
    scope: Dict[str, Any],
    fallback_user_agent: str
) -> RequestMetadata:
    """
    Extract metadata from WebSocket scope.

    WebSocket scope has headers as list of tuples: [(b'header-name', b'value'), ...]
    """
    headers = dict(scope.get('headers', []))

    # Headers are bytes in WebSocket scope
    user_agent = headers.get(b'user-agent', b'').decode('utf-8', errors='ignore')
    referer = headers.get(b'referer', b'').decode('utf-8', errors='ignore')
    session_id = headers.get(b'x-session-id', b'').decode('utf-8', errors='ignore')

    # Get IP from scope
    ip_address = ''
    x_forwarded_for = headers.get(b'x-forwarded-for', b'').decode('utf-8', errors='ignore')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    elif 'client' in scope and scope['client']:
        ip_address = scope['client'][0]  # (host, port) tuple

    # Get visitor identification headers
    visitor_id = headers.get(b'x-visitor-id', b'').decode('utf-8', errors='ignore')
    external_user_id = headers.get(b'x-external-user-id', b'').decode('utf-8', errors='ignore')

    return RequestMetadata(
        user_agent=user_agent or fallback_user_agent,
        ip_address=ip_address,
        session_id=session_id,
        referer=referer,
        visitor_id=visitor_id,
        external_user_id=external_user_id,
    )


def get_effective_language(request, product) -> str:
    """
    Determine effective language for AI responses.

    Priority:
    1. Product's default_language (if not 'auto')
    2. Browser's Accept-Language header (primary language)
    3. Fallback to 'en'

    Args:
        request: Django HTTP request object
        product: Product model instance

    Returns:
        ISO language code (e.g., 'en', 'es', 'fr')
    """
    # Product explicit language takes precedence
    product_lang = getattr(product, 'default_language', 'auto')
    if product_lang and product_lang != 'auto':
        return product_lang

    # Parse Accept-Language: "es-ES,es;q=0.9,en;q=0.8" -> "es"
    if request:
        accept_lang = request.META.get('HTTP_ACCEPT_LANGUAGE', '')
        if accept_lang:
            primary = accept_lang.split(',')[0].split(';')[0].strip()
            lang_code = primary.split('-')[0].lower()
            if lang_code:
                return lang_code

    return 'en'
