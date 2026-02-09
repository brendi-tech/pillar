"""
Views for the analytics app.
"""
from .insights import (
    OverviewStatsView,
    PageViewsView,
    ArticlePerformanceView,
    SearchAnalyticsView,
    AIUsageView,
    ConversationsTrendView,
)

__all__ = [
    'OverviewStatsView',
    'PageViewsView',
    'ArticlePerformanceView',
    'SearchAnalyticsView',
    'AIUsageView',
    'ConversationsTrendView',
]
