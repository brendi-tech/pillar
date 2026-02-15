"""
Agent Signup Test — uses Browserbase + Stagehand to attempt account creation.

Runs in parallel with http_probes and browser_analysis (fired from the API
view when signup_test_enabled=True). Joins the fan-in via complete_layer()
so analyze-and-score includes signup checks in the final score.

Key properties:
- Uses Browserbase cloud browsers via Stagehand v3 server-side SDK
- Stagehand agent execute handles the variability of signup flows
- Test identity uses @score.trypillar.com email domain (we control it)
- Stops on CAPTCHA, payment walls, or phone number fields
- One attempt per scan, no retries
"""
import logging
from datetime import timedelta

from django.conf import settings
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


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

    Stores results in the report's signup_test_data field and creates
    AgentScoreCheck records, then joins the fan-in via complete_layer().
    """
    from asgiref.sync import sync_to_async

    from apps.agent_score.analyzers.signup_test import score_signup_outcome
    from apps.agent_score.models import AgentScoreCheck, AgentScoreReport
    from apps.agent_score.workflows.fan_in import complete_layer

    from apps.agent_score.workflows.activity_log import log_activity

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
        outcome = await _run_stagehand_signup(
            report.url, identity, test_data, _update_status, report_id,
        )
        test_data["outcome"] = outcome
    except Exception as e:
        logger.error(
            f"[AGENT SCORE] Stagehand signup test failed for {report_id}: {e}",
            exc_info=True,
        )
        raw_error = str(e)
        test_data["error"] = raw_error
        error_type = _classify_error_type(raw_error, exc=e)

        await log_activity(
            report_id, "signup_test", "error",
            f"Signup test failed: {type(e).__name__}",
            {"error": raw_error, "error_type": error_type},
        )

        if error_type == "site":
            # Site-attributable error — build a real outcome and score it.
            # This IS the score: the site blocked the agent.
            outcome = _build_site_error_outcome(raw_error)
            test_data["outcome"] = outcome
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

    # Score the outcome into check results
    check_results = score_signup_outcome(outcome)

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
        for cr in check_results
    ]

    await sync_to_async(
        lambda: AgentScoreCheck.objects.bulk_create(check_objects)
    )()

    # Add scan notes for ambiguous outcomes
    scan_notes: list[dict] = []
    outcome_type = outcome.get("outcome_type", "unknown")

    if outcome_type == "unknown":
        scan_notes.append({
            "type": "info",
            "category": "signup_test",
            "title": "Signup outcome couldn't be determined",
            "detail": (
                "The AI agent completed the signup flow but we couldn't "
                "clearly classify the result. The agent's response didn't "
                "match a known outcome (success, email verification, "
                "CAPTCHA, etc.). This sometimes happens with non-standard "
                "signup flows or when the agent is redirected unexpectedly."
            ),
        })
    elif outcome_type == "form_filled_not_submitted":
        scan_notes.append({
            "type": "info",
            "category": "signup_test",
            "title": "Form filled but not submitted",
            "detail": (
                "The AI agent found and filled out the signup form but "
                "did not click the submit button. This could mean the "
                "submit button was hard to find, obscured by an overlay, "
                "or the agent ran out of steps before submitting."
            ),
        })
    elif outcome_type == "timeout":
        scan_notes.append({
            "type": "info",
            "category": "signup_test",
            "title": "Signup test timed out",
            "detail": (
                "The AI agent ran out of time before completing the "
                "signup flow. The site may be slow to load, have a "
                "complex multi-step signup process, or require "
                "interactions the agent couldn't complete quickly enough."
            ),
        })

    # Store raw test data and merge scan notes
    report.signup_test_data = test_data
    existing_notes = report.scan_notes or []
    report.scan_notes = existing_notes + scan_notes
    await report.asave(update_fields=["signup_test_data", "scan_notes"])

    outcome_type = outcome.get("outcome_type", "unknown")
    outcome_level = "success" if outcome_type in ("success", "verify_email") else (
        "warning" if outcome_type in ("captcha_blocked", "timeout", "form_filled_not_submitted") else "info"
    )
    await log_activity(
        report_id, "signup_test", outcome_level,
        f"Signup test complete: {outcome_type}",
        {"outcome_type": outcome_type, "detail": outcome.get("detail", "")},
    )

    logger.info(
        f"[AGENT SCORE] Signup test complete for {report_id}: "
        f"outcome={outcome_type}"
    )

    # Join the fan-in — analyze-and-score fires when all layers are done
    await complete_layer(report_id)

    return {
        "status": "success",
        "report_id": report_id,
        "outcome_type": outcome.get("outcome_type", "unknown"),
    }


def _classify_error_type(raw_error: str, exc: Exception | None = None) -> str:
    """
    Classify an exception as site-attributable or infrastructure.

    Returns ``"site"`` for errors the target site caused (CAPTCHA, etc.)
    and ``"infra"`` for errors from our own infrastructure (Browserbase
    outages, rate limits, connection failures, API timeouts).

    All exceptions raised by client.sessions.execute() are API-level
    failures — timeouts included (httpx.ReadTimeout / APITimeoutError).
    Site-attributable timeouts are reported within the successful response
    data, not as exceptions.
    """
    # If we have the exception object, check Stagehand/httpx types first.
    # Any Stagehand SDK exception or httpx transport error is infra.
    if exc is not None:
        exc_type = type(exc).__name__
        exc_module = type(exc).__module__ or ""
        if "stagehand" in exc_module or exc_type in (
            "APITimeoutError", "InternalServerError", "APIConnectionError",
            "APIStatusError", "ReadTimeout", "ConnectTimeout",
        ):
            return "infra"

    err_lower = raw_error.lower()

    # Stagehand API-level timeouts are infra, not site.
    # "Request timed out." is the message from stagehand.APITimeoutError.
    if "request timed out" in err_lower:
        return "infra"

    # httpx / httpcore transport timeouts are infra.
    if "readtimeout" in err_lower or "connecttimeout" in err_lower:
        return "infra"

    # Site-attributable: CAPTCHA is something the site itself blocks on.
    if "captcha" in err_lower:
        return "site"

    # Infrastructure: Browserbase / our services are down
    return "infra"


def _build_site_error_outcome(raw_error: str) -> dict:
    """
    Build a structured outcome for site-attributable errors.

    Timeouts and CAPTCHAs are things agents would also hit, so they
    produce real scored outcomes rather than DNF.
    """
    err_lower = raw_error.lower()

    if "captcha" in err_lower:
        return {
            "signup_page_found": True,
            "form_found": True,
            "fields_identifiable": False,
            "captcha_detected": True,
            "submission_succeeded": False,
            "outcome_clear": True,
            "outcome_type": "captcha_blocked",
            "detail": "A CAPTCHA blocked the signup attempt before the agent could proceed.",
        }

    # Default site error: timeout
    return {
        "signup_page_found": True,
        "form_found": False,
        "fields_identifiable": False,
        "captcha_detected": False,
        "submission_succeeded": False,
        "outcome_clear": True,
        "outcome_type": "timeout",
        "detail": (
            "The browser session timed out before the signup flow completed. "
            "The site may be slow to load or the signup process is unusually long."
        ),
    }


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


def _build_dnf_signup_checks(report) -> list:
    """
    Create DNF check records for all signup test checks.

    Used when an infrastructure error means we couldn't run the test at all.
    The site shouldn't be penalized — these checks are excluded from scoring.
    """
    from apps.agent_score.models import AgentScoreCheck

    dnf_recommendation = (
        "This check could not run due to a temporary issue on our end. "
        "Try rescanning to get a complete score."
    )

    checks_spec = [
        ("signup_page_discoverable", "Signup page discoverable by agent", 15),
        ("signup_form_parseable", "Signup form parseable by agent", 20),
        ("signup_fields_labeled", "Signup form fields identifiable", 15),
        ("signup_no_captcha", "Signup form free of CAPTCHA", 20),
        ("signup_submission_succeeds", "Signup form submission succeeds", 20),
        ("signup_clear_outcome", "Clear outcome after signup attempt", 10),
    ]

    return [
        AgentScoreCheck(
            report=report,
            category="signup_test",
            check_name=name,
            check_label=label,
            passed=False,
            score=0,
            weight=weight,
            details={"reason": "infra_error"},
            recommendation=dnf_recommendation,
            status="dnf",
        )
        for name, label, weight in checks_spec
    ]


async def _run_stagehand_signup(
    url: str,
    identity: dict,
    test_data: dict,
    update_status: callable,
    report_id: str = "",
) -> dict:
    """
    Run the actual Stagehand agent session to attempt signup.

    Uses the Stagehand v3 server-side SDK (sessions API).
    Returns a structured outcome dict used for scoring.
    """
    from apps.agent_score.workflows.activity_log import log_activity
    from stagehand import AsyncStagehand

    await update_status("Starting browser session...")

    client = AsyncStagehand(
        browserbase_api_key=settings.BROWSERBASE_API_KEY,
        browserbase_project_id=settings.BROWSERBASE_PROJECT_ID,
        model_api_key=settings.GEMINI_API_KEY,
    )

    session = await client.sessions.start(
        model_name="google/gemini-3-flash-preview",
        system_prompt=(
            "You are testing whether an AI agent can create an account on this website. "
            "Your goal is to find the signup/registration page, fill out the form, "
            "and CLICK THE SUBMIT BUTTON. You must actually submit the form, not just fill it out. "
            "Report your progress at each step."
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
        # Navigate to the target URL
        await update_status("Navigating to site...")
        await client.sessions.navigate(session_id, url=url, timeout=15.0)
        test_data["steps"].append({"step": "navigate", "url": url})
        await log_activity(
            report_id, "signup_test", "info",
            f"Navigated to {url}",
            {"url": url},
        )

        # Build the instruction for the agent
        instruction = (
            f"Find the signup or registration page on this website and create an account.\n\n"
            f"ACCOUNT DETAILS:\n"
            f"- Full name: {identity['full_name']}\n"
            f"- First name: {identity['first_name']}\n"
            f"- Last name: {identity['last_name']}\n"
            f"- Email: {identity['email']}\n"
            f"- Username (if needed): {identity['username']}\n"
            f"- Password: {identity['password']}\n"
            f"- Company (if needed): {identity['company']}\n\n"
            f"STEPS TO FOLLOW:\n"
            f"1. Navigate to the signup/registration page.\n"
            f"2. Fill in ALL required form fields using the details above.\n"
            f"3. CLICK THE SUBMIT BUTTON (e.g. 'Create account', 'Sign up', 'Register', "
            f"'Submit', or similar). You MUST actually click it — do not stop after filling the form.\n"
            f"4. WAIT for the page to respond after clicking submit.\n"
            f"5. Report EXACTLY what the page shows AFTER you clicked the submit button: "
            f"the confirmation message, error message, or where you were redirected.\n\n"
            f"IMPORTANT RULES:\n"
            f"- If you encounter a CAPTCHA, STOP and report 'captcha_blocked'.\n"
            f"- If payment info is required, STOP and report 'payment_required'.\n"
            f"- Do NOT fill phone number fields — leave them blank.\n"
            f"- Do NOT click OAuth/SSO buttons (Google, GitHub, etc.).\n"
            f"- If you filled the form but could NOT find or click a submit button, "
            f"report 'form_filled_not_submitted'.\n"
            f"- If you cannot find a signup page, report 'no_signup_found'.\n"
            f"- Report the EXACT text of any confirmation or error message you see after submission."
        )

        # Store instruction in test_data (redact password for display)
        test_data["instruction"] = instruction.replace(
            identity["password"], "••••••••"
        )

        # Use agent execute mode to handle the entire signup flow
        await update_status("Finding signup page & filling form...")
        await log_activity(
            report_id, "signup_test", "info",
            "Agent executing signup flow...",
            {"max_steps": 15, "timeout": 50.0},
        )
        execute_result = await client.sessions.execute(
            session_id,
            agent_config={
                "provider": "google",
                "model": {"model_name": "google/gemini-3-flash-preview"},
                "system_prompt": (
                    "You are testing whether an AI agent can create an account on this website. "
                    "Your goal is to find the signup/registration page and fill out the form. "
                    "Report your progress at each step."
                ),
            },
            execute_options={
                "instruction": instruction,
                "max_steps": 15,
            },
            timeout=50.0,
        )

        # Extract agent message, page state, and completion flag
        agent_message = ""
        completed = False
        final_url = ""
        final_page_text = ""
        action_count = 0

        if execute_result.data and execute_result.data.result:
            agent_message = execute_result.data.result.message or ""
            completed = execute_result.data.result.completed or False

            # Extract final page state from the last action
            actions = execute_result.data.result.actions or []
            action_count = len(actions)
            if actions:
                last_action = actions[-1]
                final_url = getattr(last_action, "page_url", "") or ""
                final_page_text = getattr(last_action, "page_text", "") or ""

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

        # Classify outcome using LLM with all available signals
        await update_status("Classifying signup result...")
        await log_activity(
            report_id, "signup_test", "info", "Classifying signup result with LLM",
        )
        outcome = await _classify_outcome_with_llm(
            agent_message=agent_message,
            final_url=final_url,
            final_page_text=final_page_text,
            completed=completed,
            original_url=url,
        )
        test_data["steps"].append({"step": "extract_outcome", "outcome": outcome})

        return outcome

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


async def _classify_outcome_with_llm(
    agent_message: str,
    final_url: str,
    final_page_text: str,
    completed: bool,
    original_url: str,
) -> dict:
    """
    Classify the signup outcome using an LLM instead of keyword matching.

    Uses the agent's message, the final page URL, the final page text,
    and the completion flag to produce a structured outcome. This avoids
    false positives from keyword matching (e.g. the agent saying "email
    verification" because it saw that text on the page, not because it
    actually submitted the form).
    """
    from common.utils.json_parser import parse_json_from_llm
    from common.utils.llm_client import get_llm_client

    # Conservative default — used if LLM call fails
    fallback_outcome = {
        "signup_page_found": False,
        "form_found": False,
        "fields_identifiable": False,
        "captcha_detected": False,
        "submission_succeeded": False,
        "outcome_clear": False,
        "outcome_type": "unknown",
        "detail": agent_message[:500] if agent_message else "No agent message",
    }

    if not agent_message:
        return fallback_outcome

    system_prompt = (
        "You are classifying the outcome of an AI agent's attempt to sign up "
        "on a website. You will receive the agent's report, the final page URL, "
        "and the final page text. Your job is to determine what ACTUALLY happened — "
        "not what the agent claims or predicts, but what the evidence shows.\n\n"
        "CRITICAL DISTINCTION: Did the agent actually CLICK the submit button and "
        "observe the result? Or did it only fill out the form? Filling out a form "
        "is NOT the same as submitting it. Look for evidence of a page change, "
        "redirect, or post-submission message.\n\n"
        "Return ONLY a JSON object with these fields:\n"
        "{\n"
        '  "signup_page_found": boolean,  // Did the agent find a signup/registration page?\n'
        '  "form_found": boolean,  // Did the agent find a signup form?\n'
        '  "fields_identifiable": boolean,  // Could the agent identify and fill the form fields?\n'
        '  "captcha_detected": boolean,  // Was a CAPTCHA encountered?\n'
        '  "form_submitted": boolean,  // Did the agent actually CLICK the submit button? (not just fill the form)\n'
        '  "submission_succeeded": boolean,  // After submitting, did the account get created or verification start?\n'
        '  "outcome_clear": boolean,  // Is the outcome clearly determinable from the evidence?\n'
        '  "outcome_type": string,  // One of: "success", "verify_email", "captcha_blocked", '
        '"payment_required", "no_signup_found", "form_error", '
        '"form_filled_not_submitted", "unknown"\n'
        '  "detail": string,  // Brief description of what happened\n'
        '  "reasoning": string  // Your reasoning, citing specific evidence\n'
        "}"
    )

    # Truncate page text for the prompt — we need enough for context but not
    # the entire DOM. This truncation is for the LLM classification prompt only.
    page_text_for_prompt = final_page_text[:3000] if final_page_text else "(no page text captured)"

    prompt = (
        f"## Agent's report\n{agent_message}\n\n"
        f"## Original URL\n{original_url}\n\n"
        f"## Final page URL after agent execution\n{final_url or '(not captured)'}\n\n"
        f"## Agent reported task as completed\n{completed}\n\n"
        f"## Final page text (what is actually visible on the page)\n{page_text_for_prompt}\n\n"
        f"Based on ALL of this evidence, classify the signup outcome. "
        f"Remember: if the agent only filled out the form but there's no evidence "
        f"it clicked submit (no URL change, no post-submission page content, agent "
        f"didn't explicitly say it clicked the button), then form_submitted should be false "
        f"and submission_succeeded should be false."
    )

    try:
        from common.utils.llm_config import LLMConfigService
        resolved_model = LLMConfigService.get_openrouter_model("google/budget")
        llm = get_llm_client(model=resolved_model)
        response = await llm.complete_async(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=500,
            temperature=0.0,
        )

        result = parse_json_from_llm(response, expected_type="object")

        # Map the LLM result to the outcome dict expected by the scorer.
        # If the LLM says the form was not submitted, submission cannot have succeeded.
        form_submitted = result.get("form_submitted", False)
        submission_succeeded = result.get("submission_succeeded", False) and form_submitted

        outcome = {
            "signup_page_found": result.get("signup_page_found", False),
            "form_found": result.get("form_found", False),
            "fields_identifiable": result.get("fields_identifiable", False),
            "captcha_detected": result.get("captcha_detected", False),
            "submission_succeeded": submission_succeeded,
            "outcome_clear": result.get("outcome_clear", False),
            "outcome_type": result.get("outcome_type", "unknown"),
            "detail": result.get("detail", agent_message[:500]),
            "reasoning": result.get("reasoning", ""),
        }

        # Enforce: if form wasn't submitted, override outcome_type if LLM
        # hallucinated a success
        if not form_submitted and outcome["outcome_type"] in ("success", "verify_email"):
            outcome["outcome_type"] = "form_filled_not_submitted"
            outcome["submission_succeeded"] = False
            outcome["outcome_clear"] = True
            outcome["detail"] = (
                "The agent filled out the signup form but did not click the submit button. "
                f"LLM reasoning: {outcome.get('reasoning', 'N/A')}"
            )

        logger.info(
            f"[AGENT SCORE] LLM classified signup outcome: "
            f"type={outcome['outcome_type']}, submitted={form_submitted}, "
            f"succeeded={submission_succeeded}"
        )

        return outcome

    except Exception as e:
        logger.warning(
            f"[AGENT SCORE] LLM classification failed, using fallback: {e}",
            exc_info=True,
        )
        # Return error outcome (not unknown) so the UI shows an error state
        # instead of the misleading "outcome couldn't be determined" message
        return {
            **fallback_outcome,
            "outcome_type": "error",
            "detail": f"LLM classification failed: {e}",
        }
