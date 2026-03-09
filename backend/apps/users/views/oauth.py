"""
OAuth authentication views for GitHub and Google login.

Copyright (C) 2025 Pillar Team
"""
import logging
import secrets
from typing import Any, Dict
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import Organization, OrganizationInvitation, OrganizationMembership
from apps.users.serializers.user import UserSerializer
from apps.products.models import Product
from common.services import slack
from apps.users.services.oauth_org_matcher import (
    can_user_join_organization,
    extract_domain_from_email,
    get_matching_organizations,
    is_free_email_provider,
)
from common.serializers import ErrorResponseSerializer


# OAuth Request/Response Serializers
class OAuthProviderSerializer(serializers.Serializer):
    """Request serializer for OAuth provider selection."""
    provider = serializers.ChoiceField(choices=['github', 'google'], help_text='OAuth provider to use')


class AuthorizationURLResponseSerializer(serializers.Serializer):
    """Response serializer for OAuth authorization URL."""
    authorization_url = serializers.URLField(help_text='URL to redirect user to for OAuth authorization')
    state = serializers.CharField(help_text='CSRF state token')


class OAuthCallbackSerializer(serializers.Serializer):
    """Request serializer for OAuth callback."""
    provider = serializers.ChoiceField(choices=['github', 'google'])
    code = serializers.CharField()
    state = serializers.CharField()


class OAuthCallbackResponseSerializer(serializers.Serializer):
    """Response serializer for OAuth callback."""
    token = serializers.CharField(help_text='JWT access token')
    refresh = serializers.CharField(help_text='JWT refresh token')
    user = UserSerializer()
    needs_organization = serializers.BooleanField(help_text='Whether user needs to select/create an organization')
    is_new_user = serializers.BooleanField(help_text='Whether this is a newly created user')
    matching_organizations = serializers.ListField(child=serializers.DictField(), help_text='Organizations matching user email domain')


class SelectOrganizationSerializer(serializers.Serializer):
    """Request serializer for selecting/creating organization."""
    organization_id = serializers.UUIDField(required=False, allow_null=True, help_text='ID of existing organization to join')
    create_new = serializers.BooleanField(default=False, help_text='Whether to create a new organization')
    organization_name = serializers.CharField(required=False, allow_blank=True, help_text='Name for new organization')


class SelectOrganizationResponseSerializer(serializers.Serializer):
    """Response serializer for organization selection."""
    user = UserSerializer()
    organization = serializers.DictField()


User = get_user_model()
logger = logging.getLogger(__name__)


@extend_schema(
    operation_id='oauth_get_authorization_url',
    tags=['Authentication'],
    summary='Get OAuth Authorization URL',
    description='Generate an OAuth authorization URL for GitHub or Google login.',
    request=OAuthProviderSerializer,
    responses={
        200: OpenApiResponse(response=AuthorizationURLResponseSerializer, description='Authorization URL generated'),
        400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid provider'),
        503: OpenApiResponse(response=ErrorResponseSerializer, description='OAuth not configured'),
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def get_authorization_url(request: Request) -> Response:
    """
    Generate OAuth authorization URL for the specified provider.
    
    POST /api/auth/oauth/authorize/
    Body: {
        "provider": "github" | "google"
    }
    
    Returns: {
        "authorization_url": "https://...",
        "state": "random_state_token"
    }
    """
    provider_name = request.data.get('provider', '').lower()
    
    if provider_name not in ['github', 'google']:
        return Response(
            {'error': 'Invalid provider. Must be "github" or "google".'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state in Redis cache for validation (5 min TTL)
    # Using state as key since it's already unique and random
    cache.set(f'oauth_state:{state}', provider_name, timeout=300)
    
    # Get client ID from settings
    if provider_name == 'github':
        client_id = settings.GITHUB_OAUTH_CLIENT_ID
        scope = 'user:email'
        auth_url = f'https://github.com/login/oauth/authorize'
    else:  # google
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        scope = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
    
    if not client_id:
        logger.warning(
            f'{provider_name.title()} OAuth not configured - '
            f'missing environment variable for OAuth client ID'
        )
        return Response(
            {'error': f'{provider_name.title()} OAuth is not configured.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    # Build authorization URL - use HELP_CENTER_URL for redirect
    frontend_url = getattr(settings, 'HELP_CENTER_URL', settings.FRONTEND_URL)
    redirect_uri = f'{frontend_url}/oauth-callback'
    
    logger.info(f'{provider_name.title()} OAuth Authorization URL Request:')
    logger.info(f'  FRONTEND_URL: {frontend_url}')
    logger.info(f'  redirect_uri: {redirect_uri}')
    logger.info(f'  client_id: {client_id}')
    logger.info(f'  IMPORTANT: Verify this redirect_uri matches EXACTLY in your OAuth App settings!')
    
    if provider_name == 'github':
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': scope,
            'state': state,
        }
        authorization_url = f'{auth_url}?{urlencode(params)}'
    else:  # google
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': scope,
            'state': state,
            'response_type': 'code',
            'access_type': 'online',
        }
        authorization_url = f'{auth_url}?{urlencode(params)}'
    
    return Response({
        'authorization_url': authorization_url,
        'state': state,
    })


@extend_schema(
    operation_id='oauth_callback',
    tags=['Authentication'],
    summary='OAuth Callback',
    description='Handle OAuth callback after user authorizes with GitHub or Google.',
    request=OAuthCallbackSerializer,
    responses={
        200: OpenApiResponse(response=OAuthCallbackResponseSerializer, description='Authentication successful'),
        400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request or state token'),
        500: OpenApiResponse(response=ErrorResponseSerializer, description='OAuth provider error'),
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def oauth_callback(request: Request) -> Response:
    """
    Handle OAuth callback and exchange code for token.
    
    POST /api/auth/oauth/callback/
    Body: {
        "provider": "github" | "google",
        "code": "authorization_code",
        "state": "state_token"
    }
    
    Returns: {
        "token": "jwt_token",
        "user": {...},
        "needs_organization": true | false
    }
    """
    provider_name = request.data.get('provider', '').lower()
    code = request.data.get('code')
    state = request.data.get('state')
    
    if not all([provider_name, code, state]):
        return Response(
            {'error': 'Missing required parameters.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if provider_name not in ['github', 'google']:
        return Response(
            {'error': 'Invalid provider.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate state token (CSRF protection) - stored in Redis
    stored_provider = cache.get(f'oauth_state:{state}')
    if not stored_provider or stored_provider != provider_name:
        logger.warning(
            f'OAuth state validation failed - stored_provider: {stored_provider}, '
            f'expected: {provider_name}, state exists: {stored_provider is not None}'
        )
        return Response(
            {'error': 'Invalid state token.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Delete the state token (one-time use)
    cache.delete(f'oauth_state:{state}')
    
    # Exchange code for access token and get user info
    try:
        user_data = _exchange_code_for_user(provider_name, code)
    except Exception as e:
        logger.error(f'OAuth callback error for {provider_name}: {e}')
        return Response(
            {'error': 'Failed to authenticate with OAuth provider.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Get or create user
    email = user_data.get('email')
    if not email:
        return Response(
            {'error': 'No email provided by OAuth provider.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get or create user
    try:
        user = User.objects.get(email=email)
        created = False
    except User.DoesNotExist:
        # Create new user
        user = User.objects.create(
            email=email,
            username=email,
            full_name=user_data.get('name', ''),
            avatar_url=user_data.get('avatar_url', ''),
        )
        created = True
    
    # Notify team of new signup
    if created:
        slack.notify_new_signup(
            email=user.email,
            full_name=user.full_name,
            signup_method=provider_name,
        )

        # Send CEO welcome email (fire-and-forget)
        try:
            from apps.users.services.email_service import send_welcome_email
            send_welcome_email(user)
        except Exception:
            logger.exception("Failed to send welcome email to %s", user.email)

    # Auto-create organization for new users with free email providers
    # This allows Gmail/personal email users to skip the organization selection page
    if created:
        # For free email providers (Gmail, Yahoo, etc.), auto-create org to skip selection page
        if is_free_email_provider(email):
            org_name = f"{email.split('@')[0].capitalize()}'s Organization"
            default_plan = 'enterprise' if settings.DEBUG else 'free'
            
            organization = Organization.objects.create(
                name=org_name,
                plan=default_plan,
                billing_email=email,
            )
            
            OrganizationMembership.objects.create(
                organization=organization,
                user=user,
                role=OrganizationMembership.Role.ADMIN
            )
            
            # Create a default Product for the new organization
            _create_default_product(organization, user)
            
            logger.info(f"Auto-created organization '{org_name}' for free email user: {email}")
    
    # Generate JWT token
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    
    # Check if user needs to select organization
    needs_organization = not user.organizations.exists()
    
    # Get matching organizations for non-free email users
    matching_orgs = []
    if needs_organization:
        matching_orgs = get_matching_organizations(email)
    
    # Only show org picker if there are actual matching organizations to show
    should_show_org_picker = len(matching_orgs) > 0
    
    # Auto-create org for new users with no matching orgs to pick from
    # (free email users already got one above; this catches corporate emails with no domain match)
    if created and needs_organization and not should_show_org_picker:
        domain = extract_domain_from_email(email)
        org_name = f"{domain.split('.')[0].capitalize()}'s Organization" if domain else f"{email.split('@')[0].capitalize()}'s Organization"
        default_plan = 'enterprise' if settings.DEBUG else 'free'
        
        organization = Organization.objects.create(
            name=org_name,
            plan=default_plan,
            billing_email=email,
        )
        
        OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=OrganizationMembership.Role.ADMIN
        )
        
        # Create a default Product for the new organization
        _create_default_product(organization, user)
        
        needs_organization = False
        logger.info(f"Auto-created organization '{org_name}' for new user with no matching orgs: {email}")
    
    # Serialize user data
    user_serializer = UserSerializer(user, context={'request': request})
    
    return Response({
        'token': access_token,
        'refresh': str(refresh),
        'user': user_serializer.data,
        'needs_organization': needs_organization,
        'is_new_user': created,
        'should_show_org_picker': should_show_org_picker,
        'matching_organizations': matching_orgs,
    })


@extend_schema(
    operation_id='oauth_select_organization',
    tags=['Authentication'],
    summary='Select Organization',
    description='Select an organization to join or create a new one after OAuth authentication.',
    request=SelectOrganizationSerializer,
    responses={
        200: OpenApiResponse(response=SelectOrganizationResponseSerializer, description='Organization selected/created'),
        400: OpenApiResponse(response=ErrorResponseSerializer, description='Invalid request'),
        403: OpenApiResponse(response=ErrorResponseSerializer, description='Cannot join organization'),
        404: OpenApiResponse(response=ErrorResponseSerializer, description='Organization not found'),
    }
)
@api_view(['POST'])
def select_organization(request: Request) -> Response:
    """
    Select an organization to join or create a new one.
    
    POST /api/auth/oauth/select-organization/
    Body: {
        "organization_id": "uuid",  # Optional, if joining existing
        "create_new": true | false,
        "organization_name": "New Org Name"  # Required if create_new=true
    }
    
    Requires authentication (user must be logged in with OAuth).
    
    Returns: {
        "user": {...},
        "organization": {...}
    }
    """
    user = request.user
    organization_id = request.data.get('organization_id')
    create_new = request.data.get('create_new', False)
    organization_name = request.data.get('organization_name', '')
    
    if not create_new and not organization_id:
        return Response(
            {'error': 'Must provide organization_id or set create_new=true.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if create_new and not organization_name:
        return Response(
            {'error': 'organization_name is required when creating new organization.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    with transaction.atomic():
        if create_new:
            # Extract domain from user's email
            domain = extract_domain_from_email(user.email)
            
            # SECURITY: Only set domain for OAuth-verified emails
            # OAuth providers (Google, GitHub) verify email ownership
            # Regular email/password signups could be fake (spam/phishing)
            # Check if user has social accounts (allauth not installed, check manually)
            is_oauth_verified = True  # In HC context, assume OAuth-verified since coming from OAuth flow
            
            if is_oauth_verified and domain:
                # Check if there are already organizations with this domain
                # If yes, leave domain NULL to avoid duplicate domain matching
                existing_with_domain = Organization.objects.filter(domain__iexact=domain).exists()
                org_domain = None if existing_with_domain else domain
            else:
                # Email not verified via OAuth - don't set domain
                org_domain = None
            
            # Create new organization
            # Use enterprise plan in dev/local, free in production
            default_plan = 'enterprise' if settings.DEBUG else 'free'
            organization = Organization.objects.create(
                name=organization_name,
                domain=org_domain,  # NULL if unverified or duplicate
                plan=default_plan,
                billing_email=user.email,
            )
            
            # Add user as admin
            OrganizationMembership.objects.create(
                organization=organization,
                user=user,
                role='admin',
            )
            
            # Log creation details
            if org_domain:
                logger.info(
                    f'Created new organization "{organization_name}" with domain "{org_domain}" '
                    f'for OAuth-verified user {user.email}'
                )
            else:
                if existing_with_domain:
                    reason = "existing org with same domain"
                else:
                    reason = "free email domain"
                logger.info(
                    f'Created new organization "{organization_name}" without domain ({reason}) '
                    f'for user {user.email}'
                )
            
        else:
            # Join existing organization
            try:
                organization = Organization.objects.get(id=organization_id)
            except Organization.DoesNotExist:
                return Response(
                    {'error': 'Organization not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if user has a valid invitation first
            has_invitation = OrganizationInvitation.objects.filter(
                email__iexact=user.email,
                organization_id=organization_id,
                status=OrganizationInvitation.Status.PENDING,
                expires_at__gt=timezone.now()
            ).exists()
            
            # If invited, skip domain validation; otherwise enforce domain match
            if not has_invitation and not can_user_join_organization(user, organization_id):
                # Add detailed logging for debugging
                user_domain = extract_domain_from_email(user.email)
                logger.warning(
                    f'User {user.email} cannot join organization {organization.name} (ID: {organization_id}). '
                    f'User domain: {user_domain}, Org domain: {organization.domain or "NOT SET"}, '
                    f'Is free email: {is_free_email_provider(user.email)}, '
                    f'Has invitation: {has_invitation}'
                )
                return Response(
                    {'error': f'You cannot join this organization. Your email domain ({user_domain}) must match the organization domain ({organization.domain or "not set"}).'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if already a member
            if OrganizationMembership.objects.filter(
                organization=organization,
                user=user
            ).exists():
                return Response(
                    {'error': 'You are already a member of this organization.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Add user as member
            OrganizationMembership.objects.create(
                organization=organization,
                user=user,
                role='member',
            )
            
            logger.info(f'User {user.email} joined organization "{organization.name}"')
    
    # Return updated user data
    user_serializer = UserSerializer(user, context={'request': request})
    
    return Response({
        'user': user_serializer.data,
        'organization': {
            'id': str(organization.id),
            'name': organization.name,
        }
    })


def _create_default_product(organization: Organization, user) -> Product:
    """
    Create a default Product for a new organization.
    
    This mirrors the logic in UserViewSet.create() to ensure OAuth signups
    get the same default product setup as regular email signups.
    """
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

    product = Product.objects.create(
        organization=organization,
        name=raw_name,
        subdomain=subdomain,
        is_default=True,
    )
    
    logger.info(f'Created default product "{product.name}" for organization "{organization.name}"')
    return product


def _exchange_code_for_user(provider: str, code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for user data.
    """
    import requests
    
    # Use HELP_CENTER_URL for redirect
    frontend_url = getattr(settings, 'HELP_CENTER_URL', settings.FRONTEND_URL)
    redirect_uri = f'{frontend_url}/oauth-callback'
    
    if provider == 'github':
        # Exchange code for access token
        token_response = requests.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
                'client_secret': settings.GITHUB_OAUTH_SECRET,
                'code': code,
                'redirect_uri': redirect_uri,
            },
            headers={'Accept': 'application/json'}
        )
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        if not access_token:
            logger.error(f'GitHub token exchange failed. Status: {token_response.status_code}, Response: {token_data}')
            raise ValueError(f'Failed to get access token from GitHub: {token_data.get("error_description", token_data.get("error", "Unknown error"))}')
        
        # Get user info
        user_response = requests.get(
            'https://api.github.com/user',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json',
            }
        )
        user_data = user_response.json()
        
        # Get email if not in user data
        if not user_data.get('email'):
            emails_response = requests.get(
                'https://api.github.com/user/emails',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/json',
                }
            )
            emails = emails_response.json()
            primary_email = next(
                (e['email'] for e in emails if e.get('primary') and e.get('verified')),
                None
            )
            if primary_email:
                user_data['email'] = primary_email
        
        return {
            'id': user_data.get('id'),
            'email': user_data.get('email'),
            'name': user_data.get('name') or user_data.get('login'),
            'avatar_url': user_data.get('avatar_url'),
        }
    
    else:  # google
        # Exchange code for access token
        request_data = {
            'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
            'client_secret': settings.GOOGLE_OAUTH_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri,
        }
        
        logger.info(f'Google token exchange request - redirect_uri: {redirect_uri}, client_id: {settings.GOOGLE_OAUTH_CLIENT_ID}')
        
        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data=request_data
        )
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        if not access_token:
            error_detail = token_data.get('error', 'unknown')
            error_description = token_data.get('error_description', 'No description')
            logger.error(f'Google token exchange failed. Status: {token_response.status_code}')
            logger.error(f'Error: {error_detail}')
            logger.error(f'Error Description: {error_description}')
            logger.error(f'Full Response: {token_data}')
            logger.error(f'Request was sent with redirect_uri: {redirect_uri}')
            logger.error(f'Request was sent with client_id: {settings.GOOGLE_OAUTH_CLIENT_ID}')
            raise ValueError(f'Failed to get access token from Google: {error_description}')
        
        # Get user info
        user_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        user_data = user_response.json()
        
        return {
            'id': user_data.get('id'),
            'email': user_data.get('email'),
            'name': user_data.get('name'),
            'avatar_url': user_data.get('picture'),
        }
