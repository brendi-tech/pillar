"""
Serializers for the products app.
"""
import re
from rest_framework import serializers
from apps.products.models import (
    Product, Platform, Action, ActionExecutionLog, ActionDeployment, SyncSecret,
    Agent,
    AgentOpenAPISource, AgentOpenAPIOperationOverride,
    AgentMCPSource, AgentMCPToolOverride,
)
from apps.knowledge.models import KnowledgeSource
from apps.tools.models import MCPToolSource, OpenAPIToolSource


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product model."""
    
    # Include organization_id for frontend to know which org this product belongs to
    organization_id = serializers.UUIDField(source='organization.id', read_only=True)
    
    # Computed field: true if a sync secret is configured (but never expose the secret itself)
    sync_secret_configured = serializers.SerializerMethodField()
    sync_secrets_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'organization_id', 'name', 'subdomain', 'website_url', 'config',
            'is_default', 'auto_theme_generated', 'show_article_owner',
            'default_language', 'agent_guidance', 'sync_secret_configured', 'sync_secrets_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'organization_id', 'sync_secret_configured', 'sync_secrets_count', 'created_at', 'updated_at']
    
    def get_sync_secret_configured(self, obj):
        """Return True if any sync secret is configured."""
        return obj.sync_secrets.exists()
    
    def get_sync_secrets_count(self, obj):
        """Return the number of sync secrets configured."""
        return obj.sync_secrets.count()


class ProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a Product."""
    
    class Meta:
        model = Product
        fields = ['name', 'subdomain', 'website_url', 'config', 'is_default']


class PlatformSerializer(serializers.ModelSerializer):
    """Serializer for Platform model."""
    
    class Meta:
        model = Platform
        fields = [
            'id', 'data_source', 'platform_type', 'name', 'is_active',
            'config', 'scrape_cadence_hours', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActionSerializer(serializers.ModelSerializer):
    """Serializer for Action model."""
    has_embedding = serializers.SerializerMethodField()
    execution_logs = serializers.SerializerMethodField()
    
    class Meta:
        model = Action
        fields = [
            'id', 'product', 'name', 'description', 'action_type',
            'tool_type', 'channel_compatibility', 'source_type',
            'status', 'implementation_status', 'path_template', 'external_url',
            'data_schema', 'default_data', 'parameter_examples', 'required_context',
            'auto_run', 'auto_complete', 'returns_data',
            'examples', 'has_embedding',
            'execution_count', 'last_executed_at',
            'confirmation_success_count', 'confirmation_failure_count',
            'last_confirmed_at', 'last_confirmation_status', 'last_confirmation_error',
            'execution_logs',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'execution_count', 'last_executed_at',
            'confirmation_success_count', 'confirmation_failure_count',
            'last_confirmed_at', 'last_confirmation_status', 'last_confirmation_error',
            'has_embedding', 'execution_logs', 'created_at', 'updated_at',
        ]

    def get_has_embedding(self, obj):
        return obj.description_embedding is not None
    
    def get_execution_logs(self, obj):
        """Return recent execution logs for detail view only."""
        request = self.context.get('request')
        # Only include logs for detail view (retrieve action), not list view
        if request and request.method == 'GET' and 'pk' in request.parser_context.get('kwargs', {}):
            logs = obj.execution_logs.all()[:20]
            return ActionExecutionLogSerializer(logs, many=True).data
        return []


class ActionExecutionLogSerializer(serializers.ModelSerializer):
    """Serializer for ActionExecutionLog model."""
    
    class Meta:
        model = ActionExecutionLog
        fields = [
            'id', 'action', 'session_id', 'conversation_id',
            'status', 'error_message', 'duration_ms', 'metadata',
            'created_at',
        ]
        read_only_fields = fields


class ActionDeploymentSerializer(serializers.ModelSerializer):
    """Serializer for ActionDeployment model."""
    
    action_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ActionDeployment
        fields = [
            'id', 'product', 'platform', 'version', 'git_sha',
            'is_active', 'deployed_at', 'deployed_by', 'action_count'
        ]
        read_only_fields = ['id', 'deployed_at']
    
    def get_action_count(self, obj):
        """Return the number of actions in this deployment."""
        return obj.action_count


class SyncSecretSerializer(serializers.ModelSerializer):
    """Read serializer for SyncSecret - never exposes the actual secret."""
    
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, allow_null=True)
    
    class Meta:
        model = SyncSecret
        fields = [
            'id', 'name', 'last_four', 'is_active', 'revoked_at',
            'created_at', 'last_used_at', 'created_by_email',
        ]
        read_only_fields = fields


class SyncSecretCreateSerializer(serializers.Serializer):
    """Create serializer for SyncSecret - validates name, auto-generates if omitted."""

    name = serializers.CharField(max_length=50, required=False, default='')
    hostname_hint = serializers.CharField(max_length=100, required=False, default='')

    def validate_name(self, value: str) -> str:
        """Validate secret name format if provided."""
        value = value.lower().strip()
        if not value:
            return ''

        if len(value) > 50:
            raise serializers.ValidationError("Secret name must be 50 characters or less")

        if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$', value):
            raise serializers.ValidationError(
                "Secret name must contain only lowercase letters, numbers, and hyphens, "
                "and cannot start or end with a hyphen"
            )

        return value


ToolSerializer = ActionSerializer
ToolExecutionLogSerializer = ActionExecutionLogSerializer
ToolDeploymentSerializer = ActionDeploymentSerializer


class AgentOpenAPIOperationOverrideSerializer(serializers.Serializer):
    """Nested serializer for per-operation overrides."""

    tool_name = serializers.CharField()
    is_enabled = serializers.BooleanField(required=False, default=None, allow_null=True)
    requires_confirmation = serializers.BooleanField(required=False, default=None, allow_null=True)


class AgentOpenAPISourceConfigSerializer(serializers.Serializer):
    """Read/write serializer for AgentOpenAPISource through-table entries."""

    openapi_source_id = serializers.UUIDField()
    operation_overrides = AgentOpenAPIOperationOverrideSerializer(
        many=True, required=False, default=list,
    )


def _sync_openapi_sources_config(agent: Agent, configs: list[dict]) -> None:
    """Replace all AgentOpenAPISource rows for an agent with the given config."""
    AgentOpenAPISource.objects.filter(agent=agent).delete()
    if not configs:
        return

    source_ids = [c['openapi_source_id'] for c in configs]
    valid_ids = set(
        OpenAPIToolSource.objects.filter(id__in=source_ids).values_list('id', flat=True)
    )

    through_objs = []
    for c in configs:
        sid = c['openapi_source_id']
        if sid not in valid_ids:
            continue
        through_objs.append(AgentOpenAPISource(
            agent=agent,
            openapi_source_id=sid,
        ))

    if not through_objs:
        return

    created = AgentOpenAPISource.objects.bulk_create(through_objs)
    source_id_to_through = {str(obj.openapi_source_id): obj for obj in created}

    override_objs = []
    for c in configs:
        sid = str(c['openapi_source_id'])
        through = source_id_to_through.get(sid)
        if not through:
            continue
        for ov in c.get('operation_overrides', []):
            if ov.get('is_enabled') is None and ov.get('requires_confirmation') is None:
                continue
            override_objs.append(AgentOpenAPIOperationOverride(
                agent_openapi_source=through,
                tool_name=ov['tool_name'],
                is_enabled=ov.get('is_enabled'),
                requires_confirmation=ov.get('requires_confirmation'),
            ))

    if override_objs:
        AgentOpenAPIOperationOverride.objects.bulk_create(override_objs)


class AgentMCPToolOverrideSerializer(serializers.Serializer):
    """Nested serializer for per-tool MCP overrides."""

    tool_name = serializers.CharField()
    is_enabled = serializers.BooleanField(required=False, default=None, allow_null=True)
    requires_confirmation = serializers.BooleanField(required=False, default=None, allow_null=True)


class AgentMCPSourceConfigSerializer(serializers.Serializer):
    """Read/write serializer for AgentMCPSource through-table entries."""

    mcp_source_id = serializers.UUIDField()
    tool_overrides = AgentMCPToolOverrideSerializer(
        many=True, required=False, default=list,
    )


def _sync_mcp_sources_config(agent: Agent, configs: list[dict]) -> None:
    """Replace all AgentMCPSource rows for an agent with the given config."""
    AgentMCPSource.objects.filter(agent=agent).delete()
    if not configs:
        return

    source_ids = [c['mcp_source_id'] for c in configs]
    valid_ids = set(
        MCPToolSource.objects.filter(id__in=source_ids).values_list('id', flat=True)
    )

    through_objs = []
    for c in configs:
        sid = c['mcp_source_id']
        if sid not in valid_ids:
            continue
        through_objs.append(AgentMCPSource(
            agent=agent,
            mcp_source_id=sid,
        ))

    if not through_objs:
        return

    created = AgentMCPSource.objects.bulk_create(through_objs)
    source_id_to_through = {str(obj.mcp_source_id): obj for obj in created}

    override_objs = []
    for c in configs:
        sid = str(c['mcp_source_id'])
        through = source_id_to_through.get(sid)
        if not through:
            continue
        for ov in c.get('tool_overrides', []):
            if ov.get('is_enabled') is None and ov.get('requires_confirmation') is None:
                continue
            override_objs.append(AgentMCPToolOverride(
                agent_mcp_source=through,
                tool_name=ov['tool_name'],
                is_enabled=ov.get('is_enabled'),
                requires_confirmation=ov.get('requires_confirmation'),
            ))

    if override_objs:
        AgentMCPToolOverride.objects.bulk_create(override_objs)


class AgentSerializer(serializers.ModelSerializer):
    """Serializer for Agent CRUD operations."""

    knowledge_source_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='knowledge_sources',
        queryset=KnowledgeSource.objects.all(),
        required=False,
    )
    tool_restriction_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='tool_restrictions',
        queryset=Action.objects.all(),
        required=False,
    )
    tool_allowance_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='tool_allowances',
        queryset=Action.objects.all(),
        required=False,
    )
    mcp_source_ids = serializers.SerializerMethodField()
    mcp_sources_config = AgentMCPSourceConfigSerializer(
        many=True, required=False,
    )

    openapi_source_ids = serializers.SerializerMethodField()
    openapi_sources_config = AgentOpenAPISourceConfigSerializer(
        many=True, required=False,
    )

    class Meta:
        model = Agent
        fields = [
            'id', 'organization', 'product', 'name', 'slug', 'channel', 'is_active',
            'tone', 'guidance_override',
            'tool_scope', 'tool_restriction_ids', 'tool_allowance_ids',
            'tool_context_restrictions',
            'mcp_source_ids', 'mcp_sources_config',
            'openapi_source_ids', 'openapi_sources_config',
            'max_response_tokens', 'include_sources', 'include_suggested_followups',
            'llm_model', 'temperature',
            'channel_config', 'mcp_domain', 'default_language',
            'knowledge_scope', 'knowledge_source_ids',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']

    def get_mcp_source_ids(self, obj) -> list[str]:
        return [
            str(pk) for pk in
            obj.mcp_sources.values_list('id', flat=True)
        ]

    def get_openapi_source_ids(self, obj) -> list[str]:
        return [
            str(pk) for pk in
            obj.openapi_sources.values_list('id', flat=True)
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        openapi_configs = AgentOpenAPISource.objects.filter(
            agent=instance,
        ).prefetch_related('operation_overrides')
        data['openapi_sources_config'] = [
            {
                'openapi_source_id': str(c.openapi_source_id),
                'operation_overrides': [
                    {
                        'tool_name': ov.tool_name,
                        'is_enabled': ov.is_enabled,
                        'requires_confirmation': ov.requires_confirmation,
                    }
                    for ov in c.operation_overrides.all()
                ],
            }
            for c in openapi_configs
        ]

        mcp_configs = AgentMCPSource.objects.filter(
            agent=instance,
        ).prefetch_related('tool_overrides')
        data['mcp_sources_config'] = [
            {
                'mcp_source_id': str(c.mcp_source_id),
                'tool_overrides': [
                    {
                        'tool_name': ov.tool_name,
                        'is_enabled': ov.is_enabled,
                        'requires_confirmation': ov.requires_confirmation,
                    }
                    for ov in c.tool_overrides.all()
                ],
            }
            for c in mcp_configs
        ]

        return data

    def update(self, instance, validated_data):
        openapi_config = validated_data.pop('openapi_sources_config', None)
        mcp_config = validated_data.pop('mcp_sources_config', None)
        instance = super().update(instance, validated_data)
        if openapi_config is not None:
            _sync_openapi_sources_config(instance, openapi_config)
        if mcp_config is not None:
            _sync_mcp_sources_config(instance, mcp_config)
        return instance


class AgentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating an Agent. Channel is required, product resolved from URL."""

    knowledge_source_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='knowledge_sources',
        queryset=KnowledgeSource.objects.all(),
        required=False,
    )
    tool_restriction_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='tool_restrictions',
        queryset=Action.objects.all(),
        required=False,
    )
    tool_allowance_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='tool_allowances',
        queryset=Action.objects.all(),
        required=False,
    )
    mcp_sources_config = AgentMCPSourceConfigSerializer(
        many=True, required=False,
    )
    openapi_sources_config = AgentOpenAPISourceConfigSerializer(
        many=True, required=False,
    )

    class Meta:
        model = Agent
        fields = [
            'name', 'slug', 'channel', 'is_active',
            'tone', 'guidance_override',
            'tool_scope', 'tool_restriction_ids', 'tool_allowance_ids',
            'tool_context_restrictions',
            'mcp_sources_config', 'openapi_sources_config',
            'max_response_tokens', 'include_sources', 'include_suggested_followups',
            'llm_model', 'temperature',
            'channel_config', 'mcp_domain', 'default_language',
            'knowledge_scope', 'knowledge_source_ids',
        ]

    def create(self, validated_data):
        openapi_config = validated_data.pop('openapi_sources_config', None)
        mcp_config = validated_data.pop('mcp_sources_config', None)
        instance = super().create(validated_data)
        if openapi_config:
            _sync_openapi_sources_config(instance, openapi_config)
        if mcp_config:
            _sync_mcp_sources_config(instance, mcp_config)
        return instance
