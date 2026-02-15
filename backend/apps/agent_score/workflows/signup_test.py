"""
Agent Signup Test — uses Browserbase + Stagehand to attempt account creation.

Runs in parallel with http_probes and browser_analysis (fired from the API
view when signup_test_enabled=True). Joins the fan-in via complete_layer()
so analyze-and-score includes signup checks in the final score.

Architecture (OpenClaw-style self-scoring):
- Stagehand agent executes the signup flow via streaming execute
- After execute, collects screenshot + independent page verification
- An LLM evaluator scores the experience holistically (0-100)
- Category score written directly (not derived from check aggregation)
- Dynamic checks from tasks_tried for detail display
"""
import logging
from datetime import timedelta

from django.conf import settings
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()

# Maximum number of streaming log entries to persist (prevents DB bloat)
_MAX_LOG_ENTRIES = 20


class SignupTestInput(BaseModel):
    """Input for the signup-test task."""
    report_id: str


def generate_test_identity(report_id: str) -> dict:
    """
    Generate a consistent, obviously-synthetic test identity.

    The email domain (score.trypillar.com) is ours, so verification emails
    land in a mailbox we control. The identity is clearly a test account,
    easy for the site owner to clean up.
    """
    short_id = str(report_id).replace("-", "")[:6]
    return {
        "first_name": "Pillar",
        "last_name": "Agent Test",
        "full_name": "Pillar Agent Test",
        "email": f"agent-test-{short_id}@score.trypillar.com",
        "username": f"pillar-agent-test-{short_id}",
        "password": f"PillarTest!{short_id}2026",
        "company": "Pillar Agent Score Test",
    }


@hatchet.task(
    name="agent-score-signup-test",
    retries=0,
    execution_timeout=timedelta(minutes=10),
    input_validator=SignupTestInput,
)
async def signup_test_workflow(workflow_input: SignupTestInput, context: Context):
    """
    Attempt to sign up on the target site using Stagehand's AI agent.

    Uses OpenClaw-style self-scoring: the agent reports what happened,
    an LLM evaluator scores the experience, and the score is written
    directly to category_scores. Checks are informational detail.
    """
    from asgiref.sync import sync_to_async

    from apps.agent_score.analyzers.signup_test import build_signup_checks
    from apps.agent_score.models import AgentScoreCheck, AgentScoreReport
    from apps.agent_score.workflows.activity_log import log_activity
    from apps.agent_score.workflows.fan_in import complete_layer

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Starting signup test for report {report_id}")

    # Close stale DB connections — Hatchet workers hold long-lived connections
    # that the DB server may have closed (idle timeout, restart, etc.)
    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(f"[AGENT SCORE] Report {report_id} not found for signup test")
        return {"status": "error", "error": "report_not_found"}

    identity = generate_test_identity(report_id)
    test_data: dict = {
        "identity": {k: v for k, v in identity.items() if k != "password"},
        "steps": [],
        "outcome": None,
        "error": None,
    }

    async def _update_status(status: str) -> None:
        """Persist a short status message for the progress UI."""
        report.signup_test_status = status
        await report.asave(update_fields=["signup_test_status"])

    await log_activity(
        report_id, "signup_test", "info",
        "Starting signup test",
        {"url": report.url, "email": identity["email"]},
    )

    try:
        result = await _run_stagehand_signup(
            report.url, identity, test_data, _update_status, report_id,
        )
        test_data["outcome"] = result
    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Stagehand signup test failed for {report_id}: {e}",
            exc_info=True,
        )
        raw_error = str(e)
        test_data["error"] = raw_error

        # Check if the agent had activity before the error
        had_activity = any(
            s.get("step") == "navigate" for s in test_data.get("steps", [])
        )
        error_type = _classify_error_type(raw_error, exc=e, had_activity=had_activity)

        await log_activity(
            report_id, "signup_test", "error",
            f"Signup test failed: {type(e).__name__}",
            {"error": raw_error, "error_type": error_type},
        )

        if error_type == "site":
            # Site-attributable error — build a minimal scored result.
            # The site was reachable but something blocked the agent.
            result = _build_site_error_result(raw_error, had_activity)
            test_data["outcome"] = result
        else:
            # Infrastructure error — create DNF checks so the site isn't
            # penalized for our Browserbase/infra issues.
            human_detail = _describe_infra_error(raw_error)
            dnf_checks = _build_dnf_signup_checks(report)
            await sync_to_async(
                lambda: AgentScoreCheck.objects.bulk_create(dnf_checks)
            )()

            scan_notes: list[dict] = [{
                "type": "warning",
                "category": "signup_test",
                "title": "Signup test could not run",
                "detail": (
                    "The signup test hit a temporary infrastructure issue "
                    "and could not complete. This does not reflect your "
                    "site's signup experience. Try rescanning for a "
                    "complete score."
                    + (f" ({human_detail})" if human_detail else "")
                ),
            }]

            report.signup_test_data = test_data
            existing_notes = report.scan_notes or []
            report.scan_notes = existing_notes + scan_notes
            await report.asave(update_fields=["signup_test_data", "scan_notes"])

            logger.info(
                f"[AGENT SCORE] Signup test infra error for {report_id}: {human_detail}"
            )
            await complete_layer(report_id)
            return {
                "status": "infra_error",
                "report_id": report_id,
                "error": human_detail,
            }

    # Build check records from the structured result (OpenClaw pattern)
    check_dicts = build_signup_checks(result)
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

    # Write the signup_test score directly into category_scores (OpenClaw pattern)
    score = result.get("score")
    if isinstance(score, (int, float)):
        score = max(0, min(100, int(score)))
    else:
        score = None

    # Build signup_test_data in the new shape for the frontend
    signup_data = {
        "score": score,
        "summary": result.get("summary", ""),
        "what_worked": result.get("what_worked", []),
        "what_didnt": result.get("what_didnt", []),
        "signup_page_found": result.get("signup_page_found", False),
        "form_found": result.get("form_found", False),
        "captcha_detected": result.get("captcha_detected", False),
        "submission_succeeded": result.get("submission_succeeded", False),
        "tasks_tried": result.get("tasks_tried", []),
        "screenshot_url": test_data.get("screenshot_url"),
        "verification": test_data.get("verification"),
        "session_id": test_data.get("session_id"),
        "recording_url": test_data.get("recording_url"),
        "instruction": test_data.get("instruction"),
    }

    category_scores = report.category_scores or {}
    category_scores["signup_test"] = score

    report.signup_test_data = signup_data
    report.category_scores = category_scores
    existing_notes = report.scan_notes or []
    report.scan_notes = existing_notes
    await report.asave(
        update_fields=["signup_test_data", "category_scores", "scan_notes"]
    )

    summary_preview = result.get("summary", "")[:200]
    outcome_level = "success" if score and score >= 70 else (
        "warning" if score and score >= 30 else "info"
    )
    await log_activity(
        report_id, "signup_test", outcome_level,
        f"Signup test complete: {score}/100 ({len(check_objects)} checks)",
        {
            "score": score,
            "check_count": len(check_objects),
            "summary": summary_preview,
        },
    )

    logger.info(
        f"[AGENT SCORE] Signup test complete for {report_id}: "
        f"score={score}, checks={len(check_objects)}"
    )

    # Join the fan-in — analyze-and-score fires when all layers are done
    await complete_layer(report_id)

    return {
        "status": "success",
        "report_id": report_id,
        "score": score,
    }


# ──────────────────────────────────────────────
# Error classification (simplified)
# ──────────────────────────────────────────────

def _classify_error_type(
    raw_error: str,
    exc: Exception | None = None,
    had_activity: bool = False,
) -> str:
    """
    Classify an exception as site-attributable or infrastructure.

    Uses ``had_activity`` (from streaming step count or navigation success)
    as the primary signal for timeout attribution: if the agent reached the
    site but timed out, it's the site's problem, not ours.
    """
    err_lower = raw_error.lower()

    # If agent took actions before timing out, it's a site problem (slow/complex)
    if had_activity and ("timed out" in err_lower or "timeout" in err_lower):
        return "site"

    # Stagehand SDK exceptions and httpx transport errors are infra
    if exc is not None:
        exc_module = type(exc).__module__ or ""
        exc_type = type(exc).__name__
        if "stagehand" in exc_module or exc_type in (
            "APITimeoutError", "InternalServerError", "APIConnectionError",
            "APIStatusError", "ReadTimeout", "ConnectTimeout",
        ):
            return "infra"

    # Infrastructure: Browserbase / our services are down
    return "infra"


def _describe_infra_error(raw_error: str) -> str:
    """
    Return a short human-readable description for infrastructure errors.

    These are problems with our browser testing service, not the target site.
    """
    err_lower = raw_error.lower()

    if "503" in raw_error or "service unavailable" in err_lower:
        return "Cloud browser service temporarily unavailable"
    if "502" in raw_error or "bad gateway" in err_lower:
        return "Cloud browser service returned bad gateway"
    if "rate limit" in err_lower or "429" in raw_error:
        return "Browser testing service rate limited"
    if "connection" in err_lower and ("refused" in err_lower or "reset" in err_lower):
        return "Could not connect to browser testing service"
    if "timed out" in err_lower or "timeout" in err_lower:
        return "Cloud browser service request timed out"

    # Truncate for logging readability
    snippet = raw_error[:120] + ("…" if len(raw_error) > 120 else "")
    return f"Unexpected error: {snippet}"


def _build_site_error_result(raw_error: str, had_activity: bool = False) -> dict:
    """
    Build a minimal self-scored result for site-attributable errors.

    When the agent reached the site but was blocked (CAPTCHA, WAF, timeout),
    we produce a scored result reflecting the site's agent-hostility.
    """
    err_lower = raw_error.lower()

    if "captcha" in err_lower:
        return {
            "score": 25,
            "summary": "A CAPTCHA blocked the signup attempt before the agent could proceed.",
            "what_worked": [],
            "what_didnt": ["CAPTCHA blocked signup"],
            "signup_page_found": True,
            "form_found": True,
            "captcha_detected": True,
            "submission_succeeded": False,
            "tasks_tried": [
                {"task": "Navigate to site", "succeeded": True, "detail": "Site loaded"},
                {"task": "Find signup form", "succeeded": True, "detail": "Form found"},
                {"task": "Complete signup", "succeeded": False, "detail": "CAPTCHA blocked submission"},
            ],
        }

    if had_activity:
        # Agent reached the site but timed out — site is slow/complex
        return {
            "score": 15,
            "summary": (
                "The agent reached the site but ran out of time before completing signup. "
                "The site may be slow to load or have a complex multi-step signup process."
            ),
            "what_worked": ["Site was reachable"],
            "what_didnt": ["Signup could not be completed in time"],
            "signup_page_found": True,
            "form_found": False,
            "captcha_detected": False,
            "submission_succeeded": False,
            "tasks_tried": [
                {"task": "Navigate to site", "succeeded": True, "detail": "Site loaded"},
                {"task": "Complete signup flow", "succeeded": False, "detail": "Timed out"},
            ],
        }

    # Agent couldn't reach the site at all — bot blocked, WAF, etc.
    return {
        "score": 0,
        "summary": (
            "The site blocked the agent entirely — likely via bot detection, "
            "a WAF, or access-denied response."
        ),
        "what_worked": [],
        "what_didnt": ["Site blocked the agent completely"],
        "signup_page_found": False,
        "form_found": False,
        "captcha_detected": False,
        "submission_succeeded": False,
        "tasks_tried": [
            {"task": "Access site", "succeeded": False, "detail": f"Blocked: {raw_error[:200]}"},
        ],
    }


def _build_dnf_signup_checks(report) -> list:
    """
    Create DNF check records for signup test infrastructure errors.

    Used when an infra error means we couldn't run the test at all.
    The site shouldn't be penalized — these checks are excluded from scoring.
    """
    from apps.agent_score.models import AgentScoreCheck

    dnf_recommendation = (
        "This check could not run due to a temporary issue on our end. "
        "Try rescanning to get a complete score."
    )

    # Single DNF marker check (dynamic checks can't be predefined)
    return [
        AgentScoreCheck(
            report=report,
            category="signup_test",
            check_name="signup_test_dnf",
            check_label="Signup test could not run",
            passed=False,
            score=0,
            weight=1,
            details={"reason": "infra_error"},
            recommendation=dnf_recommendation,
            status="dnf",
        )
    ]


# ──────────────────────────────────────────────
# Stagehand agent execution
# ──────────────────────────────────────────────

async def _run_stagehand_signup(
    url: str,
    identity: dict,
    test_data: dict,
    update_status: callable,
    report_id: str = "",
) -> dict:
    """
    Run the Stagehand agent session to attempt signup, then evaluate the
    experience using an LLM scorer.

    Flow:
    1. Start session, navigate to URL
    2. Stream execute with step-level monitoring
    3. Capture screenshot via Playwright CDP
    4. Run independent verification via extract()
    5. Score the experience with LLM evaluator
    6. Return structured result (OpenClaw-style JSON)
    """
    from apps.agent_score.workflows.activity_log import log_activity
    from stagehand import AsyncStagehand

    await update_status("Starting browser session...")

    model_name = getattr(settings, "STAGEHAND_AGENT_MODEL", "google/gemini-3-flash-preview")

    client = AsyncStagehand(
        browserbase_api_key=settings.BROWSERBASE_API_KEY,
        browserbase_project_id=settings.BROWSERBASE_PROJECT_ID,
        model_api_key=settings.GEMINI_API_KEY,
    )

    session = await client.sessions.start(
        model_name=model_name,
        system_prompt=(
            "You are testing whether an AI agent can create an account on this website. "
            "Your goal is to find the signup/registration page, fill out the form, "
            "and submit it. Report your progress and experience honestly at each step."
        ),
    )
    session_id = session.data.session_id

    # Persist session ID so we can link to the Browserbase recording
    test_data["session_id"] = session_id
    test_data["recording_url"] = f"https://browserbase.com/sessions/{session_id}"

    await log_activity(
        report_id, "signup_test", "info",
        "Stagehand session created",
        {"session_id": session_id, "recording_url": test_data["recording_url"]},
    )

    try:
        # 1. Navigate to the target URL
        await update_status("Navigating to site...")
        await client.sessions.navigate(session_id, url=url, timeout=15.0)
        test_data["steps"].append({"step": "navigate", "url": url})
        await log_activity(
            report_id, "signup_test", "info",
            f"Navigated to {url}",
            {"url": url},
        )

        # 2. Build the instruction for the agent
        instruction = (
            f"You are testing whether an AI agent can create an account on this website.\n\n"
            f"ACCOUNT DETAILS:\n"
            f"- Full name: {identity['full_name']}\n"
            f"- First name: {identity['first_name']}\n"
            f"- Last name: {identity['last_name']}\n"
            f"- Email: {identity['email']}\n"
            f"- Username (if needed): {identity['username']}\n"
            f"- Password: {identity['password']}\n"
            f"- Company (if needed): {identity['company']}\n\n"
            f"Try to sign up using these details. Along the way, note:\n"
            f"- Could you find the signup/registration page?\n"
            f"- Was the form easy to identify and fill out?\n"
            f"- Were form fields properly labeled?\n"
            f"- Did you encounter any CAPTCHAs, bot blocks, or paywalls?\n"
            f"- Could you click submit and what happened after?\n"
            f"- Was the site fast or slow? Were there unexpected popups or redirects?\n\n"
            f"RULES:\n"
            f"- You MUST actually CLICK THE SUBMIT BUTTON (e.g. 'Create account', 'Sign up', "
            f"'Register', 'Submit'). Do not stop after filling the form.\n"
            f"- WAIT for the page to respond after clicking submit.\n"
            f"- Do NOT fill phone number fields — leave them blank.\n"
            f"- Do NOT click OAuth/SSO buttons (Google, GitHub, etc.).\n"
            f"- If you hit a CAPTCHA or payment wall, stop and note it.\n\n"
            f"When you're done, respond with your assessment as a message. Include:\n"
            f"1. What you tried and what happened at each step\n"
            f"2. Whether signup succeeded, failed, or was blocked\n"
            f"3. The EXACT text of any confirmation or error message you see after submission\n"
            f"4. How easy or hard the experience was for you as an AI agent\n"
            f"5. Any issues you encountered (slow pages, confusing UI, CAPTCHAs, etc.)\n"
            f"Be honest and specific about what actually happened."
        )

        # Store instruction in test_data (redact password for display)
        test_data["instruction"] = instruction.replace(
            identity["password"], "••••••••"
        )

        # 3. Execute with streaming for step-level monitoring
        await update_status("Finding signup page & filling form...")
        execute_timeout = 180.0
        await log_activity(
            report_id, "signup_test", "info",
            "Agent executing signup flow...",
            {"max_steps": 15, "timeout": execute_timeout},
        )

        agent_message, completed, final_url, final_page_text, action_count = (
            await _streaming_execute(
                client, session_id, model_name, instruction,
                execute_timeout, update_status, report_id,
            )
        )

        test_data["steps"].append({
            "step": "agent_execute",
            "completed": completed,
            "message": agent_message,
            "final_url": final_url,
            "final_page_text": final_page_text[:5000],
            "action_count": action_count,
        })

        execute_level = "success" if completed else "warning"
        await log_activity(
            report_id, "signup_test", execute_level,
            f"Agent {'completed' if completed else 'did not complete'} "
            f"({action_count} actions taken)",
            {
                "completed": completed,
                "action_count": action_count,
                "final_url": final_url,
                "message_preview": agent_message[:300] if agent_message else "",
            },
        )

        # 4. Capture screenshot via Playwright CDP
        screenshot_data_url = await _capture_screenshot(
            session_id, test_data, report_id,
        )

        # 5. Run independent page verification via extract()
        verification = await _post_execute_verification(
            client, session_id, report_id,
        )
        if verification:
            test_data["verification"] = verification

        # 6. Score the experience with LLM evaluator
        await update_status("Scoring signup experience...")
        await log_activity(
            report_id, "signup_test", "info",
            "Scoring signup experience with LLM evaluator",
        )
        result = await _evaluate_signup_experience(
            agent_message=agent_message,
            final_url=final_url,
            final_page_text=final_page_text,
            completed=completed,
            original_url=url,
            screenshot_data_url=screenshot_data_url,
            verification=verification,
        )
        test_data["steps"].append({"step": "evaluate", "result": result})

        return result

    finally:
        try:
            # Fire-and-forget — session cleanup doesn't need to block the result
            import asyncio
            asyncio.create_task(client.sessions.end(session_id))
            await log_activity(
                report_id, "signup_test", "info", "Stagehand session ended",
                {"session_id": session_id},
            )
        except Exception:
            pass


async def _streaming_execute(
    client,
    session_id: str,
    model_name: str,
    instruction: str,
    timeout: float,
    update_status: callable,
    report_id: str,
) -> tuple[str, bool, str, str, int]:
    """
    Execute the agent instruction with streaming for step-level monitoring.

    Returns (agent_message, completed, final_url, final_page_text, action_count).
    Falls back to non-streaming execute if streaming fails.
    """
    from apps.agent_score.workflows.activity_log import log_activity

    agent_config = {
        "provider": "google",
        "model": {"model_name": model_name},
        "system_prompt": (
            "You are testing whether an AI agent can create an account on this website. "
            "Your goal is to find the signup/registration page, fill out the form, and submit it. "
            "Report your progress and experience honestly at each step."
        ),
    }
    execute_options = {
        "instruction": instruction,
        "max_steps": 15,
    }

    # Try streaming execute first
    try:
        stream = await client.sessions.execute(
            session_id,
            agent_config=agent_config,
            execute_options=execute_options,
            stream_response=True,
            timeout=timeout,
        )

        step_count = 0
        async for event in stream:
            if event.type == "log" and hasattr(event.data, "message"):
                step_count += 1
                if step_count <= _MAX_LOG_ENTRIES:
                    await log_activity(
                        report_id, "signup_test", "info",
                        f"Step {step_count}: {event.data.message}",
                    )
                await update_status(f"Agent working... (step {step_count})")
            elif event.type == "system" and hasattr(event.data, "status"):
                if event.data.status == "finished" and event.data.result:
                    # Parse the finished result
                    raw_result = event.data.result
                    if isinstance(raw_result, dict):
                        return (
                            raw_result.get("message", ""),
                            raw_result.get("completed", False),
                            "",  # final_url from streaming result
                            "",  # final_page_text from streaming result
                            len(raw_result.get("actions", [])),
                        )
                elif event.data.status == "error":
                    raise Exception(event.data.error or "Agent execution error")

        # If stream completed without a finished event, fall through to
        # non-streaming fallback
        logger.warning(
            f"[AGENT SCORE] Streaming execute for {report_id} "
            "completed without finished event, falling back to non-streaming"
        )

    except Exception as e:
        # If this is a real error (not just streaming issues), re-raise
        err_str = str(e).lower()
        if "timed out" in err_str or "timeout" in err_str:
            raise
        if "agent execution error" in err_str:
            raise
        logger.warning(
            f"[AGENT SCORE] Streaming execute failed for {report_id}, "
            f"falling back to non-streaming: {e}",
        )

    # Fallback: non-streaming execute
    execute_result = await client.sessions.execute(
        session_id,
        agent_config=agent_config,
        execute_options=execute_options,
        timeout=timeout,
    )

    agent_message = ""
    completed = False
    final_url = ""
    final_page_text = ""
    action_count = 0

    if execute_result.data and execute_result.data.result:
        agent_message = execute_result.data.result.message or ""
        completed = execute_result.data.result.completed or False

        actions = execute_result.data.result.actions or []
        action_count = len(actions)
        if actions:
            last_action = actions[-1]
            final_url = getattr(last_action, "page_url", "") or ""
            final_page_text = getattr(last_action, "page_text", "") or ""

    return (agent_message, completed, final_url, final_page_text, action_count)


async def _capture_screenshot(
    session_id: str,
    test_data: dict,
    report_id: str,
) -> str | None:
    """
    Capture a screenshot of the final page state via Playwright CDP.

    Connects to the Browserbase session via CDP, takes a screenshot,
    uploads it, and returns the base64 data URL for the vision LLM.
    Returns None if screenshot capture fails (graceful degradation).
    """
    import base64

    from apps.agent_score.workflows.activity_log import log_activity

    try:
        from playwright.async_api import async_playwright

        cdp_url = (
            f"wss://connect.browserbase.com"
            f"?apiKey={settings.BROWSERBASE_API_KEY}"
            f"&sessionId={session_id}"
        )

        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(cdp_url)
            contexts = browser.contexts
            if not contexts:
                logger.warning(f"[AGENT SCORE] No browser contexts for screenshot: {report_id}")
                return None

            pages = contexts[0].pages
            if not pages:
                logger.warning(f"[AGENT SCORE] No pages for screenshot: {report_id}")
                return None

            page = pages[0]
            screenshot_bytes = await page.screenshot(type="png")
            await browser.close()

        # Upload to public storage
        from apps.agent_score.workflows.browser_analysis import _upload_screenshot
        screenshot_url = await _upload_screenshot(screenshot_bytes, f"signup-{report_id}")
        test_data["screenshot_url"] = screenshot_url

        # Create base64 data URL for the vision LLM
        b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
        data_url = f"data:image/png;base64,{b64}"

        await log_activity(
            report_id, "signup_test", "info",
            "Captured final page screenshot",
            {"screenshot_url": screenshot_url},
        )

        return data_url

    except Exception as e:
        logger.warning(
            f"[AGENT SCORE] Screenshot capture failed for {report_id}: {e}",
            exc_info=True,
        )
        return None


async def _post_execute_verification(
    client,
    session_id: str,
    report_id: str,
) -> dict | None:
    """
    Run independent page verification via Stagehand extract().

    Returns a dict with page_state, description, and visible_text_evidence,
    or None if verification fails (graceful degradation).
    """
    from apps.agent_score.workflows.activity_log import log_activity

    try:
        extract_result = await client.sessions.extract(
            session_id,
            instruction=(
                "What is the current state of this page? "
                "Is there a success/welcome message, an error message, "
                "a CAPTCHA, a login page, a form still visible, a dashboard, "
                "or something else? Describe exactly what you see."
            ),
            schema={
                "type": "object",
                "properties": {
                    "page_state": {
                        "type": "string",
                        "description": (
                            "One of: success_message, error_message, captcha, "
                            "login_page, form_visible, dashboard, "
                            "verification_notice, blocked, other"
                        ),
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief description of what the page shows",
                    },
                    "visible_text_evidence": {
                        "type": "string",
                        "description": "Key text visible on the page that supports the classification",
                    },
                },
            },
            timeout=15.0,
        )

        verification = extract_result.data.result
        if isinstance(verification, dict):
            await log_activity(
                report_id, "signup_test", "info",
                f"Page verification: {verification.get('page_state', 'unknown')}",
                {"verification": verification},
            )
            return verification

        return None

    except Exception as e:
        logger.warning(
            f"[AGENT SCORE] Post-execute verification failed for {report_id}: {e}",
        )
        return None


# ──────────────────────────────────────────────
# LLM-based experience evaluator (replaces
# the old _classify_outcome_with_llm + score_signup_outcome)
# ──────────────────────────────────────────────

async def _evaluate_signup_experience(
    agent_message: str,
    final_url: str,
    final_page_text: str,
    completed: bool,
    original_url: str,
    screenshot_data_url: str | None = None,
    verification: dict | None = None,
) -> dict:
    """
    Evaluate the signup experience holistically using an LLM.

    Instead of classifying into fixed outcome types and applying hardcoded
    scoring rules, this evaluator asks the LLM to score the experience
    0-100 and provide structured narrative feedback — the same pattern
    OpenClaw uses for its overall agent experience evaluation.

    Returns a dict matching the OpenClaw-style self-scoring shape:
    {score, summary, what_worked, what_didnt, signup_page_found, form_found,
     captcha_detected, submission_succeeded, tasks_tried}
    """
    from common.utils.json_parser import parse_json_from_llm
    from common.utils.llm_client import get_llm_client

    # Conservative fallback — used if LLM call fails entirely
    fallback_result = {
        "score": 0,
        "summary": agent_message[:300] if agent_message else "No agent message received.",
        "what_worked": [],
        "what_didnt": ["Could not evaluate signup experience"],
        "signup_page_found": False,
        "form_found": False,
        "captcha_detected": False,
        "submission_succeeded": False,
        "tasks_tried": [],
    }

    if not agent_message:
        return fallback_result

    system_prompt = (
        "You are evaluating an AI agent's attempt to sign up on a website. "
        "You will receive the agent's report, the final page URL, "
        "the final page text, and optionally a screenshot and independent "
        "page verification.\n\n"
        "Your job is to determine what ACTUALLY happened — not what the "
        "agent claims, but what the evidence shows — and score the "
        "signup experience from 0-100.\n\n"
        "CRITICAL: Did the agent actually CLICK the submit button and "
        "observe the result? Or did it only fill the form? Look for "
        "evidence of a page change, redirect, or post-submission message.\n\n"
        "Return ONLY a JSON object with these fields:\n"
        "{\n"
        '  "score": <0-100>,\n'
        '  "summary": "<2-3 sentences on what happened>",\n'
        '  "what_worked": ["<thing that went smoothly>", ...],\n'
        '  "what_didnt": ["<thing that was hard or impossible>", ...],\n'
        '  "signup_page_found": boolean,\n'
        '  "form_found": boolean,\n'
        '  "captcha_detected": boolean,\n'
        '  "submission_succeeded": boolean,\n'
        '  "tasks_tried": [\n'
        '    {"task": "<what was tried>", "succeeded": boolean, "detail": "<what happened>"},\n'
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Scoring guidelines:\n"
        "- 90-100: Signup completed successfully with clear outcome\n"
        "- 70-89: Signup mostly worked, minor friction (email verification, etc.)\n"
        "- 50-69: Found signup but couldn't complete (form errors, confusing UI)\n"
        "- 30-49: Major blockers (CAPTCHA, paywall, hard-to-find form)\n"
        "- 10-29: Could not sign up at all (bot blocked, no signup page)\n"
        "- 0-9: Site completely inaccessible to agents\n\n"
        "If the agent only filled the form but did NOT click submit, the "
        "score should be 40-55 (found form but didn't complete the flow). "
        "submission_succeeded MUST be false in this case."
    )

    # Truncate page text for the prompt (classification context only)
    page_text_for_prompt = (
        final_page_text[:3000] if final_page_text
        else "(no page text captured)"
    )

    prompt_parts = [
        f"## Agent's report\n{agent_message}\n",
        f"## Original URL\n{original_url}\n",
        f"## Final page URL after agent execution\n{final_url or '(not captured)'}\n",
        f"## Agent reported task as completed\n{completed}\n",
        f"## Final page text (what is visible on the page)\n{page_text_for_prompt}\n",
    ]

    if verification:
        prompt_parts.append(
            f"## Independent page verification (second opinion from a separate model)\n"
            f"Page state: {verification.get('page_state', 'unknown')}\n"
            f"Description: {verification.get('description', 'N/A')}\n"
            f"Visible text: {verification.get('visible_text_evidence', 'N/A')}\n"
        )

    prompt_parts.append(
        "Based on ALL evidence above, evaluate the signup experience. "
        "Score based on what actually happened, not what the agent claims."
    )

    prompt = "\n".join(prompt_parts)

    # Try primary model, fall back to alternative
    for model_ref in ("google/budget", "anthropic/budget"):
        try:
            from common.utils.llm_config import LLMConfigService
            resolved_model = LLMConfigService.get_openrouter_model(model_ref)
            llm = get_llm_client(model=resolved_model)

            # If we have a screenshot, use vision-capable path
            if screenshot_data_url and model_ref == "google/budget":
                response = await llm.complete_async(
                    prompt=[
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": screenshot_data_url, "detail": "low"},
                        },
                    ],
                    system_prompt=system_prompt,
                    max_tokens=800,
                    temperature=0.0,
                )
            else:
                response = await llm.complete_async(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    max_tokens=800,
                    temperature=0.0,
                )

            result = parse_json_from_llm(response, expected_type="object")

            # Validate and normalize the result
            score = result.get("score")
            if isinstance(score, (int, float)):
                score = max(0, min(100, int(score)))
            else:
                score = 0

            # Enforce: if no evidence of form submission, cap score and
            # ensure submission_succeeded is false
            tasks = result.get("tasks_tried", [])
            has_submit_evidence = any(
                "submit" in t.get("task", "").lower() and t.get("succeeded", False)
                for t in tasks
            )
            submission_succeeded = result.get("submission_succeeded", False)
            if submission_succeeded and not has_submit_evidence:
                # Double-check: look for evidence in agent message
                msg_lower = agent_message.lower()
                if not any(
                    phrase in msg_lower for phrase in (
                        "clicked submit", "clicked the submit",
                        "clicked sign up", "clicked create account",
                        "submitted the form", "form was submitted",
                        "account created", "registration successful",
                    )
                ):
                    submission_succeeded = False
                    if score > 55:
                        score = 55  # Cap: form filled but not submitted

            normalized = {
                "score": score,
                "summary": result.get("summary", ""),
                "what_worked": result.get("what_worked", []),
                "what_didnt": result.get("what_didnt", []),
                "signup_page_found": result.get("signup_page_found", False),
                "form_found": result.get("form_found", False),
                "captcha_detected": result.get("captcha_detected", False),
                "submission_succeeded": submission_succeeded,
                "tasks_tried": tasks,
            }

            logger.info(
                f"[AGENT SCORE] LLM evaluated signup: score={score}, "
                f"submitted={submission_succeeded}, model={model_ref}"
            )

            return normalized

        except Exception as e:
            logger.warning(
                f"[AGENT SCORE] LLM evaluation failed with {model_ref}: {e}",
                exc_info=True,
            )
            # Try next model
            continue

    # All models failed — return fallback
    logger.error("[AGENT SCORE] All LLM evaluation models failed, using fallback")
    return fallback_result
