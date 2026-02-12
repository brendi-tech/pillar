"""
Agent Score Hatchet workflow tasks.
"""
from .browser_analysis import browser_analysis_workflow
from .http_probes import http_probes_workflow
from .run_analyzers import analyze_and_score_workflow
from .signup_test import signup_test_workflow

__all__ = [
    'http_probes_workflow',
    'browser_analysis_workflow',
    'analyze_and_score_workflow',
    'signup_test_workflow',
]
