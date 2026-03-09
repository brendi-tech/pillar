from django.urls import path

from apps.billing.views import (
    CancelDowngradeView,
    CancelSubscriptionView,
    CheckoutView,
    PortalView,
    SubscriptionView,
    UsageView,
    VerifySessionView,
)

urlpatterns = [
    path("subscription/", SubscriptionView.as_view(), name="billing-subscription"),
    path("checkout/", CheckoutView.as_view(), name="billing-checkout"),
    path("portal/", PortalView.as_view(), name="billing-portal"),
    path("usage/", UsageView.as_view(), name="billing-usage"),
    path("verify-session/", VerifySessionView.as_view(), name="billing-verify-session"),
    path("cancel/", CancelSubscriptionView.as_view(), name="billing-cancel"),
    path("cancel-downgrade/", CancelDowngradeView.as_view(), name="billing-cancel-downgrade"),
]
