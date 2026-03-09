"""
Billing service for Stripe integration.

Handles customer management, checkout sessions, portal sessions,
and subscription synchronization with Stripe.
"""
import logging

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)

PRICE_ID_TO_PLAN: dict[str, str] = {}


def _init_stripe() -> None:
    """Configure the stripe module with the secret key."""
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _build_price_id_to_plan_map() -> dict[str, str]:
    """Build a reverse mapping from Stripe Price ID to plan name."""
    global PRICE_ID_TO_PLAN
    if PRICE_ID_TO_PLAN:
        return PRICE_ID_TO_PLAN
    for key, price_id in settings.STRIPE_PRICE_IDS.items():
        if not price_id:
            continue
        plan_name = key.rsplit("_", 1)[0]  # "hobby_monthly" -> "hobby"
        PRICE_ID_TO_PLAN[price_id] = plan_name
    return PRICE_ID_TO_PLAN


def get_or_create_customer(org) -> str:
    """
    Get or create a Stripe Customer for the given organization.

    Returns the stripe_customer_id.
    """
    _init_stripe()

    if org.stripe_customer_id:
        return org.stripe_customer_id

    customer = stripe.Customer.create(
        name=org.name,
        email=org.billing_email or None,
        metadata={"organization_id": str(org.id)},
    )
    org.stripe_customer_id = customer.id
    org.save(update_fields=["stripe_customer_id", "updated_at"])
    logger.info("Created Stripe customer %s for org %s", customer.id, org.id)
    return customer.id


def _get_overage_price_for_plan(price_id: str) -> str | None:
    """Look up the metered overage price ID that corresponds to a flat-rate price."""
    plan_map = _build_price_id_to_plan_map()
    plan_name = plan_map.get(price_id)
    if not plan_name:
        return None
    return settings.STRIPE_OVERAGE_PRICE_IDS.get(plan_name) or None


def create_checkout_session(
    org,
    price_id: str,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> str:
    """
    Create a Stripe Checkout Session for subscription signup.

    Includes both the flat-rate subscription price and the metered
    overage price so Stripe can bill PAYG usage automatically.

    Returns the checkout session URL.
    """
    _init_stripe()

    customer_id = get_or_create_customer(org)
    frontend_url = settings.FRONTEND_URL

    line_items = [{"price": price_id, "quantity": 1}]

    overage_price_id = _get_overage_price_for_plan(price_id)
    if overage_price_id:
        line_items.append({"price": overage_price_id})

    resolved_success = success_url or f"{frontend_url}/billing?success=true"
    separator = "&" if "?" in resolved_success else "?"
    resolved_success += f"{separator}session_id={{CHECKOUT_SESSION_ID}}"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=line_items,
        success_url=resolved_success,
        cancel_url=cancel_url or f"{frontend_url}/billing?canceled=true",
        metadata={"organization_id": str(org.id)},
        subscription_data={"metadata": {"organization_id": str(org.id)}},
    )
    logger.info("Created checkout session %s for org %s", session.id, org.id)
    return session.url


def create_portal_session(org) -> str:
    """
    Create a Stripe Customer Portal session for self-service management.

    Returns the portal session URL.
    """
    _init_stripe()

    customer_id = get_or_create_customer(org)
    frontend_url = settings.FRONTEND_URL

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{frontend_url}/billing",
    )
    return session.url


def sync_subscription(stripe_subscription: stripe.Subscription) -> None:
    """
    Synchronize a Stripe Subscription with the Organization model.

    Maps Stripe subscription state (plan, status, price) onto the
    Organization record identified by the subscription metadata.
    """
    from apps.users.models import Organization

    org_id = stripe_subscription.metadata.get("organization_id")
    if not org_id:
        logger.warning(
            "Stripe subscription %s has no organization_id in metadata",
            stripe_subscription.id,
        )
        return

    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.error("Organization %s not found for subscription %s", org_id, stripe_subscription.id)
        return

    plan_map = _build_price_id_to_plan_map()
    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())

    price_id = None
    plan = org.plan
    for item in stripe_subscription["items"]["data"]:
        pid = item["price"]["id"]
        if pid in overage_ids:
            continue
        price_id = pid
        plan = plan_map.get(pid, org.plan)
        break

    status_map = {
        "active": "active",
        "trialing": "trialing",
        "past_due": "past_due",
        "canceled": "canceled",
        "paused": "paused",
        "incomplete": "active",
        "incomplete_expired": "canceled",
        "unpaid": "past_due",
    }
    subscription_status = status_map.get(stripe_subscription.status, "active")

    org.plan = plan
    org.subscription_status = subscription_status
    org.stripe_subscription_id = stripe_subscription.id
    org.stripe_price_id = price_id
    org.save(update_fields=[
        "plan", "subscription_status",
        "stripe_subscription_id", "stripe_price_id",
        "updated_at",
    ])
    logger.info(
        "Synced subscription %s -> org %s (plan=%s, status=%s)",
        stripe_subscription.id, org.id, plan, subscription_status,
    )


def cancel_subscription(org) -> None:
    """Cancel the organization's subscription at end of billing period."""
    _init_stripe()

    if not org.stripe_subscription_id:
        logger.warning("Org %s has no subscription to cancel", org.id)
        return

    stripe.Subscription.modify(
        org.stripe_subscription_id,
        cancel_at_period_end=True,
    )
    logger.info("Marked subscription %s for cancellation at period end", org.stripe_subscription_id)


def get_subscription_details(org) -> dict | None:
    """
    Retrieve current subscription details from Stripe.

    Returns a dict with plan info or None if no active subscription.
    """
    _init_stripe()

    if not org.stripe_subscription_id:
        return None

    try:
        sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
    except stripe.StripeError:
        logger.exception("Failed to retrieve subscription %s", org.stripe_subscription_id)
        return None

    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())
    flat_price_id = None
    for item in sub["items"]["data"]:
        pid = item["price"]["id"]
        if pid not in overage_ids:
            flat_price_id = pid
            break

    # Period dates live on the subscription item in newer Stripe API versions
    period_start = None
    period_end = None
    items_data = sub["items"]["data"]
    if items_data:
        first_item = items_data[0]
        period_start = first_item.get("current_period_start")
        period_end = first_item.get("current_period_end")

    return {
        "id": sub.id,
        "status": sub.status,
        "current_period_start": period_start,
        "current_period_end": period_end,
        "cancel_at_period_end": sub.get("cancel_at_period_end"),
        "price_id": flat_price_id,
    }
