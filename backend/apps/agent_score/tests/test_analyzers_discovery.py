"""
Tests for the discovery analyzer — llms_txt, structured_data, sitemap,
meta_description, semantic_headings, canonical_url.
"""
import pytest

from apps.agent_score.analyzers import discovery
from apps.agent_score.analyzers.discovery import (
    _check_canonical_url,
    _check_llms_txt,
    _check_meta_description,
    _check_semantic_headings,
    _check_sitemap,
    _check_structured_data,
)

from .conftest import EMPTY_PROBE_RESULTS, FULL_PROBE_RESULTS, MINIMAL_HTML, SAMPLE_PAGE_METADATA


class TestCheckLlmsTxt:
    """Tests for _check_llms_txt."""

    def test_present_and_markdown_scores_100(self):
        result = _check_llms_txt(FULL_PROBE_RESULTS)
        assert result.check_name == "llms_txt_present"
        assert result.passed is True
        assert result.score == 100
        assert result.details["exists"] is True
        assert result.details["is_markdown"] is True
        assert result.recommendation == ""

    def test_absent_scores_0(self):
        result = _check_llms_txt(EMPTY_PROBE_RESULTS)
        assert result.check_name == "llms_txt_present"
        assert result.passed is False
        assert result.score == 0
        assert result.details["exists"] is False
        assert result.details["is_markdown"] is False
        assert "llms.txt" in result.recommendation

    def test_exists_but_not_markdown_scores_40(self):
        probes = {
            "llms_txt": {"ok": True, "body": "Plain text file without markdown headers."},
        }
        result = _check_llms_txt(probes)
        assert result.passed is False
        assert result.score == 40
        assert result.details["exists"] is True
        assert result.details["is_markdown"] is False

    def test_empty_probes_scores_0(self):
        result = _check_llms_txt({})
        assert result.passed is False
        assert result.score == 0

    def test_weight_is_8(self):
        result = _check_llms_txt(FULL_PROBE_RESULTS)
        assert result.weight == 8


class TestCheckStructuredData:
    """Tests for _check_structured_data."""

    def test_one_valid_block_scores_70(self):
        result = _check_structured_data("", SAMPLE_PAGE_METADATA)
        assert result.check_name == "structured_data"
        assert result.passed is True
        assert result.score == 70
        assert result.details["valid_blocks"] == 1
        assert "WebPage" in result.details["schema_types"]

    def test_two_or_more_blocks_scores_100(self):
        metadata = {
            **SAMPLE_PAGE_METADATA,
            "json_ld_raw": [
                '{"@type": "WebPage", "name": "Test"}',
                '{"@type": "Organization", "name": "Acme"}',
            ],
        }
        result = _check_structured_data("", metadata)
        assert result.passed is True
        assert result.score == 100
        assert result.details["valid_blocks"] == 2

    def test_no_structured_data_scores_0(self):
        result = _check_structured_data("", {"json_ld_raw": []})
        assert result.check_name == "structured_data"
        assert result.passed is False
        assert result.score == 0
        assert "JSON-LD" in result.recommendation or "Schema.org" in result.recommendation

    def test_microdata_only_scores_40(self):
        html = '<div itemscope itemtype="https://schema.org/Article">Content</div>'
        result = _check_structured_data(html, {"json_ld_raw": []})
        assert result.passed is False
        assert result.score == 40
        assert result.details["has_microdata"] is True

    def test_invalid_json_ld_ignored(self):
        metadata = {"json_ld_raw": ['{"invalid": json}']}
        result = _check_structured_data("", metadata)
        assert result.passed is False
        assert result.details["valid_blocks"] == 0


class TestCheckSitemap:
    """Tests for _check_sitemap."""

    def test_present_and_valid_xml_scores_100(self):
        result = _check_sitemap(FULL_PROBE_RESULTS)
        assert result.check_name == "sitemap_present"
        assert result.passed is True
        assert result.score == 100
        assert result.details["exists"] is True
        assert result.details["is_valid_xml"] is True

    def test_absent_scores_0(self):
        result = _check_sitemap(EMPTY_PROBE_RESULTS)
        assert result.check_name == "sitemap_present"
        assert result.passed is False
        assert result.score == 0
        assert result.details["exists"] is False
        assert "sitemap.xml" in result.recommendation

    def test_exists_but_not_valid_xml_scores_50(self):
        probes = {"sitemap": {"ok": True, "body": "This is not XML."}}
        result = _check_sitemap(probes)
        assert result.passed is False
        assert result.score == 50
        assert result.details["exists"] is True
        assert result.details["is_valid_xml"] is False

    def test_sitemapindex_valid(self):
        probes = {"sitemap": {"ok": True, "body": "<?xml version='1.0'?><sitemapindex></sitemapindex>"}}
        result = _check_sitemap(probes)
        assert result.passed is True
        assert result.score == 100
        assert result.details["is_valid_xml"] is True


class TestCheckMetaDescription:
    """Tests for _check_meta_description."""

    def test_meta_and_og_scores_100(self):
        result = _check_meta_description(SAMPLE_PAGE_METADATA)
        assert result.check_name == "meta_description"
        assert result.passed is True
        assert result.score == 100
        assert result.details["has_meta_description"] is True
        assert result.details["has_og_tags"] is True

    def test_meta_only_scores_70(self):
        metadata = {"meta_description": "A good description over ten chars.", "og_tags": {}}
        result = _check_meta_description(metadata)
        assert result.passed is True
        assert result.score == 70
        assert result.details["has_og_tags"] is False

    def test_og_only_scores_50(self):
        metadata = {"meta_description": "", "og_tags": {"og:title": "Title", "og:description": "Desc"}}
        result = _check_meta_description(metadata)
        assert result.passed is False
        assert result.score == 50
        assert result.details["has_meta_description"] is False
        assert result.details["has_og_tags"] is True

    def test_absent_scores_0(self):
        result = _check_meta_description({"meta_description": "", "og_tags": {}})
        assert result.passed is False
        assert result.score == 0
        assert "meta" in result.recommendation.lower()

    def test_meta_too_short_does_not_count(self):
        metadata = {"meta_description": "Short", "og_tags": {}}
        result = _check_meta_description(metadata)
        assert result.passed is False
        assert result.details["has_meta_description"] is False


class TestCheckSemanticHeadings:
    """Tests for _check_semantic_headings."""

    def test_proper_hierarchy_scores_high(self):
        result = _check_semantic_headings(MINIMAL_HTML)
        assert result.check_name == "semantic_headings"
        assert result.passed is True
        assert result.score >= 70
        assert result.details["h1_count"] == 1
        assert result.details["skipped_levels"] is False

    def test_three_headings_proper_hierarchy_scores_100(self):
        html = """
        <html><body>
        <h1>Title</h1>
        <h2>Section A</h2>
        <h2>Section B</h2>
        </body></html>
        """
        result = _check_semantic_headings(html)
        assert result.passed is True
        assert result.score == 100
        assert result.details["heading_count"] >= 3

    def test_no_html_scores_0(self):
        result = _check_semantic_headings("")
        assert result.passed is False
        assert result.score == 0
        assert result.details.get("error") == "no_html"

    def test_skipped_levels_scores_lower(self):
        html = "<html><body><h1>Title</h1><h3>Skipped h2</h3></body></html>"
        result = _check_semantic_headings(html)
        assert result.passed is False
        assert result.details["skipped_levels"] is True
        assert result.score <= 50

    def test_multiple_h1_scores_lower(self):
        html = "<html><body><h1>First</h1><h1>Second</h1></body></html>"
        result = _check_semantic_headings(html)
        assert result.passed is False
        assert result.details["h1_count"] == 2

    def test_no_headings_scores_0(self):
        html = "<html><body><p>No headings here.</p></body></html>"
        result = _check_semantic_headings(html)
        assert result.score == 0


class TestCheckCanonicalUrl:
    """Tests for _check_canonical_url."""

    def test_present_scores_100(self):
        result = _check_canonical_url(SAMPLE_PAGE_METADATA)
        assert result.check_name == "canonical_url"
        assert result.passed is True
        assert result.score == 100
        assert result.details["canonical_url"] == "https://example.com/"
        assert result.recommendation == ""

    def test_absent_scores_0(self):
        result = _check_canonical_url({"canonical_url": ""})
        assert result.passed is False
        assert result.score == 0
        assert "canonical" in result.recommendation.lower()

    def test_empty_metadata_scores_0(self):
        result = _check_canonical_url({})
        assert result.passed is False
        assert result.score == 0


@pytest.mark.django_db
class TestRunDiscoveryChecks:
    """Integration test: run() returns all 6 discovery checks."""

    def test_returns_6_checks(self, report_with_markdown):
        results = discovery.run(report_with_markdown)
        assert len(results) == 6

    def test_check_names(self, report_with_markdown):
        results = discovery.run(report_with_markdown)
        names = [r.check_name for r in results]
        assert names == [
            "llms_txt_present",
            "structured_data",
            "sitemap_present",
            "meta_description",
            "semantic_headings",
            "canonical_url",
        ]

    def test_all_checks_are_content_category(self, report_with_markdown):
        results = discovery.run(report_with_markdown)
        for r in results:
            assert r.category == "content"

    def test_run_with_empty_probes(self, report_no_markdown):
        results = discovery.run(report_no_markdown)
        assert len(results) == 6
        llms_result = next(r for r in results if r.check_name == "llms_txt_present")
        assert llms_result.passed is False
        sitemap_result = next(r for r in results if r.check_name == "sitemap_present")
        assert sitemap_result.passed is False
