"""
Tests for Phase 1: Tool Registry Evolution.

Covers:
- Model aliases (Tool = Action, etc.)
- tool_type and channel_compatibility fields
- save() / asave() defaults for channel_compatibility
- Serializer output includes new fields
- URL routing aliases (/tools/ alongside /actions/)
- BUILTIN_TOOLS rename with backwards alias
- Search service channel filtering
"""
import pytest
from unittest.mock import patch, AsyncMock


# ============================================================================
# Model Alias Tests
# ============================================================================


class TestModelAliases:
    """Verify Tool* aliases resolve to the same classes as Action*."""

    def test_tool_is_action(self):
        from apps.products.models import Tool, Action
        assert Tool is Action

    def test_tool_deployment_is_action_deployment(self):
        from apps.products.models import ToolDeployment, ActionDeployment
        assert ToolDeployment is ActionDeployment

    def test_tool_execution_log_is_action_execution_log(self):
        from apps.products.models import ToolExecutionLog, ActionExecutionLog
        assert ToolExecutionLog is ActionExecutionLog

    def test_tool_sync_job_is_action_sync_job(self):
        from apps.products.models import ToolSyncJob, ActionSyncJob
        assert ToolSyncJob is ActionSyncJob

    def test_tool_sync_job_status_is_action_sync_job_status(self):
        from apps.products.models import ToolSyncJobStatus, ActionSyncJobStatus
        assert ToolSyncJobStatus is ActionSyncJobStatus

    def test_aliases_importable_from_model_files(self):
        from apps.products.models.action import Tool
        from apps.products.models.action_deployment import ToolDeployment
        from apps.products.models.action_execution_log import ToolExecutionLog
        from apps.products.models.action_sync_job import ToolSyncJob, ToolSyncJobStatus
        assert Tool is not None
        assert ToolDeployment is not None
        assert ToolExecutionLog is not None
        assert ToolSyncJob is not None
        assert ToolSyncJobStatus is not None


# ============================================================================
# Serializer / View / Search Service Alias Tests
# ============================================================================


class TestSerializerAndViewAliases:

    def test_tool_serializer_is_action_serializer(self):
        from apps.products.serializers import ToolSerializer, ActionSerializer
        assert ToolSerializer is ActionSerializer

    def test_tool_execution_log_serializer(self):
        from apps.products.serializers import (
            ToolExecutionLogSerializer, ActionExecutionLogSerializer
        )
        assert ToolExecutionLogSerializer is ActionExecutionLogSerializer

    def test_tool_deployment_serializer(self):
        from apps.products.serializers import (
            ToolDeploymentSerializer, ActionDeploymentSerializer
        )
        assert ToolDeploymentSerializer is ActionDeploymentSerializer

    def test_tool_viewset_is_action_viewset(self):
        from apps.products.views import ToolViewSet, ActionViewSet
        assert ToolViewSet is ActionViewSet

    def test_tool_execution_log_viewset(self):
        from apps.products.views import (
            ToolExecutionLogViewSet, ActionExecutionLogViewSet
        )
        assert ToolExecutionLogViewSet is ActionExecutionLogViewSet

    def test_tool_sync_view_aliases(self):
        from apps.products.views import (
            ToolSyncView, ActionSyncView,
            ToolSyncStatusView, ActionSyncStatusView,
        )
        assert ToolSyncView is ActionSyncView
        assert ToolSyncStatusView is ActionSyncStatusView

    def test_tool_search_service_aliases(self):
        from apps.products.services.action_search_service import (
            ToolSearchService, ActionSearchService,
            ToolSearchResult, ActionSearchResult,
            get_tool_search_service, get_action_search_service,
            tool_search_service, action_search_service,
        )
        assert ToolSearchService is ActionSearchService
        assert ToolSearchResult is ActionSearchResult
        assert get_tool_search_service is get_action_search_service
        assert tool_search_service is action_search_service


# ============================================================================
# tool_type and channel_compatibility Field Tests
# ============================================================================


class TestToolTypeField:

    def test_tool_type_choices_exist(self):
        from apps.products.models.action import Action
        assert hasattr(Action, 'ToolType')
        assert Action.ToolType.CLIENT_SIDE == 'client_side'
        assert Action.ToolType.SERVER_SIDE == 'server_side'

    @patch('common.services.embedding_service.get_embedding_service')
    def test_tool_type_defaults_to_client_side(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        action = Action(
            product=product,
            organization=product.organization,
            name='test_default_tool_type',
            description='A test tool',
        )
        action.save()
        assert action.tool_type == 'client_side'

    @patch('common.services.embedding_service.get_embedding_service')
    def test_channel_compatibility_defaults_web_for_client_side(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        action = Action(
            product=product,
            organization=product.organization,
            name='test_channel_client',
            description='A client-side tool',
            tool_type='client_side',
        )
        action.save()
        assert action.channel_compatibility == ['web']

    @patch('common.services.embedding_service.get_embedding_service')
    def test_channel_compatibility_defaults_all_for_server_side(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        action = Action(
            product=product,
            organization=product.organization,
            name='test_channel_server',
            description='A server-side tool',
            tool_type='server_side',
        )
        action.save()
        assert action.channel_compatibility == ['*']

    @patch('common.services.embedding_service.get_embedding_service')
    def test_explicit_channel_compatibility_not_overwritten(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        action = Action(
            product=product,
            organization=product.organization,
            name='test_explicit_channels',
            description='Custom channels',
            tool_type='client_side',
            channel_compatibility=['web', 'api'],
        )
        action.save()
        assert action.channel_compatibility == ['web', 'api']

    def test_asave_has_channel_compatibility_defaulting_logic(self):
        """Verify asave() contains the same channel_compatibility defaulting as save()."""
        import inspect
        from apps.products.models.action import Action
        source = inspect.getsource(Action.asave)
        assert 'channel_compatibility' in source
        assert "self.ToolType.SERVER_SIDE" in source or "'server_side'" in source


# ============================================================================
# Serializer Field Tests
# ============================================================================


class TestSerializerFields:

    @patch('common.services.embedding_service.get_embedding_service')
    def test_serializer_includes_tool_type(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        from apps.products.serializers import ActionSerializer
        action = Action.objects.create(
            product=product,
            organization=product.organization,
            name='serializer_test',
            description='Test',
        )
        data = ActionSerializer(action).data
        assert 'tool_type' in data
        assert data['tool_type'] == 'client_side'

    @patch('common.services.embedding_service.get_embedding_service')
    def test_serializer_includes_channel_compatibility(self, mock_embed, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        from apps.products.serializers import ActionSerializer
        action = Action.objects.create(
            product=product,
            organization=product.organization,
            name='serializer_channel_test',
            description='Test',
        )
        data = ActionSerializer(action).data
        assert 'channel_compatibility' in data
        assert data['channel_compatibility'] == ['web']


# ============================================================================
# URL Routing Tests
# ============================================================================


class TestURLRoutes:

    def test_tools_list_url_resolves(self):
        from django.urls import reverse
        url = reverse('products:tool-list')
        assert '/tools/' in url

    def test_actions_list_url_still_resolves(self):
        from django.urls import reverse
        url = reverse('products:action-list')
        assert '/actions/' in url

    def test_tool_logs_url_resolves(self):
        from django.urls import reverse
        url = reverse('products:tool-log-list')
        assert '/tool-logs/' in url

    def test_tool_sync_url_resolves(self):
        from django.urls import reverse
        url = reverse('products:tool-sync', kwargs={'slug': 'test-product'})
        assert '/tools/sync/' in url

    def test_action_sync_url_still_resolves(self):
        from django.urls import reverse
        url = reverse('products:action-sync', kwargs={'slug': 'test-product'})
        assert '/actions/sync/' in url

    def test_config_tool_sync_url_resolves(self):
        from django.urls import reverse
        url = reverse('config-tool-sync', kwargs={'slug': 'test-product'})
        assert '/tools/sync/' in url

    def test_config_action_sync_url_still_resolves(self):
        from django.urls import reverse
        url = reverse('config-action-sync', kwargs={'slug': 'test-product'})
        assert '/actions/sync/' in url

    def test_tools_and_actions_endpoints_return_same_data(
        self, authenticated_client, product
    ):
        actions_resp = authenticated_client.get('/api/admin/products/actions/')
        tools_resp = authenticated_client.get('/api/admin/products/tools/')
        assert actions_resp.status_code == 200
        assert tools_resp.status_code == 200
        assert actions_resp.data == tools_resp.data


# ============================================================================
# ViewSet Filter Tests
# ============================================================================


class TestViewSetFilters:

    @patch('common.services.embedding_service.get_embedding_service')
    def test_filter_by_tool_type(self, mock_embed, authenticated_client, product):
        mock_svc = mock_embed.return_value
        mock_svc.embed_document.return_value = [0.0] * 1536
        from apps.products.models import Action
        Action.objects.create(
            product=product,
            organization=product.organization,
            name='client_tool',
            description='Client tool',
            tool_type='client_side',
        )
        Action.objects.create(
            product=product,
            organization=product.organization,
            name='server_tool',
            description='Server tool',
            tool_type='server_side',
        )
        resp = authenticated_client.get(
            '/api/admin/products/tools/', {'tool_type': 'server_side'}
        )
        assert resp.status_code == 200
        names = [t['name'] for t in resp.data['results']]
        assert 'server_tool' in names
        assert 'client_tool' not in names


# ============================================================================
# MCP Layer Cleanup Tests
# ============================================================================


class TestBuiltinToolsRename:

    def test_builtin_tools_exists(self):
        from apps.mcp.services.agent.tool_handlers import BUILTIN_TOOLS
        assert isinstance(BUILTIN_TOOLS, dict)
        assert 'interact_with_page' in BUILTIN_TOOLS

    def test_builtin_actions_backwards_alias(self):
        from apps.mcp.services.agent.tool_handlers import (
            BUILTIN_TOOLS, BUILTIN_ACTIONS
        )
        assert BUILTIN_ACTIONS is BUILTIN_TOOLS

    def test_agentic_loop_imports_builtin_tools(self):
        import inspect
        from apps.mcp.services.agent import agentic_loop
        source = inspect.getsource(agentic_loop)
        assert 'BUILTIN_TOOLS' in source
        assert 'BUILTIN_ACTIONS' not in source


# ============================================================================
# Search Service Channel Filtering Tests
# ============================================================================


class TestSearchServiceChannelParam:

    def test_search_accepts_channel_parameter(self):
        import inspect
        from apps.products.services.action_search_service import ActionSearchService
        sig = inspect.signature(ActionSearchService.search)
        assert 'channel' in sig.parameters

    def test_search_with_metadata_accepts_channel_parameter(self):
        import inspect
        from apps.products.services.action_search_service import ActionSearchService
        sig = inspect.signature(ActionSearchService.search_with_metadata)
        assert 'channel' in sig.parameters

    def test_get_actions_queryset_accepts_channel_parameter(self):
        import inspect
        from apps.products.services.action_search_service import ActionSearchService
        sig = inspect.signature(ActionSearchService._get_actions_queryset)
        assert 'channel' in sig.parameters

    def test_channel_filtering_logic_in_queryset(self):
        import inspect
        from apps.products.services.action_search_service import ActionSearchService
        source = inspect.getsource(ActionSearchService._get_actions_queryset)
        assert 'channel_compatibility__contains' in source


# ============================================================================
# Sync API Tests (ActionSyncData accepts tool_type)
# ============================================================================


class TestSyncAPIToolType:

    def test_action_sync_data_has_tool_type_field(self):
        from apps.products.views import ActionSyncData
        data = ActionSyncData(
            name='test',
            description='desc',
            type='trigger_action',
            tool_type='server_side',
        )
        assert data.tool_type == 'server_side'

    def test_action_sync_data_tool_type_defaults_to_client_side(self):
        from apps.products.views import ActionSyncData
        data = ActionSyncData(
            name='test',
            description='desc',
            type='trigger_action',
        )
        assert data.tool_type == 'client_side'
