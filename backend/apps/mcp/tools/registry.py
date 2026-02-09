"""
Tool Registry for managing built-in tools.

The registry provides a single source of truth for all available tools.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, List, Optional

from .base import Tool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """
    Single registry for all tools.

    - MCP server accesses public tools via get_public_tools()
    - Supports per-help-center tools if needed in the future

    Tool hierarchy:
        1. Help-center-specific tools (highest priority, if any)
        2. Global built-in tools (lowest priority)
    """

    def __init__(self):
        self._builtin_tools: Dict[str, Tool] = {}
        self._help_center_tools: Dict[str, Dict[str, Tool]] = {}  # hc_id -> {name -> Tool}

    def register_builtin(self, tool: Tool) -> None:
        """
        Register a built-in tool (available to all help centers).

        Args:
            tool: Tool instance to register
        """
        self._builtin_tools[tool.name] = tool
        logger.info(f"Registered built-in tool: {tool.name} (public={tool.public})")

    def register_help_center_tool(self, help_center_id: str, tool: Tool) -> None:
        """
        Register a help-center-specific tool.

        Args:
            help_center_id: UUID of the help center
            tool: Tool instance to register
        """
        if help_center_id not in self._help_center_tools:
            self._help_center_tools[help_center_id] = {}
        self._help_center_tools[help_center_id][tool.name] = tool
        logger.debug(f"Registered help center tool for {help_center_id}: {tool.name}")

    def clear_help_center_tools(self, help_center_id: str) -> None:
        """
        Clear all tools for a specific help center.

        Args:
            help_center_id: UUID of the help center
        """
        if help_center_id in self._help_center_tools:
            count = len(self._help_center_tools[help_center_id])
            self._help_center_tools[help_center_id] = {}
            if count:
                logger.debug(f"Cleared {count} tools for help center {help_center_id}")

    def get_all_tools(self, help_center_id: Optional[str] = None) -> List[Tool]:
        """
        Get all tools.

        Priority (first wins on name collision):
            1. Help-center-specific tools
            2. Global built-in tools

        Args:
            help_center_id: Optional UUID of the help center for specific tools

        Returns:
            List of all available Tool instances
        """
        # Start with global built-ins (lowest priority)
        tools_by_name = dict(self._builtin_tools)

        # Add help-center-specific tools (override globals if same name)
        if help_center_id and help_center_id in self._help_center_tools:
            tools_by_name.update(self._help_center_tools[help_center_id])

        return list(tools_by_name.values())

    def get_public_tools(self, help_center_id: Optional[str] = None) -> List[Tool]:
        """
        Get public tools only (for MCP server).

        Args:
            help_center_id: Optional UUID of the help center

        Returns:
            List of Tool instances where public=True
        """
        return [t for t in self.get_all_tools(help_center_id) if t.public]

    def get_tool(self, name: str, help_center_id: Optional[str] = None) -> Optional[Tool]:
        """
        Get a specific tool by name.

        Priority (first wins):
            1. Help-center-specific tools
            2. Global built-in tools

        Args:
            name: Tool name
            help_center_id: Optional UUID of the help center

        Returns:
            Tool instance or None if not found
        """
        # Check help-center-specific tools first
        if help_center_id and help_center_id in self._help_center_tools:
            if name in self._help_center_tools[help_center_id]:
                return self._help_center_tools[help_center_id][name]

        # Fall back to global built-ins
        return self._builtin_tools.get(name)

    def get_tool_names(self, help_center_id: Optional[str] = None) -> List[str]:
        """
        Get all available tool names.

        Args:
            help_center_id: Optional UUID of the help center

        Returns:
            List of tool names
        """
        return [t.name for t in self.get_all_tools(help_center_id)]

    def has_tool(self, name: str, help_center_id: Optional[str] = None) -> bool:
        """
        Check if a tool exists.

        Args:
            name: Tool name
            help_center_id: Optional UUID of the help center

        Returns:
            True if tool exists
        """
        return self.get_tool(name, help_center_id) is not None

    def get_builtin_count(self) -> int:
        """Get count of registered built-in tools."""
        return len(self._builtin_tools)


# Global registry instance
_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    """
    Get or create the global tool registry.

    Lazily initializes the registry and registers all built-in tools.

    Returns:
        The global ToolRegistry singleton
    """
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
        _register_builtin_tools(_registry)
    return _registry


def _register_builtin_tools(registry: ToolRegistry) -> None:
    """
    Register all global built-in tools with the registry.

    These tools are available to all help centers.
    """
    from .builtin.ask import AskTool
    from .builtin.search import KeywordSearchTool
    from .builtin.suggest_questions import SuggestQuestionsTool

    # Core tools
    registry.register_builtin(AskTool())

    # Search tools (keyword_search used by frontend docs search)
    registry.register_builtin(KeywordSearchTool())

    # UI assistance tools
    registry.register_builtin(SuggestQuestionsTool())

    logger.info(f"Registered {registry.get_builtin_count()} built-in tools")
