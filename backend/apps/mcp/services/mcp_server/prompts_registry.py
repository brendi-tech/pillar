"""
Prompts registry for MCP server.

Handles listing and getting prompts (placeholder for future).

Copyright (C) 2025 Pillar Team
"""
from typing import Dict, Any, Optional


async def list_prompts(params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    List available prompts.

    Currently returns empty list (placeholder for future).

    Args:
        params: Request parameters
        context: Optional context

    Returns:
        Dict with empty prompts list
    """
    return {'prompts': []}


async def get_prompt(params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Get a specific prompt.

    Not implemented yet.

    Args:
        params: Request parameters with prompt name
        context: Optional context

    Raises:
        NotImplementedError: Prompts are not yet supported
    """
    raise NotImplementedError("Prompts are not yet supported")
