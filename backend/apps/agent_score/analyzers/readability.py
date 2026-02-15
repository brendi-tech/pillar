"""
Readability analyzer — can agents efficiently consume your content?

Checks: token_efficiency, markdown_available, content_extraction,
        semantic_html, low_token_bloat
"""
from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING

import html2text
from bs4 import BeautifulSoup

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.data_quality import DataQuality
from apps.agent_score.utils import count_tokens

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
    """Run all readability checks against the report data."""
    checks: list[CheckResult] = []
    html = report.rendered_html or report.raw_html or ""

    checks.append(_check_markdown_content_negotiation(report, dq))
    checks.append(_check_token_efficiency(html, report, dq))
    checks.append(_check_markdown_available(report, dq))
    checks.append(_check_content_extraction(html, dq))
    checks.append(_check_semantic_html(html, dq))
    checks.append(_check_low_token_bloat(html, report, dq))

    return checks


# ──────────────────────────────────────────────────────────────────────────────


def _check_markdown_content_negotiation(report: AgentScoreReport, dq: DataQuality) -> CheckResult:
    """
    Does the site respond with text/markdown when Accept: text/markdown is sent?

    This is the gold standard for agent-readable content: the CDN or origin
    converts HTML to clean markdown on-the-fly via content negotiation.
    Cloudflare's "Markdown for Agents" is the first major implementation.
    """
    if not dq.probe_usable("markdown_negotiation"):
        blocked = dq.probe_site_blocked("markdown_negotiation")
        return CheckResult(
            category="rules", check_name="markdown_content_negotiation",
            check_label="Markdown content negotiation",
            passed=False, score=0, weight=12,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.probes.get("markdown_negotiation", "unknown")},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )

    probes = report.probe_results or {}
    md_probe = probes.get("markdown_negotiation", {})
    supports = md_probe.get("supports_markdown", False)

    details: dict = {
        "supports_markdown": supports,
    }

    if supports:
        x_md_tokens = md_probe.get("x_markdown_tokens")
        content_signal = md_probe.get("content_signal", "")
        details["x_markdown_tokens"] = x_md_tokens
        details["content_signal"] = content_signal

        # Full marks if content negotiation works
        score = 100
        recommendation = ""

        # Bonus context: report the token savings
        if x_md_tokens and report.html_token_count:
            reduction = round(
                (1 - x_md_tokens / report.html_token_count) * 100, 1
            )
            details["token_reduction_percent"] = max(reduction, 0)
    else:
        score = 0
        recommendation = (
            "Your site does not respond to Accept: text/markdown content "
            "negotiation. Enable Cloudflare's 'Markdown for Agents' or implement "
            "server-side content negotiation to serve clean markdown to AI agents "
            "automatically — reducing token usage by ~80%."
        )

    return CheckResult(
        category="rules",
        check_name="markdown_content_negotiation",
        check_label="Markdown content negotiation",
        passed=supports,
        score=score,
        weight=12,
        details=details,
        recommendation=recommendation,
    )


def _extract_visible_text(html: str) -> str:
    """Strip tags and get visible text content."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "svg", "noscript"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def _html_to_markdown(html: str) -> str:
    """Convert HTML to markdown using html2text."""
    converter = html2text.HTML2Text()
    converter.ignore_links = False
    converter.ignore_images = False
    converter.body_width = 0
    return converter.handle(html)


def _check_token_efficiency(html: str, report: AgentScoreReport, dq: DataQuality) -> CheckResult:
    """
    Token efficiency — what agents actually pay to consume your content.

    If content negotiation is available (Accept: text/markdown), the effective
    token cost is the markdown token count, not the raw HTML. We score based
    on the best available delivery path.
    """
    if not dq.html_usable:
        blocked = dq.html_site_blocked()
        return CheckResult(
            category="rules", check_name="token_efficiency",
            check_label="Token efficiency",
            passed=False, score=0, weight=10,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not html:
        return CheckResult(
            category="rules",
            check_name="token_efficiency",
            check_label="Token efficiency",
            passed=False, score=0, weight=10,
            details={"error": "no_html"},
            recommendation="Ensure your page has renderable HTML content.",
        )

    html_tokens = report.html_token_count or count_tokens(html)
    content_text = _extract_visible_text(html)
    content_tokens = count_tokens(content_text)

    ratio = round(content_tokens / html_tokens * 100, 1) if html_tokens > 0 else 0

    # If the site supports markdown content negotiation, agents get markdown
    # instead of HTML — so the effective token cost is much lower.
    has_markdown_negotiation = report.supports_markdown_negotiation
    md_tokens = report.markdown_token_count

    details: dict = {
        "html_tokens": html_tokens,
        "content_tokens": content_tokens,
        "efficiency_percent": ratio,
        "has_markdown_negotiation": has_markdown_negotiation,
    }

    if has_markdown_negotiation and md_tokens:
        effective_ratio = round(content_tokens / md_tokens * 100, 1) if md_tokens > 0 else 0
        details["markdown_tokens"] = md_tokens
        details["effective_ratio_with_markdown"] = effective_ratio
        # With markdown negotiation, agents get a much better deal
        # Score based on effective ratio (content / markdown tokens)
        if effective_ratio >= 60:
            score = 100
        elif effective_ratio >= 40:
            score = 90
        else:
            score = 80  # Even poor markdown is still much better than raw HTML
        passed = True
    else:
        # Fall back to raw HTML ratio
        if ratio >= 40:
            score = 100
        elif ratio >= 25:
            score = 75
        elif ratio >= 15:
            score = 50
        else:
            score = 25
        passed = ratio >= 25

    recommendation = ""
    if not passed:
        recommendation = (
            f"Your content-to-HTML token ratio is {ratio}% (below 25%). "
            "Reduce framework noise (excessive CSS classes, nested divs), enable "
            "Cloudflare's Markdown for Agents, or provide /llms.txt."
        )

    return CheckResult(
        category="rules",
        check_name="token_efficiency",
        check_label="Token efficiency",
        passed=passed,
        score=score,
        weight=10,
        details=details,
        recommendation=recommendation,
    )


def _check_markdown_available(report: AgentScoreReport, dq: DataQuality) -> CheckResult:
    """
    Check if a static markdown version of the site is available (/llms.txt).

    Note: content negotiation (Accept: text/markdown) is checked separately
    by markdown_content_negotiation. This check covers the static discovery
    file that provides a site-wide markdown index.
    """
    if not dq.probe_usable("llms_txt"):
        blocked = dq.probe_site_blocked("llms_txt")
        return CheckResult(
            category="rules", check_name="markdown_available",
            check_label="Markdown version (/llms.txt)",
            passed=False, score=0, weight=5,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.probes.get("llms_txt", "unknown")},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    probes = report.probe_results or {}
    llms_probe = probes.get("llms_txt", {})
    llms_exists = llms_probe.get("ok", False)

    has_content_negotiation = report.supports_markdown_negotiation

    if llms_exists:
        score = 100
    elif has_content_negotiation:
        # Content negotiation covers per-page markdown, but /llms.txt is
        # still valuable as a site-wide discovery index
        score = 40
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="markdown_available",
        check_label="Markdown version (/llms.txt)",
        passed=llms_exists,
        score=score,
        weight=5,
        details={
            "llms_txt_available": llms_exists,
            "has_content_negotiation": has_content_negotiation,
        },
        recommendation="" if llms_exists else (
            "Provide a /llms.txt markdown file as a site-wide index for AI systems. "
            "Even if you support Accept: text/markdown, /llms.txt helps with discovery. "
            "See https://llmstxt.org"
        ),
    )


def _check_content_extraction(html: str, dq: DataQuality) -> CheckResult:
    """Run readability-style content extraction and measure quality."""
    if not dq.html_usable:
        blocked = dq.html_site_blocked()
        return CheckResult(
            category="rules", check_name="content_extraction",
            check_label="Content extraction quality",
            passed=False, score=0, weight=7,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not html:
        return CheckResult(
            category="rules",
            check_name="content_extraction",
            check_label="Content extraction quality",
            passed=False, score=0, weight=7,
            details={"error": "no_html"},
            recommendation="Ensure your page has extractable content.",
        )

    soup = BeautifulSoup(html, "html.parser")

    # Look for main content areas
    main = soup.find("main") or soup.find("article") or soup.find(attrs={"role": "main"})
    has_main_area = main is not None

    if has_main_area:
        main_text = main.get_text(separator=" ", strip=True)
    else:
        main_text = ""

    # Convert to markdown
    markdown = _html_to_markdown(str(main) if main else html)
    md_length = len(markdown)

    # Quality heuristic: markdown should be substantial and clean
    if has_main_area and md_length > 500:
        score = 100
    elif has_main_area and md_length > 100:
        score = 70
    elif md_length > 500:
        score = 50
    elif md_length > 100:
        score = 30
    else:
        score = 10

    return CheckResult(
        category="rules",
        check_name="content_extraction",
        check_label="Content extraction quality",
        passed=has_main_area and md_length > 100,
        score=score,
        weight=7,
        details={
            "has_main_content_area": has_main_area,
            "extracted_markdown_length": md_length,
            "main_text_length": len(main_text),
        },
        recommendation="" if has_main_area else (
            "Wrap your primary content in a <main> or <article> element so AI agents "
            "can cleanly extract it without navigation, footer, and sidebar noise."
        ),
    )


def _check_semantic_html(html: str, dq: DataQuality) -> CheckResult:
    """Uses <article>, <main>, <nav>, <section> vs div soup."""
    if not dq.html_usable:
        blocked = dq.html_site_blocked()
        return CheckResult(
            category="rules", check_name="semantic_html",
            check_label="Semantic HTML elements",
            passed=False, score=0, weight=7,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not html:
        return CheckResult(
            category="rules",
            check_name="semantic_html",
            check_label="Semantic HTML elements",
            passed=False, score=0, weight=7,
            details={"error": "no_html"},
            recommendation="Use semantic HTML elements.",
        )

    soup = BeautifulSoup(html, "html.parser")

    semantic_tags = ["main", "article", "nav", "section", "header", "footer", "aside"]
    semantic_count = sum(len(soup.find_all(tag)) for tag in semantic_tags)
    div_count = len(soup.find_all("div"))
    total = semantic_count + div_count

    ratio = round(semantic_count / total * 100, 1) if total > 0 else 0

    if semantic_count >= 5 and ratio >= 15:
        score = 100
    elif semantic_count >= 3:
        score = 70
    elif semantic_count >= 1:
        score = 40
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="semantic_html",
        check_label="Semantic HTML elements",
        passed=semantic_count >= 3,
        score=score,
        weight=7,
        details={
            "semantic_element_count": semantic_count,
            "div_count": div_count,
            "semantic_ratio_percent": ratio,
        },
        recommendation="" if semantic_count >= 3 else (
            "Replace generic <div> containers with semantic elements (<main>, <nav>, "
            "<article>, <section>, <header>, <footer>). These help agents understand "
            "page structure."
        ),
    )


def _check_low_token_bloat(html: str, report: AgentScoreReport, dq: DataQuality) -> CheckResult:
    """
    Page token footprint relative to agent context windows.

    Scores on a smooth logarithmic curve — smaller pages leave more room for
    conversation history, tools, and multi-page workflows.  If markdown
    content negotiation is available, we score based on the effective token
    cost (markdown tokens) rather than raw HTML.
    """
    if not dq.html_usable:
        blocked = dq.html_site_blocked()
        return CheckResult(
            category="rules", check_name="low_token_bloat",
            check_label="Token footprint",
            passed=False, score=0, weight=5,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.rendered_html or dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )

    html_tokens = report.html_token_count or count_tokens(html) if html else 0

    if html_tokens == 0:
        return CheckResult(
            category="rules",
            check_name="low_token_bloat",
            check_label="Token footprint",
            passed=False, score=0, weight=5,
            details={"error": "no_html"},
            recommendation="Ensure your page has content.",
        )

    # Use markdown tokens as the effective cost if content negotiation works
    has_markdown = report.supports_markdown_negotiation
    md_tokens = report.markdown_token_count
    effective_tokens = md_tokens if (has_markdown and md_tokens) else html_tokens

    # Smooth logarithmic scoring curve:
    #   ≤ 2k  → 100
    #   ~4k   → 81
    #   ~8k   → 62
    #   ~16k  → 44
    #   ~32k  → 25
    #   ~64k  → 6
    #   ≥ 80k → 0
    BASELINE = 2_000   # pages around this size score perfectly
    ZERO_POINT = 80_000  # pages this large score near 0

    if effective_tokens <= BASELINE:
        score = 100
    else:
        score = max(0, round(
            100 * (1 - math.log(effective_tokens / BASELINE)
                   / math.log(ZERO_POINT / BASELINE))
        ))

    # Express as percentage of common context window sizes
    CONTEXT_WINDOWS = {"200k": 200_000, "1m": 1_000_000}
    context_pcts = {
        label: round(effective_tokens / size * 100, 2)
        for label, size in CONTEXT_WINDOWS.items()
    }

    details: dict = {
        "html_tokens": html_tokens,
        "effective_tokens": effective_tokens,
        "context_window_percent": context_pcts,
        "using_markdown_tokens": has_markdown and md_tokens is not None,
    }
    if has_markdown and md_tokens:
        details["markdown_tokens"] = md_tokens

    recommendation = ""
    if score < 70:
        pct_200k = context_pcts["200k"]
        recommendation = (
            f"Your page costs {effective_tokens:,} tokens "
            f"({pct_200k}% of a 200k context window) for agents to consume. "
            "Lighter pages leave more room for conversation history and "
            "multi-step workflows. "
        )
        if not has_markdown:
            recommendation += (
                "Enable Cloudflare's Markdown for Agents or reduce framework noise."
            )
        else:
            recommendation += (
                "Consider reducing page content or splitting into sub-pages."
            )

    return CheckResult(
        category="rules",
        check_name="low_token_bloat",
        check_label="Token footprint",
        passed=score >= 50,
        score=score,
        weight=5,
        details=details,
        recommendation=recommendation,
    )
