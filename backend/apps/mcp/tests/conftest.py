"""
Pytest fixtures for MCP tests.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def test_organization(db):
    """Create test organization."""
    from apps.users.models import Organization
    return Organization.objects.create(
        name="Test Organization"
    )


@pytest.fixture
def test_help_center_config(db, test_organization):
    """Create test help center config (Product)."""
    from apps.products.models import Product
    return Product.objects.create(
        organization=test_organization,
        name="Test Help Center",
        subdomain="test"
    )


@pytest.fixture
def mock_tool():
    """Create mock non-streaming tool."""
    tool = MagicMock()
    tool.name = "mock_tool"
    tool.public = True
    tool.supports_streaming = False
    tool.execute = AsyncMock(return_value={'success': True, 'data': 'result'})
    return tool


@pytest.fixture
def mock_streaming_tool():
    """Create mock streaming tool that yields dict events."""
    async def mock_stream(*args, **kwargs):
        yield {"type": "token", "text": "Hello"}
        yield {"type": "complete"}

    tool = MagicMock()
    tool.name = "mock_streaming_tool"
    tool.public = True
    tool.supports_streaming = True
    tool.execute_stream = mock_stream
    return tool


@pytest.fixture
def api_client():
    """Create REST framework API client."""
    from rest_framework.test import APIClient
    return APIClient()
