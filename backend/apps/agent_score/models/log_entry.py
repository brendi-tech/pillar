"""
AgentScoreLogEntry — activity log entry for an agent score report.

Captures step-by-step progress from all workflow phases so the frontend
can render a real-time activity timeline.
"""
from django.db import models

from common.models.base import BaseModel


class AgentScoreLogEntry(BaseModel):
    """Single activity log entry within an AgentScoreReport scan."""

    report = models.ForeignKey(
        "agent_score.AgentScoreReport",
        on_delete=models.CASCADE,
        related_name="log_entries",
        help_text="Parent report this log entry belongs to",
    )
    workflow = models.CharField(
        max_length=50,
        help_text=(
            "Workflow phase that produced this entry, e.g. "
            "'http_probes', 'browser_analysis', 'signup_test', "
            "'openclaw_test', 'analyze_and_score', 'finalize'"
        ),
    )
    level = models.CharField(
        max_length=10,
        choices=[
            ("info", "Info"),
            ("warning", "Warning"),
            ("error", "Error"),
            ("success", "Success"),
        ],
        default="info",
        help_text="Severity level for display styling",
    )
    message = models.CharField(
        max_length=500,
        help_text="Human-readable description of what happened",
    )
    detail = models.JSONField(
        default=dict,
        blank=True,
        help_text="Expandable structured data (URLs, status codes, errors, etc.)",
    )

    class Meta:
        verbose_name = "Agent Score Log Entry"
        verbose_name_plural = "Agent Score Log Entries"
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["report", "created_at"],
                name="idx_aslog_report_created",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.level}] {self.workflow}: {self.message}"
