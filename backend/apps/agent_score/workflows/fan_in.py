"""
Fan-in coordination for parallel Hatchet tasks.

http_probes, browser_analysis (and optionally signup_test) each call
complete_layer() when done.  The last one to finish triggers
analyze-and-score.
"""
import logging

from django.db.models import F

logger = logging.getLogger(__name__)

# 2 base layers (http_probes + browser_analysis), +1 if signup_test enabled
BASE_LAYERS = 2


def _required_layers(report) -> int:
    """Return the number of layers that must complete before scoring."""
    return BASE_LAYERS + (1 if report.signup_test_enabled else 0)


async def complete_layer(report_id: str) -> bool:
    """
    Atomically increment completed_layers on the report.
    If all layers are done, trigger the analyze-and-score task.

    Uses Django's F() expression for a race-condition-free increment.

    Returns True if this call triggered the next step.
    """
    from apps.agent_score.models import AgentScoreReport
    from common.task_router import TaskRouter

    # Atomic increment — translates to: UPDATE SET completed_layers = completed_layers + 1
    await AgentScoreReport.objects.filter(id=report_id).aupdate(
        completed_layers=F("completed_layers") + 1
    )

    # Re-read to check the new value
    report = await AgentScoreReport.objects.aget(id=report_id)
    required = _required_layers(report)

    # Don't trigger if the report has already failed (the other task errored)
    if report.status == "failed":
        logger.warning(
            f"[AGENT SCORE] Report {report_id} already failed, "
            f"skipping analyze-and-score"
        )
        return False

    if report.completed_layers >= required:
        logger.info(
            f"[AGENT SCORE] All {required} layers complete for "
            f"report {report_id} — triggering analyze-and-score"
        )
        TaskRouter.execute(
            "agent-score-analyze-and-score",
            report_id=report_id,
        )
        return True

    logger.info(
        f"[AGENT SCORE] Layer complete for report {report_id} "
        f"({report.completed_layers}/{required})"
    )
    return False
