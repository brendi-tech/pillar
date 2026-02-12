"""
Django admin configuration for Agent Score models.
"""
from django.contrib import admin

from apps.agent_score.models import AgentScoreCheck, AgentScoreReport


@admin.register(AgentScoreReport)
class AgentScoreReportAdmin(admin.ModelAdmin):
    """Admin for AgentScoreReport."""

    list_display = [
        "domain",
        "status",
        "overall_score",
        "webmcp_score",
        "created_at",
    ]
    list_filter = ["status"]
    search_fields = ["domain", "url", "email"]
    ordering = ["-created_at"]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
        "overall_score",
        "content_score",
        "interaction_score",
        "webmcp_score",
        "signup_test_score",
        "html_token_count",
        "markdown_token_count",
        "content_token_count",
    ]


@admin.register(AgentScoreCheck)
class AgentScoreCheckAdmin(admin.ModelAdmin):
    """Admin for AgentScoreCheck."""

    list_display = [
        "check_label",
        "category",
        "passed",
        "score",
        "report",
    ]
    list_filter = ["category", "passed"]
    search_fields = ["check_name", "check_label"]
    ordering = ["category", "check_name"]
    readonly_fields = ["id", "created_at", "updated_at"]
