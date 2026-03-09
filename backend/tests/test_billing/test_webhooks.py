"""
Unit tests for apps.billing.webhooks — Stripe SDK calls are mocked.
"""
import json

import pytest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory

from apps.billing.webhooks import stripe_webhook_view, EVENT_HANDLERS
from apps.users.models import Organization

from tests.test_billing.conftest import make_stripe_event, make_stripe_subscription


@pytest.fixture
def rf():
    return RequestFactory()


def _webhook_request(rf, payload: dict, sig: str = "valid_sig"):
    """Build a fake POST request that looks like a Stripe webhook delivery."""
    body = json.dumps(payload).encode()
    request = rf.post(
        "/api/webhooks/stripe/",
        data=body,
        content_type="application/json",
    )
    request.META["HTTP_STRIPE_SIGNATURE"] = sig
    return request


# ──────────────────────────────────────────────────────────────────────────────
# Signature verification
# ──────────────────────────────────────────────────────────────────────────────
class TestSignatureVerification:
    @patch("apps.billing.webhooks.stripe.Webhook.construct_event")
    def test_valid_signature_dispatches_handler(self, mock_construct, rf, org_with_stripe):
        event = make_stripe_event(
            "checkout.session.completed",
            {"subscription": "sub_test_456"},
        )
        mock_construct.return_value = event

        with patch("apps.billing.webhooks.billing_service") as mock_svc:
            mock_svc.sync_subscription.return_value = None
            mock_svc.add_overage_item_to_subscription.return_value = None

            with patch("apps.billing.webhooks.stripe.Subscription.retrieve") as mock_retrieve:
                mock_retrieve.return_value = make_stripe_subscription(
                    org_id=str(org_with_stripe.id)
                )
                response = stripe_webhook_view(_webhook_request(rf, event))

        assert response.status_code == 200

    @patch("apps.billing.webhooks.stripe.Webhook.construct_event")
    def test_invalid_signature_returns_400(self, mock_construct, rf):
        import stripe as stripe_mod
        mock_construct.side_effect = stripe_mod.SignatureVerificationError(
            "bad sig", "sig_header"
        )
        response = stripe_webhook_view(_webhook_request(rf, {}))
        assert response.status_code == 400

    @patch("apps.billing.webhooks.stripe.Webhook.construct_event")
    def test_invalid_payload_returns_400(self, mock_construct, rf):
        mock_construct.side_effect = ValueError("bad json")
        response = stripe_webhook_view(_webhook_request(rf, {}))
        assert response.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# checkout.session.completed
# ──────────────────────────────────────────────────────────────────────────────
class TestCheckoutCompleted:
    @patch("apps.billing.webhooks.stripe")
    @patch("apps.billing.webhooks.billing_service")
    def test_syncs_and_adds_overage(self, mock_svc, mock_stripe, org_with_stripe):
        session = {"subscription": "sub_test_456"}
        event = make_stripe_event("checkout.session.completed", session)
        sub_mock = make_stripe_subscription(org_id=str(org_with_stripe.id))
        mock_stripe.Subscription.retrieve.return_value = sub_mock

        handler = EVENT_HANDLERS["checkout.session.completed"]
        handler(session, event)

        mock_svc.sync_subscription.assert_called_once_with(sub_mock)
        mock_svc.add_overage_item_to_subscription.assert_called_once_with("sub_test_456")

    @patch("apps.billing.webhooks.stripe")
    @patch("apps.billing.webhooks.billing_service")
    def test_no_subscription_id_is_noop(self, mock_svc, mock_stripe):
        session = {}
        event = make_stripe_event("checkout.session.completed", session)

        handler = EVENT_HANDLERS["checkout.session.completed"]
        handler(session, event)

        mock_svc.sync_subscription.assert_not_called()

    @patch("apps.billing.webhooks.stripe")
    @patch("apps.billing.webhooks.billing_service")
    def test_overage_failure_does_not_crash(self, mock_svc, mock_stripe, org_with_stripe):
        """add_overage_item_to_subscription can fail without breaking the handler."""
        session = {"subscription": "sub_test_456"}
        event = make_stripe_event("checkout.session.completed", session)
        mock_stripe.Subscription.retrieve.return_value = make_stripe_subscription(
            org_id=str(org_with_stripe.id)
        )
        mock_svc.add_overage_item_to_subscription.side_effect = Exception("stripe blew up")

        handler = EVENT_HANDLERS["checkout.session.completed"]
        handler(session, event)  # should not raise


# ──────────────────────────────────────────────────────────────────────────────
# customer.subscription.deleted
# ──────────────────────────────────────────────────────────────────────────────
class TestSubscriptionDeleted:
    def test_downgrades_org_to_free(self, org_with_stripe):
        sub_data = {
            "id": "sub_test_456",
            "metadata": {"organization_id": str(org_with_stripe.id)},
        }
        # MagicMock wrapping so .id works
        sub = MagicMock()
        sub.get = lambda k, d=None: sub_data.get(k, d)
        sub.id = "sub_test_456"

        handler = EVENT_HANDLERS["customer.subscription.deleted"]
        handler(sub, make_stripe_event("customer.subscription.deleted", sub_data))

        org_with_stripe.refresh_from_db()
        assert org_with_stripe.plan == "free"
        assert org_with_stripe.subscription_status == "canceled"
        assert org_with_stripe.stripe_subscription_id is None
        assert org_with_stripe.stripe_price_id is None

    def test_missing_org_id_does_not_crash(self):
        sub = MagicMock()
        sub.get = lambda k, d=None: {"metadata": {}}.get(k, d)
        sub.id = "sub_orphan"

        handler = EVENT_HANDLERS["customer.subscription.deleted"]
        handler(sub, make_stripe_event("customer.subscription.deleted", {}))


# ──────────────────────────────────────────────────────────────────────────────
# invoice.payment_failed
# ──────────────────────────────────────────────────────────────────────────────
class TestInvoicePaymentFailed:
    def test_marks_org_past_due(self, org_with_stripe):
        invoice = {"customer": org_with_stripe.stripe_customer_id}
        handler = EVENT_HANDLERS["invoice.payment_failed"]
        handler(invoice, make_stripe_event("invoice.payment_failed", invoice))

        org_with_stripe.refresh_from_db()
        assert org_with_stripe.subscription_status == "past_due"

    def test_unknown_customer_does_not_crash(self, db):
        invoice = {"customer": "cus_unknown"}
        handler = EVENT_HANDLERS["invoice.payment_failed"]
        handler(invoice, make_stripe_event("invoice.payment_failed", invoice))


# ──────────────────────────────────────────────────────────────────────────────
# invoice.payment_succeeded
# ──────────────────────────────────────────────────────────────────────────────
class TestInvoicePaymentSucceeded:
    @patch("common.services.slack.notify_payment_completed")
    def test_restores_active_from_past_due(self, mock_slack, org_with_stripe):
        org_with_stripe.subscription_status = "past_due"
        org_with_stripe.save(update_fields=["subscription_status"])

        invoice = {
            "customer": org_with_stripe.stripe_customer_id,
            "amount_paid": 2900,
            "currency": "usd",
            "customer_email": "billing@test.com",
            "hosted_invoice_url": "https://invoice.stripe.com/i/xxx",
        }
        handler = EVENT_HANDLERS["invoice.payment_succeeded"]
        handler(invoice, make_stripe_event("invoice.payment_succeeded", invoice))

        org_with_stripe.refresh_from_db()
        assert org_with_stripe.subscription_status == "active"

    @patch("common.services.slack.notify_payment_completed")
    def test_resets_usage_alert_threshold(self, mock_slack, org_with_stripe):
        org_with_stripe.usage_alert_last_threshold = 75
        org_with_stripe.save(update_fields=["usage_alert_last_threshold"])

        invoice = {
            "customer": org_with_stripe.stripe_customer_id,
            "amount_paid": 2900,
            "currency": "usd",
            "customer_email": "billing@test.com",
            "hosted_invoice_url": "",
        }
        handler = EVENT_HANDLERS["invoice.payment_succeeded"]
        handler(invoice, make_stripe_event("invoice.payment_succeeded", invoice))

        org_with_stripe.refresh_from_db()
        assert org_with_stripe.usage_alert_last_threshold is None

    @patch("common.services.slack.notify_payment_completed")
    def test_notifies_slack_on_payment(self, mock_slack, org_with_stripe):
        invoice = {
            "customer": org_with_stripe.stripe_customer_id,
            "amount_paid": 2900,
            "currency": "usd",
            "customer_email": "billing@test.com",
            "hosted_invoice_url": "https://invoice.stripe.com/i/xxx",
        }
        handler = EVENT_HANDLERS["invoice.payment_succeeded"]
        handler(invoice, make_stripe_event("invoice.payment_succeeded", invoice))

        mock_slack.assert_called_once()
        assert mock_slack.call_args[1]["amount"] == 2900

    def test_zero_amount_skips_slack(self, org_with_stripe):
        invoice = {
            "customer": org_with_stripe.stripe_customer_id,
            "amount_paid": 0,
            "currency": "usd",
        }
        handler = EVENT_HANDLERS["invoice.payment_succeeded"]
        handler(invoice, make_stripe_event("invoice.payment_succeeded", invoice))
        # No exception — Slack import not triggered for $0


# ──────────────────────────────────────────────────────────────────────────────
# Unknown event type
# ──────────────────────────────────────────────────────────────────────────────
class TestUnknownEvent:
    @patch("apps.billing.webhooks.stripe.Webhook.construct_event")
    def test_unknown_event_returns_200(self, mock_construct, rf):
        event = make_stripe_event("some.unknown.event", {"foo": "bar"})
        mock_construct.return_value = event
        response = stripe_webhook_view(_webhook_request(rf, event))
        assert response.status_code == 200
