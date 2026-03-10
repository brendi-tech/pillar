"""
Plan enforcement for billing.

Checks whether an organization has remaining usage quota
before allowing an agent response.
"""
import logging
from datetime import datetime, timezone as tz

from asgiref.sync import sync_to_async

from apps.billing.constants import aget_weighted_usage, get_effective_limit, get_plan_limits
from common.exceptions import PlanLimitExceeded

logger = logging.getLogger(__name__)


async def check_usage_allowed(org) -> None:
    """
    Check if the organization is allowed to make another agent request.

    Raises PlanLimitExceeded if the free tier is exhausted or
    if the subscription is not active on a paid plan.
    Does nothing for paid plans within or over limit (PAYG covers overage).
    """
    from apps.analytics.models import ChatMessage

    if not org:
        return

    plan_limits = get_plan_limits(org.plan)

    # Enterprise has unlimited usage
    if plan_limits.monthly_responses is None:
        return

    # Paid plans with PAYG: allow even if over limit (Stripe meters overage)
    if plan_limits.has_payg and org.subscription_status in ("active", "trialing"):
        return

    # Paid plans without active subscription shouldn't get through,
    # but if they do, block them
    if org.plan != "free" and org.subscription_status not in ("active", "trialing"):
        raise PlanLimitExceeded(
            message="Your subscription is not active. Please update your billing to continue.",
            limit_type="subscription_status",
            current_value=0,
            max_value=0,
        )

    # Free tier: lifetime limit
    base_filter = {
        "organization": org,
        "role": "assistant",
        "streaming_status": "completed",
    }

    if plan_limits.is_one_time:
        used = await aget_weighted_usage(ChatMessage.objects.filter(**base_filter))
    else:
        now = datetime.now(tz.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = await aget_weighted_usage(
            ChatMessage.objects.filter(
                **base_filter,
                created_at__gte=period_start,
            )
        )

    limit = await sync_to_async(get_effective_limit)(org)
    if used >= limit:
        raise PlanLimitExceeded(
            message=(
                f"You've used all {limit} {'lifetime' if plan_limits.is_one_time else 'monthly'} "
                f"responses on the {org.plan.title()} plan. Upgrade to continue."
            ),
            limit_type="responses",
            current_value=used,
            max_value=limit,
        )
