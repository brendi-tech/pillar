"""
Inbound OAuth token validation for MCP requests.

Validates access tokens issued by Pillar and returns the
associated product + external identity.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OAuthIdentity:
    """Validated identity from an MCP OAuth access token."""

    product: Any
    external_user_id: str | None = None
    external_email: str | None = None
    external_display_name: str | None = None
    external_user_info: dict = None

    def __post_init__(self):
        if self.external_user_info is None:
            object.__setattr__(self, 'external_user_info', {})


async def validate_mcp_oauth_token(token_value: str) -> OAuthIdentity | None:
    """
    Look up an MCPAccessToken by value and return the identity if valid.

    Returns None if the token is not found, expired, or revoked.
    """
    from apps.mcp_oauth.models import MCPAccessToken

    try:
        access_token = await (
            MCPAccessToken.objects
            .select_related('product')
            .filter(token=token_value)
            .afirst()
        )
    except Exception:
        logger.debug("OAuth token lookup failed", exc_info=True)
        return None

    if not access_token:
        return None

    if access_token.expires and access_token.expires < timezone.now():
        return None

    product = access_token.product
    if not product:
        return None

    return OAuthIdentity(
        product=product,
        external_user_id=access_token.external_user_id,
        external_email=access_token.external_email,
        external_display_name=access_token.external_display_name,
        external_user_info=access_token.external_user_info or {},
    )
