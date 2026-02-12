"""
Base types for Agent Score analyzers.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CheckResult:
    """
    Result of a single check within an analyzer.

    Each analyzer returns a list of these, which are later
    bulk-created as AgentScoreCheck model instances.
    """

    category: str
    check_name: str
    check_label: str
    passed: bool
    score: int  # 0-100
    weight: float  # relative weight within category
    details: dict = field(default_factory=dict)
    recommendation: str = ""
