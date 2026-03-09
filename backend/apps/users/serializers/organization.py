"""
Organization serializer.
"""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from apps.users.models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model."""
    member_count = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    is_trial = serializers.BooleanField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'domain',
            'plan', 'subscription_status', 'trial_ends_at',
            'billing_email',
            'member_count', 'is_active', 'is_trial',
            'onboarding_completed_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    @extend_schema_field(serializers.IntegerField())
    def get_member_count(self, obj) -> int:
        return obj.members.count()
