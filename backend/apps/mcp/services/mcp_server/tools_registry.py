"""
Tools registry for MCP server.

Delegates to the unified ToolRegistry for all tool definitions.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def build_tools_list(help_center_config) -> Dict[str, Any]:
    """
    Build list of available tools for MCP.

    Uses the unified ToolRegistry to load all tools and returns their MCP schemas.

    Args:
        help_center_config: HelpCenterConfig instance

    Returns:
        Dict with 'tools' key containing list of tool definitions
    """
    from apps.mcp.tools.loader import load_all_tools_for_help_center
    from apps.mcp.tools.registry import get_tool_registry

    logger.info(f"[tools/list] Building tools list for help center: {help_center_config.id if help_center_config else 'None'}")

    if not help_center_config:
        logger.warning("[tools/list] No help center provided, returning empty tools list")
        return {'tools': []}

    try:
        # Load all tools for this help center
        await load_all_tools_for_help_center(help_center_config)

        # Get registry and retrieve public tools
        registry = get_tool_registry()
        public_tools = registry.get_public_tools(str(help_center_config.id))

        # Convert to MCP schema format
        tools = [tool.to_mcp_schema() for tool in public_tools]

        logger.info(f"[tools/list] Returning {len(tools)} tools for help center {help_center_config.id}")
        return {'tools': tools}

    except Exception as e:
        logger.error(f"[tools/list] Error building tools list: {e}", exc_info=True)
        # Return empty list on error to prevent breaking MCP
        return {'tools': []}
