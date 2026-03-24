"""Serializers for MCP OAuth models."""
from rest_framework import serializers

from apps.mcp_oauth.models import OAuthProvider


class OAuthProviderSerializer(serializers.ModelSerializer):
    """Read/write serializer for OAuthProvider."""

    class Meta:
        model = OAuthProvider
        fields = [
            'id',
            'product',
            'provider_type',
            'issuer_url',
            'authorization_endpoint',
            'token_endpoint',
            'userinfo_endpoint',
            'client_id',
            'client_secret',
            'scopes',
            'user_id_claim',
            'email_claim',
            'name_claim',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'product', 'created_at', 'updated_at']
        extra_kwargs = {
            'client_secret': {'write_only': True},
            'authorization_endpoint': {'required': False},
            'token_endpoint': {'required': False},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['has_client_secret'] = bool(instance.client_secret)
        return data
