"""
Layer 2: Browser analysis — headless Chromium via Playwright.

Renders the page, captures Accessibility Tree, runs axe-core,
detects WebMCP/CAPTCHA, analyzes forms, and takes a screenshot.
"""
import asyncio
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()

# Limit concurrent browser instances per worker process
_browser_semaphore = asyncio.Semaphore(3)


class BrowserAnalysisInput(BaseModel):
    """Input for the browser analysis task."""
    report_id: str


# ─── JS snippets executed inside the page ────────────────────────────────────

_DETECT_WEBMCP_JS = """() => {
    const result = {
        api_exists: typeof navigator.modelContext !== 'undefined',
        tools: [],
        context_provided: false,
    };
    if (result.api_exists && navigator.modelContext) {
        const mc = navigator.modelContext;
        if (mc.tools) {
            result.tools = Array.from(mc.tools).map(t => ({
                name: t.name,
                description: t.description || '',
                has_schema: !!t.inputSchema,
                schema: t.inputSchema || null,
            }));
        }
        result.context_provided = !!mc.context;
    }
    return result;
}"""

_DETECT_CAPTCHA_JS = """() => {
    const result = { detected: false, type: null, details: {} };

    // reCAPTCHA
    if (document.querySelector('iframe[src*="recaptcha"], .g-recaptcha, #g-recaptcha')) {
        result.detected = true;
        result.type = 'reCAPTCHA';
    }
    // hCaptcha
    if (document.querySelector('iframe[src*="hcaptcha"], .h-captcha')) {
        result.detected = true;
        result.type = 'hCaptcha';
    }
    // Cloudflare Turnstile
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile')) {
        result.detected = true;
        result.type = 'Cloudflare Turnstile';
    }
    // Cloudflare challenge page
    if (document.title.includes('Just a moment') ||
        document.querySelector('#challenge-running')) {
        result.detected = true;
        result.type = 'Cloudflare Challenge';
    }
    return result;
}"""

_ANALYZE_FORMS_JS = """() => {
    const forms = [];
    document.querySelectorAll('form').forEach((form, idx) => {
        const inputs = [];
        form.querySelectorAll('input, select, textarea').forEach(inp => {
            const id = inp.id || '';
            const name = inp.name || '';
            const type = inp.type || inp.tagName.toLowerCase();
            const ariaLabel = inp.getAttribute('aria-label') || '';
            const placeholder = inp.placeholder || '';

            // Check for associated <label>
            let labelText = '';
            if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label) labelText = label.textContent.trim();
            }
            // Fallback: parent label
            if (!labelText) {
                const parent = inp.closest('label');
                if (parent) labelText = parent.textContent.trim();
            }

            const hasLabel = !!(labelText || ariaLabel);

            inputs.push({
                type, id, name,
                label_text: labelText,
                aria_label: ariaLabel,
                placeholder,
                has_label: hasLabel,
                autocomplete: inp.getAttribute('autocomplete') || '',
            });
        });

        const allLabeled = inputs.length === 0 || inputs.every(i => i.has_label);
        forms.push({
            index: idx,
            action: form.action || '',
            method: form.method || 'get',
            name: form.name || form.getAttribute('aria-label') || '',
            input_count: inputs.length,
            all_inputs_labeled: allLabeled,
            inputs: inputs,
        });
    });
    return forms;
}"""

_AXE_AUDIT_JS = """() => {
    return new Promise((resolve, reject) => {
        if (typeof axe === 'undefined') {
            reject(new Error('axe-core not loaded'));
            return;
        }
        axe.run(document, {
            runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa', 'best-practice']
            }
        }).then(results => {
            resolve({
                violations: results.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    help: v.help,
                    helpUrl: v.helpUrl,
                    nodes_count: v.nodes.length,
                })),
                passes_count: results.passes.length,
                violations_count: results.violations.length,
                incomplete_count: results.incomplete.length,
            });
        }).catch(err => reject(err));
    });
}"""


def _cdp_ax_tree_to_dict(nodes: list[dict]) -> dict:
    """
    Convert CDP Accessibility.getFullAXTree flat node list into a nested dict
    matching the structure our analyzers expect:
        {"role": "...", "name": "...", "children": [...]}

    CDP returns a flat list of AXNode objects with nodeId/childIds references.
    """
    if not nodes:
        return {}

    # Build lookup: nodeId -> node data
    lookup: dict[str, dict] = {}
    for node in nodes:
        node_id = node.get("nodeId", "")
        role = node.get("role", {}).get("value", "")
        name = node.get("name", {}).get("value", "")

        entry: dict = {"role": role, "name": name, "children": []}

        # Extract extra properties (level for headings, etc.)
        for prop in node.get("properties", []):
            prop_name = prop.get("name", "")
            prop_val = prop.get("value", {}).get("value")
            if prop_name == "level" and prop_val is not None:
                entry["level"] = prop_val

        entry["_child_ids"] = node.get("childIds", [])
        lookup[node_id] = entry

    # Wire up children
    for entry in lookup.values():
        child_ids = entry.pop("_child_ids", [])
        for cid in child_ids:
            child = lookup.get(cid)
            if child:
                entry["children"].append(child)

    # Root is the first node
    root = lookup.get(nodes[0].get("nodeId", ""), {})

    # Strip empty children lists to keep the stored JSON clean
    def _clean(node: dict) -> dict:
        if not node.get("children"):
            node.pop("children", None)
        else:
            node["children"] = [_clean(c) for c in node["children"]]
        return node

    return _clean(root)


async def _upload_screenshot(screenshot_bytes: bytes, report_id: str) -> str:
    """Upload screenshot PNG to public storage, return URL."""
    from asgiref.sync import sync_to_async
    from django.core.files.base import ContentFile

    from common.utils.public_storage import get_public_article_storage

    storage = get_public_article_storage()
    filename = f"agent-score/{report_id}.png"
    content = ContentFile(screenshot_bytes)

    saved_path = await sync_to_async(storage.save)(filename, content)
    url = await sync_to_async(storage.url)(saved_path)
    return url


@hatchet.task(
    name="agent-score-browser-analysis",
    retries=1,
    execution_timeout=timedelta(seconds=90),
    input_validator=BrowserAnalysisInput,
)
async def browser_analysis_workflow(
    workflow_input: BrowserAnalysisInput, context: Context
):
    """
    Render the page in headless Chromium and extract agent-relevant data.
    Increments the fan-in counter — the last parallel task to finish triggers analyzers.
    """
    from apps.agent_score.models import AgentScoreReport
    from apps.agent_score.utils import count_tokens

    from apps.agent_score.workflows.activity_log import log_activity

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Starting browser analysis for report {report_id}")

    # Close stale DB connections — Hatchet workers hold long-lived connections
    # that the DB server may have closed (idle timeout, restart, etc.)
    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(f"[AGENT SCORE] Report {report_id} not found")
        return {"status": "error", "error": "report_not_found"}

    await log_activity(report_id, "browser_analysis", "info", "Launching headless browser")

    scan_notes: list[dict] = []

    async with _browser_semaphore:
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox"],
                )
                ctx = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/130.0.0.0 Safari/537.36 "
                        "PillarAgentScore/1.0"
                    ),
                    viewport={"width": 1280, "height": 720},
                )
                page = await ctx.new_page()

                # Navigate with generous timeout
                try:
                    await page.goto(
                        report.url,
                        wait_until="networkidle",
                        timeout=30_000,
                    )
                except Exception as nav_err:
                    # Fall back to domcontentloaded if networkidle times out
                    logger.warning(
                        f"[AGENT SCORE] networkidle timeout for {report.url}, "
                        f"falling back to domcontentloaded: {nav_err}"
                    )
                    scan_notes.append({
                        "type": "info",
                        "category": None,
                        "title": "Page has long-running network connections",
                        "detail": (
                            "This page didn't reach network idle within 30 seconds, "
                            "likely due to analytics, tracking pixels, or real-time "
                            "connections. We analyzed the page after initial content "
                            "loaded. This is common for sites with third-party scripts "
                            "and doesn't affect most checks."
                        ),
                    })
                    try:
                        await page.goto(
                            report.url,
                            wait_until="domcontentloaded",
                            timeout=15_000,
                        )
                    except Exception as nav_err2:
                        logger.error(
                            f"[AGENT SCORE] Page navigation failed: {nav_err2}"
                        )
                        # Don't fail the whole scan — let other layers proceed
                        scan_notes.append({
                            "type": "warning",
                            "category": None,
                            "title": "Could not load page in browser",
                            "detail": (
                                "The page could not be loaded in a browser. "
                                "Checks that require browser rendering "
                                "(accessibility, form analysis, WebMCP detection) "
                                "could not be evaluated. Your score is based on "
                                "HTTP-level checks only."
                            ),
                        })
                        existing_notes = report.scan_notes or []
                        report.scan_notes = existing_notes + scan_notes
                        await report.asave(update_fields=["scan_notes"])
                        await browser.close()

                        from apps.agent_score.workflows.fan_in import (
                            complete_layer,
                        )
                        await complete_layer(report_id)

                        return {"status": "partial", "report_id": report_id}

                # Log browser resolved URL for redirect visibility
                browser_resolved_url = page.url
                await log_activity(
                    report_id, "browser_analysis", "info",
                    f"Navigated to {report.url}",
                    {"url": report.url, "resolved_url": browser_resolved_url},
                )
                if browser_resolved_url != report.url:
                    logger.info(
                        f"[AGENT SCORE] Browser redirected: {report.url} -> "
                        f"{browser_resolved_url}"
                    )
                    await log_activity(
                        report_id, "browser_analysis", "info",
                        f"Browser redirected to {browser_resolved_url}",
                    )

                # 1. Accessibility Tree snapshot via CDP
                ax_tree = {}
                try:
                    cdp = await ctx.new_cdp_session(page)
                    cdp_tree = await cdp.send("Accessibility.getFullAXTree")
                    ax_tree = _cdp_ax_tree_to_dict(cdp_tree.get("nodes", []))
                    await cdp.detach()
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] AX tree error: {e}")

                # 2. axe-core audit
                axe_results = {}
                try:
                    await page.add_script_tag(
                        url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
                    )
                    # Give axe-core a moment to initialize
                    await page.wait_for_timeout(500)
                    axe_results = await page.evaluate(_AXE_AUDIT_JS)
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] axe-core audit error: {e}")
                    error_str = str(e)
                    if "Content Security Policy" in error_str:
                        scan_notes.append({
                            "type": "warning",
                            "category": "accessibility",
                            "title": (
                                "Accessibility audit limited by "
                                "Content Security Policy"
                            ),
                            "detail": (
                                "This site's Content Security Policy (CSP) "
                                "prevented us from running the axe-core "
                                "accessibility audit. Accessibility checks "
                                "that depend on axe-core data could not be "
                                "evaluated. The remaining accessibility "
                                "checks (ARIA labels, heading structure, "
                                "semantic HTML) still ran normally."
                            ),
                        })
                    else:
                        scan_notes.append({
                            "type": "warning",
                            "category": "accessibility",
                            "title": "Accessibility audit encountered an error",
                            "detail": (
                                "The axe-core accessibility audit could not "
                                "complete. Some accessibility checks may be "
                                "incomplete. Other checks ran normally."
                            ),
                        })

                # 3. WebMCP detection
                webmcp_data = {}
                try:
                    webmcp_data = await page.evaluate(_DETECT_WEBMCP_JS)
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] WebMCP detection error: {e}")

                # 4. CAPTCHA detection
                captcha_data = {}
                try:
                    captcha_data = await page.evaluate(_DETECT_CAPTCHA_JS)
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] CAPTCHA detection error: {e}")

                # 5. Form analysis
                forms_data = []
                try:
                    forms_data = await page.evaluate(_ANALYZE_FORMS_JS)
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] Form analysis error: {e}")

                # 6. Rendered HTML
                rendered_html = ""
                try:
                    rendered_html = await page.content()
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] Rendered HTML error: {e}")

                # 7. Screenshot
                screenshot_url = ""
                try:
                    screenshot_bytes = await page.screenshot(
                        full_page=True, type="png"
                    )
                    screenshot_url = await _upload_screenshot(
                        screenshot_bytes, report_id
                    )
                except Exception as e:
                    logger.warning(f"[AGENT SCORE] Screenshot error: {e}")

                await browser.close()

            # Store results on the report
            report.accessibility_tree = ax_tree
            report.axe_results = axe_results
            report.webmcp_data = webmcp_data
            report.captcha_data = captcha_data
            report.forms_data = forms_data
            report.rendered_html = rendered_html
            report.screenshot_url = screenshot_url

            # Token counts
            if rendered_html:
                report.content_token_count = count_tokens(rendered_html)

            # Merge scan notes (other workflows may also append)
            existing_notes = report.scan_notes or []
            report.scan_notes = existing_notes + scan_notes

            await report.asave(update_fields=[
                "accessibility_tree",
                "axe_results",
                "webmcp_data",
                "captcha_data",
                "forms_data",
                "rendered_html",
                "screenshot_url",
                "content_token_count",
                "scan_notes",
            ])

            logger.info(
                f"[AGENT SCORE] Browser analysis complete for report {report_id}"
            )

            items_collected = []
            if ax_tree:
                items_collected.append("accessibility tree")
            if axe_results:
                items_collected.append("axe audit")
            if webmcp_data.get("api_exists"):
                items_collected.append("WebMCP tools")
            if forms_data:
                items_collected.append(f"{len(forms_data)} forms")
            if screenshot_url:
                items_collected.append("screenshot")

            await log_activity(
                report_id, "browser_analysis", "success",
                f"Browser analysis complete ({', '.join(items_collected) or 'no data'})",
                {
                    "has_ax_tree": bool(ax_tree),
                    "has_axe_results": bool(axe_results),
                    "webmcp_detected": webmcp_data.get("api_exists", False),
                    "webmcp_tools": len(webmcp_data.get("tools", [])),
                    "forms_count": len(forms_data),
                    "captcha_detected": captcha_data.get("detected", False),
                    "has_screenshot": bool(screenshot_url),
                },
            )

            # Fan-in: increment counter, trigger analyzers if we're the last layer
            from apps.agent_score.workflows.fan_in import complete_layer
            await complete_layer(report_id)

            return {"status": "success", "report_id": report_id}

        except Exception as e:
            logger.error(
                f"[AGENT SCORE] Browser analysis failed for {report_id}: {e}",
                exc_info=True,
            )
            await log_activity(
                report_id, "browser_analysis", "error",
                f"Browser analysis failed: {type(e).__name__}",
                {"error": str(e)},
            )
            # Don't fail the whole scan — store a warning and let other layers proceed
            existing_notes = report.scan_notes or []
            existing_notes.append({
                "type": "warning",
                "category": None,
                "title": "Browser analysis unavailable",
                "detail": (
                    "We couldn't launch a browser to analyze this page. "
                    "Checks that require browser rendering (accessibility, "
                    "form analysis, WebMCP detection) could not be evaluated. "
                    "Your score is based on HTTP-level checks only."
                ),
            })
            report.scan_notes = existing_notes
            await report.asave(update_fields=["scan_notes"])

            from apps.agent_score.workflows.fan_in import complete_layer
            await complete_layer(report_id)

            return {"status": "partial", "report_id": report_id}
