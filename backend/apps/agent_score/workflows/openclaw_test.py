"""
OpenClaw Agent Experience Test — calls the standalone OpenClaw Cloud Run
service to evaluate how easy a website is for AI agents.

Runs in parallel with http_probes, browser_analysis, and (optionally)
signup_test. Joins the fan-in via complete_layer() so the finalize step
includes the openclaw category in the final report.

Architecture:
- A standalone Cloud Run service (openclaw-agent-score) runs the OpenClaw
  gateway with Chromium.  It stays warm via min-instances and handles up
  to 5 concurrent requests per instance.
- This workflow sends an HTTP POST to that service, waits for the result,
  then parses the self-scored JSON and saves checks to the DB.
- No subprocess management, no lock, no local Chromium needed.

Key properties:
- OpenClaw self-scores the experience 0-100 (no second LLM classification)
- Checks are dynamic — generated from whatever OpenClaw actually tried
- The agent reports what worked, what didn't, and a narrative summary
"""
import asyncio
import json as json_mod
import logging
import os
from datetime import timedelta

import httpx
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class OpenclawTestInput(BaseModel):
    """Input for the openclaw-test task."""
    report_id: str


# Canonical skill lives in the pillarhq/openclaw-agent-score GitHub repo,
# synced from openclaw/skills/agent-score/ via GitHub Actions.
# The worker fetches it at runtime so there's no copy to keep in sync.
_SKILL_GITHUB_RAW_URL = (
    "https://raw.githubusercontent.com/pillarhq/"
    "openclaw-agent-score/main/SKILL.md"
)

# Local fallback paths for development (no network needed).
_SKILL_LOCAL_PATHS = [
    str(
        __import__("pathlib").Path(__file__).resolve().parents[3]
        / "openclaw"
        / "skills"
        / "agent-score"
        / "SKILL.md"
    ),
]

_skill_body_cache: str | None = None


def _strip_frontmatter(content: str) -> str:
    """Strip YAML frontmatter (--- ... ---) from skill content."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            return content[end + 3:].lstrip("\n")
    return content


def _load_skill_body() -> str:
    """
    Load the agent-score SKILL.md, trying local paths first then
    fetching from GitHub.  Result is cached for the process lifetime.
    """
    global _skill_body_cache
    if _skill_body_cache is not None:
        return _skill_body_cache

    from pathlib import Path

    # Try local paths first (fast, works in dev and if file is present)
    for path_str in _SKILL_LOCAL_PATHS:
        p = Path(path_str)
        if p.is_file():
            content = p.read_text(encoding="utf-8")
            logger.info("[AGENT SCORE] Loaded skill from %s", p)
            _skill_body_cache = _strip_frontmatter(content)
            return _skill_body_cache

    # Fetch from GitHub (production path — no local copy needed)
    import httpx

    try:
        resp = httpx.get(_SKILL_GITHUB_RAW_URL, timeout=10.0)
        resp.raise_for_status()
        content = resp.text
        logger.info(
            "[AGENT SCORE] Fetched skill from GitHub (%d bytes)",
            len(content),
        )
        _skill_body_cache = _strip_frontmatter(content)
        return _skill_body_cache
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load agent-score skill from local paths "
            f"({_SKILL_LOCAL_PATHS}) or GitHub ({_SKILL_GITHUB_RAW_URL}): "
            f"{exc}"
        ) from exc


def build_openclaw_eval_prompt(url: str) -> str:
    """Build the evaluation prompt for a specific URL.

    Prepends the target URL to the shared skill instructions so the
    agent knows which site to evaluate.
    """
    body = _load_skill_body()
    return (
        f"Your target URL is: {url}\n"
        f"Open this URL in the browser now: {url}\n\n"
        f"{body}"
    )


def _extract_message(response_data: dict) -> str:
    """Extract the text message from an OpenClaw /v1/responses response."""
    # OpenResponses API returns output[] with message content
    output = response_data.get("output", [])
    for item in output:
        if item.get("type") == "message":
            content = item.get("content", [])
            for part in content:
                if part.get("type") == "output_text":
                    return part.get("text", "")
    # Fallback: try common response shapes
    if "message" in response_data:
        return response_data["message"]
    if "choices" in response_data:
        choices = response_data["choices"]
        if choices and "message" in choices[0]:
            return choices[0]["message"].get("content", "")
    return str(response_data)


def _build_checks_from_result(result: dict) -> list[dict]:
    """
    Convert OpenClaw's self-scored JSON into AgentScoreCheck-compatible dicts.

    Each tasks_tried entry becomes a check. Boolean fields (mcp_found, etc.)
    become additional checks. All checks use category="openclaw".
    """
    checks: list[dict] = []

    # Boolean-level checks
    bool_checks = [
        ("mcp_found", "MCP tools detected", "mcp_found"),
        ("mcp_usable", "MCP tools usable by agent", "mcp_usable"),
        ("signup_attempted", "Agent attempted signup", "signup_attempted"),
        ("signup_succeeded", "Agent signup succeeded", "signup_succeeded"),
    ]
    for check_name, label, key in bool_checks:
        value = result.get(key)
        if value is not None:
            checks.append({
                "category": "openclaw",
                "check_name": f"oc_{check_name}",
                "check_label": label,
                "passed": bool(value),
                "score": 100 if value else 0,
                "weight": 1,
                "details": {},
                "recommendation": "",
            })

    # Task-level checks from tasks_tried
    for i, task in enumerate(result.get("tasks_tried", [])):
        task_name = task.get("task", f"Task {i + 1}")
        succeeded = task.get("succeeded", False)
        detail = task.get("detail", "")

        # Create a slug-safe check name from the task description
        slug = task_name.lower().replace(" ", "_")[:40]
        slug = "".join(c for c in slug if c.isalnum() or c == "_")

        checks.append({
            "category": "openclaw",
            "check_name": f"oc_task_{slug}_{i}",
            "check_label": task_name,
            "passed": succeeded,
            "score": 100 if succeeded else 0,
            "weight": 1,
            "details": {"detail": detail} if detail else {},
            "recommendation": "",
        })

    return checks


# ---------------------------------------------------------------------------
# Standalone OpenClaw Cloud Run service client
# ---------------------------------------------------------------------------

_OPENCLAW_SERVICE_URL = os.environ.get("OPENCLAW_SERVICE_URL", "")
_OPENCLAW_GATEWAY_TOKEN = os.environ.get(
    "OPENCLAW_GATEWAY_TOKEN", "pillar-agent-score-token"
)


def _is_retryable_openclaw_error(exc: Exception) -> bool:
    """
    Return True for transient errors that are safe to retry.

    These are infrastructure failures (service down, deploy in progress,
    network issues) — NOT application-level errors from the agent.
    """
    if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ConnectError)):
        return True

    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500:
        return True

    msg = str(exc).lower()
    if "timed out" in msg or "connection refused" in msg:
        return True

    return False


_OPENCLAW_RETRY_DELAYS = [10, 30, 60]  # seconds between attempts


async def _call_openclaw_service(prompt: str) -> dict:
    """
    Send an evaluation prompt to the standalone OpenClaw Cloud Run service.

    Returns the full response dict from the /v1/responses endpoint.
    """
    if not _OPENCLAW_SERVICE_URL:
        raise RuntimeError(
            "OPENCLAW_SERVICE_URL is not set. Configure it in the worker "
            "environment to point at the openclaw-agent-score Cloud Run "
            "service URL."
        )

    from common.utils.llm_config import LLMConfigService

    model = LLMConfigService.get_openrouter_model("google/budget")

    url = f"{_OPENCLAW_SERVICE_URL}/v1/responses"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_OPENCLAW_GATEWAY_TOKEN}",
    }
    payload = {"model": model, "input": prompt}

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(280.0, connect=10.0),
    ) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()


# ---------------------------------------------------------------------------
# Hatchet workflow
# ---------------------------------------------------------------------------

@hatchet.task(
    name="agent-score-openclaw-test",
    retries=1,
    execution_timeout=timedelta(minutes=8),
    input_validator=OpenclawTestInput,
)
async def openclaw_test_workflow(
    workflow_input: OpenclawTestInput, context: Context
):
    """
    Evaluate a site's agent-readiness using the OpenClaw Cloud Run service.

    Sends the eval prompt via HTTP to the standalone openclaw-agent-score
    service, parses the self-scored JSON result, creates check records,
    and stores the narrative data on the report.
    """
    from apps.agent_score.models import AgentScoreReport

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Starting OpenClaw test for report {report_id}")

    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(
            f"[AGENT SCORE] Report {report_id} not found for OpenClaw test"
        )
        return {"status": "error", "error": "report_not_found"}

    async def _update_status(status_text: str) -> None:
        report.openclaw_test_status = status_text
        await report.asave(update_fields=["openclaw_test_status"])

    return await _run_openclaw_test(
        report, report_id, _update_status, workflow_input,
    )


async def _run_openclaw_test(report, report_id, _update_status, workflow_input):
    """Call the OpenClaw service and process the result."""
    from asgiref.sync import sync_to_async

    from apps.agent_score.models import AgentScoreCheck, AgentScoreReport
    from apps.agent_score.workflows.fan_in import complete_layer
    from common.utils.json_parser import parse_json_from_llm
    from apps.agent_score.workflows.activity_log import log_activity

    try:
        # 1. Build the eval prompt and call the service (with retry)
        await _update_status("AI agent evaluating site...")
        prompt = build_openclaw_eval_prompt(report.url)

        await log_activity(
            report_id, "openclaw_test", "info",
            f"Sending eval request for {report.url}",
            {"service_url": _OPENCLAW_SERVICE_URL},
        )

        max_attempts = len(_OPENCLAW_RETRY_DELAYS) + 1
        last_exc: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            try:
                response_data = await _call_openclaw_service(prompt)
                break  # success
            except Exception as call_exc:
                last_exc = call_exc
                if attempt < max_attempts and _is_retryable_openclaw_error(call_exc):
                    delay = _OPENCLAW_RETRY_DELAYS[attempt - 1]
                    logger.warning(
                        "[AGENT SCORE] OpenClaw call failed for %s "
                        "(attempt %d/%d): %s — retrying in %ds",
                        report_id, attempt, max_attempts,
                        type(call_exc).__name__, delay,
                    )
                    await log_activity(
                        report_id, "openclaw_test", "warning",
                        f"Service call failed ({type(call_exc).__name__}) "
                        f"— retrying in {delay}s (attempt {attempt}/{max_attempts})",
                        {"error": str(call_exc), "attempt": attempt, "delay": delay},
                    )
                    await _update_status(
                        f"Service unavailable — retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    raise call_exc
        else:
            # All retries exhausted — re-raise the last exception
            raise last_exc  # type: ignore[misc]

        await log_activity(
            report_id, "openclaw_test", "info",
            "OpenClaw agent finished",
        )

        # 2. Parse the self-scored JSON from OpenClaw's response
        await _update_status("Processing results...")
        raw_message = _extract_message(response_data)

        # Log the raw response for debugging (truncated to avoid huge logs)
        logger.info(
            "[AGENT SCORE] OpenClaw raw response for %s (first 1000 chars): %s",
            report_id,
            raw_message[:1000],
        )
        await log_activity(
            report_id, "openclaw_test", "info",
            f"Raw response length: {len(raw_message)} chars",
            {"message": raw_message},
        )

        result = parse_json_from_llm(raw_message, expected_type="object")

        # If parsing returned an empty dict, the model returned freeform text
        # instead of structured JSON. This typically means the site blocked
        # the agent entirely. Default to score 0.
        if not result or "score" not in result:
            result = {
                "score": 0,
                "summary": (
                    raw_message
                    if raw_message
                    else "OpenClaw could not evaluate this site."
                ),
                "what_worked": [],
                "what_didnt": [
                    "Site could not be accessed or evaluated by the agent"
                ],
                "mcp_found": False,
                "mcp_usable": False,
                "signup_attempted": False,
                "signup_succeeded": False,
                "tasks_tried": [
                    {
                        "task": "Access and evaluate website",
                        "succeeded": False,
                        "detail": (
                            raw_message
                            if raw_message
                            else "No response from agent"
                        ),
                    }
                ],
            }
            logger.warning(
                "[AGENT SCORE] OpenClaw returned non-JSON for %s, "
                "defaulting to score=0",
                report_id,
            )

        # Validate and clamp score
        score = result.get("score")
        if isinstance(score, (int, float)):
            score = max(0, min(100, int(score)))
        else:
            score = None

        # 3. Build check records from the structured result
        check_dicts = _build_checks_from_result(result)
        check_objects = [
            AgentScoreCheck(
                report=report,
                category=cd["category"],
                check_name=cd["check_name"],
                check_label=cd["check_label"],
                passed=cd["passed"],
                score=cd["score"],
                weight=cd["weight"],
                details=cd["details"],
                recommendation=cd["recommendation"],
            )
            for cd in check_dicts
        ]

        if check_objects:
            await sync_to_async(
                lambda: AgentScoreCheck.objects.bulk_create(check_objects)
            )()

        # 4. Store full result on the report
        openclaw_data = {
            "score": score,
            "summary": result.get("summary", ""),
            "what_worked": result.get("what_worked", []),
            "what_didnt": result.get("what_didnt", []),
            "mcp_found": result.get("mcp_found", False),
            "mcp_usable": result.get("mcp_usable", False),
            "signup_attempted": result.get("signup_attempted", False),
            "signup_succeeded": result.get("signup_succeeded", False),
            "tasks_tried": result.get("tasks_tried", []),
        }

        # Write the openclaw score into category_scores alongside existing
        # scores.  Re-read from DB to avoid clobbering scores written by
        # analyze-and-score (our in-memory report was loaded before that
        # workflow ran).
        fresh = await AgentScoreReport.objects.aget(id=report_id)
        category_scores = fresh.category_scores or {}
        category_scores["openclaw"] = score

        report.openclaw_data = openclaw_data
        report.category_scores = category_scores
        await report.asave(
            update_fields=["openclaw_data", "category_scores"]
        )

        logger.info(
            f"[AGENT SCORE] OpenClaw test complete for {report_id}: "
            f"score={score}, checks={len(check_objects)}"
        )
        await log_activity(
            report_id, "openclaw_test", "success",
            f"OpenClaw test complete: {score}/100 ({len(check_objects)} checks)",
            {
                "score": score,
                "check_count": len(check_objects),
                "summary": result.get("summary", ""),
            },
        )

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] OpenClaw test failed for {report_id}: {e}",
            exc_info=True,
        )
        await log_activity(
            report_id, "openclaw_test", "error",
            f"OpenClaw test failed: {type(e).__name__}",
            {"error": str(e)},
        )

        # Infrastructure failures (timeouts, service crashes, deployment
        # rollouts) are NOT the site's fault.  Store the error so the
        # frontend can show "test unavailable" and leave score as None so
        # the category is excluded from the overall score (DNF).
        report.openclaw_data = {
            "score": None,
            "summary": "",
            "what_worked": [],
            "what_didnt": [],
            "error": str(e),
        }
        await report.asave(update_fields=["openclaw_data"])

    # Update status to done
    await _update_status("Complete")

    # Join the fan-in — finalize fires when all optional layers are done
    await complete_layer(report_id)

    # Re-read to get the final state
    report = await AgentScoreReport.objects.aget(id=report_id)
    final_score = (report.openclaw_data or {}).get("score")

    return {
        "status": "success",
        "report_id": report_id,
        "score": final_score,
    }
