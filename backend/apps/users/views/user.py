"""
UserViewSet for user management.
"""
import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse
from apps.users.models import User, Organization, OrganizationInvitation, OrganizationMembership
from apps.users.serializers import UserSerializer, UserCreateSerializer
from common.serializers import ErrorResponseSerializer
from common.services import slack

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(
        operation_id='users_list',
        tags=['Users'],
        summary='List Users',
        description='Get a list of all users.',
        responses={
            200: OpenApiResponse(response=UserSerializer(many=True), description='List of users'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    ),
    retrieve=extend_schema(
        operation_id='users_retrieve',
        tags=['Users'],
        summary='Get User',
        description='Retrieve a specific user by ID.',
        responses={
            200: OpenApiResponse(response=UserSerializer, description='User details'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='User not found'),
        }
    ),
    create=extend_schema(
        operation_id='users_create',
        tags=['Users'],
        summary='Register User',
        description='Create a new user account. This endpoint does not require authentication.',
        request=UserCreateSerializer,
        responses={
            201: OpenApiResponse(response=UserSerializer, description='User created successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
        }
    ),
    update=extend_schema(
        operation_id='users_update',
        tags=['Users'],
        summary='Update User',
        description='Update a user (requires authentication).',
        request=UserSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='User updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='User not found'),
        }
    ),
    partial_update=extend_schema(
        operation_id='users_partial_update',
        tags=['Users'],
        summary='Partially Update User',
        description='Partially update a user (requires authentication).',
        request=UserSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='User updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='User not found'),
        }
    ),
    destroy=extend_schema(
        operation_id='users_destroy',
        tags=['Users'],
        summary='Delete User',
        description='Delete a user account.',
        responses={
            204: OpenApiResponse(description='User deleted successfully'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
            404: OpenApiResponse(response=ErrorResponseSerializer, description='User not found'),
        }
    ),
)
class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        """
        Create a new user and return JWT tokens.

        Handles invitation token if provided.
        """
        from rest_framework_simplejwt.tokens import RefreshToken

        # Create the user using the serializer
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Check for invitation token and auto-accept if present
        invitation_token = request.data.get('invitation_token')
        joined_via_invitation = False

        if invitation_token:
            try:
                invitation = OrganizationInvitation.objects.select_related(
                    'organization'
                ).get(token=invitation_token, email=user.email)

                if invitation.is_valid():
                    invitation.accept(user)
                    joined_via_invitation = True
                    logger.info(
                        f'Auto-accepted invitation for new user {user.email} '
                        f'to organization {invitation.organization.name}'
                    )
                else:
                    logger.warning(
                        f'Invalid invitation token during signup for {user.email}: '
                        f'status={invitation.status}, expired={invitation.expires_at}'
                    )
            except OrganizationInvitation.DoesNotExist:
                logger.warning(
                    f'Invitation token not found during signup for {user.email}: {invitation_token}'
                )

        # If not joining via invitation, create a new organization for the user
        if not joined_via_invitation:
            from apps.products.models import Product

            # Generate org name from user's name or email
            org_name = user.full_name or user.email.split('@')[0]
            org_name = f"{org_name}'s Organization"

            organization = Organization.objects.create(name=org_name, billing_email=user.email)
            OrganizationMembership.objects.create(
                organization=organization,
                user=user,
                role=OrganizationMembership.Role.ADMIN
            )

            # Create a default Product for the new organization
            from common.services.subdomain_generator import SubdomainGeneratorService

            raw_name = user.full_name or user.email.split('@')[0]
            base_subdomain = SubdomainGeneratorService.sanitize_subdomain(raw_name)
            if len(base_subdomain) < 3:
                base_subdomain = f"org-{base_subdomain}" if base_subdomain else "org"

            existing = set(
                Product.objects.values_list('subdomain', flat=True)
            )
            subdomain = SubdomainGeneratorService.ensure_unique_subdomain(
                base_subdomain, existing
            )

            Product.objects.create(
                organization=organization,
                name=raw_name,
                subdomain=subdomain,
                is_default=True,
            )
            logger.info(
                f'Created organization "{org_name}" and default product for new user {user.email}'
            )

        # Notify team of new signup
        slack.notify_new_signup(
            email=user.email,
            full_name=user.full_name,
            signup_method="email",
        )

        # Send CEO welcome email (fire-and-forget)
        try:
            from apps.users.services.email_service import send_welcome_email
            send_welcome_email(user)
        except Exception:
            logger.exception("Failed to send welcome email to %s", user.email)

        # Serialize user data
        user_serializer = UserSerializer(user, context={'request': request})

        return Response({
            'user': user_serializer.data,
            'token': access_token,
            'refresh': str(refresh),
            'joined_via_invitation': joined_via_invitation,
        }, status=status.HTTP_201_CREATED)

    @extend_schema(
        operation_id='users_me',
        tags=['Users'],
        summary='Get Current User',
        description='Get the current authenticated user profile.',
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Current user profile'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    )
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        operation_id='users_update_profile',
        tags=['Users'],
        summary='Update Current User Profile',
        description='Update the current authenticated user profile.',
        request=UserSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    )
    @action(detail=False, methods=['patch'])
    def update_profile(self, request):
        """Update current user profile."""
        serializer = self.get_serializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        operation_id='users_preferences',
        tags=['Users'],
        summary='Update User Preferences',
        description='Update user preferences like last selected product.',
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'last_selected_product_id': {'type': 'string', 'format': 'uuid'},
                },
            }
        },
        responses={
            200: OpenApiResponse(description='Preferences updated successfully'),
            400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request data'),
            401: OpenApiResponse(response=ErrorResponseSerializer, description='Authentication required'),
        }
    )
    @action(detail=False, methods=['patch'], url_path='me/preferences')
    def preferences(self, request):
        """
        Update user preferences.
        
        Currently supports:
        - last_selected_product_id: UUID of the product to remember as last selected
        """
        from apps.products.models import Product
        
        user = request.user
        data = request.data
        
        # Handle last_selected_product_id
        if 'last_selected_product_id' in data:
            product_id = data['last_selected_product_id']
            
            if product_id is None:
                # Clear the selection
                user.last_selected_product = None
            else:
                # Validate that the product exists and user has access
                try:
                    user_org_ids = user.organizations.values_list('id', flat=True)
                    product = Product.objects.get(
                        id=product_id,
                        organization_id__in=user_org_ids
                    )
                    user.last_selected_product = product
                except Product.DoesNotExist:
                    return Response(
                        {'error': 'Product not found or not accessible'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            user.save(update_fields=['last_selected_product'])
        
        return Response({'status': 'ok'})
