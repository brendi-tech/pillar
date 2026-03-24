"""
Tests for MCP external source passthrough aggregation.

Tests that external MCP source tools and resources are correctly
aggregated into the Pillar MCP server's tools/list, tools/call,
resources/list, and resources/read endpoints with slug namespacing.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _make_agent_with_sources(sources):
    """Create a mock agent with mcp_sources M2M."""
    agent = MagicMock()
    agent.channel = 'mcp'

    pk_list = [s.id for s in sources]

    values_list_qs = MagicMock()

    async def _aiter_pks(*args, **kwargs):
        for pk in pk_list:
            yield pk

    values_list_qs.__aiter__ = _aiter_pks
    agent.mcp_sources.values_list = MagicMock(return_value=values_list_qs)
    return agent


def _make_source(
    source_id="src-1",
    name="Acme Tools",
    slug="acme",
    tools=None,
    resources=None,
    is_active=True,
    discovery_status="success",
):
    source = MagicMock()
    source.id = source_id
    source.name = name
    source.slug = slug
    source.url = "https://acme.example.com/mcp"
    source.is_active = is_active
    source.discovery_status = discovery_status
    source.discovered_tools = tools or []
    source.discovered_resources = resources or []
    return source


# -----------------------------------------------------------------------
# tools_registry — build_tools_list
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestBuildToolsListWithExternalSources:
    """Tests for external MCP tool aggregation in tools_registry."""

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center', new_callable=AsyncMock)
    @patch('apps.mcp.tools.registry.get_tool_registry')
    @patch('apps.mcp.services.mcp_server.tools_registry._load_external_mcp_tools', new_callable=AsyncMock)
    async def test_external_tools_included(
        self, mock_load_ext, mock_get_registry, mock_loader,
    ):
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list

        mock_registry = MagicMock()
        mock_registry.get_public_tools.return_value = []
        mock_get_registry.return_value = mock_registry

        mock_load_ext.return_value = [
            {"name": "acme_get_weather", "description": "Get weather", "inputSchema": {"type": "object"}},
        ]

        hc = MagicMock()
        hc.id = "hc-1"
        agent = MagicMock()
        agent.channel = "web"

        result = await build_tools_list(hc, agent=agent)
        assert any(t["name"] == "acme_get_weather" for t in result["tools"])

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center', new_callable=AsyncMock)
    @patch('apps.mcp.tools.registry.get_tool_registry')
    @patch('apps.mcp.services.mcp_server.tools_registry._load_external_mcp_tools', new_callable=AsyncMock)
    async def test_external_tools_deduped_against_builtins(
        self, mock_load_ext, mock_get_registry, mock_loader,
    ):
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list

        builtin = MagicMock()
        builtin.to_mcp_schema.return_value = {
            "name": "ask", "description": "Built-in ask", "inputSchema": {"type": "object"},
        }
        mock_registry = MagicMock()
        mock_registry.get_public_tools.return_value = [builtin]
        mock_get_registry.return_value = mock_registry

        mock_load_ext.return_value = [
            {"name": "ask", "description": "Collision", "inputSchema": {"type": "object"}},
            {"name": "acme_unique", "description": "Unique", "inputSchema": {"type": "object"}},
        ]

        hc = MagicMock()
        hc.id = "hc-1"
        agent = MagicMock()
        agent.channel = "web"

        result = await build_tools_list(hc, agent=agent)
        names = [t["name"] for t in result["tools"]]
        assert names.count("ask") == 1
        assert "acme_unique" in names

    @patch('apps.mcp.tools.loader.load_all_tools_for_help_center', new_callable=AsyncMock)
    @patch('apps.mcp.tools.registry.get_tool_registry')
    async def test_no_external_tools_without_agent(
        self, mock_get_registry, mock_loader,
    ):
        from apps.mcp.services.mcp_server.tools_registry import build_tools_list

        mock_registry = MagicMock()
        mock_registry.get_public_tools.return_value = []
        mock_get_registry.return_value = mock_registry

        hc = MagicMock()
        hc.id = "hc-1"

        result = await build_tools_list(hc, agent=None)
        assert result["tools"] == []


@pytest.mark.asyncio
class TestLoadExternalMcpTools:
    """Unit tests for _load_external_mcp_tools helper."""

    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_namespaces_with_slug(self, mock_qs):
        from apps.mcp.services.mcp_server.tools_registry import _load_external_mcp_tools

        source = _make_source(
            slug="weather",
            tools=[
                {"name": "get_forecast", "description": "Forecast", "inputSchema": {"type": "object"}},
                {"name": "get_current", "description": "Current weather", "inputSchema": {"type": "object"}},
            ],
        )

        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        tools = await _load_external_mcp_tools(agent)

        assert len(tools) == 2
        assert tools[0]["name"] == "weather_get_forecast"
        assert tools[1]["name"] == "weather_get_current"
        assert tools[0]["annotations"]["x-pillar-mcp-original-name"] == "get_forecast"
        assert tools[0]["annotations"]["x-pillar-mcp-source-id"] == "src-1"

    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_namespaces_with_slugified_name(self, mock_qs):
        from apps.mcp.services.mcp_server.tools_registry import _load_external_mcp_tools

        source = _make_source(
            slug="",
            name="My CRM Tools",
            tools=[{"name": "list_contacts", "description": "List", "inputSchema": {"type": "object"}}],
        )
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        tools = await _load_external_mcp_tools(agent)
        assert tools[0]["name"] == "my_crm_tools_list_contacts"

    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_skips_tools_without_name(self, mock_qs):
        from apps.mcp.services.mcp_server.tools_registry import _load_external_mcp_tools

        source = _make_source(
            tools=[
                {"name": "", "description": "Empty name"},
                {"description": "No name key"},
                {"name": "valid", "description": "Valid tool", "inputSchema": {"type": "object"}},
            ],
        )
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        tools = await _load_external_mcp_tools(agent)
        assert len(tools) == 1
        assert tools[0]["name"] == "acme_valid"

    async def test_returns_empty_when_no_sources(self):
        from apps.mcp.services.mcp_server.tools_registry import _load_external_mcp_tools

        agent = _make_agent_with_sources([])
        tools = await _load_external_mcp_tools(agent)
        assert tools == []


# -----------------------------------------------------------------------
# tools_dispatcher — dispatch_tool_call / dispatch_tool_call_stream
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestDispatchExternalMcpTool:
    """Tests for _dispatch_external_mcp_tool in tools_dispatcher."""

    @patch('apps.tools.services.mcp_client.execute_mcp_tool', new_callable=AsyncMock)
    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_dispatches_by_slug_prefix(self, mock_qs, mock_exec):
        from apps.mcp.services.mcp_server.tools_dispatcher import (
            _dispatch_external_mcp_tool,
        )

        source = _make_source(
            slug="acme",
            tools=[{"name": "get_weather", "description": "Weather"}],
        )
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        mock_exec.return_value = {
            "success": True,
            "result": [{"type": "text", "text": "Sunny"}],
        }

        request = MagicMock()
        request.META = {}

        result = await _dispatch_external_mcp_tool(
            "acme_get_weather", {"city": "NYC"}, request, agent,
        )

        assert result is not None
        assert result["isError"] is False
        mock_exec.assert_called_once()
        call_kwargs = mock_exec.call_args.kwargs
        assert call_kwargs["tool_name"] == "get_weather"
        assert call_kwargs["mcp_source"] is source

    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_returns_none_for_unknown_slug(self, mock_qs):
        from apps.mcp.services.mcp_server.tools_dispatcher import (
            _dispatch_external_mcp_tool,
        )

        source = _make_source(slug="acme", tools=[{"name": "get_weather"}])
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        request = MagicMock()
        request.META = {}

        result = await _dispatch_external_mcp_tool(
            "unknown_get_weather", {}, request, agent,
        )
        assert result is None

    async def test_returns_none_without_agent(self):
        from apps.mcp.services.mcp_server.tools_dispatcher import (
            _dispatch_external_mcp_tool,
        )

        result = await _dispatch_external_mcp_tool(
            "acme_get_weather", {}, MagicMock(), None,
        )
        assert result is None

    @patch('apps.tools.services.mcp_client.execute_mcp_tool', new_callable=AsyncMock)
    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_handles_timeout(self, mock_qs, mock_exec):
        from apps.mcp.services.mcp_server.tools_dispatcher import (
            _dispatch_external_mcp_tool,
        )

        source = _make_source(
            slug="acme", tools=[{"name": "slow_tool"}],
        )
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        mock_exec.return_value = {"timed_out": True}

        request = MagicMock()
        request.META = {}

        result = await _dispatch_external_mcp_tool(
            "acme_slow_tool", {}, request, agent,
        )

        assert result is not None
        assert result["isError"] is True
        assert "timed out" in result["content"][0]["text"]


# -----------------------------------------------------------------------
# resources_registry — build_resources_list
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestBuildResourcesListWithExternalSources:
    """Tests for external MCP resource aggregation."""

    @patch(
        'apps.mcp.services.mcp_server.resources_registry._load_skill_resources',
        new_callable=AsyncMock,
        return_value=[],
    )
    @patch(
        'apps.mcp.services.mcp_server.resources_registry._load_external_mcp_resources',
        new_callable=AsyncMock,
    )
    async def test_external_resources_included(self, mock_load_ext, _mock_skills):
        from apps.mcp.services.mcp_server.resources_registry import (
            build_resources_list,
        )

        mock_load_ext.return_value = [
            {
                "uri": "mcp-source://acme/file:///data.csv",
                "name": "data.csv",
                "description": "Dataset",
                "mimeType": "text/csv",
                "metadata": {"type": "mcp_source_resource"},
            },
        ]

        hc = MagicMock()
        hc.id = "hc-1"
        hc.name = "Test HC"
        hc.organization_id = "org-1"

        agent = MagicMock()

        with patch('apps.knowledge.models.KnowledgeItem.objects') as mock_ki:
            mock_ki.filter.return_value = _empty_qs()

            result = await build_resources_list(hc, None, agent=agent)

        assert any(
            r["uri"].startswith("mcp-source://") for r in result["resources"]
        )

    @patch(
        'apps.mcp.services.mcp_server.resources_registry._load_skill_resources',
        new_callable=AsyncMock,
        return_value=[],
    )
    async def test_no_external_resources_without_agent(self, _mock_skills):
        from apps.mcp.services.mcp_server.resources_registry import (
            build_resources_list,
        )

        hc = MagicMock()
        hc.id = "hc-1"
        hc.name = "Test HC"
        hc.organization_id = "org-1"

        with patch('apps.knowledge.models.KnowledgeItem.objects') as mock_ki:
            mock_ki.filter.return_value = _empty_qs()

            result = await build_resources_list(hc, None, agent=None)

        assert not any(
            r["uri"].startswith("mcp-source://") for r in result["resources"]
        )


@pytest.mark.asyncio
class TestLoadExternalMcpResources:
    """Unit tests for _load_external_mcp_resources helper."""

    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_namespaces_resource_uris(self, mock_qs):
        from apps.mcp.services.mcp_server.resources_registry import (
            _load_external_mcp_resources,
        )

        source = _make_source(
            slug="crm",
            resources=[
                {"uri": "file:///contacts.json", "name": "Contacts", "description": "All contacts"},
                {"uri": "db://orders/recent", "name": "Recent Orders"},
            ],
        )
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.aiterator = MagicMock(return_value=_async_iter([source]))
        mock_qs.filter.return_value = filter_qs

        resources = await _load_external_mcp_resources(agent)

        assert len(resources) == 2
        assert resources[0]["uri"] == "mcp-source://crm/file:///contacts.json"
        assert resources[1]["uri"] == "mcp-source://crm/db://orders/recent"
        assert resources[0]["metadata"]["originalUri"] == "file:///contacts.json"

    async def test_returns_empty_when_no_sources(self):
        from apps.mcp.services.mcp_server.resources_registry import (
            _load_external_mcp_resources,
        )

        agent = _make_agent_with_sources([])
        resources = await _load_external_mcp_resources(agent)
        assert resources == []


# -----------------------------------------------------------------------
# resources_dispatcher — mcp-source:// reads
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestReadExternalMcpResource:
    """Tests for _read_external_mcp_resource in resources_dispatcher."""

    @patch('apps.tools.services.mcp_client.read_mcp_resource', new_callable=AsyncMock)
    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_proxies_read_to_external_source(self, mock_qs, mock_read):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            _read_external_mcp_resource,
        )

        source = _make_source(slug="crm")
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.filter.return_value = filter_qs
        filter_qs.afirst = AsyncMock(return_value=source)
        mock_qs.filter.return_value = filter_qs

        mock_read.return_value = {
            "success": True,
            "contents": [
                {"uri": "file:///contacts.json", "mimeType": "application/json", "text": "[]"},
            ],
        }

        request = MagicMock()
        request.META = {}

        result = await _read_external_mcp_resource(
            "mcp-source://crm/file:///contacts.json", agent, request,
        )

        assert len(result["contents"]) == 1
        assert result["contents"][0]["uri"] == "mcp-source://crm/file:///contacts.json"
        mock_read.assert_called_once()
        call_kwargs = mock_read.call_args.kwargs
        assert call_kwargs["uri"] == "file:///contacts.json"

    async def test_raises_without_agent(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            _read_external_mcp_resource,
        )

        with pytest.raises(ValueError, match="No agent context"):
            await _read_external_mcp_resource(
                "mcp-source://crm/file:///data.csv", None, MagicMock(),
            )

    async def test_raises_on_invalid_uri(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            _read_external_mcp_resource,
        )

        agent = _make_agent_with_sources([])

        with pytest.raises(ValueError, match="Invalid mcp-source URI"):
            await _read_external_mcp_resource(
                "mcp-source://no-slash", agent, MagicMock(),
            )

    @patch('apps.tools.services.mcp_client.read_mcp_resource', new_callable=AsyncMock)
    @patch('apps.tools.models.MCPToolSource.objects')
    async def test_raises_on_timeout(self, mock_qs, mock_read):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            _read_external_mcp_resource,
        )

        source = _make_source(slug="crm")
        agent = _make_agent_with_sources([source])

        filter_qs = MagicMock()
        filter_qs.filter.return_value = filter_qs
        filter_qs.afirst = AsyncMock(return_value=source)
        mock_qs.filter.return_value = filter_qs

        mock_read.return_value = {"timed_out": True}

        request = MagicMock()
        request.META = {}

        with pytest.raises(ValueError, match="timed out"):
            await _read_external_mcp_resource(
                "mcp-source://crm/file:///data.csv", agent, request,
            )


# -----------------------------------------------------------------------
# Dispatch integration (full path through dispatch_resource_read)
# -----------------------------------------------------------------------

@pytest.mark.asyncio
class TestDispatchResourceReadRouting:
    """Tests that dispatch_resource_read routes to the right handler."""

    async def test_routes_knowledge_uri(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            dispatch_resource_read,
        )

        hc = MagicMock()
        hc.id = "hc-1"
        hc.organization_id = "org-1"

        with patch(
            'apps.mcp.services.mcp_server.resources_dispatcher._read_knowledge_item',
            new_callable=AsyncMock,
        ) as mock_read:
            mock_read.return_value = {"contents": []}
            await dispatch_resource_read(
                hc, None, {"uri": "knowledge://hc-1/item-1"},
            )
            mock_read.assert_called_once()

    async def test_routes_mcp_source_uri(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            dispatch_resource_read,
        )

        hc = MagicMock()
        agent = MagicMock()
        request = MagicMock()

        with patch(
            'apps.mcp.services.mcp_server.resources_dispatcher._read_external_mcp_resource',
            new_callable=AsyncMock,
        ) as mock_read:
            mock_read.return_value = {"contents": []}
            await dispatch_resource_read(
                hc, None, {"uri": "mcp-source://acme/file:///x"},
                agent=agent, request=request,
            )
            mock_read.assert_called_once_with(
                "mcp-source://acme/file:///x", agent, request,
            )

    async def test_raises_on_unknown_scheme(self):
        from apps.mcp.services.mcp_server.resources_dispatcher import (
            dispatch_resource_read,
        )

        with pytest.raises(ValueError, match="Unknown resource type"):
            await dispatch_resource_read(
                MagicMock(), None, {"uri": "ftp://bad"},
            )


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

async def _async_iter(items):
    for item in items:
        yield item


def _empty_qs():
    """Create a mock queryset that returns no items."""
    qs = MagicMock()
    qs.select_related.return_value = qs
    qs.order_by.return_value = qs
    qs.aiterator = MagicMock(return_value=_async_iter([]))
    qs.acount = AsyncMock(return_value=0)

    sliced = MagicMock()
    sliced.aiterator = MagicMock(return_value=_async_iter([]))
    qs.__getitem__ = MagicMock(return_value=sliced)
    return qs
