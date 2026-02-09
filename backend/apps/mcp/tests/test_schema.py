"""
Tests for MCP API schema endpoints.

Note: In help-center-backend, the schema/docs endpoints require admin authentication.
These tests verify the endpoints exist but may return 302 redirect to login.
"""
import pytest
from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.mark.django_db
class MCPSchemaTests(TestCase):
    """Tests for MCP OpenAPI schema endpoint."""

    def setUp(self):
        """Set up test client."""
        cache.clear()
        self.client = APIClient()

    def test_schema_endpoint_exists(self):
        """Test that schema endpoint exists (may require auth)."""
        response = self.client.get('/api/schema/')

        # Endpoint exists - returns 200 (if public) or 302 (redirect to login)
        self.assertIn(response.status_code, [200, 302])

    def test_schema_options_request(self):
        """Test that schema endpoint handles CORS preflight OPTIONS request."""
        response = self.client.options('/api/schema/')

        # Should return success for OPTIONS
        self.assertIn(response.status_code, [200, 204, 302])


@pytest.mark.django_db
class MCPSwaggerUITests(TestCase):
    """Tests for MCP Swagger UI endpoint."""

    def setUp(self):
        """Set up test client."""
        cache.clear()
        self.client = APIClient()

    def test_swagger_endpoint_exists(self):
        """Test that Swagger UI endpoint exists (may require auth)."""
        response = self.client.get('/api/docs/')

        # Endpoint exists - returns 200 (if public) or 302 (redirect to login)
        self.assertIn(response.status_code, [200, 302])


# Example of how to run these tests:
# uv run pytest apps/mcp/tests/test_schema.py -v
# or with Django test runner:
# uv run python manage.py test apps.mcp.tests.test_schema
