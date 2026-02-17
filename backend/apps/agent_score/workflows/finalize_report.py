"""
Finalize Report — recomputes scores after optional layers complete.

Triggered by the fan-in when all optional layers (signup_test, openclaw_test)
have finished and partial scoring (analyze-and-score) has already run. This
lightweight task reads all checks (including newly created ones), recomputes
the overall score, and sets the report status to "complete".
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class FinalizeReportInput(BaseModel):
    """Input for the finalize-report task."""
    report_id: str


@hatchet.task(
    name="agent-score-finalize-report",
    retries=1,
    execution_timeout=timedelta(seconds=30),
    input_validator=FinalizeReportInput,
)
async def finalize_report_workflow(
    workflow_input: FinalizeReportInput, context: Context
):
    """
    Recompute scores with all checks (including signup) and finalize.

    This is a lightweight task — no analyzers to run, just re-read the
    checks that are already in the DB and calculate the final scores.
    """
    from asgiref.sync import sync_to_async

    from apps.agent_score.analyzers.scoring import calculate_overall_score
    from apps.agent_score.models import AgentScoreReport

    from apps.agent_score.workflows.activity_log import log_activity

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Finalizing report {report_id}")
    await log_activity(report_id, "finalize", "info", "Finalizing report scores")

    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(f"[AGENT SCORE] Report {report_id} not found for finalize")
        return {"status": "error", "error": "report_not_found"}

    try:
        # Safety net: if analyze-and-score was skipped (fan-in race condition),
        # run the analyzers now so rules/webmcp checks exist before scoring.
        has_rules_checks = await sync_to_async(
            report.checks.filter(category__in=["rules", "webmcp"]).exists
        )()
        if not has_rules_checks:
            logger.warning(
                f"[AGENT SCORE] No rules/webmcp checks found for {report_id} "
                f"— running analyzers inline as safety net"
            )
            await log_activity(
                report_id, "finalize", "info",
                "Running analyzers (safety net — analyze-and-score was skipped)",
            )
            from apps.agent_score.analyzers import (
                assess_data_quality,
                run_accessibility,
                run_discovery,
                run_interactability,
                run_permissions,
                run_readability,
                run_webmcp,
            )
            from apps.agent_score.models import AgentScoreCheck

            dq = await sync_to_async(assess_data_quality)(report)
            all_check_results = await sync_to_async(lambda: (
                run_discovery(report, dq)
                + run_readability(report, dq)
                + run_interactability(report, dq)
                + run_permissions(report, dq)
                + run_accessibility(report, dq)
                + run_webmcp(report, dq)
            ))()
            check_objects = [
                AgentScoreCheck(
                    report=report,
                    category=cr.category,
                    check_name=cr.check_name,
                    check_label=cr.check_label,
                    passed=cr.passed,
                    score=cr.score,
                    weight=cr.weight,
                    details=cr.details,
                    recommendation=cr.recommendation,
                    status=cr.status,
                )
                for cr in all_check_results
            ]
            await sync_to_async(
                lambda: AgentScoreCheck.objects.bulk_create(check_objects)
            )()
            logger.info(
                f"[AGENT SCORE] Safety net created {len(check_objects)} checks "
                f"for report {report_id}"
            )

        # Read all checks — now includes signup_test checks
        checks = await sync_to_async(
            lambda: list(
                report.checks.values(
                    "category", "check_name", "score", "weight", "passed", "status"
                )
            )
        )()

        scores = calculate_overall_score(checks)

        report.overall_score = scores["overall"]
        # Merge calculated scores with any directly-written scores (e.g. openclaw)
        # so we don't lose data from layers that wrote their own score.
        merged_categories = {**(report.category_scores or {}), **scores["categories"]}
        report.category_scores = merged_categories

        # Legacy per-category columns (rules replaces content+interaction)
        report.content_score = scores["categories"].get("rules")
        report.interaction_score = scores["categories"].get("rules")
        report.webmcp_score = scores["categories"].get("webmcp")
        report.status = "complete"

        update_fields = [
            "overall_score",
            "category_scores",
            "content_score",
            "interaction_score",
            "webmcp_score",
            "status",
        ]

        signup_score = scores["categories"].get("signup_test")
        if report.signup_test_enabled and signup_score is not None:
            report.signup_test_score = signup_score
            update_fields.append("signup_test_score")

        await report.asave(update_fields=update_fields)

        # Invalidate the lookup-by-domain cache for this domain
        from common.cache_keys import CacheKeys
        await sync_to_async(CacheKeys.clear_agent_score_domain_report)(report.domain)

        logger.info(
            f"[AGENT SCORE] Report {report_id} finalized — "
            f"overall={scores['overall']}/100"
            + (f", signup={signup_score}/100" if signup_score is not None else "")
        )
        await log_activity(
            report_id, "finalize", "success",
            f"Report finalized: {scores['overall']}/100",
            {"overall_score": scores["overall"], "category_scores": scores["categories"]},
        )

        # Email + Slack notification
        from apps.agent_score.services.completion_hooks import on_report_complete

        await on_report_complete(report_id)

        return {
            "status": "success",
            "report_id": report_id,
            "overall_score": scores["overall"],
        }

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Finalize failed for {report_id}: {e}",
            exc_info=True,
        )
        await log_activity(
            report_id, "finalize", "error",
            f"Finalize failed: {type(e).__name__}",
            {"error": str(e)},
        )
        report.status = "failed"
        report.error_message = f"Finalize failed: {e}"
        await report.asave(update_fields=["status", "error_message"])
        return {"status": "error", "error": str(e)}
