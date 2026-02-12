"""
AgentScoreReport — a single agent-readiness audit of a URL.

Not tenant-scoped: public tool, no organization FK.
"""
from django.db import models

from common.models.base import BaseModel


class AgentScoreReport(BaseModel):
    """A single agent-readiness audit of a URL."""

    url = models.URLField(
        max_length=2048,
        help_text="Full URL that was scanned",
    )
    domain = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Extracted domain for caching/aggregation",
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("running", "Running"),
            ("complete", "Complete"),
            ("failed", "Failed"),
        ],
        default="pending",
        db_index=True,
        help_text="Current processing status",
    )

    # ── Scores (weighted from 4 categories) ──
    overall_score = models.IntegerField(null=True, blank=True)
    content_score = models.IntegerField(null=True, blank=True)
    interaction_score = models.IntegerField(null=True, blank=True)
    webmcp_score = models.IntegerField(null=True, blank=True)

    # ── Agent Signup Test (opt-in, shown separately) ──
    signup_test_enabled = models.BooleanField(
        default=True,
        help_text="Whether the signup test was requested for this scan",
    )
    signup_test_score = models.IntegerField(
        null=True,
        blank=True,
        help_text="Signup test score 0-100 (null if not enabled or not yet scored)",
    )
    signup_test_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detailed results from the Stagehand signup attempt",
    )
    signup_test_status = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text=(
            "Short status message for the signup test progress UI. "
            "Updated at each phase: navigating, filling form, submitting, classifying."
        ),
    )

    # ── Raw data from Layer 1 (HTTP probes) ──
    raw_html = models.TextField(
        blank=True,
        default="",
        help_text="Main page HTML from httpx (pre-JS)",
    )
    page_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Meta tags, title, OG tags extracted from HTML",
    )
    probe_results = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured results from all HTTP probe requests",
    )

    # ── Raw data from Layer 2 (Browser analysis) ──
    rendered_html = models.TextField(
        blank=True,
        default="",
        help_text="Full HTML after JS execution (Playwright)",
    )
    accessibility_tree = models.JSONField(
        default=dict,
        blank=True,
        help_text="Playwright accessibility tree snapshot",
    )
    axe_results = models.JSONField(
        default=dict,
        blank=True,
        help_text="axe-core accessibility audit results",
    )
    webmcp_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="WebMCP detection results from JS execution",
    )
    forms_data = models.JSONField(
        default=list,
        blank=True,
        help_text="Enumerated forms with label analysis",
    )
    captcha_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="CAPTCHA detection results",
    )
    screenshot_url = models.URLField(
        max_length=2048,
        blank=True,
        default="",
        help_text="URL to stored full-page screenshot",
    )

    # ── Scan notes (surfaced to users) ──
    scan_notes = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "List of notes/warnings generated during the scan. "
            "Each entry: {type, category, title, detail}"
        ),
    )

    # ── Layer 3: Data center reality check ──
    datacenter_issues = models.JSONField(
        default=list,
        blank=True,
        help_text="Issues found from data center access perspective",
    )

    # ── Token metrics ──
    html_token_count = models.IntegerField(null=True, blank=True)
    markdown_token_count = models.IntegerField(null=True, blank=True)
    content_token_count = models.IntegerField(null=True, blank=True)

    # ── Content negotiation ──
    supports_markdown_negotiation = models.BooleanField(
        default=False,
        help_text="Site responds with text/markdown when Accept: text/markdown is sent",
    )
    content_signal = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Content-Signal header value (e.g. 'ai-train=yes, search=yes, ai-input=yes')",
    )

    # ── Workflow coordination ──
    completed_layers = models.IntegerField(
        default=0,
        help_text=(
            "Atomic counter for fan-in coordination. "
            "Incremented by each parallel task (http_probes, browser_analysis, "
            "and optionally signup_test). When it reaches the required count "
            "(2 or 3), the analyze-and-score task is triggered."
        ),
    )

    # ── Error tracking ──
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Error details if status is 'failed'",
    )

    # ── Optional lead capture ──
    email = models.EmailField(
        blank=True,
        default="",
        help_text="Optional email for follow-up",
    )

    class Meta:
        verbose_name = "Agent Score Report"
        verbose_name_plural = "Agent Score Reports"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["domain", "-created_at"],
                name="idx_asr_domain_created",
            ),
            models.Index(
                fields=["status"],
                name="idx_asr_status",
            ),
            # Covers the cache-lookup query in the scan endpoint:
            # .filter(domain=, status=, signup_test_enabled=, created_at__gte=)
            models.Index(
                fields=["domain", "status", "signup_test_enabled", "-created_at"],
                name="idx_asr_cache_lookup",
            ),
        ]

    def __str__(self) -> str:
        score = self.overall_score if self.overall_score is not None else "?"
        return f"{self.domain} — {score}/100 ({self.status})"
