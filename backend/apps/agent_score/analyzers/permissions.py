"""
Permissions analyzer — does your site communicate boundaries to agents?

Checks: robots_txt_ai, content_signal_header
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.constants import AI_CRAWLERS

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)


def run(report: AgentScoreReport) -> list[CheckResult]:
    """Run all permissions checks against the report data."""
    checks: list[CheckResult] = []
    probes = report.probe_results or {}

    checks.append(_check_robots_txt_ai(probes))
    checks.append(_check_content_signal_header(report))

    return checks


# ──────────────────────────────────────────────────────────────────────────────


def _parse_robots_txt(body: str) -> dict:
    """
    Parse robots.txt into a simplified structure.

    Returns dict with keys:
        - user_agents: dict mapping user-agent to list of rules
        - has_wildcard_allow: bool
        - blocked_ai_crawlers: list of AI crawler names that are disallowed
        - allowed_ai_crawlers: list of AI crawler names that are allowed
    """
    result = {
        "user_agents": {},
        "has_wildcard_allow": False,
        "blocked_ai_crawlers": [],
        "allowed_ai_crawlers": [],
    }

    if not body:
        return result

    current_agents: list[str] = []
    lines = body.strip().split("\n")

    for line in lines:
        line = line.strip()
        if line.startswith("#") or not line:
            continue

        if ":" not in line:
            continue

        directive, _, value = line.partition(":")
        directive = directive.strip().lower()
        value = value.strip()

        if directive == "user-agent":
            current_agents = [value]
            if value not in result["user_agents"]:
                result["user_agents"][value] = []
        elif directive in ("disallow", "allow") and current_agents:
            for agent in current_agents:
                if agent not in result["user_agents"]:
                    result["user_agents"][agent] = []
                result["user_agents"][agent].append({
                    "directive": directive,
                    "path": value,
                })

    # Analyze AI crawler status
    wildcard_rules = result["user_agents"].get("*", [])
    wildcard_blocks_all = any(
        r["directive"] == "disallow" and r["path"] == "/"
        for r in wildcard_rules
    )

    for crawler in AI_CRAWLERS:
        crawler_rules = result["user_agents"].get(crawler, [])

        if crawler_rules:
            # Explicit rules for this crawler
            blocks_all = any(
                r["directive"] == "disallow" and r["path"] == "/"
                for r in crawler_rules
            )
            if blocks_all:
                result["blocked_ai_crawlers"].append(crawler)
            else:
                result["allowed_ai_crawlers"].append(crawler)
        elif wildcard_blocks_all:
            # Falls under wildcard block
            result["blocked_ai_crawlers"].append(crawler)
        else:
            result["allowed_ai_crawlers"].append(crawler)

    result["has_wildcard_allow"] = not wildcard_blocks_all

    return result


def _check_robots_txt_ai(probes: dict) -> CheckResult:
    """Fetch robots.txt, check if AI crawlers are allowed."""
    probe = probes.get("robots_txt", {})
    exists = probe.get("ok", False)
    body = probe.get("body", "")

    if not exists:
        # No robots.txt means everything is allowed by default
        return CheckResult(
            category="content",
            check_name="robots_txt_ai",
            check_label="AI crawlers allowed in robots.txt",
            passed=True,
            score=80,  # Slightly less than explicit allowance
            weight=10,
            details={"robots_txt_exists": False, "message": "No robots.txt — all crawlers allowed by default"},
            recommendation=(
                "Consider adding a robots.txt file to explicitly communicate your "
                "crawler policy. See https://developers.google.com/search/docs/"
                "crawling-indexing/robots/intro"
            ),
        )

    parsed = _parse_robots_txt(body)
    blocked = parsed["blocked_ai_crawlers"]
    allowed = parsed["allowed_ai_crawlers"]
    total_ai = len(AI_CRAWLERS)
    blocked_count = len(blocked)

    if blocked_count == 0:
        score = 100
        passed = True
    elif blocked_count <= total_ai * 0.3:
        score = 70
        passed = True
    elif blocked_count <= total_ai * 0.7:
        score = 40
        passed = False
    else:
        score = 10
        passed = False

    return CheckResult(
        category="content",
        check_name="robots_txt_ai",
        check_label="AI crawlers allowed in robots.txt",
        passed=passed,
        score=score,
        weight=10,
        details={
            "robots_txt_exists": True,
            "blocked_ai_crawlers": blocked,
            "allowed_ai_crawlers": allowed,
            "blocked_count": blocked_count,
            "total_checked": total_ai,
        },
        recommendation="" if passed else (
            f"{blocked_count} AI crawlers are blocked in your robots.txt "
            f"({', '.join(blocked[:5])}). This prevents AI agents and answer engines "
            "from accessing your site. Consider selective allowlisting."
        ),
    )


def _check_content_signal_header(report: AgentScoreReport) -> CheckResult:
    """
    Check for the Content-Signal response header (contentsignals.org).

    Content-Signal declares AI usage permissions at the HTTP level:
      Content-Signal: ai-train=yes, search=yes, ai-input=yes

    Directives:
      - ai-train: Content can be used for AI training
      - search: Content can appear in search results
      - ai-input: Content can be used as AI input (agentic use)
    """
    content_signal = report.content_signal or ""

    # Also check the probe results in case the model field wasn't populated
    if not content_signal:
        probes = report.probe_results or {}
        md_probe = probes.get("markdown_negotiation", {})
        content_signal = md_probe.get("content_signal", "")

    has_signal = bool(content_signal.strip())

    details: dict = {
        "has_content_signal": has_signal,
    }

    if has_signal:
        # Parse directives
        directives = {}
        for part in content_signal.split(","):
            part = part.strip()
            if "=" in part:
                key, _, val = part.partition("=")
                directives[key.strip()] = val.strip()
        details["directives"] = directives
        details["raw_header"] = content_signal

        # Check for agent-relevant permissions
        ai_input = directives.get("ai-input", "").lower() == "yes"
        ai_train = directives.get("ai-train", "").lower() == "yes"
        search = directives.get("search", "").lower() == "yes"
        details["ai_input_allowed"] = ai_input
        details["ai_train_allowed"] = ai_train
        details["search_allowed"] = search

        if ai_input:
            score = 100
        elif search:
            score = 70
        else:
            # Has the header but restrictive — still good to declare intent
            score = 50
    else:
        score = 0

    return CheckResult(
        category="content",
        check_name="content_signal_header",
        check_label="Content-Signal header declares AI usage permissions",
        passed=has_signal,
        score=score,
        weight=8,
        details=details,
        recommendation="" if has_signal else (
            "Add a Content-Signal header to your responses to declare AI usage "
            "permissions (e.g. 'ai-train=yes, search=yes, ai-input=yes'). "
            "Cloudflare's Markdown for Agents sets this automatically. "
            "See https://contentsignals.org"
        ),
    )


