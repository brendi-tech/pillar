"""
Accessibility analyzer — does the shared a11y/agent foundation exist?

Checks: aria_labels, landmark_roles, keyboard_focusable, consistent_nav
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from apps.agent_score.analyzers.base import CheckResult
from apps.agent_score.analyzers.data_quality import DataQuality

if TYPE_CHECKING:
    from apps.agent_score.models import AgentScoreReport

logger = logging.getLogger(__name__)

_DNF_RECOMMENDATION = (
    "This check could not run because our servers were blocked "
    "from loading this page in a browser."
)


def run(report: AgentScoreReport, dq: DataQuality) -> list[CheckResult]:
    """Run all accessibility checks against the report data."""
    checks: list[CheckResult] = []

    checks.append(_check_aria_labels(report.axe_results, report.accessibility_tree, dq))
    checks.append(_check_landmark_roles(report.accessibility_tree, dq))
    checks.append(_check_keyboard_focusable(report.axe_results, dq))
    checks.append(_check_consistent_nav(report.accessibility_tree, dq))

    return checks


# ──────────────────────────────────────────────────────────────────────────────

_LABEL_AXE_RULES = {"button-name", "link-name", "label", "input-image-alt", "image-alt"}
_KEYBOARD_AXE_RULES = {"tabindex", "focus-order-semantics"}
_LANDMARK_ROLES = {"navigation", "main", "banner", "contentinfo", "complementary", "search"}


def _get_violations_by_rules(axe_results: dict, rule_ids: set) -> list[dict]:
    """Filter axe violations to a subset of rule IDs."""
    violations = axe_results.get("violations", [])
    return [v for v in violations if v.get("id") in rule_ids]


def _count_ax_tree_roles(tree: dict, target_roles: set) -> dict[str, int]:
    """Walk the accessibility tree and count nodes with target roles."""
    counts: dict[str, int] = dict.fromkeys(target_roles, 0)

    def _walk(node: dict) -> None:
        role = node.get("role", "")
        if role in target_roles:
            counts[role] = counts.get(role, 0) + 1
        for child in node.get("children", []):
            if isinstance(child, dict):
                _walk(child)

    if tree:
        _walk(tree)
    return counts


def _check_aria_labels(axe_results: dict, ax_tree: dict, dq: DataQuality) -> CheckResult:
    """Interactive elements have ARIA labels (via axe-core violations)."""
    if dq.axe_results != "ok":
        return CheckResult(
            category="interaction", check_name="aria_labels",
            check_label="Interactive elements have ARIA labels",
            passed=False, score=0, weight=20, status="dnf",
            details={"reason": dq.axe_results},
            recommendation=_DNF_RECOMMENDATION,
        )
    if not axe_results:
        return CheckResult(
            category="interaction",
            check_name="aria_labels",
            check_label="Interactive elements have ARIA labels",
            passed=False, score=0, weight=20,
            details={"error": "no_axe_results"},
            recommendation="Could not run accessibility audit on this page.",
        )

    violations = _get_violations_by_rules(axe_results, _LABEL_AXE_RULES)
    total_nodes_affected = sum(v.get("nodes_count", 0) for v in violations)

    if total_nodes_affected == 0:
        score = 100
    elif total_nodes_affected <= 3:
        score = 70
    elif total_nodes_affected <= 10:
        score = 40
    else:
        score = 15

    return CheckResult(
        category="interaction",
        check_name="aria_labels",
        check_label="Interactive elements have ARIA labels",
        passed=total_nodes_affected == 0,
        score=score,
        weight=20,
        details={
            "label_violations": [
                {"rule": v["id"], "impact": v.get("impact"), "count": v.get("nodes_count")}
                for v in violations
            ],
            "total_unlabeled_elements": total_nodes_affected,
        },
        recommendation="" if total_nodes_affected == 0 else (
            f"{total_nodes_affected} interactive elements are missing accessible names. "
            "Add aria-label, <label>, or descriptive text content to all buttons, links, "
            "and form inputs."
        ),
    )


def _check_landmark_roles(ax_tree: dict, dq: DataQuality) -> CheckResult:
    """Page uses landmark roles (main, navigation, banner, etc.)."""
    if dq.accessibility_tree != "ok":
        return CheckResult(
            category="interaction", check_name="landmark_roles",
            check_label="Page uses landmark roles",
            passed=False, score=0, weight=15, status="dnf",
            details={"reason": dq.accessibility_tree},
            recommendation=_DNF_RECOMMENDATION,
        )
    if not ax_tree:
        return CheckResult(
            category="interaction",
            check_name="landmark_roles",
            check_label="Page uses landmark roles",
            passed=False, score=0, weight=15,
            details={"error": "no_accessibility_tree"},
            recommendation="Ensure your page renders an accessibility tree.",
        )

    counts = _count_ax_tree_roles(ax_tree, _LANDMARK_ROLES)
    total_landmarks = sum(counts.values())
    has_main = counts.get("main", 0) >= 1
    has_navigation = counts.get("navigation", 0) >= 1

    if has_main and has_navigation and total_landmarks >= 3:
        score = 100
    elif has_main and total_landmarks >= 2:
        score = 75
    elif has_main:
        score = 50
    elif total_landmarks >= 1:
        score = 30
    else:
        score = 0

    return CheckResult(
        category="interaction",
        check_name="landmark_roles",
        check_label="Page uses landmark roles",
        passed=has_main and has_navigation,
        score=score,
        weight=15,
        details={
            "landmark_counts": counts,
            "total_landmarks": total_landmarks,
            "has_main": has_main,
            "has_navigation": has_navigation,
        },
        recommendation="" if (has_main and has_navigation) else (
            "Add landmark roles to your page structure: <main>, <nav>, <header>, "
            "<footer>. Agents use landmarks to skip directly to relevant sections."
        ),
    )


def _check_keyboard_focusable(axe_results: dict, dq: DataQuality) -> CheckResult:
    """Interactive elements are keyboard-reachable (via axe-core)."""
    if dq.axe_results != "ok":
        return CheckResult(
            category="interaction", check_name="keyboard_focusable",
            check_label="Interactive elements are keyboard-reachable",
            passed=False, score=0, weight=15, status="dnf",
            details={"reason": dq.axe_results},
            recommendation=_DNF_RECOMMENDATION,
        )
    if not axe_results:
        return CheckResult(
            category="interaction",
            check_name="keyboard_focusable",
            check_label="Interactive elements are keyboard-reachable",
            passed=False, score=0, weight=15,
            details={"error": "no_axe_results"},
            recommendation="Could not run accessibility audit on this page.",
        )

    violations = _get_violations_by_rules(axe_results, _KEYBOARD_AXE_RULES)
    total_affected = sum(v.get("nodes_count", 0) for v in violations)

    # Also check for general ARIA violations that affect keyboard use
    aria_violations = _get_violations_by_rules(
        axe_results,
        {"aria-required-attr", "aria-roles", "aria-valid-attr"},
    )
    aria_affected = sum(v.get("nodes_count", 0) for v in aria_violations)

    combined = total_affected + aria_affected

    if combined == 0:
        score = 100
    elif combined <= 3:
        score = 70
    elif combined <= 10:
        score = 40
    else:
        score = 15

    return CheckResult(
        category="interaction",
        check_name="keyboard_focusable",
        check_label="Interactive elements are keyboard-reachable",
        passed=combined == 0,
        score=score,
        weight=15,
        details={
            "keyboard_violations": [
                {"rule": v["id"], "count": v.get("nodes_count")} for v in violations
            ],
            "aria_violations": [
                {"rule": v["id"], "count": v.get("nodes_count")} for v in aria_violations
            ],
            "total_issues": combined,
        },
        recommendation="" if combined == 0 else (
            f"{combined} elements have keyboard/ARIA issues. Use native HTML elements "
            "(<button>, <a>, <input>) instead of styled <div>s, and ensure all "
            "interactive custom widgets are keyboard-accessible."
        ),
    )


def _check_consistent_nav(ax_tree: dict, dq: DataQuality) -> CheckResult:
    """Navigation structure is consistent and parseable."""
    if dq.accessibility_tree != "ok":
        return CheckResult(
            category="interaction", check_name="consistent_nav",
            check_label="Navigation structure is consistent",
            passed=False, score=0, weight=10, status="dnf",
            details={"reason": dq.accessibility_tree},
            recommendation=_DNF_RECOMMENDATION,
        )
    if not ax_tree:
        return CheckResult(
            category="interaction",
            check_name="consistent_nav",
            check_label="Navigation structure is consistent",
            passed=False, score=0, weight=10,
            details={"error": "no_accessibility_tree"},
            recommendation="Ensure your page renders an accessibility tree.",
        )

    nav_landmarks: list[dict] = []

    def _find_navs(node: dict) -> None:
        if node.get("role") == "navigation":
            children = node.get("children", [])
            link_count = sum(
                1 for c in children
                if isinstance(c, dict) and c.get("role") == "link"
            )
            # Also count links nested deeper
            all_links = _count_nested_links(node)
            nav_landmarks.append({
                "name": node.get("name", ""),
                "direct_links": link_count,
                "total_links": all_links,
            })
        for child in node.get("children", []):
            if isinstance(child, dict):
                _find_navs(child)

    def _count_nested_links(node: dict) -> int:
        count = 0
        if node.get("role") == "link":
            count += 1
        for child in node.get("children", []):
            if isinstance(child, dict):
                count += _count_nested_links(child)
        return count

    _find_navs(ax_tree)

    has_nav = len(nav_landmarks) >= 1
    has_named_nav = any(n["name"] for n in nav_landmarks)
    has_links = any(n["total_links"] > 0 for n in nav_landmarks)

    if has_nav and has_named_nav and has_links:
        score = 100
    elif has_nav and has_links:
        score = 75
    elif has_nav:
        score = 50
    else:
        score = 0

    return CheckResult(
        category="interaction",
        check_name="consistent_nav",
        check_label="Navigation structure is consistent",
        passed=has_nav and has_links,
        score=score,
        weight=10,
        details={
            "nav_landmarks": nav_landmarks[:5],
            "has_named_nav": has_named_nav,
        },
        recommendation="" if (has_nav and has_links) else (
            "Wrap your site navigation in a <nav> element with an aria-label "
            "(e.g. aria-label=\"Main navigation\"). This helps agents quickly "
            "identify and parse your navigation structure."
        ),
    )
