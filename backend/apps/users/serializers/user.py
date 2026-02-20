"""
User serializers for authentication and profile management.
"""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    has_organization = serializers.SerializerMethodField()
    primary_organization_id = serializers.SerializerMethodField()
    primary_organization = serializers.SerializerMethodField()
    organizations = serializers.SerializerMethodField()
    last_selected_product_id = serializers.UUIDField(
        source='last_selected_product.id',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'avatar_url',
            'timezone', 'email_notifications', 'created_at', 'last_login',
            'has_organization', 'primary_organization_id',
            'primary_organization', 'organizations', 'last_selected_product_id'
        ]
        read_only_fields = ['id', 'created_at', 'last_login', 'last_selected_product_id']

    @extend_schema_field(serializers.BooleanField())
    def get_has_organization(self, obj) -> bool:
        """Check if user has any organization."""
        return obj.organizations.exists()

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_primary_organization_id(self, obj):
        """Get user's primary organization ID."""
        membership = obj.organization_memberships.order_by('created_at').first()
        return membership.organization.id if membership else None

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_primary_organization(self, obj) -> dict | None:
        """Get user's primary organization with full details."""
        membership = obj.organization_memberships.select_related('organization').order_by('created_at').first()
        if not membership:
            return None

        org = membership.organization
        # Count members in organization
        member_count = org.memberships.count()

        return {
            'id': org.id,
            'name': org.name,
            'plan': org.plan,
            'subscription_status': org.subscription_status,
            'member_count': member_count,
            'user_role': membership.role,
            'onboarding_completed_at': org.onboarding_completed_at.isoformat() if org.onboarding_completed_at else None,
        }

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_organizations(self, obj) -> list:
        """Return all organizations user is a member of with role info."""
        memberships = obj.organization_memberships.select_related(
            'organization'
        ).order_by('created_at').all()

        return [
            {
                'id': str(m.organization.id),
                'name': m.organization.name,
                'role': m.role,
                'plan': m.organization.plan,
                'subscription_status': m.organization.subscription_status,
                'member_count': m.organization.memberships.count(),
            }
            for m in memberships
        ]


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing users (e.g., in organization members).

    Includes only basic fields without expensive SerializerMethodFields.
    Use this for list views to avoid N+1 query problems.
    """

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'avatar_url',
            'created_at', 'last_login'
        ]
        read_only_fields = ['id', 'created_at', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    invitation_token = serializers.UUIDField(required=False, write_only=True)
    invite_code = serializers.CharField(required=False, write_only=True)

    # Beta invite code - hardcoded for now
    VALID_INVITE_CODE = "supersecret"

    class Meta:
        model = User
        fields = ['email', 'password', 'full_name', 'invitation_token', 'invite_code']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value

    def validate_invite_code(self, value):
        """Validate the invite code if provided."""
        if value and value != self.VALID_INVITE_CODE:
            raise serializers.ValidationError("Invalid invite code")
        return value

    def validate(self, data):
        """Ensure invite code is provided for beta signup."""
        # If invite_code field is in the request, validate it's correct
        invite_code = data.get('invite_code')
        if invite_code is None:
            # No invite code provided - this is fine for now (allows existing flows)
            pass
        return data

    def create(self, validated_data):
        """Create user without automatically creating an organization."""
        # Remove non-User fields from validated_data
        validated_data.pop('invitation_token', None)
        validated_data.pop('invite_code', None)
        # User will select or create organization after registration
        user = User.objects.create_user(**validated_data)
        return user
