"""
Tests for billing enforcement (check_usage_allowed).

Usage counts are controlled via mock patching of aget_weighted_usage.
"""
import pytest
from unittest.mock import patch, AsyncMock
from asgiref.sync import sync_to_async

from apps.billing.enforcement import check_usage_allowed
from apps.users.models import Organization
from common.exceptions import PlanLimitExceeded


@pytest.fixture
def enterprise_org(db):
    return Organization.objects.create(
        name="Enterprise Org",
        plan="enterprise",
        subscription_status="active",
    )


class TestCheckUsageAllowed:
    @pytest.mark.asyncio
    async def test_none_org_passes(self):
        await check_usage_allowed(None)

    @pytest.mark.asyncio
    async def test_enterprise_unlimited(self, enterprise_org):
        await check_usage_allowed(enterprise_org)

    @pytest.mark.asyncio
    async def test_paid_plan_active_with_payg_passes(self, org_with_stripe):
        """Pro plan with active subscription always passes (PAYG covers overage)."""
        await check_usage_allowed(org_with_stripe)

    @pytest.mark.asyncio
    async def test_paid_plan_trialing_passes(self, db):
        org = await sync_to_async(Organization.objects.create)(
            name="Trialing Org",
            plan="pro",
            subscription_status="trialing",
        )
        await check_usage_allowed(org)

    @pytest.mark.asyncio
    async def test_paid_plan_inactive_subscription_raises(self, db):
        org = await sync_to_async(Organization.objects.create)(
            name="Inactive Org",
            plan="pro",
            subscription_status="past_due",
        )
        with pytest.raises(PlanLimitExceeded) as exc_info:
            await check_usage_allowed(org)
        assert exc_info.value.limit_type == "subscription_status"

    @pytest.mark.asyncio
    async def test_paid_plan_canceled_raises(self, db):
        org = await sync_to_async(Organization.objects.create)(
            name="Canceled Org",
            plan="hobby",
            subscription_status="canceled",
        )
        with pytest.raises(PlanLimitExceeded):
            await check_usage_allowed(org)

    @pytest.mark.asyncio
    async def test_free_tier_under_limit_passes(self, org_free):
        """Free tier with 0 messages used (well under 50 limit) passes."""
        await check_usage_allowed(org_free)

    @pytest.mark.asyncio
    @patch("apps.billing.enforcement.aget_weighted_usage", new_callable=AsyncMock, return_value=50)
    @patch("apps.billing.enforcement.get_effective_limit", return_value=50)
    async def test_free_tier_at_limit_raises(self, mock_limit, mock_usage, org_free):
        """Free tier at the 50-message lifetime limit raises."""
        with pytest.raises(PlanLimitExceeded) as exc_info:
            await check_usage_allowed(org_free)

        assert exc_info.value.limit_type == "responses"
        assert exc_info.value.current_value == 50
        assert exc_info.value.max_value == 50

    @pytest.mark.asyncio
    @patch("apps.billing.enforcement.aget_weighted_usage", new_callable=AsyncMock, return_value=100)
    @patch("apps.billing.enforcement.get_effective_limit", return_value=50)
    async def test_free_tier_over_limit_raises(self, mock_limit, mock_usage, org_free):
        with pytest.raises(PlanLimitExceeded):
            await check_usage_allowed(org_free)

    @pytest.mark.asyncio
    @patch("apps.billing.enforcement.aget_weighted_usage", new_callable=AsyncMock, return_value=50)
    @patch("apps.billing.enforcement.get_effective_limit", return_value=50)
    async def test_free_tier_message_includes_plan_name(self, mock_limit, mock_usage, org_free):
        with pytest.raises(PlanLimitExceeded) as exc_info:
            await check_usage_allowed(org_free)

        assert "Free" in exc_info.value.message
        assert "lifetime" in exc_info.value.message
