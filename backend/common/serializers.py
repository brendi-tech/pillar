"""
Common serializers used across the application.
"""
from rest_framework import serializers


class ErrorResponseSerializer(serializers.Serializer):
    """Standard error response format."""
    error = serializers.CharField(help_text="Error message")
    detail = serializers.CharField(required=False, help_text="Additional error details")


class MessageResponseSerializer(serializers.Serializer):
    """Standard message response format."""
    message = serializers.CharField(help_text="Response message")


class StatusResponseSerializer(serializers.Serializer):
    """Standard status response format."""
    status = serializers.CharField(help_text="Status value")
    message = serializers.CharField(required=False, help_text="Optional status message")


class HealthCheckSerializer(serializers.Serializer):
    """Health check response."""
    status = serializers.CharField(help_text="Health status")
    service = serializers.CharField(help_text="Service name")


class ReadinessCheckSerializer(serializers.Serializer):
    """Readiness check response."""
    status = serializers.CharField(help_text="Readiness status")
    checks = serializers.DictField(help_text="Individual check results")


class TokenObtainSerializer(serializers.Serializer):
    """JWT token obtain request."""
    email = serializers.EmailField(help_text="Email address")
    password = serializers.CharField(write_only=True, help_text="Password")


class TokenObtainResponseSerializer(serializers.Serializer):
    """JWT token obtain response."""
    access = serializers.CharField(help_text="JWT access token")
    refresh = serializers.CharField(help_text="JWT refresh token")


class TokenRefreshSerializer(serializers.Serializer):
    """JWT token refresh request."""
    refresh = serializers.CharField(help_text="JWT refresh token")


class TokenRefreshResponseSerializer(serializers.Serializer):
    """JWT token refresh response."""
    access = serializers.CharField(help_text="New JWT access token")
    refresh = serializers.CharField(required=False, help_text="New JWT refresh token (if rotation enabled)")


class ContactSubmissionSerializer(serializers.Serializer):
    """Validate inbound marketing contact form submissions."""

    name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    company = serializers.CharField(max_length=160)
    message = serializers.CharField(max_length=5000)
    source_path = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate_source_path(self, value: str) -> str:
        """Ensure stored source paths stay internal and normalized."""
        if value and not value.startswith('/'):
            raise serializers.ValidationError("Source path must start with '/'.")
        return value
