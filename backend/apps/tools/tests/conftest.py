"""
Fixtures for server-side tool infrastructure tests.
"""
import secrets

import pytest
from rest_framework.test import APIClient

from apps.products.models import Action, Product, SyncSecret
from apps.tools.models import MCPToolSource, ToolEndpoint
from apps.users.models import Organization, OrganizationMembership, User


@pytest.fixture
def organization(db):
    return Organization.objects.create(
        name="Tools Test Org",
        plan="pro",
        subscription_status="active",
    )


@pytest.fixture
def product(organization):
    return Product.objects.create(
        organization=organization,
        name="Tools Test Product",
        subdomain="tools-test",
        is_default=True,
    )


@pytest.fixture
def user(organization):
    u = User.objects.create_user(
        email="toolstest@example.com",
        password="testpass123",
        full_name="Tools Tester",
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=u,
        role=OrganizationMembership.Role.ADMIN,
    )
    u.current_organization = organization
    return u


@pytest.fixture
def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def sync_secret(product):
    """Active SyncSecret for the test product."""
    raw = secrets.token_urlsafe(32)
    return SyncSecret.objects.create(
        product=product,
        organization=product.organization,
        name="test-secret",
        secret_hash=raw,
        last_four=raw[-4:],
        is_active=True,
    ), raw


@pytest.fixture
def tool_endpoint(product):
    return ToolEndpoint.objects.create(
        product=product,
        organization=product.organization,
        endpoint_url="https://api.customer.test/pillar",
        registered_tools=[
            {"name": "lookup_customer", "description": "Look up a customer"},
        ],
        sdk_version="pillar-python/0.1.0",
        is_active=True,
        last_ping_success=True,
    )


@pytest.fixture
def mcp_source(product):
    return MCPToolSource.objects.create(
        product=product,
        organization=product.organization,
        name="Test MCP Server",
        url="https://mcp.customer.test/mcp",
        auth_type=MCPToolSource.AuthType.NONE,
        auth_credentials="",
        is_active=True,
        last_ping_success=True,
    )


@pytest.fixture
def server_side_action(product):
    """A published server-side Action/Tool."""
    return Action.objects.create(
        product=product,
        organization=product.organization,
        name="lookup_customer",
        description="Look up a customer by email",
        tool_type=Action.ToolType.SERVER_SIDE,
        source_type=Action.SourceType.BACKEND_SDK,
        status=Action.Status.PUBLISHED,
        data_schema={
            "type": "object",
            "properties": {
                "email": {"type": "string"},
            },
            "required": ["email"],
        },
        channel_compatibility=["web", "slack", "discord", "email", "api"],
    )
