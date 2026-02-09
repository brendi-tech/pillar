"""
Unified route constants for query routing.

These routes are used by the agentic loop for decision making.

Copyright (C) 2025 Pillar Team
"""


class Route:
    """
    Route types for query handling.
    
    All routes are available at any decision point (ThinkFirst or ReAct loop).
    """
    
    # Need to look up information in the knowledge base
    SEARCH = 'search'
    
    # Can respond directly (greetings, have enough sources, etc.)
    ANSWER = 'answer'
    
    # Execute a product action (navigate, open modal, etc.)
    ACTION = 'action'
    
    # Route to human support (user requests help, account issues)
    ESCALATE = 'escalate'
    
    # Graceful fallback (off-topic, searched but found nothing)
    DEFER = 'defer'
    
    # Set of all valid routes
    ALL = {SEARCH, ANSWER, ACTION, ESCALATE, DEFER}
    
    @classmethod
    def is_valid(cls, route: str) -> bool:
        """Check if a route string is valid."""
        return route in cls.ALL
