from rest_framework import serializers

from apps.identity.models import IdentityMapping


class IdentityMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentityMapping
        fields = [
            'id', 'channel', 'channel_user_id', 'external_user_id',
            'email', 'display_name', 'linked_at', 'linked_via',
            'linked_by', 'is_active', 'revoked_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'linked_at', 'linked_via', 'linked_by',
            'is_active', 'revoked_at', 'created_at',
        ]


class IdentityMappingCreateSerializer(serializers.Serializer):
    channel = serializers.CharField(max_length=20)
    channel_user_id = serializers.CharField(max_length=255)
    external_user_id = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, default='')
    display_name = serializers.CharField(max_length=255, required=False, default='')


class IdentityMappingBulkCreateSerializer(serializers.Serializer):
    mappings = IdentityMappingCreateSerializer(many=True)


class LinkRequestSerializer(serializers.Serializer):
    channel = serializers.CharField(max_length=20)
    channel_user_id = serializers.CharField(max_length=255)
    channel_display_name = serializers.CharField(max_length=255, required=False, default='')
    channel_email = serializers.CharField(max_length=255, required=False, default='')


class LinkConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    external_user_id = serializers.CharField(max_length=255)


class ResolveQuerySerializer(serializers.Serializer):
    channel = serializers.CharField(max_length=20)
    channel_user_id = serializers.CharField(max_length=255)
