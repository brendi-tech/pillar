"""
Shared fixtures for billing tests.
"""
import time
import uuid

import pytest
from django.test import override_settings
from unittest.mock import patch, MagicMock

from apps.users.models import Organization, User, OrganizationMembership
from rest_framework.test import APIClient


# ---------------------------------------------------------------------------
# Deterministic Stripe price IDs used across all billing tests
# ---------------------------------------------------------------------------
TEST_STRIPE_PRICE_IDS = {
    "hobby_monthly": "price_hobby_monthly_test",
    "hobby_yearly": "price_hobby_yearly_test",
    "pro_monthly": "price_pro_monthly_test",
    "pro_yearly": "price_pro_yearly_test",
    "growth_monthly": "price_growth_monthly_test",
    "growth_yearly": "price_growth_yearly_test",
}

TEST_STRIPE_OVERAGE_PRICE_IDS = {
    "hobby": "price_hobby_overage_test",
    "pro": "price_pro_overage_test",
    "growth": "price_growth_overage_test",
}


@pytest.fixture(autouse=True)
def mock_stripe_settings(settings):
    """Override Stripe-related Django settings with deterministic test values."""
    settings.STRIPE_SECRET_KEY = "sk_test_fake_key"
    settings.STRIPE_PUBLISHABLE_KEY = "pk_test_fake_key"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret"
    settings.STRIPE_PRICE_IDS = dict(TEST_STRIPE_PRICE_IDS)
    settings.STRIPE_OVERAGE_PRICE_IDS = dict(TEST_STRIPE_OVERAGE_PRICE_IDS)
    settings.STRIPE_METER_EVENT_NAME = "agent_response"
    settings.FRONTEND_URL = "http://localhost:3000"

    # Reset the module-level cache so tests get fresh lookups
    from apps.billing import services
    services.PRICE_ID_TO_PLAN.clear()
    yield
    services.PRICE_ID_TO_PLAN.clear()


# ---------------------------------------------------------------------------
# Organization fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def org_with_stripe(db):
    """Organization on pro plan with Stripe customer & subscription wired up."""
    return Organization.objects.create(
        name="Stripe Test Org",
        plan="pro",
        subscription_status="active",
        stripe_customer_id="cus_test_123",
        stripe_subscription_id="sub_test_456",
        stripe_price_id="price_pro_monthly_test",
    )


@pytest.fixture
def org_free(db):
    """Organization on the free plan with no Stripe linkage."""
    return Organization.objects.create(
        name="Free Org",
        plan="free",
        subscription_status="active",
    )


@pytest.fixture
def billing_user(db, org_with_stripe):
    """Admin user with membership in org_with_stripe."""
    user = User.objects.create_user(
        email="billing@test.com",
        password="testpass123",
        full_name="Billing User",
    )
    OrganizationMembership.objects.create(
        organization=org_with_stripe,
        user=user,
        role=OrganizationMembership.Role.ADMIN,
    )
    user.current_organization = org_with_stripe
    return user


@pytest.fixture
def billing_client(db, billing_user):
    """Authenticated API client tied to org_with_stripe."""
    client = APIClient()
    client.force_authenticate(user=billing_user)
    return client


# ---------------------------------------------------------------------------
# Stripe data builders
# ---------------------------------------------------------------------------
class _StripeEventDict(dict):
    """Dict subclass that also supports attribute access (like real stripe.Event)."""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)


def make_stripe_event(event_type: str, data_object: dict, event_id: str | None = None) -> _StripeEventDict:
    """Build a dict matching the shape of a parsed Stripe Event."""
    return _StripeEventDict({
        "id": event_id or f"evt_test_{uuid.uuid4().hex[:16]}",
        "type": event_type,
        "data": {"object": data_object},
        "livemode": False,
        "created": int(time.time()),
        "api_version": "2024-06-20",
    })


def make_stripe_subscription(
    subscription_id: str = "sub_test_456",
    org_id: str = "",
    price_id: str = "price_pro_monthly_test",
    status: str = "active",
    extra_items: list | None = None,
) -> MagicMock:
    """Return a MagicMock that behaves like stripe.Subscription."""
    items = [
        {
            "id": "si_flat_001",
            "price": {"id": price_id},
            "current_period_start": 1_700_000_000,
            "current_period_end": 1_702_600_000,
        },
    ]
    if extra_items:
        items.extend(extra_items)

    sub = MagicMock()
    sub.id = subscription_id
    sub.status = status
    sub.metadata = {"organization_id": org_id}
    sub.__getitem__ = lambda self, key: {"items": {"data": items}}.get(key, getattr(self, key))
    sub.get = lambda key, default=None: {"cancel_at_period_end": False}.get(key, default)
    return sub
