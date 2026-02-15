"""
Signup Test analyzer — converts Stagehand agent outcome into scored checks.

Unlike other analyzers that read stored report data, this one receives
the structured outcome from the Stagehand agent session and maps it
to AgentScoreCheck-compatible CheckResult objects.
"""
from __future__ import annotations

from apps.agent_score.analyzers.base import CheckResult

CATEGORY = "signup_test"


def score_signup_outcome(outcome: dict) -> list[CheckResult]:
    """
    Convert the signup test outcome dict into a list of scored checks.

    The outcome dict has boolean flags for each stage of the signup flow
    plus an outcome_type string describing what happened.
    """
    checks: list[CheckResult] = []

    # 1. Signup page discoverable (weight: 15)
    signup_found = outcome.get("signup_page_found", False)
    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_page_discoverable",
        check_label="Signup page discoverable by agent",
        passed=signup_found,
        score=100 if signup_found else 0,
        weight=15,
        details={
            "found": signup_found,
            "final_url": outcome.get("final_url", ""),
        },
        recommendation="" if signup_found else (
            "No signup page found. Make sure your signup link is visible in the "
            "navigation or hero section with clear text like 'Sign up' or 'Create account'."
        ),
    ))

    # 2. Signup form parseable (weight: 20)
    form_found = outcome.get("form_found", False)
    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_form_parseable",
        check_label="Signup form parseable by agent",
        passed=form_found,
        score=100 if form_found else (30 if signup_found else 0),
        weight=20,
        details={"form_found": form_found},
        recommendation="" if form_found else (
            "The signup form couldn't be parsed by an AI agent. Use standard <form> elements "
            "with <input> fields that have autocomplete attributes and associated <label> elements."
        ),
    ))

    # 3. Signup fields labeled / identifiable (weight: 15)
    fields_ok = outcome.get("fields_identifiable", False)
    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_fields_labeled",
        check_label="Signup form fields identifiable",
        passed=fields_ok,
        score=100 if fields_ok else (50 if form_found else 0),
        weight=15,
        details={"fields_identifiable": fields_ok},
        recommendation="" if fields_ok else (
            "Signup form fields could not be identified by the agent. Add <label> elements, "
            "aria-label attributes, and autocomplete values (e.g. autocomplete='email') "
            "to every input."
        ),
    ))

    # 4. No CAPTCHA on signup (weight: 20)
    # Only score this if we actually reached the signup page — otherwise
    # "no captcha detected" is meaningless (agent may have crashed).
    captcha = outcome.get("captcha_detected", False)
    captcha_scoreable = signup_found or form_found
    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_no_captcha",
        check_label="Signup form free of CAPTCHA",
        passed=not captcha and captcha_scoreable,
        score=(0 if captcha else 100) if captcha_scoreable else 0,
        weight=20,
        details={"captcha_detected": captcha},
        recommendation="" if (not captcha and captcha_scoreable) else (
            "Signup form has a CAPTCHA. AI agents cannot solve CAPTCHAs. "
            "Consider risk-based challenges that only trigger for suspicious behavior, "
            "or offer an API-based registration path for programmatic access."
        ) if captcha else "",
    ))

    # 5. Form submission succeeds (weight: 20)
    submitted = outcome.get("submission_succeeded", False)
    outcome_type = outcome.get("outcome_type", "unknown")

    # Partial credit for getting far but being blocked
    if submitted:
        submit_score = 100
    elif outcome_type == "bot_blocked":
        submit_score = 0  # Site blocked agent entirely — no access at all
    elif outcome_type in ("captcha_blocked", "payment_required"):
        submit_score = 20  # Got to the form but couldn't submit
    elif outcome_type == "form_error":
        submit_score = 40  # Submitted but got an error
    elif outcome_type == "form_filled_not_submitted":
        submit_score = 25  # Filled form but agent couldn't/didn't click submit
    elif outcome_type == "timeout":
        submit_score = 10  # Agent ran out of time — site too slow or complex
    elif form_found:
        submit_score = 30  # Found form but couldn't submit
    else:
        submit_score = 0

    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_submission_succeeds",
        check_label="Signup form submission succeeds",
        passed=submitted,
        score=submit_score,
        weight=20,
        details={
            "submitted": submitted,
            "outcome_type": outcome_type,
            "detail": outcome.get("detail", ""),
        },
        recommendation="" if submitted else _submission_recommendation(outcome_type),
    ))

    # 6. Clear outcome after submission (weight: 10)
    outcome_clear = outcome.get("outcome_clear", False)
    checks.append(CheckResult(
        category=CATEGORY,
        check_name="signup_clear_outcome",
        check_label="Clear outcome after signup attempt",
        passed=outcome_clear,
        score=100 if outcome_clear else 0,
        weight=10,
        details={
            "outcome_clear": outcome_clear,
            "outcome_type": outcome_type,
        },
        recommendation="" if outcome_clear else (
            "After form submission, the outcome was unclear. Show a clear success message, "
            "redirect to a welcome page, or display a specific error so agents know what happened."
        ),
    ))

    return checks


def _submission_recommendation(outcome_type: str) -> str:
    """Return a specific recommendation based on what blocked submission."""
    recommendations = {
        "bot_blocked": (
            "The site blocked the AI agent entirely — via bot detection, a WAF, "
            "Cloudflare challenge, or access-denied response. Agents running from "
            "cloud data centers will face the same block. Consider allowlisting "
            "known AI agent user-agents or providing an API registration path."
        ),
        "captcha_blocked": (
            "A CAPTCHA prevented form submission. AI agents cannot solve CAPTCHAs. "
            "Consider risk-based challenges or an API registration path."
        ),
        "payment_required": (
            "Signup requires payment information. Consider offering a free tier "
            "or trial that doesn't require payment at signup."
        ),
        "form_error": (
            "The form was submitted but returned an error. Check that your form "
            "validation provides clear, specific error messages."
        ),
        "no_signup_found": (
            "No signup page was found. Ensure your registration flow is "
            "discoverable from your main page."
        ),
        "form_filled_not_submitted": (
            "The AI agent filled out the form but could not click the submit button. "
            "Ensure the submit button is a standard <button> or <input type='submit'> "
            "element, clearly visible and not obscured by overlays."
        ),
        "timeout": (
            "The AI agent ran out of time before completing signup. Your site may "
            "be slow to load or have a complex multi-step signup process. Simplify "
            "the signup flow and optimize page load times for programmatic access."
        ),
    }
    return recommendations.get(outcome_type, (
        "The signup form could not be submitted. Ensure the form uses standard "
        "HTML form elements and doesn't rely on complex JavaScript interactions."
    ))
