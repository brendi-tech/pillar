"""
ViewSets for the products app.
"""
import hashlib
import hmac
import json
import logging
import re
import secrets
import uuid
from typing import Optional, Union

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from pydantic import BaseModel, field_validator

from django.utils import timezone

from common.utils.cors import add_cors_headers, is_origin_allowed
from common.services import slack
from apps.products.models import (
    Product, Platform, Action, ActionExecutionLog, ActionDeployment,
    ActionSyncJob, ActionSyncJobStatus, SyncSecret, validate_subdomain, RESERVED_SUBDOMAINS,
    Agent,
)
from common.services.subdomain_generator import SubdomainGeneratorService
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

from common.utils.organization import resolve_organization_from_request
from apps.products.serializers import (
    ProductSerializer, ProductCreateSerializer,
    PlatformSerializer, ActionSerializer,
    ActionExecutionLogSerializer,
    SyncSecretSerializer, SyncSecretCreateSerializer,
    AgentSerializer, AgentCreateSerializer,
)
from apps.users.permissions import IsAuthenticatedAdmin


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Products.
    
    Provides CRUD access to product configurations.
    Use the secrets action to manage sync secrets.
    """
    
    permission_classes = [IsAuthenticatedAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_default']
    
    def get_queryset(self):
        return Product.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ProductCreateSerializer
        if self.action == 'deployments':
            from apps.products.serializers import ActionDeploymentSerializer
            return ActionDeploymentSerializer
        return ProductSerializer
    
    def perform_create(self, serializer):
        organization = resolve_organization_from_request(self.request)
        
        # Auto-generate subdomain if not provided
        subdomain = serializer.validated_data.get('subdomain')
        if not subdomain:
            product_name = serializer.validated_data.get('name', 'product')
            subdomain = self._generate_subdomain(product_name)
        
        serializer.save(organization=organization, subdomain=subdomain)
    
    def _generate_subdomain(self, name: str) -> str:
        """Generate a unique subdomain from a product name, trying clean name first."""
        from common.services.subdomain_generator import SubdomainGeneratorService

        base_subdomain = SubdomainGeneratorService.sanitize_subdomain(name)
        if len(base_subdomain) < 3:
            base_subdomain = f"product-{base_subdomain}" if base_subdomain else "product"

        existing = set(
            Product.objects.values_list('subdomain', flat=True)
        )
        return SubdomainGeneratorService.ensure_unique_subdomain(
            base_subdomain, existing
        )

    def create(self, request, *args, **kwargs):
        """Create a product and return full product data."""
        # Use ProductCreateSerializer for input validation
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return full product data using ProductSerializer
        response_serializer = ProductSerializer(serializer.instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @extend_schema(
        summary="List action deployments",
        description="List all action deployments for this product.",
        parameters=[
            OpenApiParameter('platform', OpenApiTypes.STR, description="Filter by platform (web, ios, android, desktop)"),
        ],
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'count': {'type': 'integer'},
                    'results': {'type': 'array'},
                },
            },
        },
    )
    @action(detail=True, methods=['get'], url_path='deployments')
    def deployments(self, request, pk=None):
        """
        List all action deployments for this product.
        """
        product = self.get_object()
        
        deployments = ActionDeployment.objects.filter(
            product=product
        ).order_by('-deployed_at')
        
        # Filter by platform if provided
        platform = request.query_params.get('platform')
        if platform:
            deployments = deployments.filter(platform=platform)
        
        # Serialize
        from apps.products.serializers import ActionDeploymentSerializer
        serializer = ActionDeploymentSerializer(deployments, many=True)
        
        return Response({
            'count': deployments.count(),
            'results': serializer.data,
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List or create sync secrets",
        description=(
            "GET: List all sync secrets for this product (metadata only, secrets are never exposed). "
            "POST: Create a new named sync secret. The secret is shown ONLY in the response."
        ),
        request=SyncSecretCreateSerializer,
        responses={
            200: SyncSecretSerializer(many=True),
            201: {
                'type': 'object',
                'properties': {
                    'id': {'type': 'string'},
                    'name': {'type': 'string'},
                    'secret': {'type': 'string'},
                    'message': {'type': 'string'},
                },
            },
            400: {'description': 'Invalid name or limit reached'},
        },
    )
    @action(detail=True, methods=['get', 'post'], url_path='secrets')
    def secrets(self, request, pk=None):
        """
        List or create sync secrets.
        
        GET: Returns list of all secrets (without exposing actual secret values).
        POST: Creates a new named secret and returns it once.
        """
        product = self.get_object()
        
        if request.method == 'GET':
            sync_secrets = SyncSecret.objects.filter(product=product).order_by('-created_at')
            serializer = SyncSecretSerializer(sync_secrets, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # POST - create new secret
        serializer = SyncSecretCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data.get('name', '').strip()
        hostname_hint = serializer.validated_data.get('hostname_hint', '').strip()

        if not name:
            prefix = f"cli-{hostname_hint}" if hostname_hint else "cli"
            short_id = secrets.token_hex(3)
            name = f"{prefix}-{short_id}"[:50]

        # Check for duplicate name
        if SyncSecret.objects.filter(product=product, name=name).exists():
            return Response(
                {'error': f'A secret named "{name}" already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce limit of 10 secrets per product
        if product.sync_secrets.count() >= 10:
            return Response(
                {'error': 'Maximum 10 secrets per product. Delete an existing secret first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate prefixed secret key (plr_ + 64-char hex)
        raw_secret = "plr_" + secrets.token_hex(32)

        # Create the sync secret
        sync_secret = SyncSecret.objects.create(
            product=product,
            organization=product.organization,
            name=name,
            secret_hash=raw_secret,
            created_by=request.user,
        )

        return Response({
            'id': str(sync_secret.id),
            'name': sync_secret.name,
            'secret': raw_secret,
            'message': 'Copy this secret now - it will not be shown again!',
        }, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Delete a sync secret",
        description="Revoke/delete a specific sync secret by ID.",
        responses={
            204: None,
            404: {'description': 'Secret not found'},
        },
    )
    @action(detail=True, methods=['delete'], url_path='secrets/(?P<secret_id>[^/.]+)')
    def delete_secret(self, request, pk=None, secret_id=None):
        """
        Delete a specific sync secret.
        
        This revokes the secret - any CI/CD pipelines using it will fail.
        """
        product = self.get_object()
        
        try:
            sync_secret = SyncSecret.objects.get(
                id=secret_id,
                product=product,
                organization=product.organization,
            )
        except SyncSecret.DoesNotExist:
            return Response(
                {'error': 'Secret not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        sync_secret.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        summary="Get MCP connection info",
        description="Returns computed MCP server URL and domain info for this product.",
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'mcp_url': {'type': 'string', 'nullable': True},
                    'subdomain': {'type': 'string', 'nullable': True},
                    'help_center_domain': {'type': 'string'},
                },
            },
        },
    )
    @action(detail=True, methods=['get'], url_path='mcp-info')
    def mcp_info(self, request, pk=None):
        """Return the computed MCP server URL for this product."""
        from django.conf import settings as django_settings

        product = self.get_object()
        help_center_domain = getattr(django_settings, 'HELP_CENTER_DOMAIN', 'help.pillar.io')
        mcp_url = (
            f"https://{product.subdomain}.{help_center_domain}/mcp/"
            if product.subdomain
            else None
        )
        return Response({
            'mcp_url': mcp_url,
            'subdomain': product.subdomain,
            'help_center_domain': help_center_domain,
        })

    @extend_schema(
        summary="Check subdomain availability",
        description=(
            "Check if a subdomain is available for use. "
            "Returns the sanitized subdomain and availability status."
        ),
        parameters=[
            OpenApiParameter(
                'subdomain',
                OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Subdomain to check",
                required=True,
            ),
        ],
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'subdomain': {'type': 'string', 'description': 'Sanitized subdomain'},
                    'available': {'type': 'boolean', 'description': 'Whether subdomain is available'},
                    'valid': {'type': 'boolean', 'description': 'Whether subdomain passes validation'},
                    'error': {'type': 'string', 'description': 'Validation error message if invalid'},
                    'suggestion': {'type': 'string', 'description': 'Suggested alternative if subdomain is taken'},
                },
            },
            400: {'description': 'Missing subdomain parameter'},
        },
    )
    @action(detail=False, methods=['get'], url_path='check-subdomain')
    def check_subdomain(self, request):
        """
        Check if a subdomain is available.
        
        Returns:
        - subdomain: The sanitized/lowercase version of the input
        - available: True if subdomain is not taken
        - valid: True if subdomain passes format validation
        - error: Validation error message (if invalid)
        - suggestion: Alternative subdomain suggestion (if taken)
        """
        subdomain = request.query_params.get('subdomain', '').strip().lower()
        
        if not subdomain:
            return Response(
                {'error': 'subdomain parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Sanitize the subdomain
        sanitized = SubdomainGeneratorService.sanitize_subdomain(subdomain)
        
        # Validate format
        try:
            validate_subdomain(sanitized)
            valid = True
            error = None
        except ValidationError as e:
            valid = False
            error = str(e.message) if hasattr(e, 'message') else str(e.messages[0]) if e.messages else str(e)
        
        # Check availability (only if valid)
        available = False
        suggestion = None
        if valid:
            # Check if subdomain exists (excluding current user's products for update scenarios)
            exists = Product.objects.filter(subdomain=sanitized).exists()
            available = not exists
            
            # If taken, suggest an alternative
            if not available:
                existing_subdomains = set(Product.objects.values_list('subdomain', flat=True))
                suggestion = SubdomainGeneratorService.ensure_unique_subdomain(
                    sanitized, existing_subdomains
                )
        
        return Response({
            'subdomain': sanitized,
            'available': available,
            'valid': valid,
            'error': error,
            'suggestion': suggestion,
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Suggest subdomain from URL",
        description=(
            "Generate a subdomain suggestion from a website URL. "
            "Extracts the domain name and checks availability."
        ),
        parameters=[
            OpenApiParameter(
                'url',
                OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Website URL to generate subdomain from",
                required=True,
            ),
        ],
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'suggestion': {'type': 'string', 'description': 'Suggested subdomain'},
                    'available': {'type': 'boolean', 'description': 'Whether suggestion is available'},
                },
            },
            400: {'description': 'Missing or invalid URL parameter'},
        },
    )
    @action(detail=False, methods=['get'], url_path='suggest-subdomain')
    def suggest_subdomain(self, request):
        """
        Generate a subdomain suggestion from a website URL.
        
        Extracts the base domain name (e.g., "acme" from "https://docs.acme.com")
        and ensures the suggestion is available by adding a suffix if needed.
        """
        url = request.query_params.get('url', '').strip()
        
        if not url:
            return Response(
                {'error': 'url parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract base subdomain suggestion from URL
        base_suggestion = SubdomainGeneratorService.extract_subdomain_from_domain(url)
        
        if not base_suggestion:
            return Response(
                {'error': 'Could not extract domain from URL'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate the base suggestion
        try:
            validate_subdomain(base_suggestion)
        except ValidationError:
            # Handle various validation failures
            original_suggestion = base_suggestion
            
            # If too short, pad it
            if len(base_suggestion) < 3:
                base_suggestion = f"{base_suggestion}-help"
            # If reserved, add suffix to make it unique
            elif base_suggestion in RESERVED_SUBDOMAINS:
                base_suggestion = f"{base_suggestion}-help"
            
            # Re-sanitize
            base_suggestion = SubdomainGeneratorService.sanitize_subdomain(base_suggestion)
            try:
                validate_subdomain(base_suggestion)
            except ValidationError:
                return Response(
                    {'error': f'Could not generate a valid subdomain from URL (tried {original_suggestion})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get all existing subdomains to ensure uniqueness
        existing_subdomains = set(Product.objects.values_list('subdomain', flat=True))
        
        # Ensure the suggestion is unique (adds suffix if needed)
        suggestion = SubdomainGeneratorService.ensure_unique_subdomain(
            base_suggestion, existing_subdomains
        )
        
        return Response({
            'suggestion': suggestion,
            'available': True,  # Always available since we ensure uniqueness
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get SDK integration status",
        description=(
            "Get the current SDK integration status for onboarding. "
            "Returns whether SDK has been initialized, actions registered, and actions executed."
        ),
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'sdk_initialized': {'type': 'boolean', 'description': 'SDK has called embed-config endpoint'},
                    'sdk_initialized_at': {'type': 'string', 'format': 'date-time', 'nullable': True},
                    'actions_registered': {'type': 'boolean', 'description': 'Actions have been synced via CLI'},
                    'action_executed': {'type': 'boolean', 'description': 'At least one action has been executed'},
                },
            },
        },
    )
    @action(detail=True, methods=['get'], url_path='integration-status')
    def integration_status(self, request, pk=None):
        """
        Get SDK integration status for onboarding.
        
        Returns:
        - sdk_initialized: bool - SDK has called embed-config
        - actions_registered: bool - Actions have been synced
        - action_executed: bool - At least one action has been executed
        """
        product = self.get_object()
        
        # Check SDK initialization (initialized if ever called)
        sdk_initialized = product.sdk_last_initialized_at is not None
        
        # Check if actions are registered (any active ActionDeployment exists)
        actions_registered = ActionDeployment.objects.filter(
            product=product, is_active=True
        ).exists()
        
        # Check if any action has been executed
        action_executed = Action.objects.filter(
            product=product, execution_count__gt=0
        ).exists()
        
        # Debug: log action execution counts
        actions_with_counts = list(Action.objects.filter(product=product).values('name', 'execution_count')[:10])
        logger.info(f"[IntegrationStatus] Product {product.subdomain}: actions={actions_with_counts}, action_executed={action_executed}")
        
        return Response({
            'sdk_initialized': sdk_initialized,
            'sdk_initialized_at': product.sdk_last_initialized_at,
            'actions_registered': actions_registered,
            'action_executed': action_executed,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='filter-docs-urls')
    def filter_docs_urls(self, request, pk=None):
        """
        Use LLM to filter candidate docs URLs, keeping only those
        likely belonging to the product (not third-party references).
        """
        product = self.get_object()
        candidate_urls = request.data.get('candidate_urls', [])
        product_name = request.data.get('product_name', product.name)

        if not candidate_urls or not isinstance(candidate_urls, list):
            return Response({'urls': []})

        if len(candidate_urls) == 1:
            return Response({'urls': candidate_urls})

        try:
            from common.utils.llm_client import get_llm_client
            from common.utils.llm_config import LLMConfigService
            from common.utils.json_parser import parse_json_from_llm

            model = LLMConfigService.get_openrouter_model('openai/budget')
            client = get_llm_client()

            urls_list = '\n'.join(f'- {u}' for u in candidate_urls)
            prompt = (
                f"Product name: {product_name}\n\n"
                f"Candidate documentation URLs found in the project:\n{urls_list}\n\n"
                "Which of these URLs are likely the product's OWN documentation, "
                "help center, or knowledge base? Exclude third-party docs "
                "(e.g. Stripe, AWS, Django docs) that are just referenced in the codebase.\n\n"
                "Return a JSON array of the relevant URLs only. "
                "If none are relevant, return an empty array []."
            )

            response = client.complete(
                prompt=prompt,
                model=model,
                temperature=0.0,
                max_tokens=500,
            )
            filtered = parse_json_from_llm(response)
            if isinstance(filtered, list):
                valid = [u for u in filtered if u in candidate_urls]
                return Response({'urls': valid})
        except Exception as e:
            logger.warning(f"[FilterDocsUrls] LLM filtering failed: {e}")

        return Response({'urls': candidate_urls})


class AgentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing per-channel Agent configurations."""

    permission_classes = [IsAuthenticatedAdmin]
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['channel', 'is_active']

    def get_queryset(self):
        qs = Agent.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).select_related('product').order_by('-created_at')

        product_id = self.kwargs.get('product_pk')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return AgentCreateSerializer
        return AgentSerializer

    def perform_create(self, serializer):
        product_id = self.kwargs.get('product_pk')
        if not product_id:
            raise serializers.ValidationError(
                {"product": "Product ID is required. Use the nested URL."}
            )
        product = Product.objects.filter(
            id=product_id,
            organization__in=self.request.user.organizations.all(),
        ).first()
        if not product:
            raise serializers.ValidationError(
                {"product": "Product not found or access denied."}
            )
        serializer.save(product=product, organization=product.organization)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        response_serializer = AgentSerializer(serializer.instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class PlatformViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Platforms."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = PlatformSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['data_source', 'platform_type', 'is_active']
    
    def get_queryset(self):
        return Platform.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-created_at')
    
    def perform_create(self, serializer):
        serializer.save(organization=resolve_organization_from_request(self.request))


class ActionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Actions."""

    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = ActionSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['product', 'action_type', 'tool_type', 'status', 'implementation_status']
    ordering_fields = ['action_type', 'name', 'created_at', 'updated_at', 'status']
    ordering = ['-created_at']
    search_fields = ['name', 'description']

    def get_queryset(self):
        return Action.objects.filter(
            organization__in=self.request.user.organizations.all()
        )
    
    def perform_create(self, serializer):
        serializer.save(organization=resolve_organization_from_request(self.request))
    
    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """
        Execute an action.

        Note: Action execution happens client-side in the SDK.
        This endpoint is reserved for future server-side execution use cases.
        """
        return Response(
            {'error': 'Action execution happens client-side in the SDK'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

    @action(detail=True, methods=['get'], url_path='execution-stats')
    def execution_stats(self, request, pk=None):
        """
        Get aggregated execution statistics for an action.
        
        Returns success/failure counts from ActionExecutionLog.
        """
        from django.db.models import Count, Q, Avg
        
        action = self.get_object()
        
        stats = ActionExecutionLog.objects.filter(action=action).aggregate(
            total_executions=Count('id'),
            success_count=Count('id', filter=Q(status='success')),
            failure_count=Count('id', filter=Q(status='failure')),
            avg_duration_ms=Avg('duration_ms'),
        )
        
        return Response({
            'action_id': str(action.id),
            'total_executions': stats['total_executions'] or 0,
            'success_count': stats['success_count'] or 0,
            'failure_count': stats['failure_count'] or 0,
            'avg_duration_ms': round(stats['avg_duration_ms'] or 0, 2),
        })


class ActionExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing Action execution logs."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = ActionExecutionLogSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['action', 'status']
    
    def get_queryset(self):
        return ActionExecutionLog.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-created_at')


# ============================================================================
# Action Sync API (for CI/CD code-first action definitions)
# ============================================================================


class ActionSyncData(BaseModel):
    """Schema for a single action in the sync payload."""
    name: str
    description: str
    guidance: Optional[str] = None
    examples: Optional[list[str]] = None
    type: str  # action_type
    tool_type: Optional[str] = 'client_side'
    path: Optional[str] = None
    external_url: Optional[str] = None
    auto_run: Optional[bool] = False
    auto_complete: Optional[bool] = False
    returns_data: Optional[bool] = None  # Explicit, or inferred from type=query
    data_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    default_data: Optional[dict] = None
    parameter_examples: Optional[list[dict]] = None  # Examples of valid parameter objects
    required_context: Optional[dict] = None
    channel_compatibility: Optional[list[str]] = None

    @field_validator('type')
    @classmethod
    def validate_action_type(cls, v: str) -> str:
        """Validate action type is one of the allowed values."""
        valid_types = [
            'navigate', 'open_modal', 'fill_form', 'trigger_action',
            'copy_text', 'external_link', 'start_tutorial', 'inline_ui',
            'query',  # Query actions fetch data from client and return to agent
        ]
        if v not in valid_types:
            raise ValueError(f"Invalid action type: {v}. Must be one of {valid_types}")
        return v


class SkillSyncData(BaseModel):
    """Schema for a single skill in the sync payload."""
    name: str
    description: str
    content: str


class ActionSyncRequest(BaseModel):
    """Schema for the sync request payload."""
    platform: str
    version: str
    git_sha: Optional[str] = None
    actions: list[ActionSyncData]
    skills: list[SkillSyncData] = []
    agent_guidance: Optional[str] = None
    mode: str = 'additive'

    @field_validator('platform')
    @classmethod
    def validate_platform(cls, v: str) -> str:
        """Validate platform is one of the allowed values."""
        valid_platforms = ['web', 'ios', 'android', 'desktop']
        if v not in valid_platforms:
            raise ValueError(f"Invalid platform: {v}. Must be one of {valid_platforms}")
        return v

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        valid_modes = ['additive', 'replace']
        if v not in valid_modes:
            raise ValueError(f"Invalid mode: {v}. Must be one of {valid_modes}")
        return v


class ActionSyncView(APIView):
    """
    Sync actions from client-side code definitions.

    Called by CI/CD pipeline during deployment to register
    actions for a specific platform and version.

    POST /api/admin/products/{slug}/actions/sync/
    - Accepts product slug (e.g., "acme-corp")

    Headers:
        X-Pillar-Secret: <secret>

    Body:
        {
            "platform": "web",
            "version": "1.2.3",
            "git_sha": "abc123...",
            "actions": [...]
        }
    """
    # Allow any - we validate via sync secret header
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Sync actions from code",
        description=(
            "Sync actions from client-side code definitions. "
            "Called by CI/CD pipeline during deployment."
        ),
        parameters=[
            OpenApiParameter(
                'X-Pillar-Secret',
                OpenApiTypes.STR,
                location=OpenApiParameter.HEADER,
                description="Secret token for authenticating sync requests",
                required=True,
            ),
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'platform': {'type': 'string', 'enum': ['web', 'ios', 'android', 'desktop']},
                    'version': {'type': 'string'},
                    'git_sha': {'type': 'string'},
                    'actions': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'name': {'type': 'string'},
                                'description': {'type': 'string'},
                                'type': {'type': 'string'},
                                'path': {'type': 'string'},
                                'auto_run': {'type': 'boolean'},
                                'auto_complete': {'type': 'boolean'},
                            },
                        },
                    },
                },
                'required': ['platform', 'version', 'actions'],
            }
        },
        responses={
            201: {
                'type': 'object',
                'properties': {
                    'status': {'type': 'string'},
                    'deployment_id': {'type': 'string'},
                    'version': {'type': 'string'},
                    'actions_count': {'type': 'integer'},
                },
            },
            200: {
                'type': 'object',
                'properties': {
                    'status': {'type': 'string', 'enum': ['unchanged']},
                    'deployment_id': {'type': 'string'},
                    'version': {'type': 'string'},
                },
            },
            401: {'description': 'Invalid or missing sync secret'},
            403: {'description': 'Action sync is not enabled'},
            404: {'description': 'Product not found'},
        },
    )
    def post(self, request, slug=None):
        """
        Sync actions from a client-side manifest.

        Creates or updates Action records and links them to an ActionDeployment
        for the specified platform and version.
        """
        # Get the product by slug
        product = self._get_product(slug)
        if isinstance(product, Response):
            return product  # Error response

        # Validate sync secret
        provided_secret = request.headers.get('X-Pillar-Secret', '')
        if not self._verify_secret(product, provided_secret):
            return Response(
                {'error': 'Invalid or missing sync secret'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Parse and validate request body
        try:
            sync_request = ActionSyncRequest(**request.data)
        except Exception as e:
            return Response(
                {'error': f'Invalid request body: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate manifest hash for deduplication
        manifest_hash = self._hash_manifest(sync_request.actions)
        force_sync = request.query_params.get('force', 'false').lower() == 'true'

        # Check if this exact manifest already exists for this platform
        existing = ActionDeployment.objects.filter(
            product=product,
            platform=sync_request.platform,
            manifest_hash=manifest_hash,
        ).first()

        if existing and not force_sync:
            # Verify the manifest's actions actually exist in the DB.
            # A previous destructive sync or manual deletion could have
            # removed them even though the deployment record remains.
            manifest_action_names = {a.name for a in sync_request.actions}
            existing_action_names = set(
                Action.objects.filter(
                    product=product,
                    organization=product.organization,
                    source_type=Action.SourceType.CLI_SYNC,
                    name__in=manifest_action_names,
                ).values_list('name', flat=True)
            )
            missing_actions = manifest_action_names - existing_action_names

            needs_reconcile = False
            if missing_actions:
                logger.info(
                    f"[ActionSync] Manifest hash matches but {len(missing_actions)} action(s) "
                    f"missing from DB: {missing_actions} — running sync to recreate"
                )
                needs_reconcile = True
            elif sync_request.mode == 'replace':
                # In replace mode, also check for extra actions that need deleting.
                manifest_tool_types = {
                    a.tool_type or 'client_side' for a in sync_request.actions
                }
                current_action_count = Action.objects.filter(
                    product=product,
                    organization=product.organization,
                    source_type=Action.SourceType.CLI_SYNC,
                    tool_type__in=manifest_tool_types,
                ).count()
                
                if current_action_count != len(manifest_action_names):
                    logger.info(
                        f"[ActionSync] Manifest hash matches but action count differs "
                        f"(DB: {current_action_count}, manifest: {len(manifest_action_names)}) — "
                        f"running sync to reconcile"
                    )
                    needs_reconcile = True

            if needs_reconcile:
                pass  # Fall through to run the sync
            else:
                # Even if actions unchanged, update agent_guidance if provided
                if sync_request.agent_guidance is not None:
                    product.agent_guidance = sync_request.agent_guidance
                    product.save(update_fields=['agent_guidance'])
                    logger.info(
                        f"[ActionSync] Updated agent_guidance for {product.subdomain} "
                        f"({len(sync_request.agent_guidance)} chars) - actions unchanged"
                    )

                # Check for actions missing embeddings and backfill them.
                # This handles the case where a previous sync succeeded but
                # embedding generation failed silently — without this, those
                # actions are invisible to search forever.
                missing_embeddings = existing.actions.filter(
                    status=Action.Status.PUBLISHED,
                    description_embedding__isnull=True,
                )
                missing_count = missing_embeddings.count()
                if missing_count > 0:
                    logger.warning(
                        f"[ActionSync] {missing_count} action(s) missing embeddings "
                        f"for {product.subdomain} — backfilling"
                    )
                    try:
                        from common.services.embedding_service import get_embedding_service
                        svc = get_embedding_service()
                        backfilled = 0
                        for act in missing_embeddings:
                            if act.description:
                                act.description_embedding = svc.embed_document(act.description)
                                act.save(update_fields=['description_embedding'])
                                backfilled += 1
                        logger.info(
                            f"[ActionSync] Backfilled embeddings for {backfilled}/{missing_count} actions"
                        )
                    except Exception as e:
                        logger.error(
                            f"[ActionSync] Embedding backfill failed: {e}",
                            exc_info=True,
                        )
                
                logger.info(
                    f"[ActionSync] Manifest unchanged for {product.subdomain} "
                    f"{sync_request.platform}@{sync_request.version}"
                )
                return Response({
                    'status': 'unchanged',
                    'deployment_id': str(existing.id),
                    'version': existing.version,
                }, status=status.HTTP_200_OK)

        # Check if async mode is requested
        use_async = request.query_params.get('async', 'false').lower() == 'true'
        
        if use_async:
            # Async mode: create job and trigger workflow
            return self._handle_async_sync(request, product, sync_request, manifest_hash)

        # Create or update actions
        action_ids = []
        action_names = []
        created_count = 0
        updated_count = 0

        for action_data in sync_request.actions:
            # Validate: query actions MUST return data
            if action_data.type == 'query' and action_data.returns_data is False:
                return Response(
                    {
                        'error': f"Action '{action_data.name}' has type='query' but returns_data=false. "
                                 "Query actions must return data. Either set returns_data=true or change type to 'trigger_action'."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Determine returns_data: explicit value, or True for query actions
            returns_data = action_data.returns_data
            if returns_data is None:
                # Default: query actions always return data
                returns_data = action_data.type == 'query'
            
            action_obj, created = Action.objects.update_or_create(
                product=product,
                name=action_data.name,
                source_type=Action.SourceType.CLI_SYNC,
                defaults={
                    'organization': product.organization,
                    'description': action_data.description,
                    'guidance': action_data.guidance or '',
                    'examples': action_data.examples or [],
                    'action_type': action_data.type,
                    'tool_type': action_data.tool_type or 'client_side',
                    'path_template': action_data.path or '',
                    'external_url': action_data.external_url or '',
                    'auto_run': action_data.auto_run or False,
                    'auto_complete': action_data.auto_complete or False,
                    'returns_data': returns_data,
                    'data_schema': action_data.data_schema or {},
                    'output_schema': action_data.output_schema or {},
                    'default_data': action_data.default_data or {},
                    'parameter_examples': action_data.parameter_examples or [],
                    'required_context': action_data.required_context or {},
                    'channel_compatibility': action_data.channel_compatibility or ['*'],
                    'status': Action.Status.PUBLISHED,
                }
            )
            action_ids.append(action_obj.id)
            action_names.append(action_data.name)
            if created:
                created_count += 1
            else:
                updated_count += 1

        # In replace mode, delete CLI-synced actions of the same tool_type(s)
        # not in the manifest. Scoped by source_type + tool_type so a frontend
        # sync doesn't delete backend tools, manual tools, or MCP tools.
        # In additive mode (default), only create/update — never delete.
        deleted_count = 0
        if sync_request.mode == 'replace':
            synced_tool_types = {
                action_data.tool_type or 'client_side'
                for action_data in sync_request.actions
            }
            deleted_actions = Action.objects.filter(
                product=product,
                organization=product.organization,
                source_type=Action.SourceType.CLI_SYNC,
                tool_type__in=synced_tool_types,
            ).exclude(name__in=action_names)
            
            deleted_names = list(deleted_actions.values_list('name', flat=True))
            deleted_count = deleted_actions.count()
            
            if deleted_count > 0:
                logger.info(
                    f"[ActionSync] Deleting {deleted_count} actions not in manifest: "
                    f"{deleted_names}"
                )
                deleted_actions.delete()

        # Get user agent for tracking
        user_agent = request.headers.get('User-Agent', 'unknown')
        deployed_by = f"ci/{user_agent[:50]}"  # Truncate for DB field

        # Create or update deployment record (same version can be resynced)
        deployment, deployment_created = ActionDeployment.objects.update_or_create(
            product=product,
            organization=product.organization,
            platform=sync_request.platform,
            version=sync_request.version,
            defaults={
                'git_sha': sync_request.git_sha or '',
                'manifest_hash': manifest_hash,
                'deployed_by': deployed_by,
            }
        )
        deployment.actions.set(action_ids)

        # Update agent_guidance on the product if provided
        if sync_request.agent_guidance is not None:
            product.agent_guidance = sync_request.agent_guidance
            product.save(update_fields=['agent_guidance'])
            logger.info(
                f"[ActionSync] Updated agent_guidance for {product.subdomain} "
                f"({len(sync_request.agent_guidance)} chars)"
            )

        logger.info(
            f"[ActionSync] Created deployment for {product.subdomain} "
            f"{sync_request.platform}@{sync_request.version}: "
            f"{created_count} created, {updated_count} updated, {deleted_count} deleted"
        )

        # --- Skill sync ---
        skills_count = 0
        if sync_request.skills:
            from apps.tools.models import RegisteredSkill
            from common.services.embedding_service import get_embedding_service

            embedding_service = get_embedding_service()
            incoming_skill_names = set()

            for skill_data in sync_request.skills:
                incoming_skill_names.add(skill_data.name)
                embedding = embedding_service.embed_document(skill_data.description)

                RegisteredSkill.objects.update_or_create(
                    product=product,
                    name=skill_data.name,
                    defaults={
                        'organization': product.organization,
                        'description': skill_data.description,
                        'content': skill_data.content,
                        'source_type': RegisteredSkill.SourceType.CLI_SYNC,
                        'is_active': True,
                        'description_embedding': embedding,
                        'embedding_model': 'text-embedding-3-small',
                    },
                )
                skills_count += 1

            if sync_request.mode == 'replace':
                RegisteredSkill.objects.filter(
                    product=product,
                    source_type=RegisteredSkill.SourceType.CLI_SYNC,
                    is_active=True,
                ).exclude(name__in=incoming_skill_names).update(is_active=False)

            from apps.mcp.services.prompts.capabilities import invalidate_capabilities_cache
            invalidate_capabilities_cache(str(product.id))

            logger.info(
                "[ActionSync] Synced %d skill(s) for %s",
                skills_count, product.subdomain,
            )

        if created_count > 0:
            try:
                slack.notify_actions_synced(
                    product_name=product.name,
                    organization_name=product.organization.name,
                    created_count=created_count,
                    updated_count=updated_count,
                    deleted_count=deleted_count,
                    platform=sync_request.platform or "",
                    version=sync_request.version or "",
                )
            except Exception as e:
                logger.error(f"[ActionSync] Failed to send Slack notification: {e}")

        return Response({
            'status': 'created',
            'deployment_id': str(deployment.id),
            'version': sync_request.version,
            'actions_count': len(action_ids),
            'skills_count': skills_count,
            'created': created_count,
            'updated': updated_count,
            'deleted': deleted_count,
        }, status=status.HTTP_201_CREATED)

    def _get_product(self, slug: Optional[str]) -> Union[Product, Response]:
        """
        Get the product by slug.

        Returns the product if found, or an error Response if not.
        """
        if not slug:
            return Response(
                {'error': 'Product slug is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            return Product.objects.get(subdomain=slug)
        except Product.DoesNotExist:
            return Response(
                {'error': f'Product not found: {slug}'},
                status=status.HTTP_404_NOT_FOUND
            )

    def _verify_secret(self, product: Product, provided: str) -> bool:
        """Verify against any active secret for this product.
        
        Checks the new multi-secret table first, then falls back to
        the legacy single secret field for backwards compatibility.
        """
        if not provided:
            return False
        
        # Check new multi-secret table first
        for sync_secret in product.sync_secrets.all():
            if hmac.compare_digest(sync_secret.secret_hash, provided):
                # Update last_used_at for audit purposes
                SyncSecret.objects.filter(id=sync_secret.id).update(last_used_at=timezone.now())
                return True
        
        return False

    def _hash_manifest(self, actions: list[ActionSyncData]) -> str:
        """Generate a deterministic hash of the action manifest for deduplication."""
        # Convert to dicts and sort for deterministic serialization
        actions_dicts = [a.model_dump() for a in actions]
        actions_dicts.sort(key=lambda x: x['name'])
        canonical = json.dumps(actions_dicts, sort_keys=True)
        return hashlib.sha256(canonical.encode()).hexdigest()

    def _handle_async_sync(self, request, product: Product, sync_request: ActionSyncRequest, manifest_hash: str) -> Response:
        """Handle async sync by creating a job and triggering workflow."""
        from django.utils import timezone
        from common.task_router import TaskRouter
        
        # Get user agent for tracking
        user_agent = request.headers.get('User-Agent', 'unknown')
        deployed_by = f"ci/{user_agent[:50]}"  # Truncate for DB field
        
        # Create sync job
        job = ActionSyncJob.objects.create(
            product=product,
            organization=product.organization,
            platform=sync_request.platform,
            version=sync_request.version,
            git_sha=sync_request.git_sha or '',
            manifest_hash=manifest_hash,
            status=ActionSyncJobStatus.PENDING,
            progress={
                'total': len(sync_request.actions),
                'processed': 0,
                'created': 0,
                'updated': 0,
                'deleted': 0,
            },
        )
        
        # Prepare workflow input
        # Convert actions to dict format for serialization
        actions_data = [action.model_dump() for action in sync_request.actions]
        
        # Trigger workflow
        try:
            TaskRouter.execute(
                'products-sync-actions',
                organization_id=str(product.organization_id),
                job_id=str(job.id),
                product_id=str(product.id),
                platform=sync_request.platform,
                version=sync_request.version,
                git_sha=sync_request.git_sha or '',
                manifest_hash=manifest_hash,
                actions=actions_data,
                deployed_by=deployed_by,
                agent_guidance=sync_request.agent_guidance,
                mode=sync_request.mode,
            )
        except Exception as e:
            logger.error(f"[ActionSync] Failed to trigger workflow: {e}", exc_info=True)
            job.status = ActionSyncJobStatus.FAILED
            job.error_message = f"Failed to trigger workflow: {str(e)}"
            job.completed_at = timezone.now()
            job.save(update_fields=['status', 'error_message', 'completed_at'])
            return Response(
                {'error': 'Failed to start sync job'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        logger.info(
            f"[ActionSync] Created async job {job.id} for {product.subdomain} "
            f"{sync_request.platform}@{sync_request.version}"
        )
        
        # Return 202 Accepted with job info
        status_url = f"/api/admin/configs/{product.subdomain}/actions/sync/{job.id}/status/"
        return Response({
            'status': 'accepted',
            'job_id': str(job.id),
            'status_url': status_url,
        }, status=status.HTTP_202_ACCEPTED)


class ActionSyncStatusView(APIView):
    """
    Get status of an async action sync job.
    
    GET /api/admin/configs/{slug}/actions/sync/{job_id}/status/
    - Returns job status, progress, and completion info
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get action sync job status",
        description="Get the status and progress of an async action sync job.",
        parameters=[
            OpenApiParameter(
                'X-Pillar-Secret',
                OpenApiTypes.STR,
                location=OpenApiParameter.HEADER,
                description="Secret token for authenticating sync requests",
                required=True,
            ),
        ],
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'status': {'type': 'string', 'enum': ['pending', 'processing', 'completed', 'failed']},
                    'is_complete': {'type': 'boolean'},
                    'progress': {
                        'type': 'object',
                        'properties': {
                            'total': {'type': 'integer'},
                            'processed': {'type': 'integer'},
                            'created': {'type': 'integer'},
                            'updated': {'type': 'integer'},
                            'deleted': {'type': 'integer'},
                        },
                    },
                    'deployment_id': {'type': 'string'},
                    'error': {'type': 'string'},
                },
            },
            401: {'description': 'Invalid or missing sync secret'},
            404: {'description': 'Job not found'},
        },
    )
    def get(self, request, slug=None, job_id=None):
        """Get the status of an async sync job."""
        # Get the product by slug
        product = self._get_product(slug)
        if isinstance(product, Response):
            return product  # Error response

        # Validate sync secret
        provided_secret = request.headers.get('X-Pillar-Secret', '')
        if not self._verify_secret(product, provided_secret):
            return Response(
                {'error': 'Invalid or missing sync secret'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Get the job
        try:
            job = ActionSyncJob.objects.get(
                id=job_id,
                product=product,
                organization=product.organization,
            )
        except ActionSyncJob.DoesNotExist:
            return Response(
                {'error': 'Job not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Build response
        response_data = {
            'status': job.status,
            'is_complete': job.is_complete,
            'progress': job.progress or {},
        }

        # Add deployment ID if completed
        if job.status == ActionSyncJobStatus.COMPLETED and job.deployment:
            response_data['deployment_id'] = str(job.deployment.id)

        # Add error if failed
        if job.status == ActionSyncJobStatus.FAILED:
            response_data['error'] = job.error_message or 'Unknown error'

        return Response(response_data, status=status.HTTP_200_OK)

    def _get_product(self, slug: Optional[str]) -> Union[Product, Response]:
        """Get the product by slug."""
        if not slug:
            return Response(
                {'error': 'Product slug is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            return Product.objects.get(subdomain=slug)
        except Product.DoesNotExist:
            return Response(
                {'error': f'Product not found: {slug}'},
                status=status.HTTP_404_NOT_FOUND
            )

    def _verify_secret(self, product: Product, provided: str) -> bool:
        """Verify against any active secret for this product.
        
        Checks the new multi-secret table first, then falls back to
        the legacy single secret field for backwards compatibility.
        """
        if not provided:
            return False
        
        # Check new multi-secret table first
        for sync_secret in product.sync_secrets.all():
            if hmac.compare_digest(sync_secret.secret_hash, provided):
                # Update last_used_at for audit purposes
                SyncSecret.objects.filter(id=sync_secret.id).update(last_used_at=timezone.now())
                return True
        
        return False


ToolViewSet = ActionViewSet
ToolExecutionLogViewSet = ActionExecutionLogViewSet
ToolSyncView = ActionSyncView
ToolSyncStatusView = ActionSyncStatusView


# ============================================================================
# Public SDK Config API
# ============================================================================


class EmbedConfigView(APIView):
    """
    Public endpoint for SDK to fetch embed configuration.
    
    The SDK calls this on initialization to get admin-configured settings
    (panel, floatingButton, theme) without requiring customers to update
    their integration code.
    
    GET /api/public/products/{subdomain}/embed-config/
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get embed configuration for SDK",
        description=(
            "Public endpoint for the SDK to fetch admin-configured embed settings. "
            "Called during SDK initialization to get panel settings, floating button, "
            "and theme colors."
        ),
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'panel': {
                        'type': 'object',
                        'properties': {
                            'enabled': {'type': 'boolean'},
                            'position': {'type': 'string'},
                            'width': {'type': 'integer'},
                        },
                    },
                    'floatingButton': {
                        'type': 'object',
                        'properties': {
                            'enabled': {'type': 'boolean'},
                            'position': {'type': 'string'},
                            'label': {'type': 'string'},
                        },
                    },
                    'theme': {
                        'type': 'object',
                        'properties': {
                            'colors': {
                                'type': 'object',
                                'properties': {
                                    'primary': {'type': 'string'},
                                },
                            },
                        },
                    },
                },
            },
            404: {'description': 'Product not found'},
        },
    )
    def get(self, request, subdomain):
        """
        Get embed configuration for the SDK.
        
        Returns admin-configured settings that the SDK merges with
        local config during initialization. Includes domain restriction
        status so the SDK can show clear errors on unauthorized domains.
        """
        try:
            product = Product.objects.get(subdomain=subdomain)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Record SDK initialization timestamp
        product.sdk_last_initialized_at = timezone.now()
        product.save(update_fields=['sdk_last_initialized_at', 'updated_at'])

        # Try to resolve the web Agent for this product
        web_agent = Agent.objects.filter(
            product=product, channel='web', is_active=True,
        ).first()

        config = product.config or {}
        branding = config.get('branding', {})
        response_data = {}

        if web_agent and web_agent.channel_config:
            cc = web_agent.channel_config
            if cc.get('assistantName'):
                response_data['assistantDisplayName'] = cc['assistantName']
            if cc.get('inputPlaceholder'):
                response_data['inputPlaceholder'] = cc['inputPlaceholder']
            if cc.get('welcomeMessage'):
                response_data['welcomeMessage'] = cc['welcomeMessage']
            if cc.get('panel'):
                response_data['panel'] = cc['panel']
            if cc.get('floatingButton'):
                response_data['floatingButton'] = cc['floatingButton']
            security = cc.get('security', {})
        else:
            # Fallback to Product.config (pre-migration or unconfigured)
            embed = config.get('embed', {})
            ai_config = config.get('ai', {})
            security = embed.get('security', {})

            if ai_config.get('assistantName'):
                response_data['assistantDisplayName'] = ai_config['assistantName']
            if ai_config.get('inputPlaceholder'):
                response_data['inputPlaceholder'] = ai_config['inputPlaceholder']
            if ai_config.get('welcomeMessage'):
                response_data['welcomeMessage'] = ai_config['welcomeMessage']
            if embed.get('panel'):
                response_data['panel'] = embed['panel']
            if embed.get('floatingButton'):
                response_data['floatingButton'] = embed['floatingButton']

        # Theme/branding always comes from Product (not per-agent)
        primary_color = branding.get('colors', {}).get('primary')
        if primary_color:
            response_data['theme'] = {
                'colors': {
                    'primary': primary_color
                }
            }

        # Domain restriction still comes from Product-level config
        restrict = security.get('restrictToAllowedDomains', False)
        if restrict:
            origin = request.META.get('HTTP_ORIGIN', '')
            allowed_domains = security.get('allowedDomains', [])
            origin_allowed = (
                not origin
                or is_origin_allowed(origin, allowed_domains)
            )
            response_data['security'] = {
                'originAllowed': origin_allowed,
            }

        drf_response = Response(response_data, status=status.HTTP_200_OK)
        drf_response['Vary'] = 'Origin'
        add_cors_headers(drf_response, request, skip_origin_check=True)
        return drf_response


class AgentEmbedConfigView(APIView):
    """
    Public endpoint for SDK to fetch embed config by agent slug.

    GET /api/public/agents/{slug}/embed-config/
    """
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            agent = Agent.objects.select_related('product').get(
                slug=slug, is_active=True,
            )
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        product = agent.product
        product.sdk_last_initialized_at = timezone.now()
        product.save(update_fields=['sdk_last_initialized_at', 'updated_at'])

        config = product.config or {}
        branding = config.get('branding', {})
        response_data = {}

        if agent.channel_config:
            cc = agent.channel_config
            if cc.get('assistantName'):
                response_data['assistantDisplayName'] = cc['assistantName']
            if cc.get('inputPlaceholder'):
                response_data['inputPlaceholder'] = cc['inputPlaceholder']
            if cc.get('welcomeMessage'):
                response_data['welcomeMessage'] = cc['welcomeMessage']
            if cc.get('panel'):
                response_data['panel'] = cc['panel']
            if cc.get('floatingButton'):
                response_data['floatingButton'] = cc['floatingButton']
            security = cc.get('security', {})
        else:
            embed = config.get('embed', {})
            ai_config = config.get('ai', {})
            security = embed.get('security', {})

            if ai_config.get('assistantName'):
                response_data['assistantDisplayName'] = ai_config['assistantName']
            if ai_config.get('inputPlaceholder'):
                response_data['inputPlaceholder'] = ai_config['inputPlaceholder']
            if ai_config.get('welcomeMessage'):
                response_data['welcomeMessage'] = ai_config['welcomeMessage']
            if embed.get('panel'):
                response_data['panel'] = embed['panel']
            if embed.get('floatingButton'):
                response_data['floatingButton'] = embed['floatingButton']

        primary_color = branding.get('colors', {}).get('primary')
        if primary_color:
            response_data['theme'] = {
                'colors': {
                    'primary': primary_color
                }
            }

        restrict = security.get('restrictToAllowedDomains', False)
        if restrict:
            origin = request.META.get('HTTP_ORIGIN', '')
            allowed_domains = security.get('allowedDomains', [])
            origin_allowed = (
                not origin
                or is_origin_allowed(origin, allowed_domains)
            )
            response_data['security'] = {
                'originAllowed': origin_allowed,
            }

        drf_response = Response(response_data, status=status.HTTP_200_OK)
        drf_response['Vary'] = 'Origin'
        add_cors_headers(drf_response, request, skip_origin_check=True)
        return drf_response


class CLIInitView(APIView):
    """
    Generate scaffolding for Pillar SDK integration.

    POST /api/cli/init/

    Accepts project context (framework, file tree, selected file snippets)
    and returns typed file operations for the CLI to apply locally.

    Authentication: JWT (from ``pillar auth login``).
    """

    permission_classes = [IsAuthenticated]

    SUPPORTED_FRAMEWORKS = {
        'nextjs-app', 'nextjs-pages', 'vite-react', 'vue', 'nuxt',
        'angular', 'vanilla',
    }

    MAX_FILE_TREE_ITEMS = 500
    MAX_SNIPPET_BYTES = 50_000

    SYSTEM_PROMPT = """You are a code scaffolding assistant for the Pillar AI copilot SDK.

Given a project's framework, file tree, and selected file contents, generate
the minimal set of file operations to integrate Pillar into the project.

Rules:
- Only output JSON. No prose, no markdown fences.
- Every operation must be one of: {"type": "create_file", "path": "...", "content": "..."}
  or {"type": "update_file", "path": "...", "content": "...", "precondition_snippet": "..."}.
- Paths must be relative to the project root. No leading slash. No ".." segments.
- For update_file, precondition_snippet must be a 1-3 line string that currently
  exists in the file. The CLI will verify it before applying.
- Do NOT create shell scripts or instruct the user to run commands.
- Use the correct SDK import for the framework:
  nextjs-app / nextjs-pages / vite-react → @pillar-ai/react
  vue / nuxt → @pillar-ai/vue (placeholder)
  angular → @pillar-ai/angular (placeholder)
  vanilla → @pillar-ai/sdk
- Create a tools file with 2-3 starter tool definitions using usePillarTool.
- Create or update the provider wrapper (PillarProvider) in the appropriate layout.
- Create a .env.local with PILLAR_SLUG and PILLAR_SECRET placeholders.
- Keep generated code minimal, idiomatic, and production-ready.

Output format — a JSON object:
{
  "operations": [
    {"type": "create_file", "path": "...", "content": "..."},
    ...
  ]
}
"""

    @extend_schema(
        summary="Generate CLI init scaffolding",
        description="Returns typed file operations for SDK integration.",
        request={
            'application/json': {
                'type': 'object',
                'required': ['framework', 'product_key'],
                'properties': {
                    'framework': {
                        'type': 'string',
                        'enum': list(SUPPORTED_FRAMEWORKS),
                    },
                    'framework_version': {'type': 'string'},
                    'product_key': {'type': 'string'},
                    'file_tree': {
                        'type': 'array',
                        'items': {'type': 'string'},
                        'description': 'Relative file paths in the project',
                    },
                    'file_snippets': {
                        'type': 'object',
                        'additionalProperties': {'type': 'string'},
                        'description': 'Map of path → content for key files',
                    },
                },
            },
        },
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'operations': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'type': {
                                    'type': 'string',
                                    'enum': ['create_file', 'update_file'],
                                },
                                'path': {'type': 'string'},
                                'content': {'type': 'string'},
                                'precondition_snippet': {'type': 'string'},
                            },
                        },
                    },
                },
            },
        },
    )
    def post(self, request):
        data = request.data
        framework = data.get('framework')
        product_key = data.get('product_key')
        framework_version = data.get('framework_version', '')
        file_tree = data.get('file_tree', [])
        file_snippets = data.get('file_snippets', {})

        if not framework or framework not in self.SUPPORTED_FRAMEWORKS:
            return Response(
                {'error': f'Invalid framework. Must be one of: {sorted(self.SUPPORTED_FRAMEWORKS)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not product_key:
            return Response(
                {'error': 'product_key is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify product exists and user has access
        try:
            product = Product.objects.filter(
                organization__in=request.user.organizations.all(),
                subdomain=product_key,
            ).get()
        except Product.DoesNotExist:
            return Response(
                {'error': f'Product "{product_key}" not found or not accessible'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Enforce limits
        if len(file_tree) > self.MAX_FILE_TREE_ITEMS:
            file_tree = file_tree[:self.MAX_FILE_TREE_ITEMS]

        total_snippet_bytes = sum(len(v.encode()) for v in file_snippets.values())
        if total_snippet_bytes > self.MAX_SNIPPET_BYTES:
            return Response(
                {'error': f'file_snippets total exceeds {self.MAX_SNIPPET_BYTES} bytes'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_prompt = json.dumps({
            'framework': framework,
            'framework_version': framework_version,
            'product_key': product_key,
            'file_tree': file_tree,
            'file_snippets': file_snippets,
        }, indent=2)

        try:
            from common.utils.llm_client import get_llm_client
            client = get_llm_client()
            raw = client.complete(
                prompt=user_prompt,
                system_prompt=self.SYSTEM_PROMPT,
                max_tokens=4000,
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            result = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("CLI init: LLM returned non-JSON response")
            return Response(
                {'error': 'Failed to generate valid scaffolding. Please retry.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception:
            logger.exception("CLI init: LLM call failed")
            return Response(
                {'error': 'Scaffolding generation failed. Please retry.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        operations = result.get('operations', [])
        validated = self._validate_operations(operations)
        if validated is None:
            return Response(
                {'error': 'LLM returned invalid operations. Please retry.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'operations': validated}, status=status.HTTP_200_OK)

    @staticmethod
    def _validate_operations(operations: list) -> Optional[list]:
        """Validate and sanitize LLM-generated file operations."""
        if not isinstance(operations, list):
            return None

        valid = []
        for op in operations:
            if not isinstance(op, dict):
                continue

            op_type = op.get('type')
            path = op.get('path', '')
            content = op.get('content', '')

            if op_type not in ('create_file', 'update_file'):
                continue
            if not path or not isinstance(path, str):
                continue
            if '..' in path or path.startswith('/'):
                continue
            if not isinstance(content, str):
                continue

            entry = {'type': op_type, 'path': path, 'content': content}
            if op_type == 'update_file':
                snippet = op.get('precondition_snippet', '')
                if isinstance(snippet, str) and snippet:
                    entry['precondition_snippet'] = snippet
            valid.append(entry)

        return valid if valid else None
