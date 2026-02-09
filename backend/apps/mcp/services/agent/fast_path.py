"""
Fast path handling for simple queries.

Provides optimized handling for greetings, thanks, and other simple
queries that don't require the full agentic loop.
"""
from typing import Any, Dict, List, Optional


def is_fast_path_eligible(question: str) -> bool:
    """
    Check if query can bypass full agent loop.
    
    Fast path is for:
    - Simple greetings
    - Very short, single-intent queries
    
    Args:
        question: User's question
    
    Returns:
        True if query can use fast path
    """
    q = question.lower().strip()
    
    # Greetings
    greetings = {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!', 'howdy', 'yo'}
    if q in greetings:
        return True
    
    # Thanks
    thanks = {'thanks', 'thank you', 'thanks!', 'thank you!', 'thx'}
    if q in thanks:
        return True
    
    return False


async def fast_path_handle(
    question: str,
    platform: str = None,
    version: str = None,
) -> Optional[List[Dict[str, Any]]]:
    """
    Handle fast path queries without full agent loop.
    
    Args:
        question: User's question
        platform: Optional platform filter (unused but kept for API consistency)
        version: Optional version filter (unused but kept for API consistency)
    
    Returns:
        List of events to yield, or None if not a fast path case.
    """
    q = question.lower().strip()
    
    # Greetings
    if q in {'hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!', 'howdy', 'yo'}:
        return [
            {"type": "token", "text": "Hello! How can I help you today?"},
            {"type": "sources", "sources": []},
            {"type": "complete"},
        ]
    
    # Thanks
    if q in {'thanks', 'thank you', 'thanks!', 'thank you!', 'thx'}:
        return [
            {"type": "token", "text": "You're welcome! Let me know if you need anything else."},
            {"type": "sources", "sources": []},
            {"type": "complete"},
        ]
    
    return None
