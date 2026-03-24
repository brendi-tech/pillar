"""
Shared confirmation executor — routes confirmed tool calls to the correct
backend (OpenAPI, external MCP, or customer HTTP endpoint).

All channels (Slack, Discord, web SDK) delegate to this module after a
user clicks "Confirm" so the routing logic lives in a single place.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.mcp.services.agent.models import CallerContext
    from apps.products.models.product import Product

logger = logging.getLogger(__name__)


async def execute_confirmed_tool(
    *,
    tool_name: str,
    confirm_payload: dict,
    source_type: str,
    product: Product,
    caller: CallerContext,
    conversation_id: str | None = None,
    call_id: str | None = None,
    openapi_source_id: str | None = None,
    openapi_operation: dict | None = None,
    mcp_source_id: str | None = None,
    mcp_original_name: str | None = None,
) -> dict[str, Any]:
    """Route a confirmed tool call to the correct executor.

    Returns a normalised result dict:
      - ``success``  (bool)
      - ``result``   (response body on success)
      - ``error``    (str on failure)
    """
    if source_type == "openapi":
        return await _execute_openapi(
            openapi_source_id=openapi_source_id,
            openapi_operation=openapi_operation or {},
            arguments=confirm_payload,
            caller=caller,
        )

    if source_type == "mcp":
        return await _execute_mcp(
            mcp_source_id=mcp_source_id,
            mcp_original_name=mcp_original_name or tool_name,
            arguments=confirm_payload,
            caller=caller,
        )

    # Default: server-side tool via customer HTTP endpoint
    return await _execute_server(
        product=product,
        tool_name=tool_name,
        confirm_payload=confirm_payload,
        caller=caller,
        conversation_id=conversation_id,
        call_id=call_id,
    )


async def _execute_openapi(
    *,
    openapi_source_id: str | None,
    openapi_operation: dict,
    arguments: dict,
    caller: CallerContext,
) -> dict[str, Any]:
    from apps.tools.models import OpenAPIToolSource, UserToolCredential
    from apps.tools.services.openapi_executor import execute_openapi_call

    if not openapi_source_id:
        return {"success": False, "error": "Missing OpenAPI source ID."}

    try:
        source = await OpenAPIToolSource.objects.select_related('product').aget(
            id=openapi_source_id,
        )
    except OpenAPIToolSource.DoesNotExist:
        return {"success": False, "error": f"OpenAPI source '{openapi_source_id}' not found."}

    user_credential = await _resolve_openapi_credential(source, caller)

    result = await execute_openapi_call(
        source=source,
        operation=openapi_operation,
        arguments=arguments,
        user_credential=user_credential,
    )
    return result


async def _resolve_openapi_credential(
    source,
    caller: CallerContext,
):
    """Look up OAuth user credential for the caller, mirroring the agentic loop logic."""
    from apps.tools.models import UserToolCredential

    passthrough_token = getattr(caller, "user_api_token", None)
    if passthrough_token and source.auth_type in ("oauth2_authorization_code", "bearer"):
        from types import SimpleNamespace
        return SimpleNamespace(
            access_token=passthrough_token,
            token_type="Bearer",
            is_active=True,
            is_expired=False,
            refresh_token=None,
        )

    if source.auth_type != "oauth2_authorization_code":
        return None

    channel = getattr(caller, "channel", "web")
    channel_user_id = getattr(caller, "channel_user_id", None)
    external_user_id = getattr(caller, "external_user_id", None)

    user_credentials = []
    if channel_user_id:
        user_credentials = [
            c async for c in UserToolCredential.objects.filter(
                openapi_source=source,
                channel=channel,
                channel_user_id=channel_user_id,
                is_active=True,
            )
        ]
    if not user_credentials and external_user_id:
        user_credentials = [
            c async for c in UserToolCredential.objects.filter(
                openapi_source=source,
                external_user_id=external_user_id,
                is_active=True,
            )
        ]

    if len(user_credentials) == 1:
        return user_credentials[0]
    return None


async def _execute_mcp(
    *,
    mcp_source_id: str | None,
    mcp_original_name: str,
    arguments: dict,
    caller: CallerContext,
) -> dict[str, Any]:
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import execute_mcp_tool

    if not mcp_source_id:
        return {"success": False, "error": "Missing MCP source ID."}

    try:
        mcp_source = await MCPToolSource.objects.aget(id=mcp_source_id)
    except MCPToolSource.DoesNotExist:
        return {"success": False, "error": f"MCP source '{mcp_source_id}' not found."}

    result = await execute_mcp_tool(
        tool_name=mcp_original_name,
        arguments=arguments,
        mcp_source=mcp_source,
        caller=caller,
    )
    return result


async def _execute_server(
    *,
    product: Product,
    tool_name: str,
    confirm_payload: dict,
    caller: CallerContext,
    conversation_id: str | None,
    call_id: str | None,
) -> dict[str, Any]:
    import uuid as _uuid

    from apps.tools.services.dispatch import get_tool_endpoint, post_tool_call

    endpoint = await get_tool_endpoint(str(product.id))
    if not endpoint:
        return {"success": False, "error": f"No tool endpoint registered for {product.name}."}

    result = await post_tool_call(
        endpoint_url=endpoint.endpoint_url,
        call_id=call_id or str(_uuid.uuid4()),
        tool_name=tool_name,
        arguments={},
        caller=caller,
        timeout=30.0,
        conversation_id=conversation_id,
        product=product,
        action="tool_confirm",
        confirm_payload=confirm_payload,
    )
    return result
