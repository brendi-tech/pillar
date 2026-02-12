"""
Tests for the accessibility analyzer — aria_labels, landmark_roles,
keyboard_focusable, consistent_nav.
"""
import pytest

from apps.agent_score.analyzers import accessibility
from apps.agent_score.analyzers.accessibility import (
    _check_aria_labels,
    _check_consistent_nav,
    _check_keyboard_focusable,
    _check_landmark_roles,
)

from .conftest import SAMPLE_AX_TREE, SAMPLE_AXE_RESULTS

# ─── _check_aria_labels ─────────────────────────────────────────────────────


class TestCheckAriaLabels:
    """Tests for _check_aria_labels."""

    def test_no_violations_passes(self):
        """SAMPLE_AXE_RESULTS has no violations."""
        result = _check_aria_labels(SAMPLE_AXE_RESULTS, SAMPLE_AX_TREE)
        assert result.passed is True
        assert result.score == 100
        assert result.details["total_unlabeled_elements"] == 0

    def test_label_violations_fail(self):
        """Axe violations for label rules reduce score."""
        axe_results = {
            "violations": [
                {"id": "button-name", "impact": "critical", "nodes_count": 3},
                {"id": "label", "impact": "serious", "nodes_count": 2},
            ],
            "passes": [],
        }
        result = _check_aria_labels(axe_results, SAMPLE_AX_TREE)
        assert result.passed is False
        assert result.details["total_unlabeled_elements"] == 5
        assert result.score < 100
        assert "accessible names" in result.recommendation.lower()

    def test_no_axe_results_fails(self):
        """Missing/empty axe_results yields error."""
        result = _check_aria_labels({}, SAMPLE_AX_TREE)
        assert result.passed is False
        assert result.score == 0
        assert result.details["error"] == "no_axe_results"

    def test_empty_violations_list_passes(self):
        """Empty violations list passes."""
        axe_results = {"violations": [], "passes": [{"id": "button-name"}]}
        result = _check_aria_labels(axe_results, SAMPLE_AX_TREE)
        assert result.passed is True
        assert result.score == 100


# ─── _check_landmark_roles ───────────────────────────────────────────────────


class TestCheckLandmarkRoles:
    """Tests for _check_landmark_roles."""

    def test_good_landmarks_passes(self):
        """SAMPLE_AX_TREE has banner, navigation, main, contentinfo."""
        result = _check_landmark_roles(SAMPLE_AX_TREE)
        assert result.passed is True
        assert result.score == 100
        assert result.details["has_main"] is True
        assert result.details["has_navigation"] is True
        assert result.details["total_landmarks"] >= 3

    def test_no_ax_tree_fails(self):
        """Missing accessibility tree fails."""
        result = _check_landmark_roles(None)
        assert result.passed is False
        assert result.score == 0
        assert result.details["error"] == "no_accessibility_tree"

    def test_only_main_scores_partial(self):
        """Tree with only main, no navigation, scores lower."""
        ax_tree = {
            "role": "WebArea",
            "children": [{"role": "main", "name": "", "children": []}],
        }
        result = _check_landmark_roles(ax_tree)
        assert result.passed is False
        assert result.details["has_main"] is True
        assert result.details["has_navigation"] is False
        assert result.score >= 50  # has_main gives 50

    def test_no_landmarks_scores_0(self):
        """Tree with no landmark roles scores 0."""
        ax_tree = {"role": "WebArea", "children": [{"role": "paragraph", "name": "x"}]}
        result = _check_landmark_roles(ax_tree)
        assert result.passed is False
        assert result.score == 0


# ─── _check_keyboard_focusable ───────────────────────────────────────────────


class TestCheckKeyboardFocusable:
    """Tests for _check_keyboard_focusable."""

    def test_no_violations_passes(self):
        """SAMPLE_AXE_RESULTS has no violations."""
        result = _check_keyboard_focusable(SAMPLE_AXE_RESULTS)
        assert result.passed is True
        assert result.score == 100
        assert result.details["total_issues"] == 0

    def test_keyboard_violations_fail(self):
        """Tabindex/focus violations reduce score."""
        axe_results = {
            "violations": [
                {"id": "tabindex", "nodes_count": 4},
                {"id": "focus-order-semantics", "nodes_count": 2},
            ],
            "passes": [],
        }
        result = _check_keyboard_focusable(axe_results)
        assert result.passed is False
        assert result.details["total_issues"] >= 6
        assert "keyboard" in result.recommendation.lower()

    def test_no_axe_results_fails(self):
        """Missing/empty axe_results yields error."""
        result = _check_keyboard_focusable({})
        assert result.passed is False
        assert result.score == 0
        assert result.details["error"] == "no_axe_results"


# ─── _check_consistent_nav ───────────────────────────────────────────────────


class TestCheckConsistentNav:
    """Tests for _check_consistent_nav."""

    def test_good_nav_structure_passes(self):
        """SAMPLE_AX_TREE has nav with name 'Main' and Home link."""
        result = _check_consistent_nav(SAMPLE_AX_TREE)
        assert result.passed is True
        assert result.score == 100
        assert result.details["has_named_nav"] is True
        assert any(n["total_links"] > 0 for n in result.details["nav_landmarks"])

    def test_no_ax_tree_fails(self):
        """Missing accessibility tree fails."""
        result = _check_consistent_nav(None)
        assert result.passed is False
        assert result.score == 0
        assert result.details["error"] == "no_accessibility_tree"

    def test_nav_without_links_scores_partial(self):
        """Navigation landmark with no links inside scores lower."""
        ax_tree = {
            "role": "WebArea",
            "children": [
                {
                    "role": "navigation",
                    "name": "Main",
                    "children": [],  # no links
                },
            ],
        }
        result = _check_consistent_nav(ax_tree)
        assert result.passed is False
        assert len(result.details["nav_landmarks"]) == 1
        assert result.details["nav_landmarks"][0]["total_links"] == 0
        assert result.score == 50

    def test_no_nav_scores_0(self):
        """Tree with no navigation role scores 0."""
        ax_tree = {"role": "WebArea", "children": [{"role": "main", "children": []}]}
        result = _check_consistent_nav(ax_tree)
        assert result.passed is False
        assert result.score == 0
        assert result.details["nav_landmarks"] == []


# ─── run() integration ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAccessibilityRun:
    """Integration tests for accessibility.run()."""

    def test_returns_4_checks(self, report_with_markdown):
        results = accessibility.run(report_with_markdown)
        assert len(results) == 4

    def test_check_names(self, report_with_markdown):
        results = accessibility.run(report_with_markdown)
        names = {r.check_name for r in results}
        assert names == {
            "aria_labels",
            "landmark_roles",
            "keyboard_focusable",
            "consistent_nav",
        }

    def test_all_checks_interaction_category(self, report_with_markdown):
        results = accessibility.run(report_with_markdown)
        for r in results:
            assert r.category == "interaction"
