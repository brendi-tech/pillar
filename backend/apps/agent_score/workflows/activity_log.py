"""
Activity log helper — lightweight async function to record step-by-step
progress from any workflow phase.

INSERT-only: safe for concurrent calls from parallel Hatchet tasks.
"""
import logging

from asgiref.sync import sync_to_async
from django.db import close_old_connections

logger = logging.getLogger(__name__)


async def log_activity(
    report_id: str,
    workflow: str,
    level: str,
    message: str,
    detail: dict | None = None,
) -> None:
    """Append an activity log entry for a report.

    Safe for concurrent calls — each entry is a separate INSERT.

    Args:
        report_id: UUID of the AgentScoreReport.
        workflow: Workflow phase name (e.g. "http_probes", "signup_test").
        level: One of "info", "warning", "error", "success".
        message: Human-readable description of what happened.
        detail: Optional structured data for the expandable detail view.
    """
    try:
        from apps.agent_score.models import AgentScoreLogEntry

        await sync_to_async(close_old_connections)()
        await AgentScoreLogEntry.objects.acreate(
            report_id=report_id,
            workflow=workflow,
            level=level,
            message=message[:500],
            detail=detail or {},
        )
    except Exception:
        # Never let logging failures break a workflow
        logger.warning(
            f"[AGENT SCORE] Failed to write activity log for {report_id}",
            exc_info=True,
        )
