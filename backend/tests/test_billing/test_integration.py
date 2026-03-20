"""
Integration tests that hit the real Stripe test-mode API.

These are marked with @pytest.mark.integration and require the
STRIPE_TEST_SECRET_KEY environment variable to be set.

Run locally:
    export $(grep -v '^#' .env.local | xargs)
    cd backend
    uv run pytest tests/test_billing/test_integration.py -m integration -v
"""
import os
import uuid

import pytest
import stripe

STRIPE_TEST_KEY = os.environ.get("STRIPE_TEST_SECRET_KEY", "")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not STRIPE_TEST_KEY, reason="STRIPE_TEST_SECRET_KEY not set"),
]


@pytest.fixture(autouse=True)
def _configure_stripe():
    """Point the stripe SDK at the real test key for integration tests."""
    stripe.api_key = STRIPE_TEST_KEY


@pytest.fixture
def test_customer():
    """Create a real Stripe test customer and clean up afterwards."""
    customer = stripe.Customer.create(
        name=f"CI Test {uuid.uuid4().hex[:8]}",
        email="ci-test@pillar.bot",
        metadata={"ci": "true"},
    )
    yield customer
    try:
        stripe.Customer.delete(customer.id)
    except stripe.StripeError:
        pass


class TestCustomerRoundTrip:
    def test_create_and_retrieve(self, test_customer):
        retrieved = stripe.Customer.retrieve(test_customer.id)
        assert retrieved.id == test_customer.id
        assert retrieved.email == "ci-test@pillar.bot"


class TestCheckoutSession:
    def test_create_checkout_session(self, test_customer):
        """Create a real checkout session and verify the URL is returned."""
        price_id = os.environ.get("STRIPE_PRICE_STARTER_MONTHLY", "")
        if not price_id:
            pytest.skip("STRIPE_PRICE_STARTER_MONTHLY not set")

        session = stripe.checkout.Session.create(
            customer=test_customer.id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url="https://example.com/ok?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://example.com/cancel",
        )
        assert session.url is not None
        assert session.url.startswith("https://checkout.stripe.com/")


class TestPortalSession:
    def test_create_portal_session(self, test_customer):
        session = stripe.billing_portal.Session.create(
            customer=test_customer.id,
            return_url="https://example.com/billing",
        )
        assert session.url is not None
        assert "billing.stripe.com" in session.url


class TestWebhookSignatureVerification:
    def test_valid_signature_parses(self):
        """Construct a payload + signature with a known secret and verify it round-trips."""
        import time
        import json
        import hmac
        import hashlib

        payload = json.dumps({"id": "evt_test", "type": "test.event"})
        secret = "whsec_testsecret"
        timestamp = str(int(time.time()))
        signed_payload = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        header = f"t={timestamp},v1={signature}"

        event = stripe.Webhook.construct_event(
            payload, header, secret,
        )
        assert event["type"] == "test.event"

    def test_bad_signature_raises(self):
        import json

        with pytest.raises(stripe.SignatureVerificationError):
            stripe.Webhook.construct_event(
                json.dumps({"id": "evt_bad"}),
                "t=0,v1=badsig",
                "whsec_real",
            )
