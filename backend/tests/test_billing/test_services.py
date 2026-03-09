"""
Unit tests for apps.billing.services — all Stripe SDK calls are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock, PropertyMock

from apps.billing import services as billing_service
from apps.users.models import Organization

from tests.test_billing.conftest import (
    TEST_STRIPE_PRICE_IDS,
    TEST_STRIPE_OVERAGE_PRICE_IDS,
    make_stripe_subscription,
)


# ──────────────────────────────────────────────────────────────────────────────
# get_or_create_customer
# ──────────────────────────────────────────────────────────────────────────────
class TestGetOrCreateCustomer:
    @patch("apps.billing.services.stripe")
    def test_returns_existing_customer_id_without_api_call(self, mock_stripe, org_with_stripe):
        result = billing_service.get_or_create_customer(org_with_stripe)
        assert result == "cus_test_123"
        mock_stripe.Customer.create.assert_not_called()

    @patch("apps.billing.services.stripe")
    def test_creates_customer_when_none_exists(self, mock_stripe, org_free):
        mock_stripe.Customer.create.return_value = MagicMock(id="cus_new_789")

        result = billing_service.get_or_create_customer(org_free)

        assert result == "cus_new_789"
        mock_stripe.Customer.create.assert_called_once()
        call_kwargs = mock_stripe.Customer.create.call_args[1]
        assert call_kwargs["name"] == "Free Org"
        assert call_kwargs["metadata"]["organization_id"] == str(org_free.id)

        org_free.refresh_from_db()
        assert org_free.stripe_customer_id == "cus_new_789"


# ──────────────────────────────────────────────────────────────────────────────
# create_checkout_session
# ──────────────────────────────────────────────────────────────────────────────
class TestCreateCheckoutSession:
    @patch("apps.billing.services.stripe")
    def test_creates_session_with_single_line_item(self, mock_stripe, org_with_stripe):
        mock_session = MagicMock()
        mock_session.id = "cs_test_abc"
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_abc"
        mock_stripe.checkout.Session.create.return_value = mock_session

        url = billing_service.create_checkout_session(
            org_with_stripe, "price_pro_monthly_test"
        )

        assert url == "https://checkout.stripe.com/pay/cs_test_abc"
        call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
        assert call_kwargs["mode"] == "subscription"
        assert len(call_kwargs["line_items"]) == 1
        assert call_kwargs["line_items"][0]["price"] == "price_pro_monthly_test"
        assert call_kwargs["metadata"]["organization_id"] == str(org_with_stripe.id)

    @patch("apps.billing.services.stripe")
    def test_success_url_contains_session_id_placeholder(self, mock_stripe, org_with_stripe):
        mock_stripe.checkout.Session.create.return_value = MagicMock(
            url="https://checkout.stripe.com/pay/x"
        )
        billing_service.create_checkout_session(org_with_stripe, "price_pro_monthly_test")
        success_url = mock_stripe.checkout.Session.create.call_args[1]["success_url"]
        assert "{CHECKOUT_SESSION_ID}" in success_url

    @patch("apps.billing.services.stripe")
    def test_custom_urls_forwarded(self, mock_stripe, org_with_stripe):
        mock_stripe.checkout.Session.create.return_value = MagicMock(url="https://example.com")
        billing_service.create_checkout_session(
            org_with_stripe,
            "price_pro_monthly_test",
            success_url="https://app.test/ok",
            cancel_url="https://app.test/cancel",
        )
        kw = mock_stripe.checkout.Session.create.call_args[1]
        assert "https://app.test/ok" in kw["success_url"]
        assert kw["cancel_url"] == "https://app.test/cancel"


# ──────────────────────────────────────────────────────────────────────────────
# add_overage_item_to_subscription
# ──────────────────────────────────────────────────────────────────────────────
class TestAddOverageItem:
    @patch("apps.billing.services.stripe")
    def test_adds_overage_price(self, mock_stripe, org_with_stripe):
        sub_mock = make_stripe_subscription(
            org_id=str(org_with_stripe.id),
            price_id="price_pro_monthly_test",
        )
        mock_stripe.Subscription.retrieve.return_value = sub_mock

        billing_service.add_overage_item_to_subscription("sub_test_456")

        mock_stripe.Subscription.modify.assert_called_once()
        call_kwargs = mock_stripe.Subscription.modify.call_args
        new_items = call_kwargs[1]["items"]
        new_price_ids = [it.get("price") for it in new_items if "price" in it]
        assert "price_pro_overage_test" in new_price_ids

    @patch("apps.billing.services.stripe")
    def test_skips_when_overage_already_present(self, mock_stripe, org_with_stripe):
        sub_mock = make_stripe_subscription(
            org_id=str(org_with_stripe.id),
            price_id="price_pro_monthly_test",
            extra_items=[
                {"id": "si_overage", "price": {"id": "price_pro_overage_test"}},
            ],
        )
        mock_stripe.Subscription.retrieve.return_value = sub_mock

        billing_service.add_overage_item_to_subscription("sub_test_456")

        mock_stripe.Subscription.modify.assert_not_called()

    @patch("apps.billing.services.stripe")
    def test_skips_when_no_overage_configured(self, mock_stripe, settings):
        settings.STRIPE_OVERAGE_PRICE_IDS = {}
        sub_mock = make_stripe_subscription(price_id="price_pro_monthly_test")
        mock_stripe.Subscription.retrieve.return_value = sub_mock

        billing_service.add_overage_item_to_subscription("sub_test_456")

        mock_stripe.Subscription.modify.assert_not_called()


# ──────────────────────────────────────────────────────────────────────────────
# sync_subscription
# ──────────────────────────────────────────────────────────────────────────────
class TestSyncSubscription:
    def _make_stripe_sub_dict(self, sub_id, org_id, price_id, stripe_status):
        """Minimal dict mimicking stripe.Subscription for sync_subscription."""
        sub = MagicMock()
        sub.id = sub_id
        sub.status = stripe_status
        sub.metadata = MagicMock()
        sub.metadata.get = lambda k, d=None: {"organization_id": str(org_id)}.get(k, d)
        sub.__getitem__ = lambda self, key: {
            "items": {
                "data": [{"price": {"id": price_id}}]
            }
        }[key]
        return sub

    def test_maps_active_status(self, org_with_stripe):
        sub = self._make_stripe_sub_dict(
            "sub_1", org_with_stripe.id, "price_pro_monthly_test", "active"
        )
        billing_service.sync_subscription(sub)
        org_with_stripe.refresh_from_db()
        assert org_with_stripe.subscription_status == "active"
        assert org_with_stripe.plan == "pro"

    @pytest.mark.parametrize(
        "stripe_status, expected_status",
        [
            ("active", "active"),
            ("trialing", "trialing"),
            ("past_due", "past_due"),
            ("canceled", "canceled"),
            ("incomplete", "active"),
            ("incomplete_expired", "canceled"),
            ("unpaid", "past_due"),
        ],
    )
    def test_status_mapping(self, db, stripe_status, expected_status):
        org = Organization.objects.create(
            name="Status Test Org",
            plan="free",
            subscription_status="active",
        )
        sub = self._make_stripe_sub_dict(
            "sub_status", org.id, "price_hobby_monthly_test", stripe_status
        )
        billing_service.sync_subscription(sub)
        org.refresh_from_db()
        assert org.subscription_status == expected_status

    def test_missing_org_id_does_not_raise(self):
        sub = MagicMock()
        sub.id = "sub_orphan"
        sub.metadata = MagicMock()
        sub.metadata.get = lambda k, d=None: None
        billing_service.sync_subscription(sub)  # should log warning, not crash

    def test_nonexistent_org_does_not_raise(self, db):
        sub = MagicMock()
        sub.id = "sub_ghost"
        sub.metadata = MagicMock()
        sub.metadata.get = lambda k, d=None: {
            "organization_id": "00000000-0000-0000-0000-000000000000"
        }.get(k, d)
        billing_service.sync_subscription(sub)  # should log error, not crash


# ──────────────────────────────────────────────────────────────────────────────
# cancel_subscription
# ──────────────────────────────────────────────────────────────────────────────
class TestCancelSubscription:
    @patch("apps.billing.services.stripe")
    def test_sets_cancel_at_period_end(self, mock_stripe, org_with_stripe):
        billing_service.cancel_subscription(org_with_stripe)
        mock_stripe.Subscription.modify.assert_called_once_with(
            "sub_test_456",
            cancel_at_period_end=True,
        )

    @patch("apps.billing.services.stripe")
    def test_no_op_when_no_subscription(self, mock_stripe, org_free):
        billing_service.cancel_subscription(org_free)
        mock_stripe.Subscription.modify.assert_not_called()


# ──────────────────────────────────────────────────────────────────────────────
# get_subscription_details
# ──────────────────────────────────────────────────────────────────────────────
class TestGetSubscriptionDetails:
    @patch("apps.billing.services.stripe")
    def test_returns_details_dict(self, mock_stripe, org_with_stripe):
        sub_mock = make_stripe_subscription(
            subscription_id="sub_test_456",
            price_id="price_pro_monthly_test",
        )
        mock_stripe.Subscription.retrieve.return_value = sub_mock

        result = billing_service.get_subscription_details(org_with_stripe)

        assert result is not None
        assert result["id"] == "sub_test_456"
        assert result["price_id"] == "price_pro_monthly_test"

    @patch("apps.billing.services.stripe")
    def test_returns_none_for_stripe_error(self, mock_stripe, org_with_stripe):
        import stripe as stripe_mod
        mock_stripe.StripeError = stripe_mod.StripeError
        mock_stripe.Subscription.retrieve.side_effect = stripe_mod.StripeError("boom")

        result = billing_service.get_subscription_details(org_with_stripe)
        assert result is None

    def test_returns_none_when_no_subscription(self, org_free):
        result = billing_service.get_subscription_details(org_free)
        assert result is None


# ──────────────────────────────────────────────────────────────────────────────
# create_portal_session
# ──────────────────────────────────────────────────────────────────────────────
class TestCreatePortalSession:
    @patch("apps.billing.services.stripe")
    def test_returns_portal_url(self, mock_stripe, org_with_stripe):
        mock_stripe.billing_portal.Session.create.return_value = MagicMock(
            url="https://billing.stripe.com/session/portal_test"
        )

        url = billing_service.create_portal_session(org_with_stripe)

        assert url == "https://billing.stripe.com/session/portal_test"
        call_kwargs = mock_stripe.billing_portal.Session.create.call_args[1]
        assert call_kwargs["customer"] == "cus_test_123"


# ──────────────────────────────────────────────────────────────────────────────
# _get_overage_price_for_plan  (internal helper, tested through public API)
# ──────────────────────────────────────────────────────────────────────────────
class TestGetOveragePriceForPlan:
    def test_returns_correct_overage_price(self):
        result = billing_service._get_overage_price_for_plan("price_pro_monthly_test")
        assert result == "price_pro_overage_test"

    def test_returns_none_for_unknown_price(self):
        result = billing_service._get_overage_price_for_plan("price_unknown")
        assert result is None
