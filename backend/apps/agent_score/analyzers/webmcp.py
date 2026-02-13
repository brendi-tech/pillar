"""
WebMCP analyzer — experimental, scored separately.

Checks: webmcp_meta_tag, webmcp_script_detected, tools_registered,
        tool_descriptions_quality, tool_count, context_provided
"""
from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.data_quality import DataQuality

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)

_DNF_RECOMMENDATION = (
    "This check could not run because our servers were blocked "
    "from loading this page."
)


def run(report: AgentScoreReport, dq: DataQuality) -> list[CheckResult]:
    """Run all WebMCP checks against the report data."""
    checks: list[CheckResult] = []
    webmcp = report.webmcp_data or {}
    html = report.rendered_html or report.raw_html or ""

    checks.append(_check_meta_tag(html, dq))
    checks.append(_check_script_detected(html, dq))
    checks.append(_check_tools_registered(webmcp, dq))
    checks.append(_check_tool_descriptions_quality(webmcp, dq))
    checks.append(_check_tool_count(webmcp, dq))
    checks.append(_check_context_provided(webmcp, dq))

    return checks


# ──────────────────────────────────────────────────────────────────────────────


def _check_meta_tag(html: str, dq: DataQuality) -> CheckResult:
    """Page declares WebMCP support via meta tag."""
    if not dq.html_usable:
        return CheckResult(
            category="webmcp", check_name="webmcp_meta_tag",
            check_label="Page declares WebMCP support",
            passed=False, score=0, weight=15, status="dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_DNF_RECOMMENDATION,
        )
    # Look for <meta name="webmcp" ...> or similar declarations
    has_meta = bool(
        re.search(r'<meta[^>]*name=["\']webmcp["\']', html, re.IGNORECASE)
    ) if html else False

    # Also check for model-context related meta tags
    has_model_context_meta = bool(
        re.search(r'<meta[^>]*name=["\']model-context["\']', html, re.IGNORECASE)
    ) if html else False

    found = has_meta or has_model_context_meta

    return CheckResult(
        category="webmcp",
        check_name="webmcp_meta_tag",
        check_label="Page declares WebMCP support",
        passed=found,
        score=100 if found else 0,
        weight=15,
        details={
            "has_webmcp_meta": has_meta,
            "has_model_context_meta": has_model_context_meta,
        },
        recommendation="" if found else (
            "Add a WebMCP meta tag to declare your page supports the WebMCP API. "
            "See https://webmachinelearning.github.io/webmcp"
        ),
    )


def _check_script_detected(html: str, dq: DataQuality) -> CheckResult:
    """navigator.modelContext referenced in page scripts."""
    if not dq.html_usable:
        return CheckResult(
            category="webmcp", check_name="webmcp_script_detected",
            check_label="WebMCP API referenced in scripts",
            passed=False, score=0, weight=20, status="dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_DNF_RECOMMENDATION,
        )
    if not html:
        return CheckResult(
            category="webmcp",
            check_name="webmcp_script_detected",
            check_label="WebMCP API referenced in scripts",
            passed=False, score=0, weight=20,
            details={"scripts_checked": 0, "references_found": 0},
            recommendation=(
                "Add WebMCP tools to let AI agents interact with your site directly. "
                "See https://webmachinelearning.github.io/webmcp"
            ),
        )

    # Count script tags and search for modelContext references
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script")
    scripts_checked = len(scripts)
    references = 0

    for script in scripts:
        text = script.string or ""
        src = script.get("src", "")
        if "modelContext" in text or "model-context" in text.lower():
            references += 1
        if "modelcontext" in src.lower() or "webmcp" in src.lower():
            references += 1

    # Also check inline event handlers and href attributes
    if "modelContext" in html or "navigator.modelContext" in html:
        references = max(references, 1)

    found = references > 0

    return CheckResult(
        category="webmcp",
        check_name="webmcp_script_detected",
        check_label="WebMCP API referenced in scripts",
        passed=found,
        score=100 if found else 0,
        weight=20,
        details={
            "scripts_checked": scripts_checked,
            "references_found": references,
        },
        recommendation="" if found else (
            "Add WebMCP tools to let AI agents interact with your site directly. "
            "Reference navigator.modelContext in your scripts. "
            "See https://webmachinelearning.github.io/webmcp"
        ),
    )


def _check_tools_registered(webmcp: dict, dq: DataQuality) -> CheckResult:
    """Tools actually registered (requires JS execution)."""
    if dq.webmcp_data != "ok":
        return CheckResult(
            category="webmcp", check_name="tools_registered",
            check_label="WebMCP tools registered",
            passed=False, score=0, weight=25, status="dnf",
            details={"reason": dq.webmcp_data},
            recommendation=_DNF_RECOMMENDATION,
        )
    api_exists = webmcp.get("api_exists", False)
    tools = webmcp.get("tools", [])
    has_tools = len(tools) > 0

    if api_exists and has_tools:
        score = 100
    elif api_exists:
        score = 40  # API exists but no tools registered
    else:
        score = 0

    return CheckResult(
        category="webmcp",
        check_name="tools_registered",
        check_label="WebMCP tools registered",
        passed=has_tools,
        score=score,
        weight=25,
        details={
            "api_exists": api_exists,
            "tool_count": len(tools),
            "tool_names": [t.get("name", "") for t in tools[:20]],
        },
        recommendation="" if has_tools else (
            "Register WebMCP tools via navigator.modelContext to expose page "
            "functionality to AI agents."
        ),
    )


def _check_tool_descriptions_quality(webmcp: dict, dq: DataQuality) -> CheckResult:
    """Tools have clear names, descriptions, and typed schemas."""
    if dq.webmcp_data != "ok":
        return CheckResult(
            category="webmcp", check_name="tool_descriptions_quality",
            check_label="Tool descriptions and schemas quality",
            passed=False, score=0, weight=20, status="dnf",
            details={"reason": dq.webmcp_data},
            recommendation=_DNF_RECOMMENDATION,
        )
    tools = webmcp.get("tools", [])

    if not tools:
        return CheckResult(
            category="webmcp",
            check_name="tool_descriptions_quality",
            check_label="Tool descriptions and schemas quality",
            passed=False, score=0, weight=20,
            details={"tool_count": 0},
            recommendation="Register WebMCP tools with clear names, descriptions, and input schemas.",
        )

    total = len(tools)
    with_description = sum(1 for t in tools if t.get("description"))
    with_schema = sum(1 for t in tools if t.get("has_schema"))

    desc_ratio = with_description / total if total else 0
    schema_ratio = with_schema / total if total else 0

    if desc_ratio >= 0.9 and schema_ratio >= 0.9:
        score = 100
    elif desc_ratio >= 0.7 and schema_ratio >= 0.5:
        score = 70
    elif desc_ratio >= 0.5:
        score = 40
    else:
        score = 15

    return CheckResult(
        category="webmcp",
        check_name="tool_descriptions_quality",
        check_label="Tool descriptions and schemas quality",
        passed=desc_ratio >= 0.9 and schema_ratio >= 0.9,
        score=score,
        weight=20,
        details={
            "total_tools": total,
            "with_description": with_description,
            "with_schema": with_schema,
            "description_coverage": round(desc_ratio * 100, 1),
            "schema_coverage": round(schema_ratio * 100, 1),
        },
        recommendation="" if (desc_ratio >= 0.9 and schema_ratio >= 0.9) else (
            f"{total - with_description} tools are missing descriptions and "
            f"{total - with_schema} are missing input schemas. Add clear descriptions "
            "and typed schemas to all WebMCP tools."
        ),
    )


def _check_tool_count(webmcp: dict, dq: DataQuality) -> CheckResult:
    """Number of tools exposed."""
    if dq.webmcp_data != "ok":
        return CheckResult(
            category="webmcp", check_name="tool_count",
            check_label="Number of WebMCP tools exposed",
            passed=False, score=0, weight=10, status="dnf",
            details={"reason": dq.webmcp_data},
            recommendation=_DNF_RECOMMENDATION,
        )
    tools = webmcp.get("tools", [])
    count = len(tools)

    if count >= 5:
        score = 100
    elif count >= 3:
        score = 80
    elif count >= 1:
        score = 50
    else:
        score = 0

    return CheckResult(
        category="webmcp",
        check_name="tool_count",
        check_label="Number of WebMCP tools exposed",
        passed=count >= 1,
        score=score,
        weight=10,
        details={"tool_count": count},
        recommendation="" if count >= 1 else (
            "Expose at least one WebMCP tool to let AI agents interact with your page."
        ),
    )


def _check_context_provided(webmcp: dict, dq: DataQuality) -> CheckResult:
    """Uses provideContext() to give agents page state."""
    if dq.webmcp_data != "ok":
        return CheckResult(
            category="webmcp", check_name="context_provided",
            check_label="Uses provideContext() for page state",
            passed=False, score=0, weight=10, status="dnf",
            details={"reason": dq.webmcp_data},
            recommendation=_DNF_RECOMMENDATION,
        )
    context_provided = webmcp.get("context_provided", False)

    return CheckResult(
        category="webmcp",
        check_name="context_provided",
        check_label="Uses provideContext() for page state",
        passed=context_provided,
        score=100 if context_provided else 0,
        weight=10,
        details={"context_provided": context_provided},
        recommendation="" if context_provided else (
            "Use navigator.modelContext.provideContext() to share current page state "
            "with AI agents, giving them richer context for tool execution."
        ),
    )
