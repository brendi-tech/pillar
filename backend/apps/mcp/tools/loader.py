"""
Tool loader for loading tools for a help center.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import List

from .base import Tool
from .registry import get_tool_registry

logger = logging.getLogger(__name__)


async def load_all_tools_for_help_center(help_center_config) -> List[Tool]:
    """
    Load all tools for a help center.

    This is the main entry point for loading tools when serving MCP requests.

    Currently, all tools are global built-ins. This function provides
    a hook for future help-center-specific tool loading.

    Args:
        help_center_config: HelpCenterConfig model instance (may be None)

    Returns:
        List of all Tool instances available for this help center

    Raises:
        ValueError: If help_center_config is None
    """
    if help_center_config is None:
        raise ValueError(
            "help_center_config is required. Ensure request includes a valid "
            "x-customer-id header, X-Help-Center-Id header, or subdomain."
        )

    help_center_id = str(help_center_config.id)
    registry = get_tool_registry()

    # Clear existing help-center-specific tools (for reload)
    registry.clear_help_center_tools(help_center_id)

    # Currently all tools are global built-ins
    # In the future, we could load help-center-specific tools here

    # Return all tools for this help center
    all_tools = registry.get_all_tools(help_center_id)
    logger.debug(f"Loaded {len(all_tools)} total tools for help center {help_center_id}")

    return all_tools
