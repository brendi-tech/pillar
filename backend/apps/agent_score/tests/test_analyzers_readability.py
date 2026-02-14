"""
Tests for the readability analyzer — including new markdown content negotiation checks.
"""
import pytest

from apps.agent_score.analyzers import readability
from apps.agent_score.analyzers.readability import (
    _check_content_extraction,
    _check_low_token_bloat,
    _check_markdown_available,
    _check_markdown_content_negotiation,
    _check_semantic_html,
    _check_token_efficiency,
)

from .conftest import DIV_SOUP_HTML, DQ_ALL_OK, DQ_EMPTY, MINIMAL_HTML


@pytest.mark.django_db
class TestMarkdownContentNegotiation:
    """Tests for the markdown_content_negotiation check."""

    def test_supported_scores_100(self, report_with_markdown):
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert result.check_name == "markdown_content_negotiation"
        assert result.passed is True
        assert result.score == 100
        assert result.details["supports_markdown"] is True

    def test_not_supported_scores_0(self, report_no_markdown):
        result = _check_markdown_content_negotiation(report_no_markdown, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0
        assert "text/markdown" in result.recommendation.lower() or "markdown" in result.recommendation.lower()

    def test_includes_token_reduction(self, report_with_markdown):
        """When both html and markdown token counts exist, report the reduction."""
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert "token_reduction_percent" in result.details
        # 5000 html -> 500 markdown = 90% reduction
        assert result.details["token_reduction_percent"] == 90.0

    def test_includes_content_signal(self, report_with_markdown):
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert result.details["content_signal"] == "ai-train=yes, search=yes, ai-input=yes"

    def test_includes_x_markdown_tokens(self, report_with_markdown):
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert result.details["x_markdown_tokens"] == 500

    def test_no_probe_results_scores_0(self, report_pending):
        """Report with no probe results yet."""
        result = _check_markdown_content_negotiation(report_pending, DQ_EMPTY)
        assert result.passed is False
        assert result.score == 0

    def test_weight_is_12(self, report_with_markdown):
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert result.weight == 12

    def test_category_is_content(self, report_with_markdown):
        result = _check_markdown_content_negotiation(report_with_markdown, DQ_ALL_OK)
        assert result.category == "content"


@pytest.mark.django_db
class TestTokenEfficiency:
    """Tests for the token_efficiency check — now markdown-aware."""

    def test_with_markdown_negotiation_boosts_score(self, report_with_markdown):
        """When markdown negotiation is available, score should be high."""
        result = _check_token_efficiency(MINIMAL_HTML, report_with_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score >= 80
        assert result.details["has_markdown_negotiation"] is True
        assert "markdown_tokens" in result.details

    def test_without_markdown_falls_back_to_html_ratio(self, report_no_markdown):
        result = _check_token_efficiency(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.details["has_markdown_negotiation"] is False
        assert "efficiency_percent" in result.details

    def test_no_html_scores_0(self, report_no_markdown):
        result = _check_token_efficiency("", report_no_markdown, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0
        assert result.details.get("error") == "no_html"

    def test_good_ratio_without_markdown(self, report_no_markdown):
        """High content-to-HTML ratio should score well even without markdown."""
        # Minimal HTML has a good ratio
        report_no_markdown.html_token_count = None  # force recalculation
        result = _check_token_efficiency(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.score >= 50  # MINIMAL_HTML should have decent ratio

    def test_div_soup_lower_score(self, report_no_markdown):
        """Div-heavy HTML should score worse for token efficiency."""
        report_no_markdown.html_token_count = None
        result = _check_token_efficiency(DIV_SOUP_HTML, report_no_markdown, DQ_ALL_OK)
        minimal_result = _check_token_efficiency(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        # Both might score the same since they're small, but the ratio should differ
        assert result.details["efficiency_percent"] <= minimal_result.details["efficiency_percent"]

    def test_weight_is_10(self, report_no_markdown):
        result = _check_token_efficiency(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.weight == 10


@pytest.mark.django_db
class TestMarkdownAvailable:
    """Tests for the markdown_available check (/llms.txt)."""

    def test_llms_txt_exists_scores_100(self, report_with_markdown):
        result = _check_markdown_available(report_with_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["llms_txt_available"] is True

    def test_no_llms_txt_but_content_negotiation_scores_40(self, report_no_markdown):
        """Content negotiation without /llms.txt gives partial credit."""
        report_no_markdown.supports_markdown_negotiation = True
        report_no_markdown.probe_results = {
            **report_no_markdown.probe_results,
            "llms_txt": {"status_code": 404, "ok": False, "body": ""},
        }
        result = _check_markdown_available(report_no_markdown, DQ_ALL_OK)
        assert result.passed is False  # /llms.txt still not present
        assert result.score == 40
        assert result.details["has_content_negotiation"] is True

    def test_neither_scores_0(self, report_no_markdown):
        result = _check_markdown_available(report_no_markdown, DQ_ALL_OK)
        assert result.score == 0
        assert result.details["llms_txt_available"] is False
        assert result.details["has_content_negotiation"] is False

    def test_weight_is_5(self, report_no_markdown):
        result = _check_markdown_available(report_no_markdown, DQ_ALL_OK)
        assert result.weight == 5


@pytest.mark.django_db
class TestContentExtraction:
    """Tests for the content_extraction check."""

    def test_with_main_element_detected(self, report_no_markdown):
        """MINIMAL_HTML has a <main> element, so it should be detected."""
        result = _check_content_extraction(MINIMAL_HTML, DQ_ALL_OK)
        assert result.details["has_main_content_area"] is True
        # Score depends on markdown length; our fixture is small
        assert result.score > 0

    def test_with_substantial_main_content_scores_high(self, report_no_markdown):
        """A page with a large <main> block should score high."""
        html = (
            "<html><body><main>"
            "<h1>Title</h1>"
            + "<p>Paragraph content here. </p>" * 30
            + "</main></body></html>"
        )
        result = _check_content_extraction(html, DQ_ALL_OK)
        assert result.passed is True
        assert result.score >= 70
        assert result.details["has_main_content_area"] is True

    def test_without_main_element(self, report_no_markdown):
        html = "<html><body><p>Just content, no main wrapper.</p></body></html>"
        result = _check_content_extraction(html, DQ_ALL_OK)
        assert result.details["has_main_content_area"] is False

    def test_no_html_scores_0(self):
        result = _check_content_extraction("", DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0

    def test_weight_is_7(self):
        result = _check_content_extraction(MINIMAL_HTML, DQ_ALL_OK)
        assert result.weight == 7


class TestSemanticHtml:
    """Tests for the semantic_html check."""

    def test_good_semantic_structure(self):
        result = _check_semantic_html(MINIMAL_HTML, DQ_ALL_OK)
        assert result.passed is True
        assert result.score >= 70
        assert result.details["semantic_element_count"] >= 3

    def test_div_soup_scores_low(self):
        result = _check_semantic_html(DIV_SOUP_HTML, DQ_ALL_OK)
        assert result.score <= 40
        assert result.details["div_count"] > result.details["semantic_element_count"]

    def test_no_html_scores_0(self):
        result = _check_semantic_html("", DQ_ALL_OK)
        assert result.score == 0

    def test_weight_is_7(self):
        result = _check_semantic_html(MINIMAL_HTML, DQ_ALL_OK)
        assert result.weight == 7


@pytest.mark.django_db
class TestLowTokenBloat:
    """Tests for the low_token_bloat check — smooth logarithmic scoring."""

    def test_tiny_page_scores_100(self, report_no_markdown):
        """A page at or under 2k tokens should score 100."""
        report_no_markdown.html_token_count = 1500
        result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.score == 100
        assert result.passed is True

    def test_small_page_scores_high(self, report_no_markdown):
        """A ~4k token page should score well but not perfect."""
        report_no_markdown.html_token_count = 4000
        result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert 70 <= result.score <= 90
        assert result.passed is True

    def test_large_page_scores_low(self, report_no_markdown):
        """A very large page should score poorly on the smooth curve."""
        report_no_markdown.html_token_count = 50_000
        result = _check_low_token_bloat("x" * 100000, report_no_markdown, DQ_ALL_OK)
        assert result.score <= 20

    def test_scoring_degrades_smoothly(self, report_no_markdown):
        """Score should decrease monotonically as token count increases."""
        sizes = [2000, 4000, 8000, 16000, 32000, 64000]
        scores = []
        for size in sizes:
            report_no_markdown.html_token_count = size
            result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
            scores.append(result.score)
        # Each subsequent score should be <= the previous one
        for i in range(1, len(scores)):
            assert scores[i] <= scores[i - 1], (
                f"Score should decrease: {sizes[i]}tok={scores[i]} "
                f"vs {sizes[i-1]}tok={scores[i-1]}"
            )

    def test_markdown_negotiation_uses_md_tokens(self, report_with_markdown):
        """When markdown negotiation works, use markdown token count."""
        report_with_markdown.html_token_count = 50_000  # HTML is huge
        report_with_markdown.markdown_token_count = 1500  # but markdown is small
        result = _check_low_token_bloat(MINIMAL_HTML, report_with_markdown, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["using_markdown_tokens"] is True
        assert result.details["effective_tokens"] == 1500

    def test_without_markdown_uses_html_tokens(self, report_no_markdown):
        report_no_markdown.html_token_count = 20_000
        result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.details["using_markdown_tokens"] is False
        assert result.details["effective_tokens"] == 20_000

    def test_context_window_percent_in_details(self, report_no_markdown):
        """Details should include context_window_percent for multiple window sizes."""
        report_no_markdown.html_token_count = 20_000
        result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert "context_window_percent" in result.details
        pcts = result.details["context_window_percent"]
        assert pcts["200k"] == 10.0   # 20k / 200k
        assert pcts["1m"] == 2.0      # 20k / 1m
        assert "threshold" not in result.details

    def test_weight_is_5(self, report_no_markdown):
        result = _check_low_token_bloat(MINIMAL_HTML, report_no_markdown, DQ_ALL_OK)
        assert result.weight == 5


@pytest.mark.django_db
class TestRunAllReadabilityChecks:
    """Integration test: run() returns all expected checks."""

    def test_returns_6_checks(self, report_with_markdown):
        results = readability.run(report_with_markdown, DQ_ALL_OK)
        assert len(results) == 6

    def test_check_names(self, report_with_markdown):
        results = readability.run(report_with_markdown, DQ_ALL_OK)
        names = {r.check_name for r in results}
        assert names == {
            "markdown_content_negotiation",
            "token_efficiency",
            "markdown_available",
            "content_extraction",
            "semantic_html",
            "low_token_bloat",
        }

    def test_all_checks_are_content_category(self, report_with_markdown):
        results = readability.run(report_with_markdown, DQ_ALL_OK)
        for r in results:
            assert r.category == "content"
