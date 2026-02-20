"""
Views for password reset flow.

Uses Django's built-in token generator for secure, time-limited reset tokens.
"""
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.serializers.password_reset import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)
from apps.users.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)

User = get_user_model()

GENERIC_SUCCESS_MESSAGE = (
    "If an account with that email exists, we've sent password reset instructions."
)


class PasswordResetRequestView(APIView):
    """Request a password reset email.

    Always returns 200 regardless of whether the email exists
    to prevent user enumeration.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            logger.info(f"Password reset requested for non-existent email: {email}")
            return Response(
                {"detail": GENERIC_SUCCESS_MESSAGE},
                status=status.HTTP_200_OK,
            )

        if not user.has_usable_password():
            logger.info(f"Password reset requested for OAuth-only user: {email}")
            return Response(
                {"detail": GENERIC_SUCCESS_MESSAGE},
                status=status.HTTP_200_OK,
            )

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        send_password_reset_email(email=email, uid=uid, token=token)

        return Response(
            {"detail": GENERIC_SUCCESS_MESSAGE},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Confirm a password reset with uid, token, and new password."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer._user
        token = serializer.validated_data['token']

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "This reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        logger.info(f"Password reset completed for user: {user.email}")

        return Response(
            {"detail": "Your password has been reset successfully."},
            status=status.HTTP_200_OK,
        )
