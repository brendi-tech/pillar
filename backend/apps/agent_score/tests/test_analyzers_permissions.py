"""
Tests for the permissions analyzer — robots_txt_ai and content_signal_header.
"""
import pytest

from apps.agent_score.analyzers import permissions
from apps.agent_score.analyzers.permissions import (
    _check_content_signal_header,
    _check_robots_txt_ai,
    _parse_robots_txt,
)

from .conftest import DQ_ALL_OK

# ── Content-Signal header tests ──


@pytest.mark.django_db
class TestContentSignalHeader:
    """Tests for the content_signal_header check."""

    def test_full_permissions_scores_100(self, report_with_markdown):
        """ai-input=yes should score 100."""
        result = _check_content_signal_header(report_with_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["ai_input_allowed"] is True
        assert result.details["ai_train_allowed"] is True
        assert result.details["search_allowed"] is True

    def test_search_only_scores_70(self, report_with_markdown):
        """search=yes but no ai-input should score 70."""
        report_with_markdown.content_signal = "search=yes"
        result = _check_content_signal_header(report_with_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 70
        assert result.details["ai_input_allowed"] is False
        assert result.details["search_allowed"] is True

    def test_restrictive_header_scores_50(self, report_with_markdown):
        """Header present but with restrictive directives."""
        report_with_markdown.content_signal = "ai-train=no, search=no, ai-input=no"
        result = _check_content_signal_header(report_with_markdown, DQ_ALL_OK)
        assert result.passed is True  # header exists
        assert result.score == 50  # but restrictive

    def test_missing_scores_0(self, report_no_markdown):
        result = _check_content_signal_header(report_no_markdown, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0
        assert "Content-Signal" in result.recommendation

    def test_parses_directives(self, report_with_markdown):
        """Check that directive parsing works correctly."""
        report_with_markdown.content_signal = "ai-train=yes, search=yes, ai-input=yes"
        result = _check_content_signal_header(report_with_markdown, DQ_ALL_OK)
        directives = result.details["directives"]
        assert directives["ai-train"] == "yes"
        assert directives["search"] == "yes"
        assert directives["ai-input"] == "yes"

    def test_fallback_to_probe_results(self, report_no_markdown):
        """If content_signal model field is empty, check probe results."""
        report_no_markdown.content_signal = ""
        report_no_markdown.probe_results = {
            **report_no_markdown.probe_results,
            "markdown_negotiation": {
                "supports_markdown": True,
                "content_signal": "ai-input=yes",
                "x_markdown_tokens": 1000,
            },
        }
        result = _check_content_signal_header(report_no_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100

    def test_weight_is_8(self, report_with_markdown):
        result = _check_content_signal_header(report_with_markdown, DQ_ALL_OK)
        assert result.weight == 8


# ── Robots.txt tests ──


class TestParseRobotsTxt:
    """Tests for the robots.txt parser."""

    def test_empty_body(self):
        result = _parse_robots_txt("")
        assert result["blocked_ai_crawlers"] == []

    def test_wildcard_allow(self):
        result = _parse_robots_txt("User-agent: *\nAllow: /\n")
        assert result["has_wildcard_allow"] is True
        assert len(result["blocked_ai_crawlers"]) == 0

    def test_wildcard_disallow_blocks_all(self):
        result = _parse_robots_txt("User-agent: *\nDisallow: /\n")
        assert result["has_wildcard_allow"] is False
        assert len(result["blocked_ai_crawlers"]) > 0

    def test_specific_ai_crawler_blocked(self):
        body = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n"
        result = _parse_robots_txt(body)
        assert "GPTBot" in result["blocked_ai_crawlers"]
        assert "ClaudeBot" in result["allowed_ai_crawlers"]

    def test_multiple_ai_crawlers_blocked(self):
        body = (
            "User-agent: GPTBot\nDisallow: /\n"
            "User-agent: ClaudeBot\nDisallow: /\n"
            "User-agent: *\nAllow: /\n"
        )
        result = _parse_robots_txt(body)
        assert "GPTBot" in result["blocked_ai_crawlers"]
        assert "ClaudeBot" in result["blocked_ai_crawlers"]


class TestRobotsTxtAi:
    """Tests for the robots_txt_ai check."""

    def test_no_robots_txt_scores_80(self):
        probes = {"robots_txt": {"ok": False, "body": ""}}
        result = _check_robots_txt_ai(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 80

    def test_all_allowed_scores_100(self):
        probes = {"robots_txt": {"ok": True, "body": "User-agent: *\nAllow: /\n"}}
        result = _check_robots_txt_ai(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100

    def test_all_blocked_scores_10(self):
        probes = {"robots_txt": {"ok": True, "body": "User-agent: *\nDisallow: /\n"}}
        result = _check_robots_txt_ai(probes, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 10

    def test_weight_is_10(self):
        probes = {"robots_txt": {"ok": False, "body": ""}}
        result = _check_robots_txt_ai(probes, DQ_ALL_OK)
        assert result.weight == 10


@pytest.mark.django_db
class TestRunAllPermissionsChecks:
    """Integration test: run() returns all expected checks."""

    def test_returns_2_checks(self, report_with_markdown):
        results = permissions.run(report_with_markdown, DQ_ALL_OK)
        assert len(results) == 2

    def test_check_names(self, report_with_markdown):
        results = permissions.run(report_with_markdown, DQ_ALL_OK)
        names = {r.check_name for r in results}
        assert names == {
            "robots_txt_ai",
            "content_signal_header",
        }

    def test_all_checks_are_content_category(self, report_with_markdown):
        results = permissions.run(report_with_markdown, DQ_ALL_OK)
        for r in results:
            assert r.category == "rules"
