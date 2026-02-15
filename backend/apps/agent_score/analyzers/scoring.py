"""
Scoring algorithm — weighted rollup from individual checks to category and overall scores.

Content, interaction, signup_test, and openclaw (agent experience) contribute
to the overall score.  WebMCP is scored as its own category but excluded from
the overall score because very few sites support it today — including it would
unfairly penalize most sites.

When optional categories (signup_test, openclaw) are absent (opt-out or DNF),
their weight is redistributed proportionally across the remaining weighted
categories.
"""
from __future__ import annotations

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.constants import CATEGORY_WEIGHTS


def calculate_overall_score(checks: list[CheckResult | dict]) -> dict:
    """
    Calculate category scores and overall score from a list of check results.

    Accepts either CheckResult dataclass instances or dicts with the same keys
    (for when loading from AgentScoreCheck model instances).

    DNF (Did Not Finish) checks are excluded from scoring entirely — they
    don't drag the score down or inflate it.  If every check in a category
    is DNF, that category's score is ``None``.  If every weighted category
    is ``None``, the overall score is also ``None``.

    Every category that has evaluated checks gets a score (0-100), but only
    categories listed in CATEGORY_WEIGHTS contribute to the overall score.
    WebMCP is scored independently and returned in ``categories`` but does
    not affect the overall number.

    Returns:
        {
            "overall": int | None,
            "categories": {"content": int | None, ...}
        }
    """
    # Filter to only evaluated (non-DNF) checks
    evaluated = [
        c for c in checks
        if _get_field(c, "status", "evaluated") != "dnf"
    ]

    # Discover all categories present in *all* checks (including DNF)
    all_categories = {_get_field(c, "category") for c in checks}

    # Build category scores — only from evaluated checks
    category_scores: dict[str, int | None] = {}

    for category in all_categories:
        cat_checks = [
            c for c in evaluated
            if _get_field(c, "category") == category
        ]

        if not cat_checks:
            # All checks in this category were DNF
            category_scores[category] = None
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

    # Build effective weights — only categories in CATEGORY_WEIGHTS
    # that have a non-None score contribute to the overall score.
    # Absent/DNF categories have their weight redistributed proportionally.
    active_categories = {
        cat: w for cat, w in CATEGORY_WEIGHTS.items()
        if category_scores.get(cat) is not None
    }

    total_active_weight = sum(active_categories.values())

    if total_active_weight == 0:
        return {"overall": None, "categories": category_scores}

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


def _get_field(obj: CheckResult | dict, field: str, default=0):
    """Get a field from either a dataclass or a dict."""
    if isinstance(obj, dict):
        return obj.get(field, default)
    return getattr(obj, field, default)
