"""
Email service for Agent Score report notifications.

Sends a branded HTML email with the overall score, category breakdown,
and a link back to the full report.
"""
import logging
from typing import TYPE_CHECKING

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)


def _score_color(score: int | None) -> str:
    """Return the hex color for a score value."""
    if score is None:
        return "#9A9A9A"
    if score >= 90:
        return "#0CCE6B"
    if score >= 50:
        return "#FFA400"
    return "#FF4E42"


def _score_label(score: int | None) -> str:
    """Return a human-readable label for a score."""
    if score is None:
        return "N/A"
    if score >= 90:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Needs work"


def _build_report_url(report: "AgentScoreReport") -> str:
    """Build the full URL to view the report on the marketing site."""
    frontend_url = getattr(settings, "FRONTEND_URL", "https://trypillar.com")
    # Strip trailing slashes
    frontend_url = frontend_url.rstrip("/")
    return f"{frontend_url}/tools/agent-score?report={report.id}"


def _build_category_row(label: str, score: int | None) -> str:
    """Build an HTML table row for a category score."""
    color = _score_color(score)
    display = str(score) if score is not None else "—"
    return f"""
        <tr>
            <td style="padding: 10px 0; font-size: 15px; color: #1A1A1A; border-bottom: 1px solid #F0EDE8;">
                {label}
            </td>
            <td style="padding: 10px 0; font-size: 15px; font-weight: 600; color: {color}; text-align: right; border-bottom: 1px solid #F0EDE8;">
                {display}
            </td>
        </tr>"""


def send_score_report_email(report: "AgentScoreReport") -> bool:
    """
    Send the score report email for a completed report.

    Args:
        report: A completed AgentScoreReport with email set.

    Returns:
        True if the email was sent, False otherwise.
    """
    if not report.email:
        return False

    if report.status != "complete":
        logger.warning(
            f"[AGENT SCORE] Skipping email for report {report.id} "
            f"— status is {report.status}, not complete"
        )
        return False

    if report.email_sent_at is not None:
        logger.info(
            f"[AGENT SCORE] Email already sent for report {report.id} "
            f"at {report.email_sent_at} — skipping duplicate"
        )
        return False

    try:
        from apps.agent_score.constants import CATEGORY_REGISTRY

        report_url = _build_report_url(report)
        overall = report.overall_score
        overall_color = _score_color(overall)
        overall_display = str(overall) if overall is not None else "—"

        # Build category rows
        category_rows = ""
        category_scores = report.category_scores or {}
        for key, cfg in sorted(
            CATEGORY_REGISTRY.items(), key=lambda x: x[1]["sort_order"]
        ):
            # Skip optional categories that weren't enabled
            if cfg.get("optional") and key == "signup_test" and not report.signup_test_enabled:
                continue
            if cfg.get("optional") and key == "openclaw" and not report.openclaw_test_enabled:
                continue
            score = category_scores.get(key)
            label = cfg["label"]
            if cfg["weight"] is None:
                label += " *"
            category_rows += _build_category_row(label, score)

        subject = f"Your Agent Readiness Score: {overall_display}/100 — {report.domain}"

        # Plain text version
        message = f"""Your Agent Readiness Score for {report.domain}

Overall Score: {overall_display}/100

View your full report: {report_url}

Thanks,
The Pillar Team
""".strip()

        # HTML version
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 0; background-color: #F3EFE8;">
    <div style="background-color: #F3EFE8; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto;">
            <!-- Header -->
            <div style="background-color: #1A1A1A; padding: 32px 36px; border-radius: 12px 12px 0 0;">
                <img src="https://storage.googleapis.com/pillar-prod-marketing/email/pillar-logo-white.png?v=2"
                     alt="Pillar"
                     width="99"
                     height="34"
                     style="display: block; border: 0; outline: none;">
            </div>

            <!-- Body -->
            <div style="background-color: #FFFFFF; padding: 36px; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4;">
                <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1A1A1A;">
                    Your Agent Readiness Score
                </h2>
                <p style="margin: 0 0 24px 0; color: #6B6B6B; font-size: 14px;">
                    Results for <strong style="color: #1A1A1A;">{report.domain}</strong>
                </p>

                <!-- Overall score circle -->
                <div style="text-align: center; padding: 20px 0 28px 0;">
                    <div style="display: inline-block; width: 120px; height: 120px; border-radius: 50%; border: 6px solid {overall_color}; text-align: center; line-height: 108px;">
                        <span style="font-size: 42px; font-weight: 700; color: {overall_color}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                            {overall_display}
                        </span>
                    </div>
                    <p style="margin: 12px 0 0 0; font-size: 14px; color: #6B6B6B;">
                        out of 100
                    </p>
                </div>

                <!-- Category breakdown -->
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; border-bottom: 2px solid #E8E4DC;">
                                Category
                            </th>
                            <th style="padding: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; border-bottom: 2px solid #E8E4DC;">
                                Score
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {category_rows}
                    </tbody>
                </table>

                <!-- CTA -->
                <div style="text-align: center; margin: 32px 0 8px 0;">
                    <a href="{report_url}"
                       style="display: inline-block; background-color: #FF6E00; color: #FFFFFF; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.01em;">
                        View Full Report
                    </a>
                </div>
                <p style="text-align: center; color: #999; font-size: 12px; margin: 0;">
                    See detailed checks, recommendations, and session recordings
                </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #FFFFFF; padding: 24px 36px; border-top: 1px solid #E8E4DC; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4; border-radius: 0 0 12px 12px;">
                <p style="color: #6B6B6B; font-size: 12px; margin: 0; line-height: 1.5;">
                    You received this email because you requested an Agent Readiness Score
                    for {report.domain} on <a href="https://trypillar.com" style="color: #FF6E00; text-decoration: none;">Pillar</a>.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
""".strip()

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[report.email],
            html_message=html_message,
            fail_silently=False,
        )

        report.email_sent_at = timezone.now()
        report.save(update_fields=["email_sent_at"])

        logger.info(
            f"[AGENT SCORE] Sent score report email to {report.email} "
            f"for report {report.id} (score: {overall})"
        )
        return True

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Failed to send score report email to "
            f"{report.email} for report {report.id}: {e}"
        )
        return False
