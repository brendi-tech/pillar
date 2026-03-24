"""
Tests for the MCP client (tools/list and tools/call).
"""
from dataclasses import dataclass
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from apps.tools.services.mcp_client import (
    _build_auth_headers,
    discover_tools,
    embed_source_descriptions,
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


@pytest.mark.django_db(transaction=True)
class TestEmbedSourceDescriptions:
    async def test_embeds_descriptions_and_saves(self, mcp_source):
        mcp_source.discovered_tools = [
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
        mcp_source.discovered_resources = []
        await mcp_source.asave()

        fake_embedding = [0.1, 0.2, 0.3]
        mock_service = AsyncMock()
        mock_service.embed_query_async = AsyncMock(return_value=fake_embedding)

        with patch(
            "common.services.embedding_service.get_embedding_service",
            return_value=mock_service,
        ):
            await embed_source_descriptions(mcp_source)

        await mcp_source.arefresh_from_db()
        assert len(mcp_source.discovered_tools) == 2

        for tool_def in mcp_source.discovered_tools:
            assert "_description_embedding" in tool_def
            assert tool_def["_description_embedding"] == fake_embedding

    async def test_skips_embedding_for_empty_description(self, mcp_source):
        mcp_source.discovered_tools = [
            {"name": "no_desc_tool", "description": "", "inputSchema": {}},
        ]
        mcp_source.discovered_resources = []
        await mcp_source.asave()

        mock_service = AsyncMock()
        mock_service.embed_query_async = AsyncMock()

        with patch(
            "common.services.embedding_service.get_embedding_service",
            return_value=mock_service,
        ):
            await embed_source_descriptions(mcp_source)

        await mcp_source.arefresh_from_db()
        assert len(mcp_source.discovered_tools) == 1
        assert "_description_embedding" not in mcp_source.discovered_tools[0]
        mock_service.embed_query_async.assert_not_called()

    async def test_skips_already_embedded(self, mcp_source):
        """Items with existing embeddings are not re-embedded."""
        existing_embedding = [0.9, 0.8, 0.7]
        mcp_source.discovered_tools = [
            {
                "name": "already_done",
                "description": "Already embedded",
                "inputSchema": {},
                "_description_embedding": existing_embedding,
            },
        ]
        mcp_source.discovered_resources = []
        await mcp_source.asave()

        mock_service = AsyncMock()
        mock_service.embed_query_async = AsyncMock()

        with patch(
            "common.services.embedding_service.get_embedding_service",
            return_value=mock_service,
        ):
            await embed_source_descriptions(mcp_source)

        mock_service.embed_query_async.assert_not_called()
        await mcp_source.arefresh_from_db()
        assert mcp_source.discovered_tools[0]["_description_embedding"] == existing_embedding
