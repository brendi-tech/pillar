"""
Free Tier Early Adopter Bonus workflow.

Daily cron that grants 10 bonus responses to free-tier orgs in their first
two months that have hit >= 40 weighted responses lifetime. Each org
receives this grant at most once (deduplicated by memo).
"""

import logging
from datetime import datetime, timedelta, timezone as tz

from hatchet_sdk import Context

from common.hatchet_client import task_with_conditional_cron

logger = logging.getLogger(__name__)

FREE_TIER_EARLY_ADOPTER_MEMO = "Free tier early adopter bonus"
FREE_TIER_USAGE_THRESHOLD = 40
FREE_TIER_BONUS_AMOUNT = 10
BONUS_DURATION_DAYS = 30
MAX_ORG_AGE_DAYS = 60


@task_with_conditional_cron(
    name="free-tier-early-adopter-bonus",
    on_crons=["0 9 * * *"],
    retries=1,
    execution_timeout=timedelta(minutes=10),
)
def free_tier_early_adopter_bonus_workflow(
    workflow_input: dict, context: Context
) -> dict:
    """Grant bonus responses to early, active free-tier orgs."""
    from apps.analytics.models import ChatMessage
    from apps.billing.constants import get_weighted_usage
    from apps.billing.models import BonusResponseGrant
    from apps.billing.notifications import send_free_tier_early_adopter_bonus_email
    from apps.users.models import Organization

    now = datetime.now(tz.utc)
    cutoff = now - timedelta(days=MAX_ORG_AGE_DAYS)

    candidates = Organization.objects.filter(
        plan="free",
        created_at__gte=cutoff,
    )

    already_granted = set(
        BonusResponseGrant.objects.filter(
            memo=FREE_TIER_EARLY_ADOPTER_MEMO,
        ).values_list("organization_id", flat=True)
    )

    granted_count = 0
    skipped_count = 0

    for org in candidates.iterator():
        if org.id in already_granted:
            skipped_count += 1
            continue

        # Free tier is lifetime (is_one_time), so count all-time usage
        usage = get_weighted_usage(
            ChatMessage.objects.filter(
                organization=org,
                role="assistant",
                streaming_status="completed",
            )
        )

        if usage < FREE_TIER_USAGE_THRESHOLD:
            skipped_count += 1
            continue

        expires_at = now + timedelta(days=BONUS_DURATION_DAYS)
        BonusResponseGrant.objects.create(
            organization=org,
            amount=FREE_TIER_BONUS_AMOUNT,
            expires_at=expires_at,
            memo=FREE_TIER_EARLY_ADOPTER_MEMO,
        )

        try:
            send_free_tier_early_adopter_bonus_email(org, FREE_TIER_BONUS_AMOUNT, expires_at)
        except Exception:
            logger.exception(
                "Failed to send free tier early adopter bonus email for org %s", org.id
            )

        granted_count += 1
        context.log(
            f"Granted {FREE_TIER_BONUS_AMOUNT} bonus responses to '{org.name}' "
            f"(usage={usage}, expires={expires_at.strftime('%Y-%m-%d')})"
        )

    context.log(
        f"Free tier early adopter bonus complete: {granted_count} granted, "
        f"{skipped_count} skipped"
    )

    return {"granted": granted_count, "skipped": skipped_count}
