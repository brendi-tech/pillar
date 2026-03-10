"""
Early Adopter Bonus workflow.

Daily cron that grants 100 bonus responses to paid orgs in their first
two months that have hit >= 140 weighted responses in the current billing
period. Each org receives this grant at most once (deduplicated by memo).
"""

import logging
from datetime import datetime, timedelta, timezone as tz

from hatchet_sdk import Context

from common.hatchet_client import task_with_conditional_cron

logger = logging.getLogger(__name__)

EARLY_ADOPTER_MEMO = "Early adopter bonus"
USAGE_THRESHOLD = 140
BONUS_AMOUNT = 100
BONUS_DURATION_DAYS = 30
MAX_ORG_AGE_DAYS = 60
ELIGIBLE_PLANS = ["hobby", "pro", "growth"]


@task_with_conditional_cron(
    name="early-adopter-bonus",
    on_crons=["0 9 * * *"],
    retries=1,
    execution_timeout=timedelta(minutes=10),
)
def early_adopter_bonus_workflow(workflow_input: dict, context: Context) -> dict:
    """Grant bonus responses to early, active paid orgs."""
    from apps.analytics.models import ChatMessage
    from apps.billing.constants import get_weighted_usage
    from apps.billing.models import BonusResponseGrant
    from apps.billing.notifications import send_early_adopter_bonus_email
    from apps.users.models import Organization

    now = datetime.now(tz.utc)
    cutoff = now - timedelta(days=MAX_ORG_AGE_DAYS)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    candidates = Organization.objects.filter(
        plan__in=ELIGIBLE_PLANS,
        created_at__gte=cutoff,
    )

    already_granted = set(
        BonusResponseGrant.objects.filter(
            memo=EARLY_ADOPTER_MEMO,
        ).values_list("organization_id", flat=True)
    )

    granted_count = 0
    skipped_count = 0

    for org in candidates.iterator():
        if org.id in already_granted:
            skipped_count += 1
            continue

        usage = get_weighted_usage(
            ChatMessage.objects.filter(
                organization=org,
                role="assistant",
                streaming_status="completed",
                created_at__gte=period_start,
            )
        )

        if usage < USAGE_THRESHOLD:
            skipped_count += 1
            continue

        expires_at = now + timedelta(days=BONUS_DURATION_DAYS)
        BonusResponseGrant.objects.create(
            organization=org,
            amount=BONUS_AMOUNT,
            expires_at=expires_at,
            memo=EARLY_ADOPTER_MEMO,
        )

        try:
            send_early_adopter_bonus_email(org, BONUS_AMOUNT, expires_at)
        except Exception:
            logger.exception(
                "Failed to send early adopter bonus email for org %s", org.id
            )

        granted_count += 1
        context.log(
            f"Granted {BONUS_AMOUNT} bonus responses to '{org.name}' "
            f"(usage={usage}, expires={expires_at.strftime('%Y-%m-%d')})"
        )

    context.log(
        f"Early adopter bonus complete: {granted_count} granted, "
        f"{skipped_count} skipped"
    )

    return {"granted": granted_count, "skipped": skipped_count}
