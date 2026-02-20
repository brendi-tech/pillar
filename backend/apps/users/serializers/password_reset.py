"""
Serializers for password reset flow.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

User = get_user_model()


class PasswordResetRequestSerializer(serializers.Serializer):
    """Validates the email for a password reset request."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Validates uid, token, and new password for password reset confirmation."""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_uid(self, value: str) -> str:
        try:
            uid = force_str(urlsafe_base64_decode(value))
            self._user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Invalid reset link.")
        return value

    def validate_new_password(self, value: str) -> str:
        user = getattr(self, '_user', None)
        validate_password(value, user=user)
        return value
