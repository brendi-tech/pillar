"""
Usage metering for Stripe.

Reports completed agent responses to the Stripe Meter API
for usage-based billing. Bonus responses are skipped so the
org is not charged PAYG for them.
"""
import logging
from datetime import datetime, timezone as tz

import stripe
from asgiref.sync import sync_to_async
from django.conf import settings

from apps.billing.constants import aget_weighted_usage, get_billing_weight, get_plan_limits

logger = logging.getLogger(__name__)


async def report_usage(message_id: str) -> None:
    """
    Report a single completed agent response to Stripe's Meter API.

    Looks up the organization from the ChatMessage, skips if the org
    has no Stripe customer (free tier with no billing setup).
    Skips the Stripe meter event when the response falls within the
    org's bonus range so bonus responses are truly free.
    """
    from apps.analytics.models import ChatMessage

    try:
        message = await ChatMessage.objects.select_related("organization").aget(id=message_id)
    except ChatMessage.DoesNotExist:
        logger.warning("ChatMessage %s not found for metering", message_id)
        return

    org = message.organization
    if not org:
        return

    # Check usage thresholds for all plans (including free)
    from apps.billing.notifications import check_and_notify_threshold

    try:
        await check_and_notify_threshold(org, message_id)
    except Exception:
        logger.exception("Failed threshold check for org %s", org.id)

    if not org.stripe_customer_id or org.plan in ("free", "enterprise"):
        return

    weight = get_billing_weight(message.total_tokens)

    if weight == 0:
        logger.debug(
            "Skipping meter event for simple response (message %s, %s tokens)",
            message_id,
            message.total_tokens,
        )
        return

    # Skip Stripe meter event for responses in the bonus range
    bonus = await sync_to_async(lambda: org.active_bonus_responses)()
    if bonus > 0:
        plan_limit = get_plan_limits(org.plan).monthly_responses
        if plan_limit is not None:
            now = datetime.now(tz.utc)
            period_start = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0,
            )
            used = await aget_weighted_usage(
                ChatMessage.objects.filter(
                    organization=org,
                    role="assistant",
                    streaming_status="completed",
                    created_at__gte=period_start,
                )
            )
            if plan_limit < used <= plan_limit + bonus:
                logger.info(
                    "Bonus response for org %s (%d/%d bonus used)",
                    org.id,
                    used - plan_limit,
                    bonus,
                )
                return

    stripe.api_key = settings.STRIPE_SECRET_KEY
    event_name = settings.STRIPE_METER_EVENT_NAME

    try:
        stripe.billing.MeterEvent.create(
            event_name=event_name,
            payload={
                "stripe_customer_id": org.stripe_customer_id,
                "value": str(weight),
            },
        )
        logger.debug(
            "Reported usage event for org %s (message %s, weight=%d, tokens=%s)",
            org.id, message_id, weight, message.total_tokens,
        )
    except stripe.StripeError:
        logger.exception(
            "Failed to report usage to Stripe for org %s (message %s)",
            org.id, message_id,
        )
