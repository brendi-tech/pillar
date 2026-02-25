"""
One-time secret redemption endpoint.

GET /mcp/secrets/redeem/{token}/

The SDK calls this when the user clicks "Reveal" on a sensitive field.
Returns the decrypted value and burns the token (with a 30s grace window).

IMPORTANT: Response bodies from this endpoint must NOT be logged.
"""
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from common.utils.cors import add_cors_headers

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def redeem_secret(request, token: str):
    """Redeem a one-time secret token."""

    if request.method == "OPTIONS":
        response = JsonResponse({}, status=204)
        return add_cors_headers(response, request)

    from apps.mcp.services.secret_redemption import SecretRedemptionStore

    visitor_id = request.headers.get("x-visitor-id", "")

    try:
        value = SecretRedemptionStore.redeem_secret(
            token=token,
            user_id=visitor_id or None,
        )
    except Exception:
        logger.exception("[SecretRedeem] Unexpected error during redemption")
        response = JsonResponse(
            {"error": "Internal error"}, status=500
        )
        return add_cors_headers(response, request)

    if value is None:
        response = JsonResponse(
            {"error": "Token expired or already redeemed"}, status=410
        )
        return add_cors_headers(response, request)

    response = JsonResponse({"value": value})
    return add_cors_headers(response, request)
