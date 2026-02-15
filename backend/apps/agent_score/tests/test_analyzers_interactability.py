"""
Tests for the interactability analyzer — labeled forms,
semantic actions, API documentation.
"""
import pytest

from apps.agent_score.analyzers import interactability
from apps.agent_score.analyzers.interactability import (
    _check_api_documentation,
    _check_labeled_forms,
    _check_semantic_actions,
)

from .conftest import DQ_ALL_OK, FULL_PROBE_RESULTS, SAMPLE_AX_TREE


# ─── _check_labeled_forms ────────────────────────────────────────────────────


class TestCheckLabeledForms:
    """Tests for _check_labeled_forms."""

    def test_no_forms_passes(self):
        """No forms on page is not a failure."""
        result = _check_labeled_forms([], DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["form_count"] == 0
        assert "No forms detected" in result.details["message"]

    def test_all_inputs_labeled_passes(self):
        """All form inputs have labels, scores 100."""
        forms_data = [
            {"index": 0, "inputs": [{"type": "text", "name": "email", "has_label": True}]},
            {"index": 1, "inputs": [{"type": "password", "name": "pass", "has_label": True}]},
        ]
        result = _check_labeled_forms(forms_data, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["total_inputs"] == 2
        assert result.details["labeled_inputs"] == 2

    def test_some_unlabeled_fails(self):
        """Some inputs missing labels scores lower."""
        forms_data = [
            {
                "index": 0,
                "inputs": [
                    {"type": "text", "name": "email", "has_label": True},
                    {"type": "text", "name": "search", "has_label": False},
                ],
            },
        ]
        result = _check_labeled_forms(forms_data, DQ_ALL_OK)
        assert result.passed is False
        assert result.details["total_inputs"] == 2
        assert result.details["labeled_inputs"] == 1
        assert len(result.details["unlabeled_inputs"]) == 1
        assert "label" in result.recommendation.lower()

    def test_forms_data_not_list_passes(self):
        """Non-list forms_data (e.g. None or dict) treated as no forms."""
        result = _check_labeled_forms(None, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100


# ─── _check_semantic_actions ──────────────────────────────────────────────────


class TestCheckSemanticActions:
    """Tests for _check_semantic_actions."""

    def test_good_semantic_action_passes(self):
        """SAMPLE_AX_TREE has 'Home' link — descriptive, not generic."""
        result = _check_semantic_actions(SAMPLE_AX_TREE, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["total_actions"] >= 1
        assert result.details["generic_actions"] == 0

    def test_generic_action_text_fails(self):
        """Link with 'click here' scores low."""
        ax_tree = {
            "role": "WebArea",
            "children": [
                {
                    "role": "link",
                    "name": "click here",
                    "children": [],
                },
            ],
        }
        result = _check_semantic_actions(ax_tree, DQ_ALL_OK)
        assert result.passed is False
        assert result.details["generic_actions"] >= 1
        assert result.details["examples"][0]["name"] == "click here"
        assert "click here" in result.recommendation.lower() or "generic" in result.recommendation.lower()

    def test_no_ax_tree_fails(self):
        """Missing accessibility tree fails."""
        result = _check_semantic_actions(None, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0
        assert result.details["error"] == "no_accessibility_tree"

    def test_no_actions_passes(self):
        """Page with no buttons/links passes (nothing to flag)."""
        ax_tree = {"role": "WebArea", "children": [{"role": "heading", "name": "Title"}]}
        result = _check_semantic_actions(ax_tree, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["total_actions"] == 0


# ─── _check_api_documentation ─────────────────────────────────────────────────


class TestCheckApiDocumentation:
    """Tests for _check_api_documentation (MCP or API docs)."""

    def test_openapi_in_main_page_body_passes(self):
        """Main page body mentions openapi/swagger passes."""
        probes = {
            **FULL_PROBE_RESULTS,
            "main_page": {"ok": True, "body": "Check our OpenAPI docs at /api/docs"},
        }
        result = _check_api_documentation(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.details["has_api_link_in_page"] is True
        assert result.score == 100

    def test_neither_fails(self):
        """No MCP or API doc mention fails."""
        probes = FULL_PROBE_RESULTS
        result = _check_api_documentation(probes, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0
        assert "MCP" in result.recommendation or "OpenAPI" in result.recommendation

    def test_graphql_in_body_passes(self):
        """Main page body mentions graphql passes."""
        probes = {
            **FULL_PROBE_RESULTS,
            "main_page": {"ok": True, "body": "GraphQL endpoint at /graphql"},
        }
        result = _check_api_documentation(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.details["has_api_link_in_page"] is True

    def test_mcp_json_endpoint_passes(self):
        """/.well-known/mcp.json returns 200 passes."""
        probes = {
            **FULL_PROBE_RESULTS,
            "mcp_json": {"status_code": 200, "ok": True, "body": "{}"},
        }
        result = _check_api_documentation(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.details["has_mcp_endpoint"] is True
        assert result.score == 100

    def test_mcp_link_in_page_passes(self):
        """Page mentioning MCP server or .well-known/mcp passes."""
        probes = {
            **FULL_PROBE_RESULTS,
            "main_page": {"ok": True, "body": "Connect via our MCP server at /.well-known/mcp"},
        }
        result = _check_api_documentation(probes, DQ_ALL_OK)
        assert result.passed is True
        assert result.details["has_mcp_link_in_page"] is True


# ─── run() integration ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestInteractabilityRun:
    """Integration tests for interactability.run()."""

    def test_returns_3_checks(self, report_with_markdown):
        results = interactability.run(report_with_markdown, DQ_ALL_OK)
        assert len(results) == 3

    def test_check_names(self, report_with_markdown):
        results = interactability.run(report_with_markdown, DQ_ALL_OK)
        names = {r.check_name for r in results}
        assert names == {
            "labeled_forms",
            "semantic_actions",
            "api_documentation",
        }

    def test_all_checks_interaction_category(self, report_with_markdown):
        results = interactability.run(report_with_markdown, DQ_ALL_OK)
        for r in results:
            assert r.category == "rules"
