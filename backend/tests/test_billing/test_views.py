"""
API endpoint tests for billing views via authenticated_client.

Service-layer calls to Stripe are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock

from apps.users.models import Organization
from rest_framework.test import APIClient

from tests.test_billing.conftest import make_stripe_subscription


BILLING_PREFIX = "/api/admin/billing"


# ──────────────────────────────────────────────────────────────────────────────
# POST /billing/checkout/
# ──────────────────────────────────────────────────────────────────────────────
class TestCheckoutView:
    @pytest.fixture
    def new_org_client(self, db):
        """Client with an org that has NO existing subscription (new checkout flow)."""
        org = Organization.objects.create(
            name="New Checkout Org",
            plan="free",
            subscription_status="active",
            stripe_customer_id="cus_new_123",
        )
        from apps.users.models import User, OrganizationMembership
        user = User.objects.create_user(
            email="newcheckout@test.com", password="testpass123", full_name="New User",
        )
        OrganizationMembership.objects.create(
            organization=org, user=user, role=OrganizationMembership.Role.ADMIN,
        )
        user.current_organization = org
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    @patch("apps.billing.views.billing_service")
    def test_valid_price_key_returns_url(self, mock_svc, new_org_client):
        mock_svc.create_checkout_session.return_value = "https://checkout.stripe.com/x"
        resp = new_org_client.post(
            f"{BILLING_PREFIX}/checkout/",
            {"price_id": "pro_monthly"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["url"] == "https://checkout.stripe.com/x"

    def test_missing_price_id_returns_400(self, billing_client):
        resp = billing_client.post(f"{BILLING_PREFIX}/checkout/", {}, format="json")
        assert resp.status_code == 400
        assert "price_id" in resp.data["error"].lower()

    def test_invalid_price_key_returns_400(self, billing_client):
        resp = billing_client.post(
            f"{BILLING_PREFIX}/checkout/",
            {"price_id": "bogus_plan"},
            format="json",
        )
        assert resp.status_code == 400
        assert "Invalid" in resp.data["error"]

    @patch("apps.billing.views.billing_service")
    def test_stripe_failure_returns_500(self, mock_svc, new_org_client):
        mock_svc.create_checkout_session.side_effect = Exception("stripe down")
        resp = new_org_client.post(
            f"{BILLING_PREFIX}/checkout/",
            {"price_id": "pro_monthly"},
            format="json",
        )
        assert resp.status_code == 500

    def test_unauthenticated_returns_401(self, db):
        client = APIClient()
        resp = client.post(f"{BILLING_PREFIX}/checkout/", {"price_id": "pro_monthly"}, format="json")
        assert resp.status_code in (401, 403)

    @patch("apps.billing.views.billing_service")
    def test_accepts_raw_stripe_price_id(self, mock_svc, new_org_client, settings):
        """When the caller passes an actual Stripe price ID (not a key name), accept it."""
        mock_svc.create_checkout_session.return_value = "https://checkout.stripe.com/y"
        resp = new_org_client.post(
            f"{BILLING_PREFIX}/checkout/",
            {"price_id": "price_pro_monthly_test"},
            format="json",
        )
        assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# GET /billing/subscription/
# ──────────────────────────────────────────────────────────────────────────────
class TestSubscriptionView:
    @patch("apps.billing.views.billing_service")
    def test_returns_plan_info(self, mock_svc, billing_client, org_with_stripe):
        mock_svc.get_subscription_details.return_value = {
            "id": "sub_test_456",
            "status": "active",
            "current_period_start": 1_700_000_000,
            "current_period_end": 1_702_600_000,
            "cancel_at_period_end": False,
            "price_id": "price_pro_monthly_test",
        }
        mock_svc.get_billing_interval.return_value = "monthly"
        resp = billing_client.get(f"{BILLING_PREFIX}/subscription/")
        assert resp.status_code == 200
        assert resp.data["plan"] == "pro"
        assert resp.data["monthly_responses"] == 500
        assert resp.data["has_payg"] is True

    @patch("apps.billing.views.billing_service")
    def test_no_subscription_still_returns_plan(self, mock_svc, billing_client):
        mock_svc.get_subscription_details.return_value = None
        mock_svc.get_billing_interval.return_value = None
        resp = billing_client.get(f"{BILLING_PREFIX}/subscription/")
        assert resp.status_code == 200
        assert "plan" in resp.data


# ──────────────────────────────────────────────────────────────────────────────
# POST /billing/portal/
# ──────────────────────────────────────────────────────────────────────────────
class TestPortalView:
    @patch("apps.billing.views.billing_service")
    def test_returns_portal_url(self, mock_svc, billing_client):
        mock_svc.create_portal_session.return_value = "https://billing.stripe.com/portal/x"
        resp = billing_client.post(f"{BILLING_PREFIX}/portal/")
        assert resp.status_code == 200
        assert resp.data["url"] == "https://billing.stripe.com/portal/x"

    @patch("apps.billing.views.billing_service")
    def test_stripe_failure_returns_500(self, mock_svc, billing_client):
        mock_svc.create_portal_session.side_effect = Exception("boom")
        resp = billing_client.post(f"{BILLING_PREFIX}/portal/")
        assert resp.status_code == 500

    def test_unauthenticated_returns_401(self, db):
        client = APIClient()
        resp = client.post(f"{BILLING_PREFIX}/portal/")
        assert resp.status_code in (401, 403)


# ──────────────────────────────────────────────────────────────────────────────
# GET /billing/usage/
# ──────────────────────────────────────────────────────────────────────────────
class TestUsageView:
    def test_returns_usage_data(self, billing_client, org_with_stripe):
        resp = billing_client.get(f"{BILLING_PREFIX}/usage/")
        assert resp.status_code == 200
        assert "used" in resp.data
        assert "limit" in resp.data
        assert resp.data["plan"] == "pro"
        assert resp.data["used"] == 0

    def test_free_plan_returns_is_one_time(self, db):
        """A user on free plan sees is_one_time=True."""
        from apps.users.models import User, OrganizationMembership

        free_org = Organization.objects.create(name="Free", plan="free")
        user = User.objects.create_user(
            email="freeuser@test.com", password="pass", full_name="Free"
        )
        OrganizationMembership.objects.create(
            organization=free_org,
            user=user,
            role=OrganizationMembership.Role.ADMIN,
        )
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get(f"{BILLING_PREFIX}/usage/")
        assert resp.status_code == 200
        assert resp.data["is_one_time"] is True


# ──────────────────────────────────────────────────────────────────────────────
# POST /billing/verify-session/
# ──────────────────────────────────────────────────────────────────────────────
class TestVerifySessionView:
    @patch("apps.billing.views.billing_service")
    @patch("apps.billing.views.stripe")
    def test_syncs_subscription(self, mock_stripe, mock_svc, billing_client, org_with_stripe):
        mock_session = MagicMock()
        mock_session.status = "complete"
        mock_session.subscription = "sub_test_456"
        mock_stripe.checkout.Session.retrieve.return_value = mock_session

        sub_mock = make_stripe_subscription(
            subscription_id="sub_test_456",
            org_id=str(org_with_stripe.id),
        )
        mock_stripe.Subscription.retrieve.return_value = sub_mock
        mock_stripe.StripeError = Exception

        resp = billing_client.post(
            f"{BILLING_PREFIX}/verify-session/",
            {"session_id": "cs_test_abc"},
            format="json",
        )
        assert resp.status_code == 200
        mock_svc.sync_subscription.assert_called_once()
        mock_svc.add_overage_item_to_subscription.assert_called_once_with("sub_test_456")

    def test_missing_session_id_returns_400(self, billing_client):
        resp = billing_client.post(f"{BILLING_PREFIX}/verify-session/", {}, format="json")
        assert resp.status_code == 400

    @patch("apps.billing.views.stripe")
    def test_incomplete_session_returns_409(self, mock_stripe, billing_client):
        mock_session = MagicMock()
        mock_session.status = "open"
        mock_stripe.checkout.Session.retrieve.return_value = mock_session
        mock_stripe.StripeError = Exception

        resp = billing_client.post(
            f"{BILLING_PREFIX}/verify-session/",
            {"session_id": "cs_test_abc"},
            format="json",
        )
        assert resp.status_code == 409
