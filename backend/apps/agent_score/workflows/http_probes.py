"""
Layer 1: HTTP probes — lightweight parallel requests to well-known paths.

Fetches robots.txt, sitemap.xml, llms.txt, agents.json, ai.txt, etc.
using httpx. No browser needed.
"""
import asyncio
import logging
from datetime import timedelta

import httpx
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()

# Maximum body size to store per probe (to avoid blowing up the JSONField)
MAX_PROBE_BODY_BYTES = 512_000  # 500 KB


class HttpProbesInput(BaseModel):
    """Input for the HTTP probes task."""
    report_id: str


def _serialize_response(resp: httpx.Response | Exception | None, label: str) -> dict:
    """
    Serialize an httpx response (or exception) into a storable dict.
    Truncates large bodies to keep the JSONField reasonable.
    """
    if resp is None:
        return {"status_code": None, "ok": False, "error": "no_response", "body": ""}

    if isinstance(resp, Exception):
        return {
            "status_code": None,
            "ok": False,
            "error": f"{type(resp).__name__}: {resp}",
            "body": "",
        }

    body = ""
    try:
        content_type = resp.headers.get("content-type", "")
        # Only store text-based responses
        if any(t in content_type for t in ("text", "json", "xml", "html")):
            body = resp.text[:MAX_PROBE_BODY_BYTES]
    except Exception:
        body = ""

    return {
        "status_code": resp.status_code,
        "ok": resp.status_code == 200,
        "content_type": resp.headers.get("content-type", ""),
        "body": body,
    }


def _serialize_markdown_response(resp: httpx.Response | Exception | None) -> dict:
    """
    Serialize the markdown content-negotiation response, capturing
    extra headers (x-markdown-tokens, content-signal) that normal
    probes don't return.
    """
    base = _serialize_response(resp, "markdown_negotiation")

    if isinstance(resp, httpx.Response):
        content_type = resp.headers.get("content-type", "")
        base["supports_markdown"] = "text/markdown" in content_type

        # Cloudflare returns an authoritative token count header
        raw_token_header = resp.headers.get("x-markdown-tokens", "")
        try:
            base["x_markdown_tokens"] = int(raw_token_header) if raw_token_header else None
        except (ValueError, TypeError):
            base["x_markdown_tokens"] = None

        # Content-Signal header (Cloudflare content usage permissions)
        base["content_signal"] = resp.headers.get("content-signal", "")
    else:
        base["supports_markdown"] = False
        base["x_markdown_tokens"] = None
        base["content_signal"] = ""

    return base


def _extract_page_metadata(html: str) -> dict:
    """Extract meta tags, title, and OG tags from raw HTML."""
    from bs4 import BeautifulSoup

    metadata: dict = {}

    try:
        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find("title")
        metadata["title"] = title_tag.get_text(strip=True) if title_tag else ""

        # Meta description
        desc = soup.find("meta", attrs={"name": "description"})
        metadata["meta_description"] = desc["content"] if desc and desc.get("content") else ""

        # OpenGraph tags
        og_tags = {}
        for og in soup.find_all("meta", attrs={"property": True}):
            prop = og.get("property", "")
            if prop.startswith("og:"):
                og_tags[prop] = og.get("content", "")
        metadata["og_tags"] = og_tags

        # Canonical
        canonical = soup.find("link", attrs={"rel": "canonical"})
        metadata["canonical_url"] = canonical["href"] if canonical and canonical.get("href") else ""

        # JSON-LD blocks
        json_ld_scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
        metadata["json_ld_count"] = len(json_ld_scripts)
        json_ld_bodies = []
        for script in json_ld_scripts:
            text = script.get_text(strip=True)
            if text:
                json_ld_bodies.append(text[:10_000])  # cap each block
        metadata["json_ld_raw"] = json_ld_bodies

    except Exception as e:
        logger.warning(f"[AGENT SCORE] Metadata extraction error: {e}")

    return metadata


@hatchet.task(
    name="agent-score-http-probes",
    retries=2,
    execution_timeout=timedelta(seconds=60),
    input_validator=HttpProbesInput,
)
async def http_probes_workflow(workflow_input: HttpProbesInput, context: Context):
    """
    Run all lightweight HTTP checks in parallel, store results on the report.
    Increments the fan-in counter — the last parallel task to finish triggers analyzers.
    """
    from apps.agent_score.models import AgentScoreReport
    from apps.agent_score.utils import get_origin

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Starting HTTP probes for report {report_id}")

    # Close stale DB connections — Hatchet workers hold long-lived connections
    # that the DB server may have closed (idle timeout, restart, etc.)
    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(f"[AGENT SCORE] Report {report_id} not found")
        return {"status": "error", "error": "report_not_found"}

    origin = get_origin(report.url)

    try:
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            headers={"User-Agent": "PillarAgentScore/1.0 (+https://pillar.bot)"},
        ) as client:
            results = await asyncio.gather(
                client.get(report.url),                              # [0] main page
                client.get(f"{origin}/robots.txt"),                  # [1]
                client.get(f"{origin}/sitemap.xml"),                 # [2]
                client.get(f"{origin}/llms.txt"),                    # [3]
                client.get(                                          # [4] markdown negotiation
                    report.url,
                    headers={"Accept": "text/markdown, text/html"},
                ),
                return_exceptions=True,
            )

        # Store the main page HTML
        main_resp = results[0]
        if isinstance(main_resp, httpx.Response) and main_resp.status_code == 200:
            report.raw_html = main_resp.text
        elif isinstance(main_resp, Exception):
            logger.warning(f"[AGENT SCORE] Main page fetch failed: {main_resp}")
            report.raw_html = ""

        # Extract metadata from raw HTML
        if report.raw_html:
            report.page_metadata = _extract_page_metadata(report.raw_html)

        # Serialize all probe responses
        probe_labels = [
            "main_page", "robots_txt", "sitemap", "llms_txt",
        ]
        probe_results = {}
        for label, resp in zip(probe_labels, results[:4], strict=True):
            probe_results[label] = _serialize_response(resp, label)

        # Handle markdown content negotiation probe separately
        probe_results["markdown_negotiation"] = _serialize_markdown_response(results[4])

        report.probe_results = probe_results

        # Compute token count for raw HTML
        if report.raw_html:
            from apps.agent_score.utils import count_tokens
            report.html_token_count = count_tokens(report.raw_html)

        # Populate markdown negotiation fields from content negotiation probe
        md_probe = probe_results["markdown_negotiation"]
        if md_probe.get("supports_markdown"):
            report.supports_markdown_negotiation = True
            report.content_signal = md_probe.get("content_signal", "")

            # Prefer the authoritative x-markdown-tokens header from the CDN
            header_tokens = md_probe.get("x_markdown_tokens")
            if header_tokens:
                report.markdown_token_count = header_tokens
            elif md_probe.get("body"):
                from apps.agent_score.utils import count_tokens
                report.markdown_token_count = count_tokens(md_probe["body"])

        await report.asave(update_fields=[
            "raw_html",
            "page_metadata",
            "probe_results",
            "html_token_count",
            "markdown_token_count",
            "supports_markdown_negotiation",
            "content_signal",
        ])

        logger.info(f"[AGENT SCORE] HTTP probes complete for report {report_id}")

        # Fan-in: increment counter, trigger analyzers if we're the last layer
        from apps.agent_score.workflows.fan_in import complete_layer
        await complete_layer(report_id)

        return {"status": "success", "report_id": report_id}

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] HTTP probes failed for {report_id}: {e}",
            exc_info=True,
        )
        # Don't fail the whole scan — store a warning and let other layers proceed
        existing_notes = report.scan_notes or []
        existing_notes.append({
            "type": "warning",
            "category": None,
            "title": "HTTP analysis unavailable",
            "detail": (
                "We couldn't fetch your page from our servers. "
                "Checks that rely on HTTP responses (robots.txt, "
                "sitemap, structured data) could not be evaluated. "
                "Your score is based on browser-level checks only."
            ),
        })
        report.scan_notes = existing_notes
        await report.asave(update_fields=["scan_notes"])

        from apps.agent_score.workflows.fan_in import complete_layer
        await complete_layer(report_id)

        return {"status": "partial", "report_id": report_id}
