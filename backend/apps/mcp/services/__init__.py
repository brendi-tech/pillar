"""
MCP services for Help Center.
"""
from apps.mcp.services.stream_registry import StreamRegistry, stream_registry
from apps.mcp.services.server_info_service import ServerInfoService, server_info_service

# Backwards-compatible imports from refactored modules
from apps.mcp.services.agent import AgentAnswerServiceReActAsync, StreamingSourcesBuffer
from apps.mcp.services.agent_tools import (
    AgentContext,
    AgentToolExecutor,
    AGENT_TOOLS,
    get_tool_by_name,
    get_tool_names,
)
from apps.mcp.services.prompts import (
    get_agent_system_prompt,
    build_dynamic_instructions,
    format_sources_for_prompt,
    PERSONALITY_PRESETS,
)

__all__ = [
    # Core services
    'StreamRegistry',
    'stream_registry',
    'ServerInfoService',
    'server_info_service',
    
    # Agent service (backwards-compatible)
    'AgentAnswerServiceReActAsync',
    'StreamingSourcesBuffer',
    
    # Agent tools (backwards-compatible)
    'AgentContext',
    'AgentToolExecutor',
    'AGENT_TOOLS',
    'get_tool_by_name',
    'get_tool_names',
    
    # Prompts (backwards-compatible)
    'get_agent_system_prompt',
    'build_dynamic_instructions',
    'format_sources_for_prompt',
    'PERSONALITY_PRESETS',
]
