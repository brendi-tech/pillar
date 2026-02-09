"""
Serializers for OrganizationInvitation model.
"""
from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from apps.users.models import OrganizationInvitation
from apps.users.serializers.user import UserSerializer
from apps.users.serializers.organization import OrganizationSerializer


class OrganizationInvitationSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationInvitation model."""
    invited_by = UserSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    is_valid = serializers.SerializerMethodField()
    invitation_link = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvitation
        fields = [
            'id',
            'organization',
            'email',
            'role',
            'invited_by',
            'status',
            'token',
            'expires_at',
            'accepted_at',
            'declined_at',
            'created_at',
            'updated_at',
            'is_valid',
            'invitation_link',
        ]
        read_only_fields = [
            'id',
            'token',
            'status',
            'accepted_at',
            'declined_at',
            'created_at',
            'updated_at',
        ]

    @extend_schema_field(serializers.BooleanField())
    def get_is_valid(self, obj) -> bool:
        """Return whether the invitation is still valid."""
        return obj.is_valid()

    @extend_schema_field(serializers.CharField())
    def get_invitation_link(self, obj) -> str:
        """Return the full invitation link."""
        return f"{settings.ADMIN_URL}/accept-invite?token={obj.token}"


class CreateInvitationSerializer(serializers.Serializer):
    """Serializer for creating invitations."""
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=['admin', 'member'],
        default='member',
        required=False
    )


class AcceptInvitationSerializer(serializers.Serializer):
    """Serializer for accepting invitations."""
    token = serializers.UUIDField(required=True)


class InvitationPreviewSerializer(serializers.ModelSerializer):
    """Public serializer for previewing invitation details (unauthenticated)."""
    invited_by = UserSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    is_valid = serializers.SerializerMethodField()
    user_exists = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvitation
        fields = [
            'email',
            'role',
            'invited_by',
            'organization',
            'expires_at',
            'created_at',
            'is_valid',
            'user_exists',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_is_valid(self, obj) -> bool:
        """Return whether the invitation is still valid."""
        return obj.is_valid()

    @extend_schema_field(serializers.BooleanField())
    def get_user_exists(self, obj) -> bool:
        """Check if a user with this email already exists."""
        from apps.users.models import User
        return User.objects.filter(email=obj.email).exists()


class BulkInvitationSerializer(serializers.Serializer):
    """Serializer for bulk creating invitations."""
    emails = serializers.ListField(
        child=serializers.EmailField(),
        required=True,
        min_length=1,
        help_text='List of email addresses to invite'
    )
    role = serializers.ChoiceField(
        choices=['admin', 'member'],
        default='member',
        required=False,
        help_text='Role to assign to all invited users'
    )


class SkippedInvitationSerializer(serializers.Serializer):
    """Serializer for skipped invitations in bulk invite response."""
    email = serializers.EmailField()
    reason = serializers.CharField()


class FailedInvitationSerializer(serializers.Serializer):
    """Serializer for failed invitations in bulk invite response."""
    email = serializers.EmailField()
    error = serializers.CharField()


class BulkInvitationResultSerializer(serializers.Serializer):
    """Serializer for bulk invitation results."""
    successful = OrganizationInvitationSerializer(many=True)
    skipped = SkippedInvitationSerializer(many=True)
    errors = FailedInvitationSerializer(many=True)
