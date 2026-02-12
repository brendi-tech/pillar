"""
Tests for the scoring analyzer — calculate_overall_score with 4 unified categories
and signup_test weight redistribution.
"""

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.scoring import (
    _get_field,
    calculate_overall_score,
)
from apps.agent_score.constants import CATEGORY_WEIGHTS


def _check(category: str, score: int, weight: float, **kwargs) -> CheckResult:
    """Helper to build a CheckResult with common defaults."""
    return CheckResult(
        category=category,
        check_name="test_check",
        check_label="Test Check",
        passed=score >= 100,
        score=score,
        weight=weight,
        details=kwargs.get("details", {}),
        recommendation=kwargs.get("recommendation", ""),
    )


class TestGetField:
    """Tests for _get_field helper."""

    def test_dataclass_returns_attribute(self):
        c = _check("content", 80, 1.0)
        assert _get_field(c, "category") == "content"
        assert _get_field(c, "score") == 80
        assert _get_field(c, "weight") == 1.0

    def test_dict_returns_key(self):
        d = {"category": "interaction", "score": 70, "weight": 2.0}
        assert _get_field(d, "category") == "interaction"
        assert _get_field(d, "score") == 70
        assert _get_field(d, "weight") == 2.0

    def test_missing_field_returns_0(self):
        c = _check("content", 80, 1.0)
        assert _get_field(c, "nonexistent") == 0
        assert _get_field({"category": "x"}, "score") == 0


class TestCalculateOverallScore:
    """Tests for calculate_overall_score with 4 unified categories."""

    def test_all_4_categories_100_scores_100(self):
        """All checks score 100 across all 4 categories → overall 100."""
        checks = [
            _check("content", 100, 1.0),
            _check("interaction", 100, 1.0),
            _check("webmcp", 100, 1.0),
            _check("signup_test", 100, 1.0),
        ]
        result = calculate_overall_score(checks)
        assert result["overall"] == 100
        for cat in CATEGORY_WEIGHTS:
            assert result["categories"][cat] == 100

    def test_all_0_scores_0(self):
        """All checks score 0 → overall 0."""
        checks = [
            _check("content", 0, 1.0),
            _check("interaction", 0, 1.0),
            _check("webmcp", 0, 1.0),
            _check("signup_test", 0, 1.0),
        ]
        result = calculate_overall_score(checks)
        assert result["overall"] == 0
        for cat in CATEGORY_WEIGHTS:
            assert result["categories"][cat] == 0

    def test_mixed_scores(self):
        """Mix of scores gives weighted result."""
        checks = [
            _check("content", 100, 1.0),
            _check("content", 0, 1.0),
            _check("interaction", 80, 1.0),
            _check("webmcp", 60, 1.0),
            _check("signup_test", 40, 1.0),
        ]
        result = calculate_overall_score(checks)
        assert "overall" in result
        assert "categories" in result
        assert 0 <= result["overall"] <= 100
        assert result["categories"]["content"] == 50
        assert result["categories"]["interaction"] == 80
        assert result["categories"]["webmcp"] == 60
        assert result["categories"]["signup_test"] == 40

        # Expected: 50*0.35 + 80*0.35 + 60*0.15 + 40*0.15 = 17.5 + 28 + 9 + 6 = 60.5 → 60
        assert result["overall"] == 60

    def test_empty_checks_scores_0(self):
        """Empty checks list yields 0."""
        result = calculate_overall_score([])
        assert result["overall"] == 0
        assert result["categories"] == {}

    def test_accepts_dicts(self):
        """Works with dicts not just CheckResult instances."""
        checks = [
            {"category": "content", "score": 100, "weight": 1.0},
            {"category": "interaction", "score": 100, "weight": 1.0},
        ]
        result = calculate_overall_score(checks)
        assert result["overall"] >= 0
        assert "content" in result["categories"]
        assert "interaction" in result["categories"]
        assert result["categories"]["content"] == 100
        assert result["categories"]["interaction"] == 100

    def test_webmcp_included_in_overall(self):
        """WebMCP is now part of the unified score."""
        checks = [
            _check("content", 100, 1.0),
            _check("interaction", 100, 1.0),
            _check("webmcp", 100, 1.0),
            _check("signup_test", 100, 1.0),
        ]
        result = calculate_overall_score(checks)
        assert "webmcp" in result["categories"]
        assert result["categories"]["webmcp"] == 100
        assert result["overall"] == 100


class TestSignupTestWeightRedistribution:
    """Tests for proportional weight redistribution when signup_test is absent."""

    def test_without_signup_test_redistributes_weight(self):
        """When no signup_test checks exist, weight redistributes proportionally."""
        checks = [
            _check("content", 100, 1.0),
            _check("interaction", 100, 1.0),
            _check("webmcp", 100, 1.0),
        ]
        result = calculate_overall_score(checks)
        # All present categories score 100, so overall should still be 100
        assert result["overall"] == 100
        assert "signup_test" not in result["categories"]

    def test_redistribution_changes_effective_weights(self):
        """Without signup_test, the remaining 3 categories get proportionally more."""
        # Content=100, Interaction=0, WebMCP=0 with signup test
        checks_with_signup = [
            _check("content", 100, 1.0),
            _check("interaction", 0, 1.0),
            _check("webmcp", 0, 1.0),
            _check("signup_test", 0, 1.0),
        ]
        result_with = calculate_overall_score(checks_with_signup)

        # Content=100, Interaction=0, WebMCP=0 without signup test
        checks_without_signup = [
            _check("content", 100, 1.0),
            _check("interaction", 0, 1.0),
            _check("webmcp", 0, 1.0),
        ]
        result_without = calculate_overall_score(checks_without_signup)

        # Without signup test: content weight goes from 0.35 to 0.35/0.85 ≈ 0.4118
        # So 100 * 0.4118 ≈ 41
        assert result_with["overall"] == 35  # 100 * 0.35
        assert result_without["overall"] == 41  # 100 * (0.35/0.85) ≈ 41.18

    def test_only_content_scores_correct_proportion(self):
        """With only content checks, it should get 100% of the weight."""
        checks = [
            _check("content", 80, 1.0),
        ]
        result = calculate_overall_score(checks)
        # Only content exists, so it gets 100% of the weight
        assert result["overall"] == 80
        assert result["categories"]["content"] == 80

    def test_signup_test_zeroed_is_different_from_absent(self):
        """A signup_test scoring 0 is different from no signup_test at all."""
        # signup_test present but scores 0
        checks_present = [
            _check("content", 100, 1.0),
            _check("interaction", 100, 1.0),
            _check("webmcp", 100, 1.0),
            _check("signup_test", 0, 1.0),
        ]
        result_present = calculate_overall_score(checks_present)

        # signup_test absent — weight redistributed
        checks_absent = [
            _check("content", 100, 1.0),
            _check("interaction", 100, 1.0),
            _check("webmcp", 100, 1.0),
        ]
        result_absent = calculate_overall_score(checks_absent)

        # Present but 0: 100*0.35 + 100*0.35 + 100*0.15 + 0*0.15 = 85
        assert result_present["overall"] == 85
        # Absent: all remaining score 100 → 100
        assert result_absent["overall"] == 100
