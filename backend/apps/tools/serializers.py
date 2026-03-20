"""
Serializers for server-side tool infrastructure.
"""
from rest_framework import serializers

from apps.tools.models import MCPToolSource, ToolEndpoint


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


class MCPToolSourceSerializer(serializers.ModelSerializer):
    """Read serializer for MCP tool sources."""

    class Meta:
        model = MCPToolSource
        fields = [
            'id', 'name', 'url', 'auth_type',
            'discovered_tools', 'last_discovery_at',
            'discovery_status', 'discovery_error',
            'is_active', 'last_ping_at', 'last_ping_success',
            'consecutive_failures', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'discovered_tools', 'last_discovery_at',
            'discovery_status', 'discovery_error',
            'last_ping_at', 'last_ping_success', 'consecutive_failures',
            'created_at', 'updated_at',
        ]


class MCPToolSourceCreateSerializer(serializers.ModelSerializer):
    """Create/update serializer for MCP tool sources."""

    class Meta:
        model = MCPToolSource
        fields = ['name', 'url', 'auth_type', 'auth_credentials']
