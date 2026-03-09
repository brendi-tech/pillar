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


PRICE_ID_TO_KEY: dict[str, str] = {}


def _build_price_id_to_key_map() -> dict[str, str]:
    """Build a reverse mapping from Stripe Price ID to the full settings key (e.g. 'growth_monthly')."""
    global PRICE_ID_TO_KEY
    if PRICE_ID_TO_KEY:
        return PRICE_ID_TO_KEY
    for key, price_id in settings.STRIPE_PRICE_IDS.items():
        if not price_id:
            continue
        PRICE_ID_TO_KEY[price_id] = key
    return PRICE_ID_TO_KEY


def get_billing_interval(stripe_price_id: str | None) -> str | None:
    """Derive 'monthly' or 'yearly' from a Stripe Price ID."""
    if not stripe_price_id:
        return None
    key_map = _build_price_id_to_key_map()
    key = key_map.get(stripe_price_id)
    if not key:
        return None
    if key.endswith("_yearly"):
        return "yearly"
    if key.endswith("_monthly"):
        return "monthly"
    return None


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

    Only the flat-rate subscription price is included in the checkout.
    The metered overage price is added to the subscription after checkout
    completes (in the webhook handler) to avoid Stripe's restriction on
    mixing prices with different billing intervals.

    Returns the checkout session URL.
    """
    _init_stripe()

    customer_id = get_or_create_customer(org)
    admin_url = settings.ADMIN_URL

    line_items = [{"price": price_id, "quantity": 1}]

    resolved_success = success_url or f"{admin_url}/billing?success=true"
    separator = "&" if "?" in resolved_success else "?"
    resolved_success += f"{separator}session_id={{CHECKOUT_SESSION_ID}}"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=line_items,
        success_url=resolved_success,
        cancel_url=cancel_url or f"{admin_url}/billing?canceled=true",
        metadata={"organization_id": str(org.id)},
        subscription_data={"metadata": {"organization_id": str(org.id)}},
    )
    logger.info("Created checkout session %s for org %s", session.id, org.id)
    return session.url


def add_overage_item_to_subscription(subscription_id: str) -> None:
    """
    Add the metered overage price to an existing subscription.

    Called after checkout completes so the customer gets PAYG billing
    without hitting Stripe's mixed-interval restriction in Checkout.
    """
    _init_stripe()

    sub = stripe.Subscription.retrieve(subscription_id)

    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())
    existing_prices = {item["price"]["id"] for item in sub["items"]["data"]}
    if existing_prices & overage_ids:
        logger.debug("Subscription %s already has an overage item", subscription_id)
        return

    flat_price_id = None
    for item in sub["items"]["data"]:
        pid = item["price"]["id"]
        if pid not in overage_ids:
            flat_price_id = pid
            break

    overage_price_id = _get_overage_price_for_plan(flat_price_id) if flat_price_id else None
    if not overage_price_id:
        logger.debug("No overage price configured for subscription %s", subscription_id)
        return

    stripe.Subscription.modify(
        subscription_id,
        items=[
            *[{"id": item["id"]} for item in sub["items"]["data"]],
            {"price": overage_price_id},
        ],
        proration_behavior="none",
    )
    logger.info("Added overage item %s to subscription %s", overage_price_id, subscription_id)


def create_portal_session(org) -> str:
    """
    Create a Stripe Customer Portal session for self-service management.

    Returns the portal session URL.
    """
    _init_stripe()

    customer_id = get_or_create_customer(org)
    admin_url = settings.ADMIN_URL

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{admin_url}/billing",
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


def update_subscription_plan(
    org, new_price_id: str
) -> stripe.Subscription | dict:
    """
    Change an existing subscription to a different price.

    Upgrades are applied immediately with proration.
    Downgrades are scheduled for the end of the billing period via
    Subscription Schedules so the customer keeps their current plan
    until the period ends.

    Returns the updated Stripe Subscription (upgrade) or a dict with
    scheduling info (downgrade).
    """
    from apps.billing.constants import is_downgrade as _is_downgrade

    _init_stripe()

    if not org.stripe_subscription_id:
        raise ValueError("Organization has no active subscription to update")

    plan_map = _build_price_id_to_plan_map()
    target_plan = plan_map.get(new_price_id)
    current_plan = org.plan

    if target_plan and current_plan and _is_downgrade(current_plan, target_plan):
        effective_date = schedule_downgrade(org, new_price_id)
        return {
            "scheduled": True,
            "effective_date": effective_date,
            "plan": target_plan,
        }

    # Upgrade path: apply immediately with proration.
    # If a downgrade was previously scheduled, release it first.
    sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
    if sub.get("schedule"):
        try:
            stripe.SubscriptionSchedule.release(sub["schedule"])
            logger.info("Released schedule %s before upgrade", sub["schedule"])
            sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
        except stripe.StripeError:
            logger.warning("Failed to release schedule %s", sub["schedule"])

    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())

    flat_item_id = None
    overage_item_id = None
    for item in sub["items"]["data"]:
        pid = item["price"]["id"]
        if pid in overage_ids:
            overage_item_id = item["id"]
        else:
            flat_item_id = item["id"]

    if not flat_item_id:
        raise ValueError("Could not find flat-rate item on subscription")

    new_overage_price_id = _get_overage_price_for_plan(new_price_id)

    items: list[dict] = [
        {"id": flat_item_id, "price": new_price_id},
    ]
    if overage_item_id and new_overage_price_id:
        items.append({"id": overage_item_id, "price": new_overage_price_id})
    elif overage_item_id and not new_overage_price_id:
        items.append({"id": overage_item_id, "deleted": True})
    elif not overage_item_id and new_overage_price_id:
        items.append({"price": new_overage_price_id})

    updated_sub = stripe.Subscription.modify(
        org.stripe_subscription_id,
        items=items,
        proration_behavior="create_prorations",
    )
    logger.info(
        "Upgraded subscription %s to price %s for org %s",
        org.stripe_subscription_id, new_price_id, org.id,
    )

    sync_subscription(updated_sub)
    return updated_sub


def schedule_downgrade(org, new_price_id: str) -> int:
    """
    Schedule a plan downgrade at the end of the current billing period
    using Stripe Subscription Schedules.

    Creates a two-phase schedule: current plan until period end, then
    the new (lower) plan ongoing. Stripe handles the transition
    automatically and fires customer.subscription.updated when it happens.

    Returns the effective_date as a unix timestamp (current_period_end).
    """
    _init_stripe()

    if not org.stripe_subscription_id:
        raise ValueError("Organization has no active subscription to downgrade")

    sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())

    current_flat_price = None
    current_overage_price = None
    for item in sub["items"]["data"]:
        pid = item["price"]["id"]
        if pid in overage_ids:
            current_overage_price = pid
        else:
            current_flat_price = pid

    if not current_flat_price:
        raise ValueError("Could not find flat-rate item on subscription")

    new_overage_price = _get_overage_price_for_plan(new_price_id)

    # If subscription is already on a schedule, release it first
    if sub.get("schedule"):
        try:
            stripe.SubscriptionSchedule.release(sub["schedule"])
        except stripe.StripeError:
            logger.warning("Failed to release existing schedule %s", sub["schedule"])

    schedule = stripe.SubscriptionSchedule.create(
        from_subscription=sub.id,
    )

    current_phase_items: list[dict] = [{"price": current_flat_price, "quantity": 1}]
    if current_overage_price:
        current_phase_items.append({"price": current_overage_price})

    new_phase_items: list[dict] = [{"price": new_price_id, "quantity": 1}]
    if new_overage_price:
        new_phase_items.append({"price": new_overage_price})

    period_end = sub["items"]["data"][0].get("current_period_end") or sub.get("current_period_end")

    stripe.SubscriptionSchedule.modify(
        schedule.id,
        end_behavior="release",
        phases=[
            {
                "items": current_phase_items,
                "start_date": schedule.phases[0].start_date,
                "end_date": period_end,
            },
            {
                "items": new_phase_items,
            },
        ],
    )
    logger.info(
        "Scheduled downgrade for subscription %s to price %s at %s for org %s",
        org.stripe_subscription_id, new_price_id, period_end, org.id,
    )
    return period_end


def cancel_pending_downgrade(org) -> None:
    """
    Cancel a pending scheduled downgrade by releasing the subscription schedule.

    The subscription continues on its current plan as a regular subscription.
    """
    _init_stripe()

    if not org.stripe_subscription_id:
        return

    sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
    schedule_id = sub.get("schedule")
    if not schedule_id:
        logger.debug("No schedule to cancel for subscription %s", org.stripe_subscription_id)
        return

    stripe.SubscriptionSchedule.release(schedule_id)
    logger.info("Released schedule %s for subscription %s", schedule_id, org.stripe_subscription_id)


def get_pending_schedule(org) -> dict | None:
    """
    Check if the subscription has a pending scheduled plan change.

    Returns {plan, effective_date} if a future phase transition is scheduled,
    or None if no schedule exists.
    """
    _init_stripe()

    if not org.stripe_subscription_id:
        return None

    try:
        sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
    except stripe.StripeError:
        return None

    schedule_id = sub.get("schedule")
    if not schedule_id:
        return None

    try:
        schedule = stripe.SubscriptionSchedule.retrieve(schedule_id)
    except stripe.StripeError:
        return None

    if schedule.status not in ("active", "not_started"):
        return None

    if len(schedule.phases) < 2:
        return None

    next_phase = schedule.phases[1]
    overage_ids = set((settings.STRIPE_OVERAGE_PRICE_IDS or {}).values())
    plan_map = _build_price_id_to_plan_map()

    for item in next_phase["items"]:
        price_id = item.get("price") or item.get("plan")
        if price_id and price_id not in overage_ids:
            plan_name = plan_map.get(price_id)
            if plan_name:
                return {
                    "plan": plan_name,
                    "effective_date": next_phase["start_date"],
                }

    return None


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

    result = {
        "id": sub.id,
        "status": sub.status,
        "current_period_start": period_start,
        "current_period_end": period_end,
        "cancel_at_period_end": sub.get("cancel_at_period_end"),
        "price_id": flat_price_id,
    }

    pending = get_pending_schedule(org)
    if pending:
        result["pending_downgrade"] = pending

    return result
