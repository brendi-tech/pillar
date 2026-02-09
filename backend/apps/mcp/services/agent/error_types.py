"""
Structured error types for LLM-based error recovery.

Provides error types and utilities that enable the agentic loop
to reason about tool failures instead of silently swallowing them.

Copyright (C) 2025 Pillar Team
"""
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolError:
    """
    Structured error for tool failures.
    
    This class provides a consistent format for errors that can be:
    1. Passed to the LLM for recovery decisions
    2. Logged for debugging
    3. Tracked in agent context
    
    Attributes:
        error: Human-readable error message
        tool: Name of the tool that failed
        recoverable: Whether the error might be fixed by retrying or trying differently
        hint: Optional suggestion for how to fix the error
        original_args: Optional original arguments that caused the error
    """
    error: str
    tool: str
    recoverable: bool = True
    hint: Optional[str] = None
    original_args: Optional[dict] = field(default=None)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "error": self.error,
            "tool": self.tool,
            "recoverable": self.recoverable,
        }
        if self.hint:
            result["hint"] = self.hint
        if self.original_args:
            result["original_args"] = self.original_args
        return result


def is_tool_error(result: Any) -> bool:
    """
    Check if a result indicates a tool error.
    
    Handles both ToolError instances and error dicts.
    
    Args:
        result: The result from a tool execution
        
    Returns:
        True if the result represents an error
    """
    if isinstance(result, ToolError):
        return True
    if isinstance(result, dict):
        # Check for error key with a truthy value
        error_val = result.get("error")
        if error_val:
            return True
    return False


def format_error_for_llm(error: dict, tool_name: str) -> str:
    """
    Format an error for inclusion in LLM context.
    
    Creates a human-readable error message that helps the LLM
    understand what went wrong and how to recover.
    
    Args:
        error: Error dictionary with 'error', optionally 'hint' and 'recoverable'
        tool_name: Name of the tool that failed
        
    Returns:
        Formatted error string for LLM prompt
    """
    msg = f"Tool '{tool_name}' failed: {error.get('error', 'Unknown error')}"
    
    if error.get("hint"):
        msg += f"\nHint: {error['hint']}"
    
    if error.get("recoverable", True):
        msg += "\nThis error may be recoverable - consider retrying or trying a different approach."
    else:
        msg += "\nThis error is not recoverable - consider an alternative strategy."
    
    return msg


def create_error_result(
    error: str,
    tool: str,
    recoverable: bool = True,
    hint: Optional[str] = None,
    original_args: Optional[dict] = None,
) -> dict:
    """
    Create a standardized error result dictionary.
    
    Use this helper to ensure consistent error format across all tools.
    
    Args:
        error: Human-readable error message
        tool: Name of the tool that failed
        recoverable: Whether the error might be fixed by retrying
        hint: Optional suggestion for fixing
        original_args: Optional original arguments
        
    Returns:
        Error dictionary that can be returned from tool execution
    """
    result = {
        "error": error,
        "tool": tool,
        "recoverable": recoverable,
    }
    if hint:
        result["hint"] = hint
    if original_args:
        result["original_args"] = original_args
    return result
