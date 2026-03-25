"""
OAuth views for Unified.to integrations.
"""
import logging
from asgiref.sync import async_to_sync
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.knowledge.models import KnowledgeSource
from apps.knowledge.services.providers.unified_provider import UnifiedKMSClient

logger = logging.getLogger(__name__)

# Supported integration platforms
SUPPORTED_PLATFORMS = [
    'pylon',
    'zendesk',
    'intercom',
    'freshdesk',
    'helpscout',
    'notion',
    'confluence',
]


@extend_schema(
    summary="Start OAuth flow for integration",
    description="Initiates OAuth flow for connecting a help desk platform via Unified.to.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'platform': {
                    'type': 'string',
                    'enum': SUPPORTED_PLATFORMS,
                    'description': 'Platform to connect (pylon, zendesk, etc.)',
                },
            },
            'required': ['platform'],
        }
    },
    responses={
        200: {
            'description': 'OAuth URL generated',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'source_id': {'type': 'string', 'format': 'uuid'},
                            'oauth_url': {'type': 'string', 'format': 'uri'},
                        },
                    }
                }
            }
        },
        400: {'description': 'Invalid platform'},
        500: {'description': 'Failed to generate OAuth URL'},
    },
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_oauth(request):
    """
    Start OAuth flow for a help desk integration.

    Creates a pending KnowledgeSource and returns the OAuth URL to redirect to.
    After OAuth completes, Unified.to redirects back to our callback endpoint.
    """
    platform = request.data.get('platform', '').lower()

    # Validate platform
    if platform not in SUPPORTED_PLATFORMS:
        return Response(
            {'error': f'Unsupported platform: {platform}. Supported: {", ".join(SUPPORTED_PLATFORMS)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check if Unified.to API key is configured
    unified_api_key = getattr(settings, 'UNIFIED_TO_API_KEY', None)
    if not unified_api_key:
        logger.error("UNIFIED_TO_API_KEY not configured in settings")
        return Response(
            {'error': 'Integration service not configured. Please contact support.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        from apps.products.models import Product
        from common.utils.organization import resolve_organization_from_request

        organization = resolve_organization_from_request(request)

        # Get product from request (required for proper gating)
        product_id = request.query_params.get('product') or request.data.get('product')
        if not product_id:
            return Response(
                {'error': 'Product ID is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            product = Product.objects.get(id=product_id, organization=organization)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Invalid product ID'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create a pending source for this integration
        source = KnowledgeSource.objects.create(
            organization=organization,
            product=product,
            name=f'{platform.title()} Integration',
            source_type=KnowledgeSource.SourceType.INTEGRATION,
            status=KnowledgeSource.Status.PAUSED,  # Paused until OAuth completes
            connection_config={
                'platform': platform,
                'status': 'pending_oauth',
            },
        )

        # Build redirect URL for OAuth callback
        # This should be the frontend URL that handles the callback
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3001')
        redirect_url = f'{base_url}/knowledge/oauth/callback'

        # Get OAuth URL from Unified.to
        client = UnifiedKMSClient()
        oauth_url = async_to_sync(client.create_link_url)(
            integration_type=platform,
            redirect_url=redirect_url,
            state=str(source.id),  # Pass source ID as state
        )

        if not oauth_url:
            # Clean up the source if we couldn't get the OAuth URL
            source.delete()
            return Response(
                {'error': 'Failed to generate OAuth URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(f"Started OAuth flow for {platform}, source={source.id}")

        return Response({
            'source_id': str(source.id),
            'oauth_url': oauth_url,
        })

    except Exception as e:
        logger.error(f"Failed to start OAuth flow: {e}")
        return Response(
            {'error': f'Failed to start OAuth: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@extend_schema(
    summary="Complete OAuth flow",
    description="Callback endpoint for Unified.to to complete the OAuth flow.",
    parameters=[
        OpenApiParameter(name='connection_id', description='Unified.to connection ID', type=str),
        OpenApiParameter(name='state', description='Source ID passed as state', type=str),
    ],
    responses={
        200: {'description': 'OAuth completed successfully'},
        400: {'description': 'Missing required parameters'},
        404: {'description': 'Source not found'},
    },
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_oauth(request):
    """
    Complete OAuth flow after user authorizes.

    This endpoint is called by the frontend after receiving the OAuth callback.
    It updates the source with the Unified.to connection ID.
    """
    connection_id = request.data.get('connection_id')
    source_id = request.data.get('source_id') or request.data.get('state')

    if not connection_id or not source_id:
        return Response(
            {'error': 'Missing connection_id or source_id'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Find the source
        source = KnowledgeSource.objects.get(
            id=source_id,
            organization__in=request.user.organizations.all(),
            source_type=KnowledgeSource.SourceType.INTEGRATION,
        )

        # Get connection details from Unified.to
        client = UnifiedKMSClient()
        connection_details = async_to_sync(client.get_connection)(connection_id)

        # Update source with connection info
        source.connection_config = {
            'unified_connection_id': connection_id,
            'platform': source.connection_config.get('platform', ''),
            'workspace_name': connection_details.get('integration_type', ''),
            'connected_at': connection_details.get('created_at', ''),
            'status': 'connected',
        }
        source.status = KnowledgeSource.Status.ACTIVE
        source.save(update_fields=['connection_config', 'status'])

        logger.info(f"Completed OAuth for source {source.id}, connection={connection_id}")

        # Trigger initial sync
        try:
            from common.task_router import TaskRouter

            TaskRouter.execute(
                'knowledge-sync-source',
                source_id=str(source.id),
                organization_id=str(source.organization_id),
            )
            source.status = KnowledgeSource.Status.SYNCING
            source.save(update_fields=['status'])
        except Exception as sync_err:
            logger.warning(f"Failed to trigger initial sync: {sync_err}")

        return Response({
            'source_id': str(source.id),
            'status': 'connected',
            'message': 'OAuth completed successfully',
        })

    except KnowledgeSource.DoesNotExist:
        return Response(
            {'error': 'Source not found'},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        logger.error(f"Failed to complete OAuth: {e}")
        return Response(
            {'error': f'Failed to complete OAuth: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
