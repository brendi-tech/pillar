"""
Tests for prompt context formatting functions.

Tests build_environment_context() and build_capabilities_summary().
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.prompts.environment_context import build_environment_context
from apps.mcp.services.prompts.capabilities import (
    build_capabilities_summary,
    invalidate_capabilities_cache,
    CAPABILITIES_CACHE_TTL,
)


class TestBuildEnvironmentContext:
    """Tests for build_environment_context()."""
    
    def test_returns_empty_string_when_no_context(self):
        """Returns empty string when all inputs are None/empty."""
        result = build_environment_context()
        assert result == ""
        
        result = build_environment_context(sdk_context=None, user_profile=None, page_url=None)
        assert result == ""
    
    def test_includes_current_page(self):
        """Includes currentPage from SDK context."""
        result = build_environment_context(
            sdk_context={"currentPage": "/settings/billing"}
        )
        assert "<<user_environment>>" in result
        assert "<current_page>/settings/billing</current_page>" in result
        assert "<</user_environment>>" in result
    
    def test_includes_current_feature(self):
        """Includes currentFeature from SDK context."""
        result = build_environment_context(
            sdk_context={"currentFeature": "Billing Settings"}
        )
        assert "<current_feature>Billing Settings</current_feature>" in result
    
    def test_includes_user_state(self):
        """Includes userState from SDK context."""
        result = build_environment_context(
            sdk_context={"userState": "onboarding"}
        )
        assert "<user_state>onboarding</user_state>" in result
    
    def test_includes_error_state(self):
        """Includes errorState with code and message."""
        result = build_environment_context(
            sdk_context={
                "errorState": {
                    "code": "PAYMENT_FAILED",
                    "message": "Your card was declined"
                }
            }
        )
        assert '<error_state code="PAYMENT_FAILED">Your card was declined</error_state>' in result
    
    def test_includes_recent_actions(self):
        """Includes recentActions from SDK context."""
        result = build_environment_context(
            sdk_context={
                "recentActions": ["view_dashboard", "open_settings", "view_billing"]
            }
        )
        assert "<recent_actions>view_dashboard, open_settings, view_billing</recent_actions>" in result
    
    def test_limits_recent_actions_to_five(self):
        """Only includes last 5 recent actions."""
        result = build_environment_context(
            sdk_context={
                "recentActions": ["a1", "a2", "a3", "a4", "a5", "a6", "a7"]
            }
        )
        # Should only have the last 5
        assert "<recent_actions>a3, a4, a5, a6, a7</recent_actions>" in result
    
    def test_includes_custom_fields(self):
        """Includes custom fields from SDK context."""
        result = build_environment_context(
            sdk_context={
                "custom": {
                    "accountId": "acc_123",
                    "planType": "enterprise"
                }
            }
        )
        assert "<custom_accountId>acc_123</custom_accountId>" in result
        assert "<custom_planType>enterprise</custom_planType>" in result
    
    def test_limits_custom_fields_to_five(self):
        """Only includes up to 5 custom fields."""
        result = build_environment_context(
            sdk_context={
                "custom": {f"field{i}": f"value{i}" for i in range(10)}
            }
        )
        # Count custom_ tags
        custom_count = result.count("<custom_")
        assert custom_count == 5
    
    def test_uses_page_url_as_fallback(self):
        """Uses page_url when currentPage not in SDK context."""
        result = build_environment_context(
            page_url="https://app.example.com/settings"
        )
        assert "<page_url>https://app.example.com/settings</page_url>" in result
    
    def test_prefers_current_page_over_page_url(self):
        """Prefers currentPage from SDK over page_url header."""
        result = build_environment_context(
            sdk_context={"currentPage": "/settings"},
            page_url="https://app.example.com/settings"
        )
        assert "<current_page>/settings</current_page>" in result
        assert "<page_url>" not in result
    
    def test_includes_user_profile_name(self):
        """Includes name from user profile."""
        result = build_environment_context(
            user_profile={"name": "John Doe"}
        )
        assert "<user_name>John Doe</user_name>" in result
    
    def test_includes_user_profile_role(self):
        """Includes role from user profile."""
        result = build_environment_context(
            user_profile={"role": "admin"}
        )
        assert "<user_role>admin</user_role>" in result
    
    def test_includes_account_type(self):
        """Includes accountType from user profile."""
        result = build_environment_context(
            user_profile={"accountType": "enterprise"}
        )
        assert "<account_type>enterprise</account_type>" in result
    
    def test_includes_experience_level(self):
        """Includes experienceLevel from user profile."""
        result = build_environment_context(
            user_profile={"experienceLevel": "beginner"}
        )
        assert "<experience_level>beginner</experience_level>" in result
    
    def test_falls_back_to_sdk_user_role(self):
        """Falls back to userRole from SDK context when no profile."""
        result = build_environment_context(
            sdk_context={"userRole": "member"}
        )
        assert "<user_role>member</user_role>" in result
    
    def test_combines_all_context_sources(self):
        """Combines SDK context, user profile, and page URL."""
        result = build_environment_context(
            sdk_context={
                "currentPage": "/billing",
                "currentFeature": "Billing",
                "userState": "active"
            },
            user_profile={
                "name": "Jane",
                "role": "admin"
            }
        )
        assert "<current_page>/billing</current_page>" in result
        assert "<current_feature>Billing</current_feature>" in result
        assert "<user_state>active</user_state>" in result
        assert "<user_name>Jane</user_name>" in result
        assert "<user_role>admin</user_role>" in result


def make_async_iterable(items):
    """Helper to create an async iterable mock from a list of items."""
    class AsyncIterableMock:
        def __init__(self, data):
            self._data = data
        
        def __aiter__(self):
            return self
        
        async def __anext__(self):
            if not self._data:
                raise StopAsyncIteration
            return self._data.pop(0)
        
        def values(self, *args, **kwargs):
            # Return self to allow chaining .values()
            return self
    
    return AsyncIterableMock(list(items))


class TestBuildCapabilitiesSummary:
    """Tests for build_capabilities_summary()."""
    
    @pytest.mark.asyncio
    async def test_returns_empty_for_no_actions(self):
        """Returns empty string when product has no actions."""
        mock_product = MagicMock()
        mock_product.id = "test-product-id"
        
        with patch('apps.mcp.services.prompts.capabilities.cache') as mock_cache:
            mock_cache.get.return_value = None
            
            with patch('apps.products.models.Action.objects') as mock_actions, \
                 patch('apps.tools.models.RegisteredSkill.objects') as mock_skills:
                mock_actions.filter.return_value = make_async_iterable([])
                mock_skill_qs = make_async_iterable([])
                mock_skills.filter.return_value.values_list.return_value = mock_skill_qs
                
                result = await build_capabilities_summary(mock_product)
                
                assert result == ""
    
    @pytest.mark.asyncio
    async def test_uses_cached_result(self):
        """Returns cached result when available."""
        mock_product = MagicMock()
        mock_product.id = "test-product-id"
        
        cached_summary = "<<available_capabilities>>\n<total_actions>5</total_actions>\n<</available_capabilities>>\n"
        
        with patch('apps.mcp.services.prompts.capabilities.cache') as mock_cache:
            mock_cache.get.return_value = cached_summary
            
            result = await build_capabilities_summary(mock_product)
            
            assert result == cached_summary
            mock_cache.get.assert_called_once_with("capabilities_summary_test-product-id")
    
    @pytest.mark.asyncio
    async def test_groups_actions_by_type(self):
        """Groups actions by type in the summary."""
        mock_product = MagicMock()
        mock_product.id = "test-product-id"
        
        mock_actions_data = [
            {"name": "open_settings", "description": "Open settings", "action_type": "navigation", "required_context": None},
            {"name": "go_to_billing", "description": "Go to billing", "action_type": "navigation", "required_context": None},
            {"name": "invite_user", "description": "Invite a user", "action_type": "trigger", "required_context": None},
            {"name": "list_orders", "description": "List orders", "action_type": "query", "required_context": None},
        ]
        
        with patch('apps.mcp.services.prompts.capabilities.cache') as mock_cache:
            mock_cache.get.return_value = None
            
            with patch('apps.products.models.Action.objects') as mock_action_model, \
                 patch('apps.tools.models.RegisteredSkill.objects') as mock_skills:
                mock_action_model.filter.return_value = make_async_iterable(mock_actions_data)
                mock_skills.filter.return_value.values_list.return_value = make_async_iterable([])
                
                result = await build_capabilities_summary(mock_product)
                
                assert "<<available_capabilities>>" in result
                assert "<navigation_tools>open_settings, go_to_billing</navigation_tools>" in result
                assert "<trigger_tools>invite_user</trigger_tools>" in result
                assert "<query_tools>list_orders</query_tools>" in result
                assert "<total_tools>4</total_tools>" in result
    
    @pytest.mark.asyncio
    async def test_notes_restricted_actions(self):
        """Notes count of actions with required_context."""
        mock_product = MagicMock()
        mock_product.id = "test-product-id"
        
        mock_actions_data = [
            {"name": "admin_action", "description": "Admin only", "action_type": "trigger", "required_context": {"userRole": "admin"}},
            {"name": "public_action", "description": "Public", "action_type": "trigger", "required_context": None},
        ]
        
        with patch('apps.mcp.services.prompts.capabilities.cache') as mock_cache:
            mock_cache.get.return_value = None
            
            with patch('apps.products.models.Action.objects') as mock_action_model, \
                 patch('apps.tools.models.RegisteredSkill.objects') as mock_skills:
                mock_action_model.filter.return_value = make_async_iterable(mock_actions_data)
                mock_skills.filter.return_value.values_list.return_value = make_async_iterable([])
                
                result = await build_capabilities_summary(mock_product)
                
                assert "<note>1 tools require specific user roles/contexts</note>" in result


class TestInvalidateCapabilitiesCache:
    """Tests for invalidate_capabilities_cache()."""
    
    def test_deletes_cache_key(self):
        """Deletes the correct cache key."""
        with patch('apps.mcp.services.prompts.capabilities.cache') as mock_cache:
            invalidate_capabilities_cache("product-123")
            
            mock_cache.delete.assert_called_once_with("capabilities_summary_product-123")
