"""
Plan limits and pricing constants.

This module defines the limits and pricing for each subscription plan.
These constants are used for usage tracking, enforcement, and billing.
"""
import math
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
        monthly_responses=150,
        is_one_time=False,
        payg_rate=Decimal("0.25"),
    ),
    "pro": PlanLimits(
        monthly_responses=500,
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


def get_effective_limit(org) -> int | None:
    """
    Get the effective response limit for an org, including bonus grants.

    Returns plan_limit + active bonus, or None for unlimited (enterprise).
    """
    base = get_plan_limits(org.plan).monthly_responses
    if base is None:
        return None
    return base + org.active_bonus_responses


PLAN_ORDER: list[str] = ["free", "hobby", "pro", "growth", "enterprise"]


def is_downgrade(current_plan: str, target_plan: str) -> bool:
    """Check whether switching from current_plan to target_plan is a downgrade."""
    return PLAN_ORDER.index(target_plan) < PLAN_ORDER.index(current_plan)


# ---------------------------------------------------------------------------
# Weighted response metering
# ---------------------------------------------------------------------------

SIMPLE_RESPONSE_TOKEN_THRESHOLD = 5_000
RESPONSE_TOKEN_UNIT = 50_000


def get_billing_weight(total_tokens: int | None) -> int:
    """
    Compute how many billing units a single response costs.

    - Under 5K tokens: 0 (free, trivial response)
    - 5K–50K tokens: 1 (standard response)
    - Over 50K tokens: ceil(total_tokens / 50K), scaling proportionally
    - None (unknown): 1 (safe default)
    """
    if total_tokens is None:
        return 1
    if total_tokens < SIMPLE_RESPONSE_TOKEN_THRESHOLD:
        return 0
    return max(1, math.ceil(total_tokens / RESPONSE_TOKEN_UNIT))


def get_weighted_usage(queryset) -> int:
    """
    Compute weighted response count from a ChatMessage queryset (sync).

    Each row contributes its billing weight to the sum:
    0 for simple, 1 for standard, ceil(tokens/50K) for heavy.
    """
    from django.db.models import Case, F, FloatField, IntegerField, Sum, Value, When
    from django.db.models.functions import Cast, Ceil, Greatest

    result = queryset.aggregate(
        weighted=Sum(
            Case(
                When(total_tokens__isnull=True, then=Value(1)),
                When(total_tokens__lt=SIMPLE_RESPONSE_TOKEN_THRESHOLD, then=Value(0)),
                default=Greatest(
                    Value(1),
                    Ceil(Cast(F("total_tokens"), FloatField()) / Value(RESPONSE_TOKEN_UNIT)),
                ),
                output_field=IntegerField(),
            )
        )
    )
    return result["weighted"] or 0


async def aget_weighted_usage(queryset) -> int:
    """Async variant of get_weighted_usage."""
    from asgiref.sync import sync_to_async

    return await sync_to_async(get_weighted_usage)(queryset)
