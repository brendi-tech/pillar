"""
URL configuration for the analytics app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.analytics.viewsets import (
    SearchViewSet,
    WidgetSessionViewSet, ChatConversationViewSet, ChatMessageViewSet,
    VisitorViewSet,
)
from apps.analytics.views import (
    OverviewStatsView, PageViewsView, ArticlePerformanceView,
    SearchAnalyticsView, AIUsageView,
    ConversationsTrendView,
)

router = DefaultRouter()
router.register(r'searches', SearchViewSet, basename='search')
router.register(r'widget-sessions', WidgetSessionViewSet, basename='widget-session')
router.register(r'conversations', ChatConversationViewSet, basename='chat-conversation')
router.register(r'messages', ChatMessageViewSet, basename='chat-message')
router.register(r'visitors', VisitorViewSet, basename='visitor')

app_name = 'analytics'

urlpatterns = [
    # Insights endpoints
    path('insights/overview/', OverviewStatsView.as_view(), name='insights-overview'),
    path('insights/page-views/', PageViewsView.as_view(), name='insights-page-views'),
    path('insights/article-performance/', ArticlePerformanceView.as_view(), name='insights-article-performance'),
    path('insights/search/', SearchAnalyticsView.as_view(), name='insights-search'),
    path('insights/', AIUsageView.as_view(), name='insights'),
    path('insights/conversations-trend/', ConversationsTrendView.as_view(), name='insights-conversations-trend'),
    
    # CRUD endpoints
    path('', include(router.urls)),
]
