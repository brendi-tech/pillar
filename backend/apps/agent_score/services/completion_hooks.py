"""
Side-effects that run when an AgentScoreReport finishes scoring.

Centralises the email + Slack notification logic so the two completion
paths (run_analyzers full-mode and finalize_report) stay DRY.
"""
import logging

from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


async def on_report_complete(report_id: str) -> None:
    """
    Run all side-effects when a report reaches status='complete'.

    Re-fetches the report to pick up email subscriptions that arrived
    during scoring.  Email is sent first (external-facing, must not be
    blocked by internal notification failures).  Slack follows as
    fire-and-forget.
    """
    from apps.agent_score.models import AgentScoreReport
    from apps.agent_score.services.email_service import (
        _build_report_url,
        send_score_report_email,
    )
    from common.services import slack

    fresh_report = await AgentScoreReport.objects.aget(id=report_id)

    # External email (high priority -- errors propagate)
    if fresh_report.email:
        await sync_to_async(send_score_report_email)(fresh_report)

    # Internal Slack notification (fire-and-forget)
    try:
        await sync_to_async(slack.notify_agent_score_complete)(
            domain=fresh_report.domain,
            overall_score=fresh_report.overall_score,
            report_url=_build_report_url(fresh_report),
            email=fresh_report.email or "",
        )
    except Exception:
        logger.exception(
            "[AGENT SCORE] Slack notification failed for report %s", report_id
        )
