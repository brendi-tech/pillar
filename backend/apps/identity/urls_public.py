from django.urls import path

from apps.identity.views import LinkConfirmView, LinkRequestView, ResolveView

urlpatterns = [
    path('link-request/', LinkRequestView.as_view(), name='identity-link-request'),
    path('link-confirm/', LinkConfirmView.as_view(), name='identity-link-confirm'),
    path('resolve/', ResolveView.as_view(), name='identity-resolve'),
]
