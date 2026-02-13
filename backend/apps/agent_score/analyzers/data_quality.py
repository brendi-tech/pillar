"""
Data quality assessment — determines which data sources are usable
before analyzers run.

When HTTP probes or browser analysis are blocked (e.g., Cloudflare challenge),
the raw data stored on the report is garbage.  Running analyzers against
garbage produces misleading zero scores.  This module inspects the report's
raw data and flags which sources are compromised so analyzers can return
``status="dnf"`` instead of a bogus failure.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)

# Strings that indicate a Cloudflare challenge page rather than real content.
_CF_MARKERS = ("Just a moment", "challenge-platform")


def _is_cloudflare_challenge(html: str) -> bool:
    """Return True if *html* looks like a Cloudflare challenge page."""
    return any(marker in html for marker in _CF_MARKERS)


@dataclass
class DataQuality:
    """
    Per-source quality flags for a single report.

    Each field is a short string describing the status of that data source:
      - ``"ok"``                  — data is present and usable
      - ``"empty"``               — data was never collected
      - ``"cloudflare_challenge"``— data is a CF challenge page, not real content
      - ``"from_challenge"``      — derived from a CF challenge page (metadata)
      - ``"blocked"``             — probe returned an error or non-200
      - ``"error"``               — unexpected probe-level failure
    """

    raw_html: str = "empty"
    page_metadata: str = "empty"
    rendered_html: str = "empty"
    accessibility_tree: str = "empty"
    axe_results: str = "empty"
    forms_data: str = "empty"
    webmcp_data: str = "empty"
    probes: dict[str, str] = field(default_factory=dict)

    # ── Convenience helpers ──────────────────────────────────────────────

    @property
    def html_usable(self) -> bool:
        """True if at least one of rendered_html / raw_html is ``"ok"``."""
        return self.rendered_html == "ok" or self.raw_html == "ok"

    def probe_usable(self, name: str) -> bool:
        """True if the named probe (e.g. ``"robots_txt"``) is ``"ok"``."""
        return self.probes.get(name) == "ok"

    @property
    def browser_data_usable(self) -> bool:
        """True if the accessibility tree was collected."""
        return self.accessibility_tree == "ok"


def assess_data_quality(report: AgentScoreReport) -> DataQuality:
    """
    Inspect a report's raw data and return a :class:`DataQuality` describing
    which sources are usable.
    """
    dq = DataQuality()

    # ── raw_html ─────────────────────────────────────────────────────────
    raw = report.raw_html or ""
    if not raw:
        dq.raw_html = "empty"
    elif _is_cloudflare_challenge(raw):
        dq.raw_html = "cloudflare_challenge"
    else:
        dq.raw_html = "ok"

    # ── page_metadata (derived from raw_html during http_probes) ─────────
    meta = report.page_metadata or {}
    if not meta:
        dq.page_metadata = "empty"
    elif dq.raw_html == "cloudflare_challenge":
        # Metadata was extracted from the challenge page — not trustworthy
        dq.page_metadata = "from_challenge"
    else:
        dq.page_metadata = "ok"

    # ── rendered_html (from browser analysis / Playwright) ───────────────
    rendered = report.rendered_html or ""
    if not rendered:
        dq.rendered_html = "empty"
    elif _is_cloudflare_challenge(rendered):
        dq.rendered_html = "cloudflare_challenge"
    else:
        dq.rendered_html = "ok"

    # ── browser-level data ───────────────────────────────────────────────
    ax_tree = report.accessibility_tree or {}
    dq.accessibility_tree = "ok" if ax_tree else "empty"

    axe = report.axe_results or {}
    dq.axe_results = "ok" if axe else "empty"

    forms = report.forms_data
    # forms_data defaults to list, so check for non-empty list
    dq.forms_data = "ok" if forms else "empty"

    wmcp = report.webmcp_data or {}
    dq.webmcp_data = "ok" if wmcp else "empty"

    # ── per-probe status ─────────────────────────────────────────────────
    probe_results = report.probe_results or {}
    probe_names = ["main_page", "robots_txt", "sitemap", "llms_txt",
                   "markdown_negotiation"]

    for name in probe_names:
        probe = probe_results.get(name, {})
        if not probe:
            dq.probes[name] = "empty"
        elif probe.get("error"):
            dq.probes[name] = "error"
        elif not probe.get("ok", False):
            dq.probes[name] = "blocked"
        else:
            # Probe got a 200, but the body might be a CF challenge
            body = probe.get("body", "")
            if body and _is_cloudflare_challenge(body):
                dq.probes[name] = "cloudflare_challenge"
            else:
                dq.probes[name] = "ok"

    logger.info(
        "[AGENT SCORE] Data quality: raw_html=%s, rendered=%s, "
        "page_meta=%s, ax_tree=%s, probes=%s",
        dq.raw_html, dq.rendered_html, dq.page_metadata,
        dq.accessibility_tree, dq.probes,
    )

    return dq
