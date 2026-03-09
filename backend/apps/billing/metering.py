"""
Usage metering for Stripe.

Reports completed agent responses to the Stripe Meter API
for usage-based billing.
"""
import logging

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)


async def report_usage(message_id: str) -> None:
    """
    Report a single completed agent response to Stripe's Meter API.

    Looks up the organization from the ChatMessage, skips if the org
    has no Stripe customer (free tier with no billing setup).
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

    if not org.stripe_customer_id or org.plan == "free":
        return

    stripe.api_key = settings.STRIPE_SECRET_KEY
    event_name = settings.STRIPE_METER_EVENT_NAME

    try:
        stripe.billing.MeterEvent.create(
            event_name=event_name,
            payload={
                "stripe_customer_id": org.stripe_customer_id,
                "value": "1",
            },
        )
        logger.debug(
            "Reported usage event for org %s (message %s)",
            org.id, message_id,
        )
    except stripe.StripeError:
        logger.exception(
            "Failed to report usage to Stripe for org %s (message %s)",
            org.id, message_id,
        )
