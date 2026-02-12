"""
Scoring algorithm — weighted rollup from individual checks to category and overall scores.

All 4 categories (content, interaction, webmcp, signup_test) contribute to
the overall score. When signup_test checks are absent (opt-out), the 0.15
weight is redistributed proportionally across the other 3 categories.
"""
from __future__ import annotations

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.constants import CATEGORY_WEIGHTS


def calculate_overall_score(checks: list[CheckResult | dict]) -> dict:
    """
    Calculate category scores and overall score from a list of check results.

    Accepts either CheckResult dataclass instances or dicts with the same keys
    (for when loading from AgentScoreCheck model instances).

    When signup_test checks are absent, their weight is redistributed
    proportionally across the remaining categories.

    Returns:
        {
            "overall": int,
            "categories": {"content": int, "interaction": int, "webmcp": int, ...}
        }
    """
    # Build category scores
    category_scores: dict[str, int] = {}

    for category in CATEGORY_WEIGHTS:
        cat_checks = [
            c for c in checks
            if _get_field(c, "category") == category
        ]

        if not cat_checks:
            # Category has no checks — will be excluded from overall
            continue

        total_weight = sum(_get_field(c, "weight") for c in cat_checks)
        if total_weight == 0:
            category_scores[category] = 0
            continue

        weighted_sum = sum(
            _get_field(c, "score") * _get_field(c, "weight")
            for c in cat_checks
        )
        category_scores[category] = round(weighted_sum / total_weight)

    # Build effective weights — redistribute absent categories proportionally
    active_categories = {
        cat: w for cat, w in CATEGORY_WEIGHTS.items()
        if cat in category_scores
    }

    total_active_weight = sum(active_categories.values())

    if total_active_weight == 0:
        return {"overall": 0, "categories": category_scores}

    # Normalize weights so they sum to 1.0
    effective_weights = {
        cat: w / total_active_weight
        for cat, w in active_categories.items()
    }

    overall = round(sum(
        category_scores[cat] * effective_weights[cat]
        for cat in effective_weights
    ))

    return {"overall": overall, "categories": category_scores}


def _get_field(obj: CheckResult | dict, field: str):
    """Get a field from either a dataclass or a dict."""
    if isinstance(obj, dict):
        return obj.get(field, 0)
    return getattr(obj, field, 0)
