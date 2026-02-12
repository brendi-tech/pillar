"""
URL configuration for Agent Score app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.agent_score.views import AgentScoreViewSet

router = DefaultRouter()
router.register(r"", AgentScoreViewSet, basename="agent-score")

urlpatterns = [
    path("", include(router.urls)),
]
