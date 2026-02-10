"""
Shared prompt utilities for agent services.

Centralizes system prompts and instructions to avoid duplication.
"""
from apps.mcp.services.prompts.system_prompts import get_agent_system_prompt
from apps.mcp.services.prompts.dynamic_instructions import build_dynamic_instructions
from apps.mcp.services.prompts.agentic_prompts import (
    format_sources_for_prompt,
    format_conversation_history,
    build_agentic_prompt,
)
from apps.mcp.services.prompts.personality import PERSONALITY_PRESETS
from apps.mcp.services.prompts.environment_context import build_environment_context
from apps.mcp.services.prompts.capabilities import (
    build_capabilities_summary,
    invalidate_capabilities_cache,
)

__all__ = [
    # System prompts
    'get_agent_system_prompt',
    'PERSONALITY_PRESETS',
    
    # Dynamic instructions
    'build_dynamic_instructions',
    
    # Agentic prompts
    'format_sources_for_prompt',
    'format_conversation_history',
    'build_agentic_prompt',
    
    # Environment context
    'build_environment_context',
    
    # Capabilities
    'build_capabilities_summary',
    'invalidate_capabilities_cache',
]
