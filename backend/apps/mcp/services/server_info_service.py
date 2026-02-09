"""
Service for generating consistent MCP server information across endpoints.

Provides centralized logic for building help-center-specific server metadata
used by the landing page and streaming endpoints.

Copyright (C) 2025 Pillar Team
"""
from typing import Dict, Any, Optional


class ServerInfoService:
    """
    Generates consistent server information for MCP endpoints.

    Ensures that all endpoints (landing page, streaming, etc.)
    return consistent help-center-specific branding and metadata.
    """

    # Platform-level constants (used for attribution only)
    PLATFORM_NAME = "Pillar Help Center"
    PLATFORM_URL = "https://trypillar.com"
    PLATFORM_DESCRIPTION = "Powered by Pillar - AI-powered help center platform"

    # MCP Protocol constants
    PROTOCOL_VERSION = "2025-06-18"  # Latest MCP spec
    SERVER_VERSION = "1.0.0"
    DEFAULT_DESCRIPTION = "AI-powered help center that answers questions using RAG (Retrieval Augmented Generation) over help articles and documentation"

    # Tool/capability metadata
    TOOL_CATEGORIES = ["help-center", "question-answering", "search", "documentation"]
    TOOL_TAGS = ["rag", "ai", "help-center", "qa", "semantic-search", "articles"]

    # Error messages
    NO_CONTEXT_ERROR = "Help center context required. Please provide a valid help_center_id or use a help-center-specific subdomain."

    @classmethod
    def get_server_info(cls, help_center_config=None, include_platform: bool = True) -> Dict[str, Any]:
        """
        Generate server info for MCP initialize method.

        Per MCP spec 2025-06-18, serverInfo MUST include:
        - name: technical identifier
        - version: semver string

        Optional but recommended:
        - title: human-readable display name

        Args:
            help_center_config: HelpCenterConfig model instance (required)
            include_platform: Whether to include platform attribution

        Returns:
            Server info dict for MCP serverInfo field

        Raises:
            ValueError: If help_center_config is not provided
        """
        if not help_center_config:
            raise ValueError(cls.NO_CONTEXT_ERROR)

        # Per MCP spec: Only include standard fields for maximum compatibility
        server_info = {
            'name': f"{help_center_config.name.lower().replace(' ', '-')}-help-center-mcp",
            'version': cls.SERVER_VERSION,
        }

        # Add title (recommended by spec)
        if help_center_config.name:
            server_info['title'] = f"{help_center_config.name} Help Center"

        return server_info

    @classmethod
    def get_landing_page_response(cls, help_center_config=None) -> Dict[str, Any]:
        """
        Generate complete landing page response.

        Args:
            help_center_config: HelpCenterConfig model instance (required)

        Returns:
            Complete JSON response for GET /mcp/ endpoint

        Raises:
            ValueError: If help_center_config is not provided
        """
        if not help_center_config:
            return {
                'error': 'No Help Center Context',
                'message': cls.NO_CONTEXT_ERROR,
                'details': 'MCP servers are help-center-specific. Please access via a help-center-specific subdomain or include a valid help_center_id parameter.',
                'usage': {
                    'subdomain': 'Access via {subdomain}.help.pillar.bot',
                    'query_param': 'Add ?help_center_id={id} to your request',
                    'header': 'Include X-Help-Center-Id header'
                },
                'platform': {
                    'name': cls.PLATFORM_NAME,
                    'url': cls.PLATFORM_URL,
                    'description': cls.PLATFORM_DESCRIPTION
                }
            }

        service_name = f"{help_center_config.name} Help Center MCP Server"
        message = f"You're talking to {help_center_config.name} Help Center"

        # Build domain from subdomain
        domain = f"{help_center_config.subdomain}.help.pillar.bot"

        response_data = {
            'service': service_name,
            'message': message,
            'version': 'v1',
            'protocol': 'MCP/JSON-RPC',
            'description': cls.DEFAULT_DESCRIPTION,
            'endpoints': {
                'mcp': '/',
                'health': '/health',
                'readiness': '/health/ready'
            },
            'capabilities': cls._get_capabilities(help_center_config=help_center_config),
            'help_center': {
                'name': help_center_config.name,
                'subdomain': help_center_config.subdomain,
                'domain': domain
            },
            'documentation': {
                'mcp_protocol': 'https://modelcontextprotocol.io',
                'examples': cls._get_documentation_examples(help_center_config),
                'usage_notes': {
                    'uri_format': 'Use resources/list to get actual URIs with real help_center_id and resource_id values',
                    'conversation_tracking': 'The ask tool returns a conversation_id that can be used for follow-up questions'
                }
            },
            'platform': {
                'name': cls.PLATFORM_NAME,
                'url': cls.PLATFORM_URL,
                'description': cls.PLATFORM_DESCRIPTION
            }
        }

        return response_data

    @classmethod
    def _get_capabilities(cls, help_center_config=None) -> Dict[str, Any]:
        """
        Get MCP capabilities based on help center content.

        Args:
            help_center_config: HelpCenterConfig model instance

        Returns:
            Capabilities dict with tools and resources
        """
        from apps.knowledge.models import KnowledgeItem

        resources = []
        has_content = False

        if help_center_config:
            # Check for indexed knowledge items
            has_items = KnowledgeItem.objects.filter(
                organization_id=help_center_config.organization_id,
                is_active=True,
                status=KnowledgeItem.Status.INDEXED,
            ).exists()

            if has_items:
                resources.append({
                    'type': 'knowledge_items',
                    'description': 'Indexed knowledge content (pages, documents)',
                    'format': 'markdown'
                })
                has_content = True

        # Build tools list
        tools = []
        if has_content:
            tools.append({
                'name': 'ask',
                'description': 'Ask questions about help center content with AI-powered answers',
                'categories': ['help-center', 'question-answering', 'search']
            })
            tools.append({
                'name': 'keyword_search',
                'description': 'Search articles using keyword matching',
                'categories': ['search', 'keyword']
            })

        # Build features dict
        features = {}
        if has_content:
            features = {
                'keyword_search': True,
                'rag': True,
                'source_citations': True
            }

        return {
            'tools': tools,
            'resources': resources,
            'prompts': [],
            'features': features
        }

    @classmethod
    def _get_documentation_examples(cls, help_center_config=None) -> Dict[str, Any]:
        """
        Get documentation examples.

        Args:
            help_center_config: HelpCenterConfig model instance

        Returns:
            Documentation examples dict
        """
        examples = {
            'ask': {
                'description': 'Ask a question via JSON-RPC streaming',
                'endpoint': 'POST /mcp/',
                'request': {
                    'jsonrpc': '2.0',
                    'method': 'tools/call',
                    'params': {
                        'name': 'ask',
                        'arguments': {
                            'query': 'How do I get started?'
                        }
                    },
                    'id': 'request-id'
                },
                'response': 'SSE stream of events (token, sources, actions, complete)'
            },
            'tool_result': {
                'description': 'Submit client-side tool execution result',
                'endpoint': 'POST /mcp/tool-result/',
                'request': {
                    'conversation_id': 'conversation-id',
                    'tool_call_id': 'tool-call-id',
                    'result': {'key': 'value'},
                    'error': None
                }
            },
            'health': {
                'description': 'Health check',
                'endpoint': 'GET /mcp/health/',
                'response': {'status': 'healthy'}
            }
        }

        return examples


# Singleton instance
server_info_service = ServerInfoService()
