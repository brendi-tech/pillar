"""Tests for Agent Score constants — verify weight integrity."""
from collections import defaultdict

from apps.agent_score.constants import CATEGORY_WEIGHTS, CHECK_DEFINITIONS


class TestCheckDefinitions:
    """Validate that CHECK_DEFINITIONS are internally consistent."""

    def test_all_weights_sum_to_100_per_category(self):
        """Each category's check weights must sum to exactly 100."""
        totals: dict[str, int] = defaultdict(int)
        for check in CHECK_DEFINITIONS:
            totals[check["category"]] += check["weight"]

        for category, total in totals.items():
            assert total == 100, (
                f"Category '{category}' weights sum to {total}, expected 100"
            )

    def test_all_categories_covered(self):
        """Every category in CATEGORY_WEIGHTS has at least one check."""
        check_categories = {c["category"] for c in CHECK_DEFINITIONS}
        for cat in CATEGORY_WEIGHTS:
            assert cat in check_categories, (
                f"Category '{cat}' is in CATEGORY_WEIGHTS but has no check definitions"
            )

    def test_category_weights_sum_to_1(self):
        """CATEGORY_WEIGHTS must sum to 1.0."""
        total = sum(CATEGORY_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9, (
            f"CATEGORY_WEIGHTS sum to {total}, expected 1.0"
        )

    def test_check_names_unique(self):
        """All check_name values must be unique."""
        names = [c["check_name"] for c in CHECK_DEFINITIONS]
        assert len(names) == len(set(names)), (
            f"Duplicate check names found: {[n for n in names if names.count(n) > 1]}"
        )

    def test_required_fields_present(self):
        """Every check definition has category, check_name, check_label, weight."""
        required = {"category", "check_name", "check_label", "weight"}
        for i, check in enumerate(CHECK_DEFINITIONS):
            missing = required - set(check.keys())
            assert not missing, (
                f"Check at index {i} ({check.get('check_name', '?')}) "
                f"missing fields: {missing}"
            )

    def test_all_4_categories_in_weights(self):
        """All 4 unified categories should be in CATEGORY_WEIGHTS."""
        assert set(CATEGORY_WEIGHTS.keys()) == {"content", "interaction", "webmcp", "signup_test"}

    def test_new_checks_exist(self):
        """Verify the new markdown/content-signal checks are defined."""
        names = {c["check_name"] for c in CHECK_DEFINITIONS}
        assert "markdown_content_negotiation" in names
        assert "content_signal_header" in names
