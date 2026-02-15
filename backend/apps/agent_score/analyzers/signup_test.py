"""
Signup Test analyzer — converts self-scored agent result into check records.

Follows the OpenClaw pattern: the agent's self-reported score is used
directly for the category score (written to category_scores in the workflow).
Checks are informational detail derived from tasks_tried and boolean flags,
not scoring inputs.
"""
from __future__ import annotations

import re

CATEGORY = "signup_test"


def build_signup_checks(result: dict) -> list[dict]:
    """
    Convert the agent's self-scored result into AgentScoreCheck-compatible dicts.

    Each tasks_tried entry becomes a check. Boolean fields (signup_page_found,
    etc.) become additional checks. All checks use category="signup_test"
    and weight=1 (the category score comes from the agent's self-assessment,
    not from check aggregation).
    """
    checks: list[dict] = []

    # Boolean-level checks from top-level fields
    bool_checks = [
        ("signup_page_found", "Signup page found by agent"),
        ("form_found", "Signup form detected"),
        ("captcha_detected", "CAPTCHA blocked signup"),
        ("submission_succeeded", "Form submission succeeded"),
    ]
    for field, label in bool_checks:
        value = result.get(field)
        if value is None:
            continue

        # For captcha_detected, passing means NOT detected
        passed = (not value) if field == "captcha_detected" else bool(value)

        checks.append({
            "category": CATEGORY,
            "check_name": f"signup_{field}",
            "check_label": label,
            "passed": passed,
            "score": 100 if passed else 0,
            "weight": 1,
            "details": {},
            "recommendation": "",
        })

    # Dynamic task-level checks from tasks_tried
    for i, task in enumerate(result.get("tasks_tried", [])):
        task_name = task.get("task", f"Task {i + 1}")
        succeeded = task.get("succeeded", False)
        detail = task.get("detail", "")

        # Create a slug-safe check name from the task description
        slug = task_name.lower().replace(" ", "_")[:40]
        slug = re.sub(r"[^a-z0-9_]", "", slug)

        checks.append({
            "category": CATEGORY,
            "check_name": f"signup_task_{slug}_{i}",
            "check_label": task_name,
            "passed": succeeded,
            "score": 100 if succeeded else 0,
            "weight": 1,
            "details": {"detail": detail} if detail else {},
            "recommendation": "",
        })

    return checks
