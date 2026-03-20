"""
Authentication and webhook signature utilities for server-side tools.

- Authenticate incoming SDK requests by matching Bearer tokens against SyncSecret.
- Sign outgoing webhook POSTs with HMAC-SHA256 so customers can verify authenticity.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import TYPE_CHECKING

from django.utils import timezone

if TYPE_CHECKING:
    from rest_framework.request import Request

    from apps.products.models import Product

logger = logging.getLogger(__name__)


def generate_webhook_signature(body: str | bytes, secret_value: str) -> str:
    """
    Sign a webhook payload using HMAC-SHA256.

    Returns a header value like ``t=1710676800,v1=5257a869...``.
    """
    if isinstance(body, str):
        body = body.encode()

    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.".encode() + body
    digest = hmac.new(
        secret_value.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return f"t={timestamp},v1={digest}"


def verify_webhook_signature(
    signature_header: str,
    body: str | bytes,
    secret_value: str,
    tolerance_seconds: int = 300,
) -> bool:
    """
    Verify an ``X-Pillar-Signature`` header.

    Checks HMAC-SHA256 and rejects timestamps older than *tolerance_seconds*.
    """
    if isinstance(body, str):
        body = body.encode()

    parts: dict[str, str] = {}
    for segment in signature_header.split(","):
        key, _, value = segment.partition("=")
        parts[key.strip()] = value.strip()

    ts = parts.get("t")
    sig = parts.get("v1")
    if not ts or not sig:
        return False

    try:
        ts_int = int(ts)
    except ValueError:
        return False

    if abs(time.time() - ts_int) > tolerance_seconds:
        return False

    signed_payload = f"{ts}.".encode() + body
    expected = hmac.new(
        secret_value.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, sig)


async def authenticate_sdk_request(request: Request) -> Product | None:
    """
    Authenticate an incoming SDK request by matching the Bearer token
    against active ``SyncSecret`` records.

    Returns the associated ``Product`` on success, or ``None``.
    Also updates ``last_used_at`` on the matched secret.
    """
    from apps.products.models import SyncSecret

    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:].strip()
    if not token:
        return None

    async for secret in (
        SyncSecret.objects
        .filter(is_active=True)
        .select_related("product")
        .aiterator()
    ):
        if hmac.compare_digest(secret.secret_hash, token):
            secret.last_used_at = timezone.now()
            await secret.asave(update_fields=["last_used_at"])
            return secret.product

    return None


def get_signing_secret_for_product(product: Product) -> str | None:
    """
    Return the raw secret value for signing outgoing webhooks.

    Uses the most recently created active secret for the product.
    """
    from apps.products.models import SyncSecret

    secret = (
        SyncSecret.objects
        .filter(product=product, is_active=True)
        .order_by("-created_at")
        .first()
    )
    if secret is None:
        return None
    return secret.secret_hash


async def aget_signing_secret_for_product(product: Product) -> str | None:
    """Async version of :func:`get_signing_secret_for_product`."""
    from apps.products.models import SyncSecret

    secret = await (
        SyncSecret.objects
        .filter(product=product, is_active=True)
        .order_by("-created_at")
        .afirst()
    )
    if secret is None:
        return None
    return secret.secret_hash
