"""
Base Tool class for MCP tools.

All tools (built-in and custom) inherit from the Tool base class.

Copyright (C) 2025 Pillar Team
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, Optional


@dataclass
class ToolDefinition:
    """Schema for MCP tool registration."""
    name: str
    description: str
    input_schema: Dict[str, Any]


class Tool(ABC):
    """
    Base class for all MCP tools.

    Tools can be:
    - public=True: Exposed via MCP to external clients
    - public=False: Internal only

    Attributes:
        name: Unique identifier for the tool
        description: Human-readable description
        input_schema: JSON Schema for tool input parameters
        public: Whether exposed via MCP
        supports_streaming: Whether this tool supports streaming
        annotations: MCP annotations (readOnlyHint, categories, etc.)
        meta: OpenAI widget metadata
    """

    name: str
    description: str
    input_schema: Dict[str, Any]
    public: bool = True
    supports_streaming: bool = False
    annotations: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None

    @abstractmethod
    async def execute(
        self,
        help_center_config,
        arguments: Dict[str, Any],
        request=None,
        language: str = 'en'
    ) -> Dict[str, Any]:
        """
        Execute the tool with given arguments (non-streaming).

        Args:
            help_center_config: HelpCenterConfig model instance
            arguments: Tool input arguments matching input_schema
            request: Optional HTTP request object
            language: Language code for AI responses (e.g., 'en', 'es', 'fr')

        Returns:
            Dict with 'success' bool and tool-specific result data
        """
        raise NotImplementedError

    async def execute_stream(
        self,
        help_center_config,
        organization,
        request,
        arguments: Dict[str, Any],
        cancel_event=None,
        language: str = 'en'
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute the tool with streaming response.

        Override this method for tools that support streaming.
        Default implementation falls back to non-streaming execute().

        Args:
            help_center_config: HelpCenterConfig model instance
            organization: Organization model instance
            request: HTTP request object
            arguments: Tool input arguments
            cancel_event: Optional asyncio.Event to signal cancellation
            language: Language code for AI responses (e.g., 'en', 'es', 'fr')

        Yields:
            Event dictionaries:
            - {'type': 'token', 'text': '...'} for streaming text
            - {'type': 'result', 'data': {...}} for final result
            - {'type': 'error', 'message': '...'} for errors
            - {'type': 'progress', 'message': '...'} for progress
        """
        # Default: fall back to non-streaming execution
        result = await self.execute(help_center_config, arguments, request=request, language=language)
        yield {'type': 'result', 'data': result}

    def get_definition(self) -> ToolDefinition:
        """Get tool definition for registration."""
        return ToolDefinition(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema
        )

    def to_mcp_schema(self) -> Dict[str, Any]:
        """
        Convert to MCP tools/list format with full metadata.

        Returns schema compatible with MCP specification including:
        - name, description, inputSchema (required)
        - annotations (optional)
        - _meta (optional: OpenAI widget metadata)
        """
        schema = {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema
        }

        if self.annotations:
            schema["annotations"] = self.annotations

        if self.meta:
            schema["_meta"] = self.meta

        return schema

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name='{self.name}' public={self.public}>"
