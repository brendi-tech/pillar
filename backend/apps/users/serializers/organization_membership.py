"""
OrganizationMembership serializer.
"""
from rest_framework import serializers
from apps.users.models import OrganizationMembership
from .user import UserSerializer, UserListSerializer
from .organization import OrganizationSerializer


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationMembership model."""
    user = UserSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            'id', 'user', 'organization', 'role',
            'invited_by', 'invitation_accepted_at',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class OrganizationMembershipListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing organization members.

    Optimized for performance:
    - Uses UserListSerializer to avoid expensive computed fields
    - Excludes organization field (client already knows which org)
    - Prevents N+1 queries
    """
    user = UserListSerializer(read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            'id', 'user', 'role',
            'invited_by', 'invitation_accepted_at',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
