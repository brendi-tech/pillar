"""
Custom authentication views with OpenAPI schema.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from drf_spectacular.utils import extend_schema, OpenApiResponse
from common.serializers import (
    TokenObtainSerializer,
    TokenObtainResponseSerializer,
    TokenRefreshSerializer,
    TokenRefreshResponseSerializer,
    ErrorResponseSerializer,
)

User = get_user_model()


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that uses email instead of username."""
    username_field = 'email'


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token obtain view with OpenAPI schema."""
    serializer_class = EmailTokenObtainPairSerializer

    @extend_schema(
        operation_id='auth_token_obtain',
        tags=['Authentication'],
        summary='Obtain JWT Token',
        description='Authenticate with email and password to obtain JWT access and refresh tokens.',
        request=TokenObtainSerializer,
        responses={
            200: OpenApiResponse(
                response=TokenObtainResponseSerializer,
                description='Login successful, JWT tokens returned'
            ),
            400: OpenApiResponse(
                response=ErrorResponseSerializer,
                description='Invalid request data'
            ),
            401: OpenApiResponse(
                response=ErrorResponseSerializer,
                description='Invalid credentials or account disabled'
            ),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class CustomTokenRefreshView(TokenRefreshView):
    """Custom JWT token refresh view with OpenAPI schema."""

    @extend_schema(
        operation_id='auth_token_refresh',
        tags=['Authentication'],
        summary='Refresh JWT Token',
        description='Use a refresh token to obtain a new access token.',
        request=TokenRefreshSerializer,
        responses={
            200: OpenApiResponse(
                response=TokenRefreshResponseSerializer,
                description='Token refreshed successfully'
            ),
            400: OpenApiResponse(
                response=ErrorResponseSerializer,
                description='Invalid request data'
            ),
            401: OpenApiResponse(
                response=ErrorResponseSerializer,
                description='Invalid or expired refresh token'
            ),
        }
    )
    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except User.DoesNotExist:
            # Handle case where token references a deleted/non-existent user
            raise InvalidToken({
                'detail': 'Token is invalid or expired',
                'code': 'token_user_not_found'
            })


class LogoutView(APIView):
    """
    Logout view that invalidates the refresh token.
    For JWT-based auth, this blacklists the refresh token if provided.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id='auth_logout',
        tags=['Authentication'],
        summary='Logout',
        description='Logout and invalidate the refresh token.',
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'refresh': {
                        'type': 'string',
                        'description': 'Optional refresh token to blacklist'
                    }
                }
            }
        },
        responses={
            200: OpenApiResponse(
                description='Logout successful'
            ),
            401: OpenApiResponse(
                response=ErrorResponseSerializer,
                description='Authentication required'
            ),
        }
    )
    def post(self, request):
        try:
            # If refresh token is provided, blacklist it
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            # Even if blacklisting fails, we still want to return success
            # since the client will delete the token anyway
            pass

        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_200_OK
        )
