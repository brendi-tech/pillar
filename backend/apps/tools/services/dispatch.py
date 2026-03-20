"""
HTTP dispatch for server-side tool calls.

Pillar POSTs tool calls to the customer's registered endpoint and
returns the result synchronously.
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

import httpx

from apps.tools.services.auth import aget_signing_secret_for_product, generate_webhook_signature

if TYPE_CHECKING:
    from apps.mcp.services.agent.models import CallerContext
    from apps.products.models import Product
    from apps.tools.models import ToolEndpoint

logger = logging.getLogger(__name__)


async def post_tool_call(
    *,
    endpoint_url: str,
    call_id: str,
    tool_name: str,
    arguments: dict,
    caller: CallerContext,
    timeout: float,
    conversation_id: str | None,
    product: Product,
    action: str = "tool_call",
    confirm_payload: dict | None = None,
) -> dict[str, Any]:
    """POST a tool call (or confirmation) to the customer's endpoint."""

    payload: dict[str, Any] = {
        "action": action,
        "call_id": call_id,
        "product_id": str(product.id),
        "tool_name": tool_name,
        "caller": {
            "channel": getattr(caller, "channel", "web"),
            "channel_user_id": getattr(caller, "channel_user_id", None),
            "external_user_id": getattr(caller, "external_user_id", None),
            "email": getattr(caller, "email", None),
            "display_name": getattr(caller, "display_name", None),
        },
        "conversation_id": str(conversation_id) if conversation_id else None,
        "timeout_ms": int(timeout * 1000),
    }

    if action == "tool_confirm" and confirm_payload is not None:
        payload["confirm_payload"] = confirm_payload
        payload["confirmed"] = True
    else:
        payload["arguments"] = arguments

    body = json.dumps(payload, default=str)

    secret_value = await aget_signing_secret_for_product(product)
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if secret_value:
        headers["X-Pillar-Signature"] = generate_webhook_signature(body, secret_value)

    try:
        async with httpx.AsyncClient(timeout=timeout + 5) as client:
            response = await client.post(
                endpoint_url,
                content=body,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        return {"timed_out": True}
    except httpx.ConnectError:
        return {"connection_error": True}
    except httpx.HTTPStatusError as exc:
        resp_body: dict = {}
        try:
            resp_body = exc.response.json()
        except Exception:
            pass
        error_msg = resp_body.get("error", str(exc))
        logger.warning(
            "Tool call to %s returned HTTP %s: %s",
            endpoint_url, exc.response.status_code, error_msg,
        )
        return {
            "server_error": True,
            "error": error_msg,
            "success": resp_body.get("success", False),
        }
    except Exception as exc:
        logger.exception("Tool call to %s failed: %s", endpoint_url, exc)
        return {"connection_error": True, "error": str(exc)}


async def get_tool_endpoint(product_id: str) -> ToolEndpoint | None:
    """Get the active tool endpoint for a product."""
    from apps.tools.models import ToolEndpoint

    return await (
        ToolEndpoint.objects
        .filter(product_id=product_id, is_active=True)
        .afirst()
    )
