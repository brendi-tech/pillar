"""
Billing API views.

Authenticated admin endpoints for subscription management,
checkout session creation, and usage reporting.
"""
import logging
from datetime import datetime, timezone as tz

import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing import services as billing_service
from apps.billing.constants import get_plan_limits
from apps.analytics.models import ChatMessage
from apps.users.permissions import IsAuthenticatedAdmin

logger = logging.getLogger(__name__)


class SubscriptionView(APIView):
    """GET current subscription details for the authenticated org."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan_limits = get_plan_limits(org.plan)
        data = {
            "plan": org.plan,
            "subscription_status": org.subscription_status,
            "monthly_responses": plan_limits.monthly_responses,
            "is_one_time": plan_limits.is_one_time,
            "has_payg": plan_limits.has_payg,
            "stripe_subscription_id": org.stripe_subscription_id,
            "billing_interval": billing_service.get_billing_interval(org.stripe_price_id),
        }

        details = billing_service.get_subscription_details(org)
        if details:
            data.update({
                "current_period_start": details["current_period_start"],
                "current_period_end": details["current_period_end"],
                "cancel_at_period_end": details["cancel_at_period_end"],
            })
            if details.get("pending_downgrade"):
                data["pending_downgrade"] = details["pending_downgrade"]

        return Response(data)


class CheckoutView(APIView):
    """POST to create a Stripe Checkout Session or modify an existing subscription.

    If the org already has an active subscription, the existing subscription's
    price is updated in-place (no new checkout). Otherwise a new Checkout
    Session is created.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def _resolve_price_id(self, price_key: str) -> str | None:
        price_id = settings.STRIPE_PRICE_IDS.get(price_key)
        if price_id:
            return price_id
        valid_prices = {pid for pid in settings.STRIPE_PRICE_IDS.values() if pid}
        if price_key in valid_prices:
            return price_key
        return None

    def post(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_key = request.data.get("price_id")
        if not price_key:
            return Response(
                {"error": "price_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_id = self._resolve_price_id(price_key)
        if not price_id:
            return Response(
                {"error": f"Invalid price_id: {price_key}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if org.stripe_subscription_id and org.subscription_status in ("active", "trialing"):
            return self._update_existing(request, org, price_id)
        return self._create_new(request, org, price_id)

    def _update_existing(self, request, org, price_id: str):
        """Modify the existing subscription's price in-place (upgrade) or schedule at period end (downgrade)."""
        try:
            result = billing_service.update_subscription_plan(org, price_id)
        except Exception:
            logger.exception("Failed to update subscription for org %s", org.id)
            return Response(
                {"error": "Failed to update subscription"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if isinstance(result, dict) and result.get("scheduled"):
            return Response({
                "scheduled": True,
                "effective_date": result["effective_date"],
                "plan": result["plan"],
            })

        org.refresh_from_db()
        plan_limits = get_plan_limits(org.plan)
        return Response({
            "plan": org.plan,
            "subscription_status": org.subscription_status,
            "monthly_responses": plan_limits.monthly_responses,
            "updated": True,
        })

    def _create_new(self, request, org, price_id: str):
        """Create a new Stripe Checkout Session for first-time subscribers."""
        try:
            checkout_url = billing_service.create_checkout_session(
                org,
                price_id,
                success_url=request.data.get("success_url"),
                cancel_url=request.data.get("cancel_url"),
            )
        except Exception:
            logger.exception("Failed to create checkout session for org %s", org.id)
            return Response(
                {"error": "Failed to create checkout session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"url": checkout_url})


class PortalView(APIView):
    """POST to create a Stripe Customer Portal session."""

    permission_classes = [IsAuthenticatedAdmin]

    def post(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            portal_url = billing_service.create_portal_session(org)
        except Exception:
            logger.exception("Failed to create portal session for org %s", org.id)
            return Response(
                {"error": "Failed to create portal session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"url": portal_url})


class VerifySessionView(APIView):
    """POST to verify a Stripe Checkout Session and sync the subscription.

    Provides a webhook-independent fallback so the frontend can ensure
    the org plan is updated immediately after checkout completes.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def post(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_id = request.data.get("session_id")
        if not session_id:
            return Response(
                {"error": "session_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(session_id)
        except stripe.StripeError:
            logger.exception("Failed to retrieve checkout session %s", session_id)
            return Response(
                {"error": "Failed to retrieve checkout session"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if session.status != "complete":
            return Response(
                {"error": "Checkout session is not complete", "session_status": session.status},
                status=status.HTTP_409_CONFLICT,
            )

        subscription_id = session.subscription
        if not subscription_id:
            return Response(
                {"error": "No subscription found on checkout session"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            billing_service.sync_subscription(subscription)
        except stripe.StripeError:
            logger.exception("Failed to sync subscription %s", subscription_id)
            return Response(
                {"error": "Failed to sync subscription"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            billing_service.add_overage_item_to_subscription(subscription_id)
        except Exception:
            logger.exception("Failed to add overage item to subscription %s", subscription_id)

        org.refresh_from_db()
        plan_limits = get_plan_limits(org.plan)

        return Response({
            "plan": org.plan,
            "subscription_status": org.subscription_status,
            "monthly_responses": plan_limits.monthly_responses,
            "is_one_time": plan_limits.is_one_time,
            "has_payg": plan_limits.has_payg,
            "stripe_subscription_id": org.stripe_subscription_id,
        })


class CancelDowngradeView(APIView):
    """POST to cancel a pending scheduled downgrade."""

    permission_classes = [IsAuthenticatedAdmin]

    def post(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            billing_service.cancel_pending_downgrade(org)
        except Exception:
            logger.exception("Failed to cancel pending downgrade for org %s", org.id)
            return Response(
                {"error": "Failed to cancel pending downgrade"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"canceled": True})


class CancelSubscriptionView(APIView):
    """POST to cancel the org's subscription at end of billing period (downgrade to free)."""

    permission_classes = [IsAuthenticatedAdmin]

    def post(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not org.stripe_subscription_id:
            return Response(
                {"error": "No active subscription to cancel"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            billing_service.cancel_subscription(org)
        except Exception:
            logger.exception("Failed to cancel subscription for org %s", org.id)
            return Response(
                {"error": "Failed to cancel subscription"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"canceled": True})


class UsageView(APIView):
    """GET current billing period usage for the authenticated org."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        org = request.user.primary_organization
        if not org:
            return Response(
                {"error": "No organization found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan_limits = get_plan_limits(org.plan)

        base_filter = {
            "organization": org,
            "role": "assistant",
            "streaming_status": "completed",
        }

        if plan_limits.is_one_time:
            used = ChatMessage.objects.filter(**base_filter).count()
        else:
            now = datetime.now(tz.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            used = ChatMessage.objects.filter(
                **base_filter,
                created_at__gte=period_start,
            ).count()

        return Response({
            "used": used,
            "limit": plan_limits.monthly_responses,
            "is_one_time": plan_limits.is_one_time,
            "plan": org.plan,
            "has_payg": plan_limits.has_payg,
            "payg_rate": str(plan_limits.payg_rate) if plan_limits.payg_rate else None,
        })
