"""
Serializers for the products app.
"""
import re
from rest_framework import serializers
from apps.products.models import (
    Product, Platform, Action, ActionExecutionLog, ActionDeployment, SyncSecret
)


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
            'id', 'product', 'name', 'description', 'action_type', 'status',
            'implementation_status', 'path_template', 'external_url',
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
        fields = ['id', 'name', 'created_at', 'last_used_at', 'created_by_email']
        read_only_fields = ['id', 'created_at', 'last_used_at', 'created_by_email']


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
