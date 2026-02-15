"""
Fixtures for Agent Score tests.

Provides reusable report objects in various states, plus sample probe/AX data.
"""
from unittest.mock import patch

import pytest

from apps.agent_score.analyzers.data_quality import DataQuality
from apps.agent_score.models import AgentScoreCheck, AgentScoreReport

# ── Sample HTML snippets ──


MINIMAL_HTML = """<!DOCTYPE html>
<html lang="en">
<head><title>Test Page</title>
<meta name="description" content="A test page for agent score.">
<link rel="canonical" href="https://example.com/">
</head>
<body>
<header><nav aria-label="Main"><a href="/">Home</a></nav></header>
<main>
<h1>Welcome</h1>
<p>This is the main content of the page.</p>
<section><h2>About</h2><p>About us section.</p></section>
</main>
<footer><p>&copy; 2026</p></footer>
</body>
</html>"""

DIV_SOUP_HTML = """<!DOCTYPE html>
<html>
<head><title>Div Soup</title></head>
<body>
<div class="header"><div class="nav"><div><a href="/">Home</a></div></div></div>
<div class="main">
<div class="title"><b>Welcome</b></div>
<div class="content"><div class="text">Content here.</div></div>
<div class="section"><div class="subtitle"><b>About</b></div></div>
</div>
<div class="footer"><div>&copy; 2026</div></div>
</body>
</html>"""


# ── Sample probe results ──


FULL_PROBE_RESULTS = {
    "main_page": {"status_code": 200, "ok": True, "content_type": "text/html", "body": MINIMAL_HTML},
    "robots_txt": {
        "status_code": 200, "ok": True, "content_type": "text/plain",
        "body": "User-agent: *\nAllow: /\n",
    },
    "sitemap": {
        "status_code": 200, "ok": True, "content_type": "application/xml",
        "body": '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url></urlset>',
    },
    "llms_txt": {
        "status_code": 200, "ok": True, "content_type": "text/plain",
        "body": "# Example\nThis is an LLMs.txt file.\n",
    },
    "mcp_json": {
        "status_code": 404, "ok": False, "body": "",
    },
    "markdown_negotiation": {
        "status_code": 200, "ok": True,
        "content_type": "text/markdown; charset=utf-8",
        "body": "# Welcome\n\nThis is the main content.",
        "supports_markdown": True,
        "x_markdown_tokens": 500,
        "content_signal": "ai-train=yes, search=yes, ai-input=yes",
    },
}

EMPTY_PROBE_RESULTS = {
    "main_page": {"status_code": 200, "ok": True, "content_type": "text/html", "body": ""},
    "robots_txt": {"status_code": 404, "ok": False, "body": ""},
    "sitemap": {"status_code": 404, "ok": False, "body": ""},
    "llms_txt": {"status_code": 404, "ok": False, "body": ""},
    "mcp_json": {"status_code": 404, "ok": False, "body": ""},
    "markdown_negotiation": {
        "status_code": 200, "ok": True,
        "content_type": "text/html; charset=utf-8",
        "body": MINIMAL_HTML,
        "supports_markdown": False,
        "x_markdown_tokens": None,
        "content_signal": "",
    },
}

# ── Sample accessibility tree ──

SAMPLE_AX_TREE = {
    "role": "WebArea",
    "name": "Test Page",
    "children": [
        {
            "role": "banner",
            "name": "",
            "children": [
                {
                    "role": "navigation",
                    "name": "Main",
                    "children": [
                        {"role": "link", "name": "Home"},
                    ],
                },
            ],
        },
        {
            "role": "main",
            "name": "",
            "children": [
                {"role": "heading", "name": "Welcome", "level": 1},
                {"role": "paragraph", "name": ""},
                {
                    "role": "region",
                    "name": "",
                    "children": [
                        {"role": "heading", "name": "About", "level": 2},
                    ],
                },
            ],
        },
        {
            "role": "contentinfo",
            "name": "",
            "children": [],
        },
    ],
}


SAMPLE_AXE_RESULTS = {
    "violations": [],
    "passes": [
        {"id": "button-name", "nodes_count": 2},
        {"id": "link-name", "nodes_count": 5},
    ],
}


SAMPLE_PAGE_METADATA = {
    "title": "Test Page",
    "meta_description": "A test page for agent score.",
    "og_tags": {"og:title": "Test Page", "og:description": "A test page."},
    "canonical_url": "https://example.com/",
    "json_ld_count": 1,
    "json_ld_raw": ['{"@context": "https://schema.org", "@type": "WebPage", "name": "Test"}'],
}


# ── Data Quality constants ──

DQ_ALL_OK = DataQuality(
    raw_html="ok",
    page_metadata="ok",
    rendered_html="ok",
    accessibility_tree="ok",
    axe_results="ok",
    forms_data="ok",
    webmcp_data="ok",
    probes={
        "main_page": "ok",
        "robots_txt": "ok",
        "sitemap": "ok",
        "llms_txt": "ok",
        "markdown_negotiation": "ok",
    },
)

DQ_EMPTY = DataQuality()  # all fields default to "empty"


# ── Fixtures ──


@pytest.fixture
def mock_task_router():
    """Mock TaskRouter.execute to prevent real Hatchet calls."""
    with patch("common.task_router.TaskRouter.execute") as mock:
        yield mock


@pytest.fixture
def report_with_markdown(mock_task_router):
    """A report where the site supports markdown content negotiation."""
    return AgentScoreReport.objects.create(
        url="https://example.com/",
        domain="example.com",
        status="complete",
        raw_html=MINIMAL_HTML,
        html_token_count=5000,
        markdown_token_count=500,
        supports_markdown_negotiation=True,
        content_signal="ai-train=yes, search=yes, ai-input=yes",
        probe_results=FULL_PROBE_RESULTS,
        page_metadata=SAMPLE_PAGE_METADATA,
        accessibility_tree=SAMPLE_AX_TREE,
        axe_results=SAMPLE_AXE_RESULTS,
        overall_score=85,
        content_score=90,
        interaction_score=80,
    )


@pytest.fixture
def report_no_markdown(mock_task_router):
    """A report where the site does NOT support markdown content negotiation."""
    return AgentScoreReport.objects.create(
        url="https://plain-site.com/",
        domain="plain-site.com",
        status="complete",
        raw_html=MINIMAL_HTML,
        html_token_count=5000,
        markdown_token_count=None,
        supports_markdown_negotiation=False,
        content_signal="",
        probe_results=EMPTY_PROBE_RESULTS,
        page_metadata=SAMPLE_PAGE_METADATA,
        accessibility_tree=SAMPLE_AX_TREE,
        axe_results=SAMPLE_AXE_RESULTS,
        overall_score=55,
    )


@pytest.fixture
def report_pending(mock_task_router):
    """A report in pending state (scan just started)."""
    return AgentScoreReport.objects.create(
        url="https://pending-site.com/",
        domain="pending-site.com",
        status="pending",
    )


@pytest.fixture
def report_with_checks(report_with_markdown, mock_task_router):
    """A complete report with associated check records."""
    checks = [
        AgentScoreCheck(
            report=report_with_markdown,
            category="rules",
            check_name="markdown_content_negotiation",
            check_label="Markdown content negotiation",
            passed=True,
            score=100,
            weight=12,
            details={"supports_markdown": True},
        ),
        AgentScoreCheck(
            report=report_with_markdown,
            category="rules",
            check_name="token_efficiency",
            check_label="Token efficiency",
            passed=True,
            score=90,
            weight=10,
            details={"html_tokens": 5000, "markdown_tokens": 500},
        ),
        AgentScoreCheck(
            report=report_with_markdown,
            category="rules",
            check_name="content_signal_header",
            check_label="Content-Signal header",
            passed=True,
            score=100,
            weight=8,
            details={"has_content_signal": True},
        ),
    ]
    AgentScoreCheck.objects.bulk_create(checks)
    return report_with_markdown
