"""
Knowledge admin API URL configuration.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    SourceViewSet,
    ItemViewSet,
    SnippetViewSet,
    CreateCorrectionView,
    CorrectionViewSet,
    PendingUploadViewSet,
    start_oauth,
    complete_oauth,
)

router = DefaultRouter()
router.register(r'sources', SourceViewSet, basename='knowledge-source')
router.register(r'items', ItemViewSet, basename='knowledge-item')
router.register(r'snippets', SnippetViewSet, basename='knowledge-snippet')
router.register(r'corrections', CorrectionViewSet, basename='knowledge-correction')
router.register(r'pending-uploads', PendingUploadViewSet, basename='knowledge-pending-upload')

urlpatterns = [
    # Explicit correction creation endpoint
    path('corrections/create/', CreateCorrectionView.as_view(), name='correction-create'),
    # Router URLs
    path('', include(router.urls)),
    # OAuth endpoints for Unified.to integrations
    path('oauth/unified/start/', start_oauth, name='knowledge-oauth-start'),
    path('oauth/unified/complete/', complete_oauth, name='knowledge-oauth-complete'),
]
