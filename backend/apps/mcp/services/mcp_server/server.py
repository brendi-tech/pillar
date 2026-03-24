"""
Model Context Protocol (MCP) server implementation for Help Center.

Main MCPServer class that delegates to specialized modules for tools and resources.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Dict, Any, Optional
from apps.mcp.services.server_info_service import server_info_service

logger = logging.getLogger(__name__)


class MCPServer:
    """
    MCP protocol server implementation for Help Center.

    Provides methods for:
    - Protocol initialization and capabilities
    - Tools (ask for Q&A, search variants)
    - Resources (articles, categories)
    - Prompts (pass-through from external MCP sources)
    """

    # Use constants from centralized service
    PROTOCOL_VERSION = server_info_service.PROTOCOL_VERSION
    SERVER_VERSION = server_info_service.SERVER_VERSION

    # Metadata for tools
    TOOL_CATEGORIES = server_info_service.TOOL_CATEGORIES
    TOOL_TAGS = server_info_service.TOOL_TAGS

    def __init__(self, help_center_config=None, organization=None, request=None, language: str = 'en', agent=None):
        """
        Initialize MCP server for a specific help center context.

        Args:
            help_center_config: HelpCenterConfig model instance
            organization: Organization model instance
            request: HTTP request object (for conversation tracking)
            language: Language code for AI responses (e.g., 'en', 'es', 'fr')
            agent: Agent model instance (resolved by middleware)
        """
        self.help_center_config = help_center_config
        self.organization = organization
        self.request = request
        self.language = language
        self.agent = agent

    # Core Protocol Methods

    async def initialize(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Initialize MCP connection and declare capabilities.

        Per MCP spec, handles:
        - Protocol version negotiation
        - Capability negotiation
        - Error cases (version mismatch, missing context)

        Params:
            protocolVersion: Client's protocol version
            capabilities: Client capabilities
            clientInfo: Client name and version

        Returns:
            Server protocol version, capabilities, and info

        Raises:
            ValueError: For spec-compliant errors
        """
        client_version = params.get('protocolVersion', 'unknown')
        client_info = params.get('clientInfo', {})
        client_name = client_info.get('name', 'unknown')

        logger.info(
            f"[initialize] MCP initialize request from {client_name} "
            f"(protocol {client_version})"
        )

        # Error case 1: Missing help center context
        if not self.help_center_config:
            error_msg = "Help center context required for initialization"
            logger.error(f"[initialize] ERROR: {error_msg}")
            raise ValueError(error_msg)

        # Protocol version negotiation
        supported_versions = ['2025-06-18', '2025-03-26', '2024-11-05']
        negotiated_version = self.PROTOCOL_VERSION

        if client_version == 'unknown' or client_version not in supported_versions:
            logger.warning(
                f"[initialize] Protocol version negotiation: "
                f"Client requested '{client_version}', not in supported versions {supported_versions}. "
                f"Responding with our latest: {self.PROTOCOL_VERSION}. "
                f"Client may disconnect if incompatible."
            )
            negotiated_version = self.PROTOCOL_VERSION
        else:
            negotiated_version = client_version
            logger.info(
                f"[initialize] Protocol version negotiated: {negotiated_version} "
                f"(client requested {client_version})"
            )

        # Capability negotiation logging
        client_capabilities = params.get('capabilities', {})
        logger.info(f"[initialize] Client capabilities: {list(client_capabilities.keys())}")

        # Use centralized service to build server info
        try:
            server_info = server_info_service.get_server_info(
                help_center_config=self.help_center_config,
                include_platform=True
            )
        except Exception as e:
            logger.error(f"[initialize] ERROR: Failed to generate server info: {e}", exc_info=True)
            raise ValueError(f"Failed to initialize server: {str(e)}")

        # Build capabilities - match MCP spec examples exactly
        capabilities = {
            'tools': {
                'listChanged': False
            },
            'resources': {
                'subscribe': False,
                'listChanged': False
            },
            'prompts': {
                'listChanged': False
            }
        }

        return {
            'protocolVersion': negotiated_version,
            'capabilities': capabilities,
            'serverInfo': server_info
        }

    async def ping(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Health check ping.

        Returns:
            Empty object (as per MCP spec)
        """
        return {}

    async def notifications_initialized(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> None:
        """
        Handle notifications/initialized from client.

        Per MCP spec 2025-06-18, after the server responds to initialize,
        the client MUST send this notification to indicate it's ready for normal operations.

        This is a notification (no response expected).
        """
        logger.info(f"[MCP] Client sent initialized notification - connection ready for operations")
        # No return value for notifications

    # Tools Methods

    async def tools_list(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        List available tools.

        Supports cursor-based pagination per the MCP spec.

        Returns:
            List of tool definitions with input schemas and optional nextCursor
        """
        from .tools_registry import build_tools_list
        return await build_tools_list(
            self.help_center_config, agent=self.agent,
            cursor=params.get('cursor'),
        )

    async def tools_call(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a tool.

        Params:
            name: Tool name
            arguments: Tool input arguments

        Returns:
            Tool execution result with content array
        """
        from .tools_dispatcher import dispatch_tool_call
        return await dispatch_tool_call(
            self.help_center_config,
            self.organization,
            self.request,
            params,
            language=self.language,
            agent=self.agent,
        )

    async def tools_call_stream(self, params: Dict[str, Any], cancel_event=None):
        """
        Execute a tool with streaming response.
        Used by SSE and WebSocket endpoints.

        Params:
            name: Tool name
            arguments: Tool input arguments
            cancel_event: Optional asyncio.Event to signal cancellation

        Yields:
            Event dictionaries compatible with SSE/WebSocket format
        """
        from .tools_dispatcher import dispatch_tool_call_stream
        async for event in dispatch_tool_call_stream(
            self.help_center_config,
            self.organization,
            self.request,
            params,
            cancel_event=cancel_event,
            language=self.language,
            agent=self.agent,
        ):
            yield event

    # Resources Methods

    async def resources_list(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        List available resources (articles, categories, external MCP resources).

        Supports cursor-based pagination per the MCP spec.

        Returns:
            List of resource descriptors and optional nextCursor
        """
        from .resources_registry import build_resources_list
        return await build_resources_list(
            self.help_center_config, self.organization, agent=self.agent,
            cursor=params.get('cursor'),
        )

    async def resources_read(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Read a specific resource (article or external MCP resource).

        Params:
            uri: Resource URI

        Returns:
            Resource content
        """
        from .resources_dispatcher import dispatch_resource_read
        return await dispatch_resource_read(
            self.help_center_config, self.organization, params,
            agent=self.agent, request=self.request,
        )

    # Prompts Methods

    async def prompts_list(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        List available prompts from external MCP sources.

        Supports cursor-based pagination per the MCP spec.

        Returns:
            List of prompt definitions and optional nextCursor
        """
        from .prompts_registry import list_prompts
        return await list_prompts(
            self.help_center_config,
            agent=self.agent,
            cursor=params.get('cursor'),
        )

    async def prompts_get(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get a specific prompt by proxying to the external MCP source.

        Params:
            name: Namespaced prompt name (e.g. 'acme__code_review')
            arguments: Optional prompt arguments

        Returns:
            Prompt content with description and messages
        """
        from .prompts_registry import get_prompt
        return await get_prompt(
            params,
            agent=self.agent,
            help_center_config=self.help_center_config,
        )
