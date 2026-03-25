"""
Identity resolution and account linking services.

resolve_identity() runs once per incoming message (before the agentic loop)
and produces a CallerContext that travels through the entire request lifecycle.

The linking functions support the /pillar connect flow for non-web channels.
"""
from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.identity.models import IdentityMapping, LinkCode
from apps.mcp.services.agent.models import CallerContext

if TYPE_CHECKING:
    from apps.products.models import Product

logger = logging.getLogger(__name__)

LINK_CODE_EXPIRY_MINUTES = 5


class CodeExpiredError(Exception):
    pass


class CodeAlreadyUsedError(Exception):
    pass


class CodeNotFoundError(Exception):
    pass


async def resolve_identity(
    product: Product,
    channel: str,
    channel_user_id: str | None = None,
    external_user_id: str | None = None,
    email: str | None = None,
    display_name: str | None = None,
    auto_link_by_email: bool = False,
) -> CallerContext:
    """
    Resolve caller identity for any channel.

    Priority order:
    1. If external_user_id is already provided (web identify, API), use it directly.
    2. Look up IdentityMapping for (product, channel, channel_user_id).
    3. If auto_link_by_email is enabled and email is available, try email-based matching.
    4. Return whatever we have — tools will see partial identity.
    """

    # Case 1: Identity already known (web channel, or API with explicit caller)
    if external_user_id:
        return CallerContext(
            channel=channel,
            channel_user_id=channel_user_id,
            external_user_id=external_user_id,
            email=email,
            display_name=display_name,
        )

    # Case 2: Look up IdentityMapping
    if channel_user_id:
        mapping = await IdentityMapping.objects.filter(
            product=product,
            channel=channel,
            channel_user_id=channel_user_id,
            is_active=True,
        ).afirst()

        if mapping:
            return CallerContext(
                channel=channel,
                channel_user_id=channel_user_id,
                external_user_id=mapping.external_user_id,
                email=mapping.email or email,
                display_name=mapping.display_name or display_name,
            )

    # Case 3: Auto-link by email (opt-in per product)
    if auto_link_by_email and email:
        email_mapping = await IdentityMapping.objects.filter(
            product=product,
            email__iexact=email,
            is_active=True,
        ).afirst()

        if email_mapping:
            return CallerContext(
                channel=channel,
                channel_user_id=channel_user_id,
                external_user_id=email_mapping.external_user_id,
                email=email,
                display_name=display_name,
            )

    # Case 4: Unlinked user — pass through whatever we have
    return CallerContext(
        channel=channel,
        channel_user_id=channel_user_id,
        external_user_id=None,
        email=email,
        display_name=display_name,
    )


def _generate_code() -> str:
    """Generate a cryptographically random URL-safe code (128-bit entropy)."""
    return secrets.token_urlsafe(16)


async def generate_link_code(
    product: Product,
    channel: str,
    channel_user_id: str,
    channel_display_name: str = '',
    channel_email: str = '',
    organization_id: str | None = None,
) -> LinkCode:
    """
    Generate a one-time linking code for the account linking flow.

    Invalidates any existing unused codes for the same (product, channel, channel_user_id).
    Pass organization_id explicitly to avoid sync FK access in async context.
    """
    now = timezone.now()

    # Invalidate existing unused codes for this user
    await LinkCode.objects.filter(
        product=product,
        channel=channel,
        channel_user_id=channel_user_id,
        is_used=False,
    ).aupdate(is_used=True, used_at=now)

    org_id = organization_id or product.organization_id
    code = _generate_code()
    link_code = await LinkCode.objects.acreate(
        organization_id=org_id,
        product=product,
        code=code,
        channel=channel,
        channel_user_id=channel_user_id,
        channel_display_name=channel_display_name,
        channel_email=channel_email,
        expires_at=now + timedelta(minutes=LINK_CODE_EXPIRY_MINUTES),
    )

    logger.info(
        "Generated link code for %s:%s on product %s",
        channel, channel_user_id, product.id,
    )
    return link_code


def generate_link_code_sync(
    product: Product,
    channel: str,
    channel_user_id: str,
    channel_display_name: str = '',
    channel_email: str = '',
) -> LinkCode:
    """Synchronous version of generate_link_code for use in sync DRF views."""
    now = timezone.now()

    LinkCode.objects.filter(
        product=product,
        channel=channel,
        channel_user_id=channel_user_id,
        is_used=False,
    ).update(is_used=True, used_at=now)

    code = _generate_code()
    link_code = LinkCode.objects.create(
        organization_id=product.organization_id,
        product=product,
        code=code,
        channel=channel,
        channel_user_id=channel_user_id,
        channel_display_name=channel_display_name,
        channel_email=channel_email,
        expires_at=now + timedelta(minutes=LINK_CODE_EXPIRY_MINUTES),
    )

    logger.info(
        "Generated link code for %s:%s on product %s",
        channel, channel_user_id, product.id,
    )
    return link_code


@transaction.atomic
def confirm_link(
    code_str: str,
    external_user_id: str,
    product: Product | None = None,
) -> IdentityMapping:
    """
    Validate a link code and create an IdentityMapping.

    Uses select_for_update to prevent race conditions on double-redemption.
    When product is provided, the code must belong to that product (prevents
    cross-product code theft via a stolen sync secret).
    Raises CodeNotFoundError, CodeExpiredError, or CodeAlreadyUsedError.
    """
    try:
        lookup = {'code': code_str}
        if product is not None:
            lookup['product'] = product
        code = LinkCode.objects.select_for_update().get(**lookup)
    except LinkCode.DoesNotExist:
        raise CodeNotFoundError("Link code not found.")

    if code.is_used:
        raise CodeAlreadyUsedError("This linking code has already been used.")
    if code.is_expired:
        raise CodeExpiredError("This linking code has expired. Please run /pillar connect again.")

    now = timezone.now()

    # Mark code as used
    code.is_used = True
    code.used_at = now
    code.used_by_external_user_id = external_user_id
    code.save(update_fields=['is_used', 'used_at', 'used_by_external_user_id', 'updated_at'])

    # Deactivate any existing active mapping for this channel user
    IdentityMapping.objects.filter(
        product=code.product,
        channel=code.channel,
        channel_user_id=code.channel_user_id,
        is_active=True,
    ).update(is_active=False, revoked_at=now)

    mapping = IdentityMapping.objects.create(
        organization=code.product.organization,
        product=code.product,
        channel=code.channel,
        channel_user_id=code.channel_user_id,
        external_user_id=external_user_id,
        email=code.channel_email,
        display_name=code.channel_display_name,
        linked_via='slash_command',
        linked_by='self',
    )

    logger.info(
        "Linked %s:%s → %s on product %s",
        code.channel, code.channel_user_id, external_user_id, code.product_id,
    )
    return mapping


async def revoke_mapping(mapping: IdentityMapping) -> None:
    """Soft-delete an identity mapping."""
    mapping.is_active = False
    mapping.revoked_at = timezone.now()
    await mapping.asave(update_fields=['is_active', 'revoked_at', 'updated_at'])
    logger.info(
        "Revoked mapping %s:%s → %s on product %s",
        mapping.channel, mapping.channel_user_id,
        mapping.external_user_id, mapping.product_id,
    )
