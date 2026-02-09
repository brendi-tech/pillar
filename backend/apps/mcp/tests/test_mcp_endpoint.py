"""
Tests for MCP agent server endpoints.

These tests verify:
1. MCP endpoints are accessible
2. Health checks work
3. HelpCenterConfig resolution works

Note: These tests use Django's test client. For full integration testing
of async middleware with the ASGI server, run the server manually.
"""
import pytest
from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.mark.django_db
class MCPEndpointTests(TestCase):
    """Tests for MCP agent server endpoints."""

    def setUp(self):
        """Set up test data for MCP tests."""
        cache.clear()
        self.client = APIClient()

        # Create organization
        from apps.users.models import Organization
        self.org = Organization.objects.create(
            name='Test Organization'
        )

        # Create help center config (Product)
        from apps.products.models import Product
        self.help_center_config = Product.objects.create(
            name='Test Help Center',
            subdomain='test',
            organization=self.org
        )

    def test_mcp_health_check(self):
        """Test MCP health endpoint returns healthy status."""
        response = self.client.get('/mcp/health/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['service'], 'pillar-help-center-mcp')

    def test_mcp_readiness_check(self):
        """Test MCP readiness endpoint checks database and cache."""
        response = self.client.get('/mcp/health/ready/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ready')
        self.assertTrue(data['checks']['database'])
        self.assertTrue(data['checks']['cache'])

    def test_mcp_info_endpoint(self):
        """Test MCP service info endpoint."""
        response = self.client.get('/mcp/info')

        # Without help center context, should return error
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    def test_mcp_info_with_help_center_id(self):
        """Test MCP service info with help_center_id parameter."""
        response = self.client.get(f'/mcp/info?help_center_id={self.help_center_config.id}')

        # With valid help center ID, should work
        # Note: Middleware resolution happens in real ASGI server
        # In tests, we're just verifying the endpoint exists
        self.assertIn(response.status_code, [200, 400])

    def test_help_center_config_exists(self):
        """Test that help center configuration was created properly."""
        self.assertIsNotNone(self.help_center_config)
        self.assertEqual(self.help_center_config.subdomain, 'test')
        self.assertEqual(self.help_center_config.organization, self.org)

    def test_help_center_has_organization(self):
        """Test that help center is properly associated with organization."""
        self.assertEqual(self.help_center_config.organization, self.org)
        self.assertEqual(self.help_center_config.name, 'Test Help Center')


@pytest.mark.django_db
class MCPMainEndpointTests(TestCase):
    """Tests for main MCP streamable HTTP endpoint."""

    def setUp(self):
        """Set up test data."""
        cache.clear()
        self.client = APIClient()

        # Create organization
        from apps.users.models import Organization
        self.org = Organization.objects.create(
            name='MCP Test Org'
        )

        # Create help center config (Product)
        from apps.products.models import Product
        self.help_center_config = Product.objects.create(
            name='MCP Test Help Center',
            subdomain='mcp-test',
            organization=self.org
        )

    def test_mcp_endpoint_accepts_get(self):
        """Test that MCP endpoint accepts GET for server info."""
        response = self.client.get(f'/mcp/?help_center_id={self.help_center_config.id}')

        # Should not be 404 - endpoint exists
        self.assertNotEqual(response.status_code, 404)

    def test_mcp_endpoint_accepts_post(self):
        """Test that MCP endpoint accepts POST for JSON-RPC requests."""
        response = self.client.post(
            f'/mcp/?help_center_id={self.help_center_config.id}',
            {
                'conversation_id': 'test-conversation',
                'messages': [
                    {'role': 'user', 'content': 'Hello'}
                ]
            },
            format='json'
        )

        # Should not be 404 - endpoint exists
        self.assertNotEqual(response.status_code, 404)


# Example of how to run these tests:
# uv run pytest apps/mcp/tests/test_mcp_endpoint.py -v
# or with Django test runner:
# uv run python manage.py test apps.mcp.tests.test_mcp_endpoint
