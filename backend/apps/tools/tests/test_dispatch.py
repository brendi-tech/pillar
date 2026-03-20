"""
Tests for server-side tool dispatch (HTTP POST to customer endpoint).
"""
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from apps.tools.services.dispatch import get_tool_endpoint, post_tool_call


@dataclass
class FakeCaller:
    channel: str = "web"
    channel_user_id: str | None = None
    external_user_id: str | None = "user_123"
    email: str | None = "test@example.com"
    display_name: str | None = "Test User"


@pytest.mark.django_db(transaction=True)
class TestGetToolEndpoint:
    async def test_returns_active_endpoint(self, tool_endpoint):
        result = await get_tool_endpoint(str(tool_endpoint.product_id))
        assert result is not None
        assert result.id == tool_endpoint.id

    async def test_returns_none_for_no_endpoint(self, product):
        result = await get_tool_endpoint(str(product.id))
        assert result is None

    async def test_skips_inactive_endpoint(self, tool_endpoint):
        tool_endpoint.is_active = False
        await tool_endpoint.asave(update_fields=["is_active"])

        result = await get_tool_endpoint(str(tool_endpoint.product_id))
        assert result is None


@pytest.mark.django_db(transaction=True)
class TestPostToolCall:
    async def test_successful_tool_call(self, product):
        mock_response = httpx.Response(
            200,
            json={"call_id": "tc_1", "success": True, "result": {"name": "Sarah"}},
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="test-secret"):
                result = await post_tool_call(
                    endpoint_url="https://api.customer.test/pillar",
                    call_id="tc_1",
                    tool_name="lookup_customer",
                    arguments={"email": "sarah@acme.com"},
                    caller=FakeCaller(),
                    timeout=30.0,
                    conversation_id="conv-123",
                    product=product,
                )

        assert result["success"] is True
        assert result["result"]["name"] == "Sarah"

    async def test_timeout_returns_timed_out(self, product):
        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="test-secret"):
                result = await post_tool_call(
                    endpoint_url="https://api.customer.test/pillar",
                    call_id="tc_2",
                    tool_name="slow_tool",
                    arguments={},
                    caller=FakeCaller(),
                    timeout=5.0,
                    conversation_id=None,
                    product=product,
                )

        assert result["timed_out"] is True

    async def test_connect_error_returns_connection_error(self, product):
        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="test-secret"):
                result = await post_tool_call(
                    endpoint_url="https://offline.example.com/pillar",
                    call_id="tc_3",
                    tool_name="unreachable_tool",
                    arguments={},
                    caller=FakeCaller(),
                    timeout=10.0,
                    conversation_id=None,
                    product=product,
                )

        assert result["connection_error"] is True

    async def test_http_error_returns_server_error_with_body(self, product):
        """HTTP 500 with JSON body should return server_error with the error message."""
        mock_response = httpx.Response(
            500,
            json={"call_id": "tc_err", "success": False, "error": "Product custom-logo-1 already exists"},
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="test-secret"):
                result = await post_tool_call(
                    endpoint_url="https://api.customer.test/pillar",
                    call_id="tc_err",
                    tool_name="create_plan",
                    arguments={"name": "custom-logo-1"},
                    caller=FakeCaller(),
                    timeout=30.0,
                    conversation_id="conv-123",
                    product=product,
                )

        assert result.get("server_error") is True
        assert result["error"] == "Product custom-logo-1 already exists"
        assert result["success"] is False
        assert "connection_error" not in result

    async def test_http_error_without_json_body(self, product):
        """HTTP 500 with non-JSON body should fall back to status message."""
        mock_response = httpx.Response(
            500,
            text="Internal Server Error",
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="test-secret"):
                result = await post_tool_call(
                    endpoint_url="https://api.customer.test/pillar",
                    call_id="tc_err2",
                    tool_name="broken_tool",
                    arguments={},
                    caller=FakeCaller(),
                    timeout=30.0,
                    conversation_id=None,
                    product=product,
                )

        assert result.get("server_error") is True
        assert "500" in result["error"]
        assert "connection_error" not in result

    async def test_signature_header_included(self, product):
        mock_response = httpx.Response(
            200,
            json={"success": True, "result": "ok"},
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.dispatch.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with patch("apps.tools.services.dispatch.aget_signing_secret_for_product", return_value="my-signing-key"):
                await post_tool_call(
                    endpoint_url="https://api.customer.test/pillar",
                    call_id="tc_4",
                    tool_name="tool",
                    arguments={},
                    caller=FakeCaller(),
                    timeout=30.0,
                    conversation_id=None,
                    product=product,
                )

        call_kwargs = mock_client.post.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert "X-Pillar-Signature" in headers
        assert headers["X-Pillar-Signature"].startswith("t=")
