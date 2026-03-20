"""
Tests for the MCP client (tools/list and tools/call).
"""
from dataclasses import dataclass
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from apps.products.models import Action
from apps.tools.services.mcp_client import (
    _build_auth_headers,
    _sync_discovered_tools,
    discover_tools,
    execute_mcp_tool,
)


@dataclass
class FakeCaller:
    channel: str = "web"
    channel_user_id: str | None = None
    external_user_id: str | None = "user_42"
    email: str | None = "user@example.com"
    display_name: str | None = "User"


class TestBuildAuthHeaders:
    def test_no_auth(self, mcp_source):
        mcp_source.auth_type = "none"
        headers = _build_auth_headers(mcp_source)
        assert "Authorization" not in headers

    def test_bearer_auth(self, mcp_source):
        import json

        mcp_source.auth_type = "bearer"
        mcp_source.auth_credentials = json.dumps({"token": "my-token"})
        headers = _build_auth_headers(mcp_source)
        assert headers["Authorization"] == "Bearer my-token"

    def test_custom_header_auth(self, mcp_source):
        import json

        mcp_source.auth_type = "header"
        mcp_source.auth_credentials = json.dumps({
            "header_name": "X-API-Key",
            "header_value": "secret-key",
        })
        headers = _build_auth_headers(mcp_source)
        assert headers["X-API-Key"] == "secret-key"


@pytest.mark.django_db
class TestDiscoverTools:
    async def test_discover_returns_tools(self, mcp_source):
        mock_response = httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "result": {
                    "tools": [
                        {
                            "name": "get_weather",
                            "description": "Get weather for a city",
                            "inputSchema": {
                                "type": "object",
                                "properties": {"city": {"type": "string"}},
                            },
                        },
                    ],
                },
            },
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.mcp_client.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_cls.return_value = mock_client

            tools = await discover_tools(mcp_source)

        assert len(tools) == 1
        assert tools[0]["name"] == "get_weather"

    async def test_discover_error_raises(self, mcp_source):
        mock_response = httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "error": {"code": -32600, "message": "Invalid Request"},
            },
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.mcp_client.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_cls.return_value = mock_client

            with pytest.raises(RuntimeError, match="tools/list error"):
                await discover_tools(mcp_source)


@pytest.mark.django_db
class TestExecuteMCPTool:
    async def test_successful_call(self, mcp_source):
        mock_response = httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "result": {
                    "content": [{"type": "text", "text": "72°F, sunny"}],
                },
            },
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.mcp_client.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_cls.return_value = mock_client

            result = await execute_mcp_tool(
                tool_name="get_weather",
                arguments={"city": "Austin"},
                mcp_source=mcp_source,
                caller=FakeCaller(),
            )

        assert result["success"] is True
        assert len(result["result"]) == 1

    async def test_timeout_returns_timed_out(self, mcp_source):
        with patch("apps.tools.services.mcp_client.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("slow"))
            mock_cls.return_value = mock_client

            result = await execute_mcp_tool(
                tool_name="slow_tool",
                arguments={},
                mcp_source=mcp_source,
                caller=FakeCaller(),
            )

        assert result["timed_out"] is True

    async def test_caller_headers_set(self, mcp_source):
        mock_response = httpx.Response(
            200,
            json={"jsonrpc": "2.0", "id": "1", "result": {"content": []}},
            request=httpx.Request("POST", "https://example.com"),
        )

        with patch("apps.tools.services.mcp_client.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_cls.return_value = mock_client

            await execute_mcp_tool(
                tool_name="t",
                arguments={},
                mcp_source=mcp_source,
                caller=FakeCaller(external_user_id="u_99", email="a@b.com"),
            )

        call_kwargs = mock_client.post.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert headers["X-Pillar-Caller-Id"] == "u_99"
        assert headers["X-Pillar-Caller-Email"] == "a@b.com"


@pytest.mark.django_db
class TestSyncDiscoveredTools:
    def test_creates_draft_actions(self, mcp_source):
        tools = [
            {
                "name": "get_weather",
                "description": "Get weather",
                "inputSchema": {"type": "object", "properties": {"city": {"type": "string"}}},
            },
            {
                "name": "get_stock",
                "description": "Get stock price",
                "inputSchema": {"type": "object", "properties": {"symbol": {"type": "string"}}},
            },
        ]

        _sync_discovered_tools(mcp_source, tools)

        mcp_source.refresh_from_db()
        assert mcp_source.discovery_status == "success"
        assert len(mcp_source.discovered_tools) == 2

        actions = Action.objects.filter(mcp_source=mcp_source)
        assert actions.count() == 2

        for action in actions:
            assert action.tool_type == Action.ToolType.SERVER_SIDE
            assert action.source_type == Action.SourceType.MCP
            assert action.status == Action.Status.DRAFT

    def test_idempotent_sync(self, mcp_source):
        tools = [{"name": "my_tool", "description": "Does stuff", "inputSchema": {}}]

        _sync_discovered_tools(mcp_source, tools)
        _sync_discovered_tools(mcp_source, tools)

        assert Action.objects.filter(mcp_source=mcp_source).count() == 1
