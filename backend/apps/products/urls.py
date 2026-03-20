"""
URL configuration for the products app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.products.views import (
    ProductViewSet, PlatformViewSet, ActionViewSet,
    ActionExecutionLogViewSet, ActionSyncView, ActionSyncStatusView,
    AgentViewSet,
)

router = DefaultRouter()
router.register(r'platforms', PlatformViewSet, basename='platform')
router.register(r'actions', ActionViewSet, basename='action')
router.register(r'action-logs', ActionExecutionLogViewSet, basename='action-log')
router.register(r'tools', ActionViewSet, basename='tool')
router.register(r'tool-logs', ActionExecutionLogViewSet, basename='tool-log')
router.register(r'', ProductViewSet, basename='product')

agents_router = DefaultRouter()
agents_router.register(r'', AgentViewSet, basename='agent')

app_name = 'products'

urlpatterns = [
    path('', include(router.urls)),
    # Nested agent routes: /api/admin/products/{product_pk}/agents/
    path('<uuid:product_pk>/agents/', include(agents_router.urls)),
    # Legacy action sync endpoints (kept for backwards compat)
    path('<slug:slug>/actions/sync/', ActionSyncView.as_view(), name='action-sync'),
    path('<slug:slug>/actions/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='action-sync-status'),
    # Tool sync endpoints
    path('<slug:slug>/tools/sync/', ActionSyncView.as_view(), name='tool-sync'),
    path('<slug:slug>/tools/sync/<uuid:job_id>/status/', ActionSyncStatusView.as_view(), name='tool-sync-status'),
]
