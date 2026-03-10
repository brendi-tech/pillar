"""
Pure-logic tests for billing plan limits and constants.

No mocks, no Stripe — just verifying the dataclass and helper functions.
"""
from decimal import Decimal

import pytest

from apps.billing.constants import (
    PLAN_LIMITS,
    PlanLimits,
    get_monthly_limit,
    get_payg_rate,
    get_plan_limits,
)

ALL_PLANS = ["free", "hobby", "pro", "growth", "enterprise"]


class TestPlanLimits:
    """Verify PlanLimits dataclass properties."""

    def test_has_payg_true_when_rate_set(self):
        pl = PlanLimits(monthly_responses=100, is_one_time=False, payg_rate=Decimal("0.25"))
        assert pl.has_payg is True

    def test_has_payg_false_when_rate_none(self):
        pl = PlanLimits(monthly_responses=100, is_one_time=False, payg_rate=None)
        assert pl.has_payg is False

    def test_frozen(self):
        pl = PlanLimits(monthly_responses=100, is_one_time=False, payg_rate=None)
        with pytest.raises(AttributeError):
            pl.monthly_responses = 200


class TestGetPlanLimits:
    """Verify get_plan_limits returns correct objects for every tier."""

    @pytest.mark.parametrize("plan", ALL_PLANS)
    def test_returns_plan_limits_instance(self, plan):
        result = get_plan_limits(plan)
        assert isinstance(result, PlanLimits)

    def test_unknown_plan_raises_key_error(self):
        with pytest.raises(KeyError):
            get_plan_limits("nonexistent")

    def test_free_tier_values(self):
        pl = get_plan_limits("free")
        assert pl.monthly_responses == 50
        assert pl.is_one_time is True
        assert pl.payg_rate is None
        assert pl.has_payg is False

    def test_hobby_values(self):
        pl = get_plan_limits("hobby")
        assert pl.monthly_responses == 150
        assert pl.is_one_time is False
        assert pl.payg_rate == Decimal("0.25")

    def test_pro_values(self):
        pl = get_plan_limits("pro")
        assert pl.monthly_responses == 500
        assert pl.is_one_time is False
        assert pl.payg_rate == Decimal("0.20")

    def test_growth_values(self):
        pl = get_plan_limits("growth")
        assert pl.monthly_responses == 1500
        assert pl.is_one_time is False
        assert pl.payg_rate == Decimal("0.15")

    def test_enterprise_unlimited(self):
        pl = get_plan_limits("enterprise")
        assert pl.monthly_responses is None
        assert pl.is_one_time is False
        assert pl.payg_rate is None


class TestGetMonthlyLimit:
    @pytest.mark.parametrize(
        "plan, expected",
        [("free", 50), ("hobby", 150), ("pro", 500), ("growth", 1500), ("enterprise", None)],
    )
    def test_returns_expected_limit(self, plan, expected):
        assert get_monthly_limit(plan) == expected


class TestGetPaygRate:
    @pytest.mark.parametrize(
        "plan, expected",
        [
            ("free", None),
            ("hobby", Decimal("0.25")),
            ("pro", Decimal("0.20")),
            ("growth", Decimal("0.15")),
            ("enterprise", None),
        ],
    )
    def test_returns_expected_rate(self, plan, expected):
        assert get_payg_rate(plan) == expected


class TestPlanLimitsRegistry:
    """Structural checks on the PLAN_LIMITS dict itself."""

    def test_all_five_plans_present(self):
        assert set(PLAN_LIMITS.keys()) == set(ALL_PLANS)

    def test_paid_plans_are_not_one_time(self):
        for plan in ["hobby", "pro", "growth", "enterprise"]:
            assert PLAN_LIMITS[plan].is_one_time is False

    def test_payg_rates_decrease_with_tier(self):
        hobby = PLAN_LIMITS["hobby"].payg_rate
        pro = PLAN_LIMITS["pro"].payg_rate
        growth = PLAN_LIMITS["growth"].payg_rate
        assert hobby > pro > growth
