"""
Tests for endpoint health checking.
"""
import pytest

from apps.tools.models import ToolEndpoint
from apps.tools.services.health import is_endpoint_healthy, is_mcp_source_healthy


@pytest.mark.django_db(transaction=True)
class TestIsEndpointHealthy:
    async def test_healthy_endpoint(self, tool_endpoint):
        assert await is_endpoint_healthy(str(tool_endpoint.product_id)) is True

    async def test_unhealthy_endpoint(self, tool_endpoint):
        tool_endpoint.last_ping_success = False
        await tool_endpoint.asave(update_fields=["last_ping_success"])

        assert await is_endpoint_healthy(str(tool_endpoint.product_id)) is False

    async def test_no_endpoint_returns_false(self, product):
        assert await is_endpoint_healthy(str(product.id)) is False

    async def test_inactive_endpoint_returns_false(self, tool_endpoint):
        tool_endpoint.is_active = False
        await tool_endpoint.asave(update_fields=["is_active"])

        assert await is_endpoint_healthy(str(tool_endpoint.product_id)) is False


@pytest.mark.django_db(transaction=True)
class TestIsMCPSourceHealthy:
    async def test_healthy_source(self, mcp_source):
        assert await is_mcp_source_healthy(str(mcp_source.id)) is True

    async def test_unhealthy_source(self, mcp_source):
        mcp_source.last_ping_success = False
        await mcp_source.asave(update_fields=["last_ping_success"])

        assert await is_mcp_source_healthy(str(mcp_source.id)) is False

    async def test_nonexistent_source_returns_false(self):
        assert await is_mcp_source_healthy("00000000-0000-0000-0000-000000000000") is False
