"""
Tests for admin-facing views (endpoint status, MCP source CRUD).
"""
import pytest
from rest_framework.test import APIClient

from apps.tools.models import MCPToolSource


@pytest.mark.django_db
class TestEndpointStatusView:
    def test_returns_active_endpoint(self, authenticated_client, tool_endpoint, product):
        resp = authenticated_client.get(
            f"/api/tools/admin/endpoint/?product_id={product.id}",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "active"
        assert resp.data["endpoint"]["endpoint_url"] == "https://api.customer.test/pillar"

    def test_returns_no_endpoint_when_none(self, authenticated_client, product):
        resp = authenticated_client.get(
            f"/api/tools/admin/endpoint/?product_id={product.id}",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "no_endpoint"

    def test_returns_unreachable_when_unhealthy(self, authenticated_client, tool_endpoint, product):
        tool_endpoint.last_ping_success = False
        tool_endpoint.save(update_fields=["last_ping_success"])

        resp = authenticated_client.get(
            f"/api/tools/admin/endpoint/?product_id={product.id}",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "unreachable"

    def test_requires_product_id(self, authenticated_client):
        resp = authenticated_client.get("/api/tools/admin/endpoint/")
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        resp = client.get("/api/tools/admin/endpoint/?product_id=1")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestMCPSourceViewSet:
    def test_list_empty(self, authenticated_client):
        resp = authenticated_client.get("/api/tools/admin/mcp-sources/")
        assert resp.status_code == 200
        assert resp.data["results"] == [] or resp.data == []

    def test_list_with_source(self, authenticated_client, mcp_source):
        resp = authenticated_client.get("/api/tools/admin/mcp-sources/")
        assert resp.status_code == 200
        sources = resp.data.get("results", resp.data)
        assert len(sources) == 1
        assert sources[0]["name"] == "Test MCP Server"

    def test_retrieve(self, authenticated_client, mcp_source):
        resp = authenticated_client.get(f"/api/tools/admin/mcp-sources/{mcp_source.id}/")
        assert resp.status_code == 200
        assert resp.data["name"] == "Test MCP Server"
        assert resp.data["url"] == "https://mcp.customer.test/mcp"

    def test_delete(self, authenticated_client, mcp_source):
        resp = authenticated_client.delete(f"/api/tools/admin/mcp-sources/{mcp_source.id}/")
        assert resp.status_code == 204
        assert not MCPToolSource.objects.filter(id=mcp_source.id).exists()

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        resp = client.get("/api/tools/admin/mcp-sources/")
        assert resp.status_code in (401, 403)
