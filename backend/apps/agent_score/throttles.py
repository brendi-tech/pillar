"""
Throttle classes for Agent Score public endpoints.
"""
from rest_framework.throttling import AnonRateThrottle


class AgentScoreScanThrottle(AnonRateThrottle):
    """Rate limit: 5 scans per minute per IP for the public scan endpoint."""
    scope = 'agent_score_scan'


class AgentScoreSignupThrottle(AnonRateThrottle):
    """
    Rate limit: 2 signup tests per hour per IP.

    Signup tests are throttled more aggressively than standard scans because
    they create real accounts on the target site via an AI agent.
    """
    scope = 'agent_score_signup'
