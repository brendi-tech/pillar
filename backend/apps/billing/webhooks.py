"""
Stripe webhook handler.

Receives Stripe events, verifies signatures, and dispatches to the
appropriate billing service methods.
"""
import logging

import stripe
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.billing import services as billing_service
from apps.users.models import Organization

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def stripe_webhook_view(request):
    """
    Stripe webhook endpoint.

    Verifies the webhook signature and dispatches events to handlers.
    No Django auth — security comes from Stripe signature verification.
    """
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        logger.warning("Invalid webhook payload")
        return HttpResponse(status=400)
    except stripe.SignatureVerificationError:
        logger.warning("Invalid webhook signature")
        return HttpResponse(status=400)

    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info("Received Stripe event: %s (%s)", event_type, event.id)

    handler = EVENT_HANDLERS.get(event_type)
    if handler:
        try:
            handler(data_object, event)
        except Exception:
            logger.exception("Error handling Stripe event %s", event_type)
            return HttpResponse(status=500)
    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)

    return JsonResponse({"status": "ok"})


def _handle_checkout_completed(session, event):
    """Handle checkout.session.completed — activate the new subscription and attach overage."""
    subscription_id = session.get("subscription")
    if not subscription_id:
        return

    stripe.api_key = settings.STRIPE_SECRET_KEY
    subscription = stripe.Subscription.retrieve(subscription_id)
    billing_service.sync_subscription(subscription)

    try:
        billing_service.add_overage_item_to_subscription(subscription_id)
    except Exception:
        logger.exception("Failed to add overage item to subscription %s", subscription_id)


def _handle_subscription_updated(subscription, event):
    """Handle customer.subscription.updated — sync plan/status changes."""
    billing_service.sync_subscription(subscription)


def _handle_subscription_deleted(subscription, event):
    """Handle customer.subscription.deleted — downgrade to free."""
    org_id = subscription.get("metadata", {}).get("organization_id")
    if not org_id:
        logger.warning("Deleted subscription %s has no organization_id", subscription.id)
        return

    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.error("Organization %s not found for deleted subscription", org_id)
        return

    org.plan = "free"
    org.subscription_status = "canceled"
    org.stripe_subscription_id = None
    org.stripe_price_id = None
    org.save(update_fields=[
        "plan", "subscription_status",
        "stripe_subscription_id", "stripe_price_id",
        "updated_at",
    ])
    logger.info("Downgraded org %s to free after subscription deletion", org.id)


def _handle_invoice_payment_failed(invoice, event):
    """Handle invoice.payment_failed — mark subscription as past_due."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    try:
        org = Organization.objects.get(stripe_customer_id=customer_id)
    except Organization.DoesNotExist:
        logger.warning("No org found for customer %s on payment failure", customer_id)
        return

    org.subscription_status = "past_due"
    org.save(update_fields=["subscription_status", "updated_at"])
    logger.info("Marked org %s as past_due after payment failure", org.id)


def _handle_invoice_payment_succeeded(invoice, event):
    """Handle invoice.payment_succeeded — ensure status is active, notify Slack."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    try:
        org = Organization.objects.get(stripe_customer_id=customer_id)
    except Organization.DoesNotExist:
        return

    update_fields = ["updated_at"]
    was_past_due = org.subscription_status == "past_due"

    if was_past_due:
        org.subscription_status = "active"
        update_fields.append("subscription_status")
        logger.info("Restored org %s to active after successful payment", org.id)

    if org.usage_alert_last_threshold is not None:
        org.usage_alert_last_threshold = None
        update_fields.append("usage_alert_last_threshold")
        logger.info("Reset usage alert threshold for org %s on new billing period", org.id)

    if len(update_fields) > 1:
        org.save(update_fields=update_fields)

    # Notify Slack of successful payment
    amount_paid = invoice.get("amount_paid", 0)
    if amount_paid > 0:
        from common.services import slack

        slack.notify_payment_completed(
            organization_name=org.name,
            plan=org.plan,
            amount=amount_paid,
            currency=invoice.get("currency", "usd"),
            customer_email=invoice.get("customer_email", ""),
            invoice_url=invoice.get("hosted_invoice_url", ""),
            is_recurring=not was_past_due,
        )


EVENT_HANDLERS = {
    "checkout.session.completed": _handle_checkout_completed,
    "customer.subscription.updated": _handle_subscription_updated,
    "customer.subscription.deleted": _handle_subscription_deleted,
    "invoice.payment_failed": _handle_invoice_payment_failed,
    "invoice.payment_succeeded": _handle_invoice_payment_succeeded,
}
