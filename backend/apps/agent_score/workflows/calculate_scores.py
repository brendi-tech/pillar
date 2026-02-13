"""
Calculate final scores — weighted rollup from checks to category and overall scores.

This is the final step in the workflow chain. Sets report status to 'complete'.
Called after signup test completes to recalculate with all 4 categories.
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class CalculateScoresInput(BaseModel):
    """Input for the calculate-scores task."""
    report_id: str


@hatchet.task(
    name="agent-score-calculate-scores",
    retries=1,
    execution_timeout=timedelta(seconds=30),
    input_validator=CalculateScoresInput,
)
async def calculate_scores_workflow(
    workflow_input: CalculateScoresInput, context: Context
):
    """
    Load all checks, compute weighted scores, finalize the report.
    """
    from asgiref.sync import sync_to_async

    from apps.agent_score.analyzers.scoring import calculate_overall_score
    from apps.agent_score.models import AgentScoreReport

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Calculating scores for report {report_id}")

    # Close stale DB connections — Hatchet workers hold long-lived connections
    # that the DB server may have closed (idle timeout, restart, etc.)
    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(f"[AGENT SCORE] Report {report_id} not found")
        return {"status": "error", "error": "report_not_found"}

    try:
        # Load all checks as dicts for the scoring function
        checks = await sync_to_async(
            lambda: list(
                report.checks.values(
                    "category", "check_name", "score", "weight", "passed"
                )
            )
        )()

        scores = calculate_overall_score(checks)

        # Update report with final scores
        report.overall_score = scores["overall"]
        report.content_score = scores["categories"].get("content", 0)
        report.interaction_score = scores["categories"].get("interaction", 0)
        report.webmcp_score = scores["categories"].get("webmcp", 0)

        # Signup test score (only if enabled and present)
        signup_score = scores["categories"].get("signup_test")
        if report.signup_test_enabled and signup_score is not None:
            report.signup_test_score = signup_score

        report.status = "complete"

        update_fields = [
            "overall_score",
            "content_score",
            "interaction_score",
            "webmcp_score",
            "status",
        ]
        if report.signup_test_enabled and signup_score is not None:
            update_fields.append("signup_test_score")

        await report.asave(update_fields=update_fields)

        logger.info(
            f"[AGENT SCORE] Report {report_id} complete — "
            f"score={scores['overall']}/100"
            + (f", signup={signup_score}/100" if signup_score is not None else "")
        )

        return {
            "status": "success",
            "report_id": report_id,
            "overall_score": scores["overall"],
            "signup_test_score": signup_score,
        }

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Score calculation failed for {report_id}: {e}",
            exc_info=True,
        )
        report.status = "failed"
        report.error_message = f"Score calculation failed: {e}"
        await report.asave(update_fields=["status", "error_message"])
        return {"status": "error", "error": str(e)}
