"""Tests for Agent Score constants — verify weight integrity."""
from collections import defaultdict

from apps.agent_score.constants import (
    CATEGORY_REGISTRY,
    CATEGORY_WEIGHTS,
    CHECK_DEFINITIONS,
)


class TestCheckDefinitions:
    """Validate that CHECK_DEFINITIONS are internally consistent."""

    def test_all_weights_are_positive_per_category(self):
        """Each category's check weights must be positive and sum to > 0."""
        totals: dict[str, int] = defaultdict(int)
        for check in CHECK_DEFINITIONS:
            assert check["weight"] > 0, (
                f"Check '{check['check_name']}' has non-positive weight {check['weight']}"
            )
            totals[check["category"]] += check["weight"]

        for category, total in totals.items():
            assert total > 0, (
                f"Category '{category}' weights sum to {total}, expected > 0"
            )

    def test_all_categories_covered(self):
        """Every category in CATEGORY_WEIGHTS has at least one check.

        Openclaw is excluded — its checks are dynamically generated at
        runtime from the OpenClaw agent's self-scored results.
        """
        # Categories whose checks are generated dynamically at runtime
        dynamic_categories = {"openclaw"}

        check_categories = {c["category"] for c in CHECK_DEFINITIONS}
        for cat in CATEGORY_WEIGHTS:
            if cat in dynamic_categories:
                continue
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

    def test_all_scored_categories_in_weights(self):
        """All scored categories should be in CATEGORY_WEIGHTS.

        Note: webmcp is scored separately and excluded from the overall
        score (see constants.py comment), so it is NOT in CATEGORY_WEIGHTS.
        """
        assert set(CATEGORY_WEIGHTS.keys()) == {
            "openclaw", "signup_test", "rules",
        }

    def test_new_checks_exist(self):
        """Verify the new markdown/content-signal checks are defined."""
        names = {c["check_name"] for c in CHECK_DEFINITIONS}
        assert "markdown_content_negotiation" in names
        assert "content_signal_header" in names


class TestCategoryRegistry:
    """Validate CATEGORY_REGISTRY structure and its relationship to CATEGORY_WEIGHTS."""

    def test_registry_has_required_fields(self):
        """Every registry entry must have label, description, weight, sort_order."""
        required = {"label", "description", "weight", "sort_order"}
        for key, cfg in CATEGORY_REGISTRY.items():
            missing = required - set(cfg.keys())
            assert not missing, (
                f"Category '{key}' missing fields: {missing}"
            )

    def test_sort_orders_unique(self):
        """Sort orders must be unique across categories."""
        orders = [cfg["sort_order"] for cfg in CATEGORY_REGISTRY.values()]
        assert len(orders) == len(set(orders)), "Duplicate sort_order values"

    def test_weights_derived_correctly(self):
        """CATEGORY_WEIGHTS should be derived from CATEGORY_REGISTRY."""
        derived = {
            k: v["weight"]
            for k, v in CATEGORY_REGISTRY.items()
            if v["weight"] is not None
        }
        assert CATEGORY_WEIGHTS == derived

    def test_all_check_categories_in_registry(self):
        """Every category used in CHECK_DEFINITIONS must exist in the registry."""
        check_categories = {c["category"] for c in CHECK_DEFINITIONS}
        for cat in check_categories:
            assert cat in CATEGORY_REGISTRY, (
                f"Category '{cat}' used in CHECK_DEFINITIONS but missing from CATEGORY_REGISTRY"
            )

    def test_unscored_categories_have_none_weight(self):
        """Categories excluded from overall score must have weight=None."""
        unscored = {
            k for k, v in CATEGORY_REGISTRY.items() if v["weight"] is None
        }
        # WebMCP is the only unscored category
        assert unscored == {"webmcp"}
        # None of the unscored categories should be in CATEGORY_WEIGHTS
        for cat in unscored:
            assert cat not in CATEGORY_WEIGHTS
