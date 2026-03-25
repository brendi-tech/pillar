"""
Serializers for server-side tool infrastructure.
"""
from rest_framework import serializers

from apps.tools.models import (
    MCPToolConfig,
    MCPToolSource,
    OpenAPIOperationConfig,
    OpenAPIToolSource,
    OpenAPIToolSourceVersion,
    ToolEndpoint,
)


class ToolEndpointSerializer(serializers.ModelSerializer):
    """Read-only serializer for ToolEndpoint status."""

    class Meta:
        model = ToolEndpoint
        fields = [
            'id', 'endpoint_url', 'registered_tools', 'sdk_version',
            'is_active', 'last_call_at', 'last_ping_at', 'last_ping_success',
            'consecutive_failures', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class ToolRegistrationSerializer(serializers.Serializer):
    """Validates incoming SDK tool registration payloads."""

    endpoint_url = serializers.URLField(max_length=500)
    tools = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )
    skills = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=[],
    )
    sdk_version = serializers.CharField(max_length=100, required=False, default='')

    def validate_tools(self, value: list[dict]) -> list[dict]:
        for tool in value:
            if 'name' not in tool:
                raise serializers.ValidationError("Each tool must have a 'name' field.")
            if 'description' not in tool:
                raise serializers.ValidationError(
                    f"Tool '{tool['name']}' must have a 'description' field."
                )
        return value

    def validate_skills(self, value: list[dict]) -> list[dict]:
        for skill in value:
            if 'name' not in skill:
                raise serializers.ValidationError("Each skill must have a 'name' field.")
            if 'description' not in skill:
                raise serializers.ValidationError(
                    f"Skill '{skill.get('name', '?')}' must have a 'description' field."
                )
            if 'content' not in skill:
                raise serializers.ValidationError(
                    f"Skill '{skill['name']}' must have a 'content' field."
                )
        return value


class MCPToolConfigSerializer(serializers.ModelSerializer):
    """Serializer for MCPToolConfig (source-level tool defaults)."""

    class Meta:
        model = MCPToolConfig
        fields = ['id', 'tool_name', 'is_enabled', 'requires_confirmation']
        read_only_fields = ['id', 'tool_name']


class MCPToolSourceSerializer(serializers.ModelSerializer):
    """Read serializer for MCP tool sources."""

    discovered_tools = serializers.SerializerMethodField()
    tool_count = serializers.SerializerMethodField()
    tool_configs = serializers.SerializerMethodField()
    discovered_resources = serializers.SerializerMethodField()
    resource_count = serializers.SerializerMethodField()
    discovered_prompts = serializers.SerializerMethodField()
    prompt_count = serializers.SerializerMethodField()

    class Meta:
        model = MCPToolSource
        fields = [
            'id', 'name', 'slug', 'url', 'auth_type', 'oauth_mode',
            'discovered_tools', 'tool_count', 'tool_configs',
            'discovered_resources', 'resource_count',
            'discovered_prompts', 'prompt_count',
            'last_discovery_at',
            'discovery_status', 'discovery_error',
            'is_active', 'last_ping_at', 'last_ping_success',
            'consecutive_failures', 'created_at', 'updated_at',
            'oauth_status', 'oauth_token_expires_at',
        ]
        read_only_fields = [
            'id', 'discovered_tools', 'tool_count', 'tool_configs',
            'discovered_resources', 'resource_count',
            'discovered_prompts', 'prompt_count',
            'last_discovery_at',
            'discovery_status', 'discovery_error',
            'last_ping_at', 'last_ping_success', 'consecutive_failures',
            'created_at', 'updated_at',
            'oauth_status', 'oauth_token_expires_at',
        ]

    def get_discovered_tools(self, obj) -> list[dict]:
        """Strip embedding vectors from the response to avoid sending large float arrays."""
        return [
            {k: v for k, v in tool.items() if not k.startswith("_")}
            for tool in (obj.discovered_tools or [])
        ]

    def get_tool_count(self, obj) -> int:
        return len(obj.discovered_tools or [])

    def get_tool_configs(self, obj) -> list[dict]:
        configs = obj.tool_configs.all()
        return MCPToolConfigSerializer(configs, many=True).data

    def get_discovered_resources(self, obj) -> list[dict]:
        """Strip embedding vectors from the response."""
        return [
            {k: v for k, v in res.items() if not k.startswith("_")}
            for res in (obj.discovered_resources or [])
        ]

    def get_resource_count(self, obj) -> int:
        return len(obj.discovered_resources or [])

    def get_discovered_prompts(self, obj) -> list[dict]:
        """Strip internal fields from the response."""
        return [
            {k: v for k, v in prompt.items() if not k.startswith("_")}
            for prompt in (obj.discovered_prompts or [])
        ]

    def get_prompt_count(self, obj) -> int:
        return len(obj.discovered_prompts or [])


class MCPToolSourceCreateSerializer(serializers.ModelSerializer):
    """Create/update serializer for MCP tool sources."""

    class Meta:
        model = MCPToolSource
        fields = ['name', 'slug', 'url', 'auth_type', 'auth_credentials', 'oauth_mode']


class OpenAPIToolSourceVersionSerializer(serializers.ModelSerializer):
    """Read-only serializer for OpenAPI spec versions."""

    display_version = serializers.SerializerMethodField()

    class Meta:
        model = OpenAPIToolSourceVersion
        fields = [
            'id', 'version_number', 'spec_version', 'revision', 'label',
            'display_version', 'operation_count', 'spec_format',
            'spec_url', 'created_at',
        ]
        read_only_fields = fields

    def get_display_version(self, obj) -> str:
        return obj.display_version


class OpenAPIToolSourceVersionDetailSerializer(serializers.ModelSerializer):
    """Version serializer including full operations list."""

    display_version = serializers.SerializerMethodField()
    discovered_operations = serializers.JSONField(read_only=True)

    class Meta:
        model = OpenAPIToolSourceVersion
        fields = [
            'id', 'version_number', 'spec_version', 'revision', 'label',
            'display_version', 'operation_count', 'spec_format',
            'spec_url', 'spec_content', 'discovered_operations', 'created_at',
        ]
        read_only_fields = fields

    def get_display_version(self, obj) -> str:
        return obj.display_version


class OpenAPIOperationConfigSerializer(serializers.ModelSerializer):
    """Serializer for OpenAPIOperationConfig (source-level operation defaults)."""

    class Meta:
        model = OpenAPIOperationConfig
        fields = ['id', 'tool_name', 'is_enabled', 'requires_confirmation']
        read_only_fields = ['id', 'tool_name']


class OpenAPIToolSourceSerializer(serializers.ModelSerializer):
    """Read serializer for OpenAPI tool sources."""

    discovered_operations = serializers.SerializerMethodField()
    operation_count = serializers.SerializerMethodField()
    operation_configs = serializers.SerializerMethodField()
    has_spec_content = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    current_version_display = serializers.SerializerMethodField()

    class Meta:
        model = OpenAPIToolSource
        fields = [
            'id', 'name', 'slug', 'spec_url', 'spec_format', 'spec_version',
            'base_url', 'auth_type',
            'discovered_operations', 'operation_count', 'operation_configs',
            'has_spec_content',
            'current_version_number', 'version_count', 'current_version_display',
            'last_discovery_at', 'discovery_status', 'discovery_error',
            'is_active', 'last_ping_at', 'last_ping_success',
            'consecutive_failures', 'created_at', 'updated_at',
            'oauth_client_id',
            'oauth_authorization_endpoint', 'oauth_token_endpoint',
            'oauth_scopes', 'oauth_environments',
            'oauth_token_exchange_url',
        ]
        read_only_fields = [
            'id', 'discovered_operations', 'operation_count', 'operation_configs',
            'has_spec_content',
            'spec_format', 'spec_version',
            'current_version_number', 'version_count', 'current_version_display',
            'last_discovery_at', 'discovery_status', 'discovery_error',
            'last_ping_at', 'last_ping_success', 'consecutive_failures',
            'created_at', 'updated_at',
        ]

    def get_discovered_operations(self, obj) -> list[dict]:
        """Strip embedding vectors from the response."""
        return [
            {k: v for k, v in op.items() if not k.startswith("_")}
            for op in (obj.discovered_operations or [])
        ]

    def get_operation_count(self, obj) -> int:
        return len(obj.discovered_operations or [])

    def get_operation_configs(self, obj) -> list[dict]:
        configs = obj.operation_configs.all()
        return OpenAPIOperationConfigSerializer(configs, many=True).data

    def get_has_spec_content(self, obj) -> bool:
        return bool(obj.spec_content)

    def get_version_count(self, obj) -> int:
        if hasattr(obj, '_version_count'):
            return obj._version_count
        return obj.current_version_number or 0

    def get_current_version_display(self, obj) -> str:
        if not obj.current_version_number:
            return ''
        base = obj.spec_version or f'v{obj.current_version_number}'
        return base


class OpenAPIToolSourceCreateSerializer(serializers.ModelSerializer):
    """Create/update serializer for OpenAPI tool sources."""

    spec_url = serializers.URLField(required=False, allow_blank=True, default='')
    spec_content = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = OpenAPIToolSource
        fields = [
            'name', 'slug', 'spec_url', 'spec_content', 'base_url', 'auth_type',
            'auth_credentials',
            'oauth_client_id', 'oauth_client_secret',
            'oauth_authorization_endpoint', 'oauth_token_endpoint',
            'oauth_scopes', 'oauth_environments',
            'oauth_token_exchange_url',
        ]

    def validate(self, attrs):
        if self.partial and 'spec_url' not in attrs and 'spec_content' not in attrs:
            return attrs

        spec_url = attrs.get('spec_url', '')
        spec_content = attrs.get('spec_content', '')
        if not spec_url and not spec_content:
            raise serializers.ValidationError(
                "Either spec_url or spec_content must be provided."
            )
        if spec_url and spec_content:
            raise serializers.ValidationError(
                "Only one of spec_url or spec_content can be set."
            )
        return attrs
