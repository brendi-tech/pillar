"""
Discovery analyzer — can agents find and understand your site?

Checks: llms_txt_present, structured_data, sitemap_present,
        meta_description, semantic_headings
"""
from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

from bs4 import BeautifulSoup

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.data_quality import DataQuality

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
    """Run all discovery checks against the report data."""
    checks: list[CheckResult] = []
    probes = report.probe_results or {}
    html = report.raw_html or ""

    checks.append(_check_llms_txt(probes, dq))
    checks.append(_check_structured_data(html, report.page_metadata, dq))
    checks.append(_check_sitemap(probes, dq))
    checks.append(_check_meta_description(report.page_metadata, dq))
    checks.append(_check_semantic_headings(html, dq))

    return checks


# ──────────────────────────────────────────────────────────────────────────────


def _check_llms_txt(probes: dict, dq: DataQuality) -> CheckResult:
    """Fetch /llms.txt — exists, valid markdown, reasonable size."""
    if not dq.probe_usable("llms_txt"):
        blocked = dq.probe_site_blocked("llms_txt")
        return CheckResult(
            category="rules", check_name="llms_txt_present",
            check_label="Has /llms.txt",
            passed=False, score=0, weight=8,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.probes.get("llms_txt", "unknown")},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    probe = probes.get("llms_txt", {})
    exists = probe.get("ok", False)
    body = probe.get("body", "")
    is_markdown = body.strip().startswith("#") if body else False
    size = len(body.encode("utf-8")) if body else 0

    if exists and is_markdown:
        score = 100
    elif exists:
        score = 40  # exists but not proper markdown
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="llms_txt_present",
        check_label="Has /llms.txt",
        passed=exists and is_markdown,
        score=score,
        weight=8,
        details={"exists": exists, "is_markdown": is_markdown, "size_bytes": size},
        recommendation="" if (exists and is_markdown) else (
            "Add a /llms.txt file to help AI assistants understand your site. "
            "See https://llmstxt.org for the specification."
        ),
    )


def _check_structured_data(html: str, metadata: dict, dq: DataQuality) -> CheckResult:
    """Parse HTML for JSON-LD / Schema.org markup."""
    if dq.page_metadata != "ok" and dq.raw_html != "ok":
        blocked = dq.html_site_blocked() or dq.source_site_blocked("page_metadata")
        return CheckResult(
            category="rules", check_name="structured_data",
            check_label="Structured data (JSON-LD)",
            passed=False, score=0, weight=9,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    json_ld_raw = metadata.get("json_ld_raw", [])
    count = len(json_ld_raw)

    # Try to parse each block to validate
    valid_blocks = 0
    schema_types: list[str] = []
    for block_text in json_ld_raw:
        try:
            data = json.loads(block_text)
            valid_blocks += 1
            if isinstance(data, dict):
                t = data.get("@type", "")
                if t:
                    schema_types.append(t)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        t = item.get("@type", "")
                        if t:
                            schema_types.append(t)
        except (json.JSONDecodeError, TypeError):
            pass

    # Also check for microdata / RDFa (basic heuristic from raw HTML)
    has_microdata = 'itemscope' in html if html else False

    if valid_blocks >= 2:
        score = 100
    elif valid_blocks == 1:
        score = 70
    elif has_microdata:
        score = 40
    else:
        score = 0

    passed = valid_blocks > 0

    return CheckResult(
        category="rules",
        check_name="structured_data",
        check_label="Structured data (JSON-LD)",
        passed=passed,
        score=score,
        weight=9,
        details={
            "json_ld_blocks": count,
            "valid_blocks": valid_blocks,
            "schema_types": schema_types[:10],
            "has_microdata": has_microdata,
        },
        recommendation="" if passed else (
            "Add JSON-LD structured data (Schema.org) to help AI systems understand "
            "the entities on your page. See https://developers.google.com/search/docs/"
            "appearance/structured-data/intro-structured-data"
        ),
    )


def _check_sitemap(probes: dict, dq: DataQuality) -> CheckResult:
    """Fetch /sitemap.xml — does it exist?"""
    if not dq.probe_usable("sitemap"):
        blocked = dq.probe_site_blocked("sitemap")
        return CheckResult(
            category="rules", check_name="sitemap_present",
            check_label="Has /sitemap.xml",
            passed=False, score=0, weight=5,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.probes.get("sitemap", "unknown")},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    probe = probes.get("sitemap", {})
    exists = probe.get("ok", False)
    body = probe.get("body", "")
    is_xml = "<urlset" in body or "<sitemapindex" in body if body else False

    if exists and is_xml:
        score = 100
    elif exists:
        score = 50  # exists but not valid XML sitemap
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="sitemap_present",
        check_label="Has /sitemap.xml",
        passed=exists and is_xml,
        score=score,
        weight=5,
        details={"exists": exists, "is_valid_xml": is_xml},
        recommendation="" if (exists and is_xml) else (
            "Add a /sitemap.xml to help AI crawlers discover all your pages. "
            "See https://www.sitemaps.org/protocol.html"
        ),
    )


def _check_meta_description(metadata: dict, dq: DataQuality) -> CheckResult:
    """Check for <meta name="description"> and OpenGraph tags."""
    if dq.page_metadata != "ok":
        blocked = dq.source_site_blocked("page_metadata")
        return CheckResult(
            category="rules", check_name="meta_description",
            check_label="Meta & OpenGraph tags",
            passed=False, score=0, weight=5,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.page_metadata},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    desc = metadata.get("meta_description", "")
    og_tags = metadata.get("og_tags", {})
    has_desc = bool(desc and len(desc) > 10)
    has_og = bool(og_tags.get("og:title") or og_tags.get("og:description"))

    if has_desc and has_og:
        score = 100
    elif has_desc:
        score = 70
    elif has_og:
        score = 50
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="meta_description",
        check_label="Meta & OpenGraph tags",
        passed=has_desc,
        score=score,
        weight=5,
        details={
            "has_meta_description": has_desc,
            "description_length": len(desc),
            "has_og_tags": has_og,
            "og_tags_present": list(og_tags.keys()),
        },
        recommendation="" if has_desc else (
            "Add a <meta name=\"description\"> tag and OpenGraph tags so AI systems "
            "can summarize your page before reading the full content."
        ),
    )


def _check_semantic_headings(html: str, dq: DataQuality) -> CheckResult:
    """Proper h1-h6 hierarchy — no skipped levels, single h1."""
    if dq.raw_html != "ok":
        blocked = dq.raw_html in ("cloudflare_challenge", "blocked", "error")
        return CheckResult(
            category="rules", check_name="semantic_headings",
            check_label="Heading hierarchy (h1–h6)",
            passed=False, score=0, weight=6,
            status="evaluated" if blocked else "dnf",
            details={"reason": dq.raw_html},
            recommendation=_BLOCKED_RECOMMENDATION if blocked else _INFRA_RECOMMENDATION,
        )
    if not html:
        return CheckResult(
            category="rules",
            check_name="semantic_headings",
            check_label="Heading hierarchy (h1–h6)",
            passed=False, score=0, weight=6,
            details={"error": "no_html"},
            recommendation="Ensure your page has proper heading hierarchy (h1–h6).",
        )

    soup = BeautifulSoup(html, "html.parser")
    headings: list[tuple[int, str]] = []
    for level in range(1, 7):
        for tag in soup.find_all(f"h{level}"):
            headings.append((level, tag.get_text(strip=True)[:100]))

    # Re-sort by document order (find_all is already in order per level,
    # but we merged levels). Use original position in source.
    all_heading_tags = soup.find_all(re.compile(r"^h[1-6]$"))
    headings = [(int(t.name[1]), t.get_text(strip=True)[:100]) for t in all_heading_tags]

    h1_count = sum(1 for lvl, _ in headings if lvl == 1)
    has_h1 = h1_count >= 1
    single_h1 = h1_count == 1

    # Check for skipped levels (e.g. h1 → h3 with no h2)
    skipped_levels = False
    levels_used = sorted({lvl for lvl, _ in headings})
    for i in range(len(levels_used) - 1):
        if levels_used[i + 1] - levels_used[i] > 1:
            skipped_levels = True
            break

    if has_h1 and single_h1 and not skipped_levels and len(headings) >= 3:
        score = 100
    elif has_h1 and not skipped_levels:
        score = 70
    elif has_h1:
        score = 50
    elif len(headings) > 0:
        score = 30
    else:
        score = 0

    return CheckResult(
        category="rules",
        check_name="semantic_headings",
        check_label="Heading hierarchy (h1–h6)",
        passed=has_h1 and single_h1 and not skipped_levels,
        score=score,
        weight=6,
        details={
            "heading_count": len(headings),
            "h1_count": h1_count,
            "levels_used": levels_used,
            "skipped_levels": skipped_levels,
        },
        recommendation="" if (has_h1 and not skipped_levels) else (
            "Use a single <h1> and sequential heading levels (h1 → h2 → h3) without "
            "skipping. Agents fold content by heading to navigate efficiently."
        ),
    )
