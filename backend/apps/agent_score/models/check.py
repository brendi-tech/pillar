"""
AgentScoreCheck — individual check result within a report.
"""
from django.db import models

from common.models.base import BaseModel


class AgentScoreCheck(BaseModel):
    """Individual check result within an AgentScoreReport."""

    report = models.ForeignKey(
        "agent_score.AgentScoreReport",
        on_delete=models.CASCADE,
        related_name="checks",
        help_text="Parent report this check belongs to",
    )
    category = models.CharField(
        max_length=30,
        choices=[
            ("content", "Content"),
            ("interaction", "Interaction"),
            ("webmcp", "WebMCP"),
            ("signup_test", "Signup Test"),
        ],
        help_text="Scoring category this check belongs to",
    )
    check_name = models.CharField(
        max_length=100,
        help_text="Machine-readable check identifier (e.g. 'llms_txt_present')",
    )
    check_label = models.CharField(
        max_length=200,
        help_text="Human-readable check description (e.g. 'Has /llms.txt')",
    )
    passed = models.BooleanField(
        help_text="Whether the check passed",
    )
    score = models.IntegerField(
        help_text="Score from 0-100 for this individual check",
    )
    weight = models.FloatField(
        help_text="Relative weight within its category",
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Check-specific structured data",
    )
    recommendation = models.TextField(
        blank=True,
        default="",
        help_text="Actionable recommendation if check didn't pass",
    )

    class Meta:
        verbose_name = "Agent Score Check"
        verbose_name_plural = "Agent Score Checks"
        ordering = ["category", "check_name"]
        indexes = [
            models.Index(
                fields=["report", "category"],
                name="idx_asc_report_cat",
            ),
        ]

    def __str__(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        return f"[{status}] {self.check_label} ({self.score}/100)"
