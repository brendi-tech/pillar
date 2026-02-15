"""
Interactability analyzer — can agents take actions on your site?

Checks: labeled_forms, semantic_actions, api_documentation
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.data_quality import DataQuality
from apps.agent_score.constants import GENERIC_ACTION_TEXT

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)

_BLOCKED_RECOMMENDATION = (
    "Your site blocked this request from a cloud server. AI agents "
    "typically run from cloud data centers and will face the same block. "
    "Consider allowlisting known AI agent user-agents or providing "
    "an API-accessible path for programmatic access."
)

_INFRA_RECOMMENDATION = (
    "This check could not run due to a temporary issue on our end. "
    "Try rescanning to get a complete score."
)


def run(report: AgentScoreReport, dq: DataQuality) -> list[CheckResult]:
    """Run all interactability checks against the report data."""
    checks: list[CheckResult] = []
    probes = report.probe_results or {}

    checks.append(_check_labeled_forms(report.forms_data, dq))
    checks.append(_check_semantic_actions(report.accessibility_tree, dq))
    checks.append(_check_api_documentation(probes, dq))

    return checks


# ──────────────────────────────────────────────────────────────────────────────


def _check_labeled_forms(forms_data: list | dict, dq: DataQuality) -> CheckResult:
    """All form inputs have associated labels or aria-label."""
    if dq.forms_data != "ok":
        blocked = dq.source_site_blocked("forms_data")
        return CheckResult(
            category="interaction", check_name="labeled_forms",
            check_label="All form inputs labeled",
            passed=False, score=0, weight=20,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.forms_data},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not forms_data or not isinstance(forms_data, list):
        # No forms on page — that's not a failure
        return CheckResult(
            category="interaction",
            check_name="labeled_forms",
            check_label="All form inputs labeled",
            passed=True,
            score=100,
            weight=20,
            details={"form_count": 0, "message": "No forms detected on page"},
            recommendation="",
        )

    total_inputs = 0
    labeled_inputs = 0
    unlabeled_details: list[dict] = []

    for form in forms_data:
        if not isinstance(form, dict):
            continue
        for inp in form.get("inputs", []):
            if not isinstance(inp, dict):
                continue
            total_inputs += 1
            if inp.get("has_label"):
                labeled_inputs += 1
            else:
                unlabeled_details.append({
                    "form_index": form.get("index"),
                    "input_type": inp.get("type", ""),
                    "input_name": inp.get("name", ""),
                })

    if total_inputs == 0:
        return CheckResult(
            category="interaction",
            check_name="labeled_forms",
            check_label="All form inputs labeled",
            passed=True, score=100, weight=20,
            details={"form_count": len(forms_data), "total_inputs": 0},
            recommendation="",
        )

    ratio = labeled_inputs / total_inputs
    all_labeled = ratio == 1.0

    if all_labeled:
        score = 100
    elif ratio >= 0.8:
        score = 70
    elif ratio >= 0.5:
        score = 40
    else:
        score = 15

    return CheckResult(
        category="interaction",
        check_name="labeled_forms",
        check_label="All form inputs labeled",
        passed=all_labeled,
        score=score,
        weight=20,
        details={
            "form_count": len(forms_data),
            "total_inputs": total_inputs,
            "labeled_inputs": labeled_inputs,
            "unlabeled_inputs": unlabeled_details[:5],
        },
        recommendation="" if all_labeled else (
            f"{total_inputs - labeled_inputs} of {total_inputs} form inputs are missing "
            "labels. Add <label for=\"...\"> or aria-label to every input so agents can "
            "identify which field is which."
        ),
    )


def _check_semantic_actions(ax_tree: dict, dq: DataQuality) -> CheckResult:
    """Buttons/links have descriptive text, not 'Click here'."""
    if dq.accessibility_tree != "ok":
        blocked = dq.source_site_blocked("accessibility_tree")
        return CheckResult(
            category="interaction", check_name="semantic_actions",
            check_label="Buttons and links have descriptive text",
            passed=False, score=0, weight=15,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.accessibility_tree},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not ax_tree:
        return CheckResult(
            category="interaction",
            check_name="semantic_actions",
            check_label="Buttons and links have descriptive text",
            passed=False, score=0, weight=15,
            details={"error": "no_accessibility_tree"},
            recommendation="Ensure your page renders an accessibility tree.",
        )

    total_actions = 0
    generic_actions: list[dict] = []

    def _walk(node: dict) -> None:
        nonlocal total_actions
        role = node.get("role", "")
        name = (node.get("name") or "").strip()

        if role in ("button", "link", "menuitem"):
            total_actions += 1
            if name.lower() in GENERIC_ACTION_TEXT:
                generic_actions.append({"role": role, "name": name})

        for child in node.get("children", []):
            if isinstance(child, dict):
                _walk(child)

    _walk(ax_tree)

    if total_actions == 0:
        return CheckResult(
            category="interaction",
            check_name="semantic_actions",
            check_label="Buttons and links have descriptive text",
            passed=True, score=100, weight=15,
            details={"total_actions": 0},
            recommendation="",
        )

    generic_count = len(generic_actions)
    generic_ratio = generic_count / total_actions if total_actions else 0

    if generic_count == 0:
        score = 100
    elif generic_ratio <= 0.1:
        score = 80
    elif generic_ratio <= 0.3:
        score = 50
    else:
        score = 20

    return CheckResult(
        category="interaction",
        check_name="semantic_actions",
        check_label="Buttons and links have descriptive text",
        passed=generic_count == 0,
        score=score,
        weight=15,
        details={
            "total_actions": total_actions,
            "generic_actions": generic_count,
            "examples": generic_actions[:5],
        },
        recommendation="" if generic_count == 0 else (
            f"{generic_count} buttons/links use generic text like 'Click here' or "
            "'Learn more'. Use descriptive text (e.g. 'Download pricing guide') so "
            "agents know what each action does."
        ),
    )


def _check_api_documentation(probes: dict, dq: DataQuality) -> CheckResult:
    """Check for MCP server or API documentation (OpenAPI/Swagger/GraphQL)."""
    if not dq.probe_usable("main_page"):
        blocked = dq.probe_site_blocked("main_page")
        return CheckResult(
            category="interaction", check_name="api_documentation",
            check_label="MCP or API documentation exposed",
            passed=False, score=0, weight=5,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.probes.get("main_page", "unknown")},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )

    # Check for /.well-known/mcp.json probe
    mcp_probe = probes.get("mcp_json", {})
    has_mcp_endpoint = mcp_probe.get("ok", False)

    # Check main page HTML for API doc or MCP keywords
    main_body = probes.get("main_page", {}).get("body", "")
    body_lower = main_body.lower()
    has_api_link = any(
        keyword in body_lower
        for keyword in ["openapi", "swagger", "/api/docs", "/api/schema", "graphql"]
    )
    has_mcp_link = any(
        keyword in body_lower
        for keyword in [
            "/.well-known/mcp", "mcp-server", "model context protocol",
            "mcp.json",
        ]
    )

    found = has_mcp_endpoint or has_api_link or has_mcp_link

    return CheckResult(
        category="interaction",
        check_name="api_documentation",
        check_label="MCP or API documentation exposed",
        passed=found,
        score=100 if found else 0,
        weight=5,
        details={
            "has_mcp_endpoint": has_mcp_endpoint,
            "has_api_link_in_page": has_api_link,
            "has_mcp_link_in_page": has_mcp_link,
        },
        recommendation="" if found else (
            "Expose an MCP server (/.well-known/mcp.json) or API documentation "
            "(OpenAPI/Swagger/GraphQL) so AI agents can discover your site's "
            "programmatic capabilities."
        ),
    )
