"""
Plan limits and pricing constants.

This module defines the limits and pricing for each subscription plan.
These constants are used for usage tracking, enforcement, and billing.
"""
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PlanLimits:
    """Configuration for a subscription plan."""

    monthly_responses: int | None  # None = unlimited (enterprise)
    is_one_time: bool  # True for free tier (lifetime limit, not monthly)
    payg_rate: Decimal | None  # Pay As You Go rate per response (None = not available)

    @property
    def has_payg(self) -> bool:
        """Check if this plan supports Pay As You Go."""
        return self.payg_rate is not None


# Plan configuration
# Note: These match the plan choices in apps.users.models.Organization
PLAN_LIMITS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        monthly_responses=50,
        is_one_time=True,  # 50 responses total, not per month
        payg_rate=None,  # No PAYG for free tier
    ),
    "hobby": PlanLimits(
        monthly_responses=100,
        is_one_time=False,
        payg_rate=Decimal("0.25"),
    ),
    "pro": PlanLimits(
        monthly_responses=400,
        is_one_time=False,
        payg_rate=Decimal("0.20"),
    ),
    "growth": PlanLimits(
        monthly_responses=1500,
        is_one_time=False,
        payg_rate=Decimal("0.15"),
    ),
    "enterprise": PlanLimits(
        monthly_responses=None,  # Unlimited / custom
        is_one_time=False,
        payg_rate=None,  # Custom pricing negotiated
    ),
}


def get_plan_limits(plan: str) -> PlanLimits:
    """
    Get the limits for a given plan.

    Args:
        plan: The plan name (free, hobby, pro, growth, enterprise)

    Returns:
        PlanLimits for the specified plan

    Raises:
        KeyError: If the plan name is not recognized
    """
    return PLAN_LIMITS[plan]


def get_monthly_limit(plan: str) -> int | None:
    """
    Get the monthly response limit for a plan.

    For the free tier (is_one_time=True), this returns the lifetime limit.

    Args:
        plan: The plan name

    Returns:
        The number of responses included, or None for unlimited
    """
    return PLAN_LIMITS[plan].monthly_responses


def get_payg_rate(plan: str) -> Decimal | None:
    """
    Get the Pay As You Go rate for a plan.

    Args:
        plan: The plan name

    Returns:
        The rate per response in dollars, or None if PAYG not available
    """
    return PLAN_LIMITS[plan].payg_rate


PLAN_ORDER: list[str] = ["free", "hobby", "pro", "growth", "enterprise"]


def is_downgrade(current_plan: str, target_plan: str) -> bool:
    """Check whether switching from current_plan to target_plan is a downgrade."""
    return PLAN_ORDER.index(target_plan) < PLAN_ORDER.index(current_plan)
