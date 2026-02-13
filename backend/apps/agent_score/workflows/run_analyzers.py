"""
Analyze and Score — runs all analyzers, datacenter check, and calculates final scores.

This is the fan-in target: triggered once all parallel layers (http_probes,
browser_analysis, and optionally signup_test) have completed. It runs the
static analyzers, merges any existing signup test checks, calculates scores,
and finalizes the report.
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class AnalyzeAndScoreInput(BaseModel):
    """Input for the analyze-and-score task."""
    report_id: str


def _run_datacenter_check(report) -> list[dict]:
    """
    Layer 3: Compare HTTP probe HTML vs rendered HTML for bot detection,
    Cloudflare challenges, and content parity.
    """
    issues: list[dict] = []

    raw_html = report.raw_html or ""
    rendered_html = report.rendered_html or ""
    captcha_data = report.captcha_data or {}

    # Check for Cloudflare challenge in HTTP response
    if raw_html:
        if "Just a moment" in raw_html or "challenge-platform" in raw_html:
            issues.append({
                "type": "cloudflare_challenge",
                "detail": "Site shows Cloudflare challenge to data center IPs",
                "impact": "Agents running from cloud infrastructure will be blocked",
            })

    # Check for significant content difference (JS-dependent content)
    if raw_html and rendered_html:
        from bs4 import BeautifulSoup

        def _text_len(html: str) -> int:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup.find_all(["script", "style"]):
                tag.decompose()
            return len(soup.get_text(strip=True))

        http_text_len = _text_len(raw_html)
        rendered_text_len = _text_len(rendered_html)

        if http_text_len > 0 and rendered_text_len > http_text_len * 3:
            ratio = rendered_text_len / http_text_len
            issues.append({
                "type": "js_dependent_content",
                "detail": (
                    f"Page content is {ratio:.0f}x larger after JS execution "
                    f"({http_text_len} chars raw vs {rendered_text_len} chars rendered)"
                ),
                "impact": "Agents that don't execute JavaScript will miss most content",
            })

    # Check for CAPTCHA in rendered page
    if captcha_data.get("detected"):
        issues.append({
            "type": "captcha_on_render",
            "detail": f"CAPTCHA detected: {captcha_data.get('type', 'unknown')}",
            "impact": "AI agents cannot bypass CAPTCHAs",
        })

    return issues


@hatchet.task(
    name="agent-score-analyze-and-score",
    retries=1,
    execution_timeout=timedelta(seconds=120),
    input_validator=AnalyzeAndScoreInput,
)
async def analyze_and_score_workflow(
    workflow_input: AnalyzeAndScoreInput, context: Context
):
    """
    Run all 6 analyzers, datacenter check, calculate weighted scores,
    and finalize the report.

    Triggered by the fan-in after all parallel layers complete (http_probes,
    browser_analysis, and optionally signup_test). Signup test checks are
    already in the DB by the time this runs.
    """
    from asgiref.sync import sync_to_async

    from apps.agent_score.analyzers import (
        assess_data_quality,
        run_accessibility,
        run_discovery,
        run_interactability,
        run_permissions,
        run_readability,
        run_webmcp,
    )
    from apps.agent_score.analyzers.scoring import calculate_overall_score
    from apps.agent_score.models import AgentScoreCheck, AgentScoreReport

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Running analyze-and-score for report {report_id}")

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
        # ── Phase 0: Assess data quality ────────────────────────────────────
        dq = await sync_to_async(assess_data_quality)(report)

        # ── Phase 1: Run all analyzers ──────────────────────────────────────
        all_check_results = await sync_to_async(lambda: (
            run_discovery(report, dq)
            + run_readability(report, dq)
            + run_interactability(report, dq)
            + run_permissions(report, dq)
            + run_accessibility(report, dq)
            + run_webmcp(report, dq)
        ))()

        # Data center reality check (Layer 3)
        datacenter_issues = await sync_to_async(_run_datacenter_check)(report)

        # Bulk-create check records
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

        # Auto-append scan note when >50% of checks are DNF
        dnf_count = sum(1 for cr in all_check_results if cr.status == "dnf")
        total_count = len(all_check_results)
        if total_count > 0 and dnf_count / total_count > 0.5:
            existing_notes = report.scan_notes or []
            existing_notes.append({
                "type": "warning",
                "category": None,
                "title": "Limited scan results",
                "detail": (
                    f"{dnf_count} of {total_count} checks could not run "
                    "because our servers were blocked from accessing this "
                    "site. The score shown is based on the checks that "
                    "completed successfully."
                ),
            })
            report.scan_notes = existing_notes
            await report.asave(update_fields=["scan_notes"])

        # Store datacenter issues
        report.datacenter_issues = datacenter_issues
        await report.asave(update_fields=["datacenter_issues"])

        logger.info(
            f"[AGENT SCORE] Created {len(check_objects)} checks, "
            f"{len(datacenter_issues)} datacenter issues for report {report_id}"
        )

        # ── Phase 2: Calculate scores ───────────────────────────────────────
        # All checks are in the DB now — including signup_test checks if that
        # layer ran in parallel. Read them all for the final score.
        checks = await sync_to_async(
            lambda: list(
                report.checks.values(
                    "category", "check_name", "score", "weight", "passed"
                )
            )
        )()

        scores = calculate_overall_score(checks)

        report.overall_score = scores["overall"]
        report.content_score = scores["categories"].get("content", 0)
        report.interaction_score = scores["categories"].get("interaction", 0)
        report.webmcp_score = scores["categories"].get("webmcp", 0)
        report.status = "complete"

        update_fields = [
            "overall_score",
            "content_score",
            "interaction_score",
            "webmcp_score",
            "status",
        ]

        # Include signup_test_score if that layer ran
        signup_score = scores["categories"].get("signup_test")
        if report.signup_test_enabled and signup_score is not None:
            report.signup_test_score = signup_score
            update_fields.append("signup_test_score")

        await report.asave(update_fields=update_fields)

        logger.info(
            f"[AGENT SCORE] Report {report_id} complete — "
            f"overall={scores['overall']}/100"
            + (f", signup={signup_score}/100" if signup_score is not None else "")
        )

        return {
            "status": "success",
            "report_id": report_id,
            "check_count": len(check_objects),
            "overall_score": scores["overall"],
        }

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Analyze-and-score failed for {report_id}: {e}",
            exc_info=True,
        )
        report.status = "failed"
        report.error_message = f"Analyze-and-score failed: {e}"
        await report.asave(update_fields=["status", "error_message"])
        return {"status": "error", "error": str(e)}
