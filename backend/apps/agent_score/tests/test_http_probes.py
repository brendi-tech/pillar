"""
Tests for the HTTP probes workflow — mocked httpx requests.
"""

import httpx

from apps.agent_score.workflows.http_probes import (
    _extract_page_metadata,
    _serialize_markdown_response,
    _serialize_response,
)


class TestSerializeResponse:
    """Tests for _serialize_response."""

    def test_successful_html_response(self):
        resp = httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="<h1>Hello</h1>",
        )
        result = _serialize_response(resp, "test")
        assert result["status_code"] == 200
        assert result["ok"] is True
        assert result["body"] == "<h1>Hello</h1>"
        assert result["content_type"] == "text/html"

    def test_404_response(self):
        resp = httpx.Response(404, headers={"content-type": "text/html"}, text="Not Found")
        result = _serialize_response(resp, "test")
        assert result["status_code"] == 404
        assert result["ok"] is False

    def test_exception_response(self):
        exc = httpx.ConnectTimeout("Connection timed out")
        result = _serialize_response(exc, "test")
        assert result["ok"] is False
        assert "ConnectTimeout" in result["error"]
        assert result["body"] == ""

    def test_none_response(self):
        result = _serialize_response(None, "test")
        assert result["ok"] is False
        assert result["error"] == "no_response"

    def test_json_response_body_stored(self):
        resp = httpx.Response(
            200,
            headers={"content-type": "application/json"},
            text='{"key": "value"}',
        )
        result = _serialize_response(resp, "test")
        assert result["body"] == '{"key": "value"}'

    def test_binary_response_body_empty(self):
        resp = httpx.Response(
            200,
            headers={"content-type": "image/png"},
            content=b"\x89PNG\r\n",
        )
        result = _serialize_response(resp, "test")
        assert result["body"] == ""


class TestSerializeMarkdownResponse:
    """Tests for _serialize_markdown_response — markdown-specific headers."""

    def test_markdown_response_detected(self):
        resp = httpx.Response(
            200,
            headers={
                "content-type": "text/markdown; charset=utf-8",
                "x-markdown-tokens": "3719",
                "content-signal": "ai-train=yes, search=yes, ai-input=yes",
            },
            text="# Hello\n\nWorld",
        )
        result = _serialize_markdown_response(resp)
        assert result["supports_markdown"] is True
        assert result["x_markdown_tokens"] == 3719
        assert result["content_signal"] == "ai-train=yes, search=yes, ai-input=yes"
        assert result["body"] == "# Hello\n\nWorld"

    def test_html_response_not_markdown(self):
        resp = httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            text="<h1>Hello</h1>",
        )
        result = _serialize_markdown_response(resp)
        assert result["supports_markdown"] is False
        assert result["x_markdown_tokens"] is None
        assert result["content_signal"] == ""

    def test_missing_token_header(self):
        resp = httpx.Response(
            200,
            headers={"content-type": "text/markdown"},
            text="# Hello",
        )
        result = _serialize_markdown_response(resp)
        assert result["supports_markdown"] is True
        assert result["x_markdown_tokens"] is None

    def test_invalid_token_header(self):
        resp = httpx.Response(
            200,
            headers={
                "content-type": "text/markdown",
                "x-markdown-tokens": "not-a-number",
            },
            text="# Hello",
        )
        result = _serialize_markdown_response(resp)
        assert result["x_markdown_tokens"] is None

    def test_exception_response(self):
        exc = httpx.ConnectError("Connection failed")
        result = _serialize_markdown_response(exc)
        assert result["supports_markdown"] is False
        assert result["x_markdown_tokens"] is None
        assert result["content_signal"] == ""

    def test_none_response(self):
        result = _serialize_markdown_response(None)
        assert result["supports_markdown"] is False


class TestExtractPageMetadata:
    """Tests for _extract_page_metadata."""

    def test_extracts_title(self):
        html = "<html><head><title>Test Page</title></head><body></body></html>"
        meta = _extract_page_metadata(html)
        assert meta["title"] == "Test Page"

    def test_extracts_meta_description(self):
        html = '<html><head><meta name="description" content="A test page"></head></html>'
        meta = _extract_page_metadata(html)
        assert meta["meta_description"] == "A test page"

    def test_extracts_og_tags(self):
        html = '<html><head><meta property="og:title" content="OG Title"></head></html>'
        meta = _extract_page_metadata(html)
        assert meta["og_tags"]["og:title"] == "OG Title"

    def test_extracts_canonical(self):
        html = '<html><head><link rel="canonical" href="https://example.com/"></head></html>'
        meta = _extract_page_metadata(html)
        assert meta["canonical_url"] == "https://example.com/"

    def test_counts_json_ld(self):
        html = """<html><head>
        <script type="application/ld+json">{"@type": "WebPage"}</script>
        <script type="application/ld+json">{"@type": "Organization"}</script>
        </head></html>"""
        meta = _extract_page_metadata(html)
        assert meta["json_ld_count"] == 2
        assert len(meta["json_ld_raw"]) == 2

    def test_empty_html(self):
        meta = _extract_page_metadata("")
        assert meta.get("title", "") == ""

    def test_missing_elements(self):
        html = "<html><head></head><body></body></html>"
        meta = _extract_page_metadata(html)
        assert meta["title"] == ""
        assert meta["meta_description"] == ""
        assert meta["canonical_url"] == ""
