"""
Serializers for Agent Score API endpoints.
"""
from rest_framework import serializers

from apps.agent_score.models import AgentScoreCheck, AgentScoreLogEntry, AgentScoreReport


class ScanRequestSerializer(serializers.Serializer):
    """Validates the POST /scan/ request body."""

    url = serializers.URLField(
        max_length=2048,
        help_text="The URL to scan for agent readiness",
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional email for follow-up",
    )
    test_signup = serializers.BooleanField(
        required=False,
        default=True,
        help_text=(
            "When enabled, we attempt to create a test account on the site "
            "using an AI agent. Default: true."
        ),
    )
    test_openclaw = serializers.BooleanField(
        required=False,
        default=False,
        help_text=(
            "When enabled, an OpenClaw agent will test the site end-to-end "
            "and self-score the experience. Default: false."
        ),
    )
    force_rescan = serializers.BooleanField(
        required=False,
        default=False,
        help_text=(
            "When true, bypasses the 1-hour cache and runs a fresh scan. "
            "Default: false."
        ),
    )


class ScanResponseSerializer(serializers.Serializer):
    """Response for POST /scan/ — returns the report_id for polling."""

    report_id = serializers.UUIDField(help_text="ID to poll for results")
    status = serializers.CharField(help_text="Current report status")


class CheckSerializer(serializers.ModelSerializer):
    """Serializer for individual check results within a report."""

    class Meta:
        model = AgentScoreCheck
        fields = [
            "category",
            "check_name",
            "check_label",
            "passed",
            "score",
            "status",
            "details",
            "recommendation",
        ]


class LogEntrySerializer(serializers.ModelSerializer):
    """Serializer for activity log entries within a report."""

    # Use created_at as the canonical timestamp field
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = AgentScoreLogEntry
        fields = [
            "timestamp",
            "workflow",
            "level",
            "message",
            "detail",
        ]


class ReportSerializer(serializers.ModelSerializer):
    """Full report serializer — includes scores and all check results."""

    checks = CheckSerializer(many=True, read_only=True)
    activity_log = LogEntrySerializer(
        source="log_entries", many=True, read_only=True,
    )
    token_metrics = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    category_config = serializers.SerializerMethodField()
    category_scores = serializers.SerializerMethodField()

    class Meta:
        model = AgentScoreReport
        fields = [
            "id",
            "url",
            "resolved_url",
            "redirect_chain",
            "domain",
            "status",
            "overall_score",
            "category_scores",
            "category_config",
            # Legacy per-category score fields (kept for backward compat)
            "content_score",
            "interaction_score",
            "webmcp_score",
            "signup_test_enabled",
            "signup_test_score",
            "signup_test_data",
            "openclaw_test_enabled",
            "openclaw_data",
            "token_metrics",
            "scan_notes",
            "screenshot_url",
            "checks",
            "activity_log",
            "progress",
            "error_message",
            "created_at",
        ]

    def get_progress(self, obj: AgentScoreReport) -> dict:
        """Compute step completion from model state for the progress UI."""
        # Browser analysis is "done" if we got a screenshot (success) OR
        # if a failure note was recorded (graceful degradation).
        _BROWSER_FAIL_TITLES = {
            "Browser analysis unavailable",
            "Could not load page in browser",
        }
        browser_done = (
            bool(obj.screenshot_url)
            or bool(obj.accessibility_tree)
            or bool(obj.rendered_html)
            or any(
                note.get("title") in _BROWSER_FAIL_TITLES
                for note in (obj.scan_notes or [])
            )
        )
        return {
            "http_probes_done": bool(obj.probe_results),
            "browser_analysis_done": browser_done,
            "analyzers_done": obj.checks.exists(),
            "signup_test_done": (
                not obj.signup_test_enabled
                or bool(obj.signup_test_data)
            ),
            "signup_test_status": obj.signup_test_status or "",
            "openclaw_test_done": (
                not obj.openclaw_test_enabled
                or bool(obj.openclaw_data)
            ),
            "openclaw_test_status": obj.openclaw_test_status or "",
            "scoring_done": obj.status == "complete",
        }

    def get_category_config(self, obj: AgentScoreReport) -> dict:
        """Return the category registry so the frontend can render dynamically."""
        from apps.agent_score.constants import CATEGORY_REGISTRY

        return {
            key: {
                "label": cfg["label"],
                "description": cfg["description"],
                "scored": cfg["weight"] is not None,
                "optional": cfg.get("optional", False),
                "sort_order": cfg["sort_order"],
            }
            for key, cfg in CATEGORY_REGISTRY.items()
        }

    def get_category_scores(self, obj: AgentScoreReport) -> dict:
        """Return category scores, falling back to legacy columns for old reports."""
        if obj.category_scores:
            return obj.category_scores
        # Fallback for pre-migration reports that only have individual columns
        return {
            "content": obj.content_score,
            "interaction": obj.interaction_score,
            "webmcp": obj.webmcp_score,
            "signup_test": obj.signup_test_score,
        }

    def get_token_metrics(self, obj: AgentScoreReport) -> dict:
        metrics: dict = {
            "html_token_count": obj.html_token_count,
            "markdown_token_count": obj.markdown_token_count,
            "content_token_count": obj.content_token_count,
            "supports_markdown_negotiation": obj.supports_markdown_negotiation,
        }

        # Include token reduction percentage when both counts are available
        if obj.html_token_count and obj.markdown_token_count:
            reduction = round(
                (1 - obj.markdown_token_count / obj.html_token_count) * 100, 1
            )
            metrics["token_reduction_percent"] = max(reduction, 0)

        # Include content signal if present
        if obj.content_signal:
            metrics["content_signal"] = obj.content_signal

        return metrics
