"""
Tests for server-side tool models.
"""
import pytest
from django.utils import timezone

from apps.products.models import Action, SyncSecret
from apps.tools.models import MCPToolSource, ToolEndpoint


@pytest.mark.django_db
class TestSyncSecretRotation:
    def test_new_fields_have_defaults(self, product):
        secret = SyncSecret.objects.create(
            product=product,
            organization=product.organization,
            name="defaults",
            secret_hash="some-value",
        )
        assert secret.is_active is True
        assert secret.revoked_at is None
        assert secret.last_four == ""

    def test_revoke_sets_fields(self, sync_secret):
        secret_obj, _ = sync_secret
        assert secret_obj.is_active is True

        secret_obj.revoke()
        secret_obj.refresh_from_db()

        assert secret_obj.is_active is False
        assert secret_obj.revoked_at is not None

    def test_last_four_stored(self, product):
        secret = SyncSecret.objects.create(
            product=product,
            organization=product.organization,
            name="with-last-four",
            secret_hash="abcdefghij",
            last_four="ghij",
        )
        assert secret.last_four == "ghij"
        assert str(secret) == "tools-test/••••ghij"


@pytest.mark.django_db
class TestToolEndpoint:
    def test_create_and_str(self, tool_endpoint):
        assert "tools-test" in str(tool_endpoint)
        assert "api.customer.test" in str(tool_endpoint)

    def test_registered_tools_is_list(self, tool_endpoint):
        assert isinstance(tool_endpoint.registered_tools, list)
        assert len(tool_endpoint.registered_tools) == 1
        assert tool_endpoint.registered_tools[0]["name"] == "lookup_customer"


@pytest.mark.django_db
class TestMCPToolSource:
    def test_create_and_str(self, mcp_source):
        assert "tools-test" in str(mcp_source)
        assert "Test MCP Server" in str(mcp_source)

    def test_auth_type_choices(self):
        assert MCPToolSource.AuthType.NONE == "none"
        assert MCPToolSource.AuthType.BEARER == "bearer"
        assert MCPToolSource.AuthType.HEADER == "header"
        assert MCPToolSource.AuthType.OAUTH == "oauth"


@pytest.mark.django_db
class TestActionSourceType:
    def test_source_type_defaults_to_cli_sync(self, product):
        action = Action.objects.create(
            product=product,
            organization=product.organization,
            name="test_tool",
            description="A test tool",
        )
        assert action.source_type == Action.SourceType.CLI_SYNC

    def test_server_side_tool_with_backend_sdk_source(self, server_side_action):
        assert server_side_action.tool_type == Action.ToolType.SERVER_SIDE
        assert server_side_action.source_type == Action.SourceType.BACKEND_SDK

    def test_mcp_source_fk(self, mcp_source, product):
        action = Action.objects.create(
            product=product,
            organization=product.organization,
            name="mcp_tool",
            description="Tool from MCP",
            tool_type=Action.ToolType.SERVER_SIDE,
            source_type=Action.SourceType.MCP,
            mcp_source=mcp_source,
        )
        assert action.mcp_source_id == mcp_source.id
        assert mcp_source.tools.count() == 1
