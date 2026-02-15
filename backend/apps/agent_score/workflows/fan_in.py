"""
Fan-in coordination for parallel Hatchet tasks.

http_probes, browser_analysis, signup_test, and openclaw_test each call
complete_layer() when done.

Two-phase triggering for progressive results:
  Phase 1 — base layers (http_probes + browser_analysis) ready →
             trigger analyze-and-score immediately so the user sees
             rules / webmcp scores within ~7 s.
  Phase 2 — all layers (signup_test, openclaw_test) finish after
             partial scoring → trigger finalize-report to recompute
             overall score.

When all layers finish before (or at the same time as) the base
layers, everything fires in a single pass — no finalize needed.
"""
import logging

from asgiref.sync import sync_to_async
from django.db.models import F

logger = logging.getLogger(__name__)

# Sentinel names used in scan_notes when browser_analysis fails gracefully
_BROWSER_FAIL_TITLES = {
    "Browser analysis unavailable",
    "Could not load page in browser",
}


def _base_layers_ready(report) -> bool:
    """Check if http_probes and browser_analysis have both finished."""
    has_probes = bool(report.probe_results)
    # Browser analysis is done when we have any of its outputs:
    # screenshot, accessibility tree, or rendered HTML.
    # Screenshot upload can fail (e.g. GCS 403) while the rest succeeds,
    # so we can't rely on screenshot_url alone.
    has_browser = (
        bool(report.screenshot_url)
        or bool(report.accessibility_tree)
        or bool(report.rendered_html)
        or any(
            note.get("title") in _BROWSER_FAIL_TITLES
            for note in (report.scan_notes or [])
        )
    )
    return has_probes and has_browser


async def complete_layer(report_id: str) -> bool:
    """
    Atomically increment completed_layers on the report, then decide
    which downstream task (if any) to trigger.

    Uses Django's F() expression for a race-condition-free increment.

    Returns True if this call triggered a downstream task.
    """
    from apps.agent_score.models import AgentScoreReport
    from common.task_router import TaskRouter

    # Atomic increment — UPDATE SET completed_layers = completed_layers + 1
    await AgentScoreReport.objects.filter(id=report_id).aupdate(
        completed_layers=F("completed_layers") + 1
    )

    # Re-read to check the new value and data state
    report = await AgentScoreReport.objects.aget(id=report_id)

    # Don't trigger if the report has already failed (the other task errored)
    if report.status == "failed":
        logger.warning(
            f"[AGENT SCORE] Report {report_id} already failed, "
            f"skipping downstream tasks"
        )
        return False

    base_ready = _base_layers_ready(report)
    signup_ready = (not report.signup_test_enabled) or bool(report.signup_test_data)
    openclaw_ready = (not report.openclaw_test_enabled) or bool(report.openclaw_data)
    all_layers_ready = signup_ready and openclaw_ready
    checks_exist = await sync_to_async(report.checks.exists)()

    # Phase 1: base layers done, no checks yet → run analyzers
    # (may produce partial or full results depending on optional layer status)
    if base_ready and not checks_exist:
        logger.info(
            f"[AGENT SCORE] Base layers ready for report {report_id} "
            f"— triggering analyze-and-score"
        )
        TaskRouter.execute(
            "agent-score-analyze-and-score",
            report_id=report_id,
        )
        return True

    # Phase 2: all layers finished after partial scoring → finalize
    if checks_exist and all_layers_ready and report.status != "complete":
        logger.info(
            f"[AGENT SCORE] All layers complete for report {report_id} "
            f"— triggering finalize-report"
        )
        TaskRouter.execute(
            "agent-score-finalize-report",
            report_id=report_id,
        )
        return True

    logger.info(
        f"[AGENT SCORE] Layer complete for report {report_id} "
        f"({report.completed_layers} layers done)"
    )
    return False
