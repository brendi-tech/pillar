"""
URL configuration for the products app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.products.views import (
    ProductViewSet, PlatformViewSet, ActionViewSet,
    ActionExecutionLogViewSet, ActionSyncView, ActionSyncStatusView
)

router = DefaultRouter()
router.register(r'platforms', PlatformViewSet, basename='platform')
router.register(r'actions', ActionViewSet, basename='action')
router.register(r'action-logs', ActionExecutionLogViewSet, basename='action-log')
router.register(r'', ProductViewSet, basename='product')

app_name = 'products'

urlpatterns = [
    path('', include(router.urls)),
    # Action sync endpoint (for CI/CD code-first action definitions)
    path('<slug:slug>/actions/sync/', ActionSyncView.as_view(), name='action-sync'),
    # Action sync status endpoint (for polling async jobs)
    path('<slug:slug>/actions/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='action-sync-status'),
]
