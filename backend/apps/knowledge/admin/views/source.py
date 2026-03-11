"""
KnowledgeSource ViewSet.
"""
import logging
from asgiref.sync import async_to_sync
from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.knowledge.models import KnowledgeSource, KnowledgeItem, KnowledgeSyncHistory
from apps.products.models import Product
from apps.knowledge.admin.views.mixins import ProductResolveMixin
from apps.knowledge.admin.serializers import (
    KnowledgeSourceSerializer,
    KnowledgeSourceCreateSerializer,
    KnowledgeSourceListSerializer,
    KnowledgeItemListSerializer,
    KnowledgeSyncHistorySerializer,
)

logger = logging.getLogger(__name__)


class KnowledgeSourceFilter(filters.FilterSet):
    """Filters for knowledge sources."""

    source_type = filters.ChoiceFilter(choices=KnowledgeSource.SourceType.choices)
    status = filters.ChoiceFilter(choices=KnowledgeSource.Status.choices)

    class Meta:
        model = KnowledgeSource
        fields = ['source_type', 'status']


@extend_schema_view(
    list=extend_schema(summary="List knowledge sources"),
    retrieve=extend_schema(summary="Get knowledge source details"),
    create=extend_schema(summary="Create knowledge source"),
    partial_update=extend_schema(summary="Update knowledge source"),
    destroy=extend_schema(summary="Delete knowledge source"),
)
class SourceViewSet(ProductResolveMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing knowledge sources.

    Provides CRUD operations and sync action.
    """

    permission_classes = [IsAuthenticated]
    filterset_class = KnowledgeSourceFilter
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        """Filter sources by user's organizations and product with computed item counts.

        Product is required for list/create; detail actions (retrieve, update,
        sync, sync-history, etc.) only need org scoping since the source is
        already identified by pk.
        """
        user_orgs = self.request.user.organizations.all()
        product_param = self.request.query_params.get('product')

        if product_param:
            product = self._resolve_product()
            queryset = KnowledgeSource.objects.filter(
                organization__in=user_orgs, product=product
            )
        elif self.action in ('list', 'create'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'product': 'Product ID is required.'})
        else:
            queryset = KnowledgeSource.objects.filter(organization__in=user_orgs)

        return queryset.annotate(
            live_item_count=Count('items'),
            live_indexed_count=Count(
                'items',
                filter=Q(items__status=KnowledgeItem.Status.INDEXED)
            ),
        ).order_by('name')

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return KnowledgeSourceListSerializer
        if self.action == 'create':
            return KnowledgeSourceCreateSerializer
        return KnowledgeSourceSerializer

    @extend_schema(
        summary="Sync knowledge source",
        description="Trigger a sync/crawl for this knowledge source. Pass restart=true to stop the current sync (if any) and start a new one.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {'restart': {'type': 'boolean', 'description': 'If true and source is syncing, cancel and start a fresh sync.'}},
            }
        },
        responses={
            202: {"description": "Sync started"},
            400: {"description": "Source cannot be synced"},
        }
    )
    @action(detail=True, methods=['post'], url_path='sync')
    def sync(self, request, pk=None):
        """Trigger a sync for this source."""
        source = self.get_object()
        restart = request.data.get('restart') is True

        # Can't sync snippets source
        if source.source_type == KnowledgeSource.SourceType.SNIPPETS:
            return Response(
                {'error': 'Snippet sources cannot be synced.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # If already syncing, only allow if restart requested
        if source.status == KnowledgeSource.Status.SYNCING:
            if not restart:
                return Response(
                    {'error': 'Source is already syncing.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Stop current sync: reset status and clear crawl state so workflow sees "not syncing"
            source.status = KnowledgeSource.Status.ACTIVE
            source.error_message = ''
            if source.crawl_config:
                crawl_config = dict(source.crawl_config)
                for key in ('firecrawl_job_id', 'sync_history_id', 'crawl_started_at', 'pages_discovered', 'pages_processed'):
                    crawl_config.pop(key, None)
                source.crawl_config = crawl_config
            source.save(update_fields=['status', 'error_message', 'crawl_config'])
            # Mark any running sync history as failed so UI shows clean history
            running = source.sync_history.filter(status=KnowledgeSyncHistory.Status.RUNNING).order_by('-started_at').first()
            if running:
                running.mark_failed('Cancelled (restart requested)')
            logger.info(f"Restarting sync for source {source.id}: cleared syncing state")

        # Trigger sync workflow
        try:
            from common.task_router import TaskRouter
            from django.utils import timezone

            # Create sync history immediately for URL-based sources so it appears in the UI
            # before the worker runs. Worker will use this record and update it.
            sync_history_id = None
            if source.source_type in (
                KnowledgeSource.SourceType.HELP_CENTER,
                KnowledgeSource.SourceType.MARKETING_SITE,
                KnowledgeSource.SourceType.WEBSITE_CRAWL,
            ):
                sync_history = KnowledgeSyncHistory.objects.create(
                    organization=source.organization,
                    source=source,
                    sync_type=KnowledgeSyncHistory.SyncType.FULL,
                    status=KnowledgeSyncHistory.Status.RUNNING,
                    started_at=timezone.now(),
                )
                sync_history_id = str(sync_history.id)

            TaskRouter.execute(
                'knowledge-sync-source',
                source_id=str(source.id),
                organization_id=str(source.organization_id),
                sync_history_id=sync_history_id,
            )

            # Update status
            source.status = KnowledgeSource.Status.SYNCING
            source.save(update_fields=['status'])

            logger.info(f"Triggered sync for source {source.id}: {source.name}")

            return Response(
                {'status': 'sync_started', 'source_id': str(source.id)},
                status=status.HTTP_202_ACCEPTED
            )

        except Exception as e:
            logger.error(f"Failed to trigger sync for source {source.id}: {e}")
            return Response(
                {'error': f'Failed to start sync: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get sync history",
        description="Get the sync history for this knowledge source.",
        responses={
            200: KnowledgeSyncHistorySerializer(many=True),
        }
    )
    @action(detail=True, methods=['get'], url_path='sync-history')
    def sync_history(self, request, pk=None):
        """Get sync history for this source."""
        source = self.get_object()
        history = source.sync_history.order_by('-created_at')[:20]
        serializer = KnowledgeSyncHistorySerializer(history, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Test cloud storage connection",
        description="Test connection to S3 or GCS bucket before creating a source.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'provider': {'type': 'string', 'enum': ['s3', 'gcs']},
                    'bucket': {'type': 'string'},
                    'prefix': {'type': 'string'},
                    'region': {'type': 'string'},
                    'access_key': {'type': 'string'},
                    'secret_key': {'type': 'string'},
                    'credentials_json': {'type': 'string'},
                },
                'required': ['provider', 'bucket'],
            }
        },
        responses={
            200: {
                'description': 'Connection test result',
                'content': {
                    'application/json': {
                        'schema': {
                            'type': 'object',
                            'properties': {
                                'valid': {'type': 'boolean'},
                                'error': {'type': 'string'},
                                'objects_found': {'type': 'integer'},
                                'supported_files': {'type': 'integer'},
                            },
                        }
                    }
                }
            },
            400: {'description': 'Invalid configuration'},
        }
    )
    @action(detail=False, methods=['post'], url_path='test-connection')
    def test_connection(self, request):
        """Test cloud storage connection before creating source."""
        config = request.data

        # Validate required fields
        provider = config.get('provider')
        bucket = config.get('bucket')

        if not provider or provider not in ('s3', 'gcs'):
            return Response(
                {'valid': False, 'error': 'Provider must be "s3" or "gcs"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not bucket:
            return Response(
                {'valid': False, 'error': 'Bucket name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate provider-specific fields
        if provider == 's3':
            if not config.get('access_key') or not config.get('secret_key'):
                return Response(
                    {'valid': False, 'error': 'Access key and secret key are required for S3'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif provider == 'gcs':
            if not config.get('credentials_json'):
                return Response(
                    {'valid': False, 'error': 'Service account JSON is required for GCS'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            from apps.knowledge.services.providers.cloud_storage_provider import (
                CloudStorageProvider,
                SUPPORTED_EXTENSIONS,
            )

            # Create a mock source to test with
            class MockSource:
                def __init__(self, connection_config):
                    self.connection_config = connection_config
                    self.source_type = 'cloud_storage'

            # For testing, we don't encrypt - the provider will use raw values
            # Note: credentials are NOT encrypted during test, only on save
            mock_source = MockSource(config)
            provider_instance = CloudStorageProvider()

            # Use sync version of validate_config
            result = async_to_sync(provider_instance.validate_config)(mock_source)

            if result.valid:
                # Try to count objects and supported files
                try:
                    client = provider_instance._get_client(config)
                    # List up to 1000 objects to get a good sample
                    # Note: Both S3 and GCS list recursively by default (no delimiter)
                    objects = async_to_sync(client.list_objects)(
                        prefix=config.get('prefix', ''),
                        max_keys=1000,
                    )
                    
                    # Log raw results for debugging
                    logger.info(
                        f"Test connection found {len(objects)} raw objects. "
                        f"Sample keys: {[obj.key for obj in objects[:10]]}"
                    )
                    
                    # Filter out folder markers (size 0 objects ending with /)
                    real_files = [
                        obj for obj in objects
                        if obj.size > 0 and not obj.key.endswith('/')
                    ]
                    total_objects = len(real_files)
                    supported_files = sum(
                        1 for obj in real_files
                        if any(obj.key.lower().endswith(ext) for ext in SUPPORTED_EXTENSIONS)
                    )
                    
                    logger.info(
                        f"After filtering: {total_objects} real files, "
                        f"{supported_files} supported files"
                    )
                    
                    return Response({
                        'valid': True,
                        'objects_found': total_objects,
                        'supported_files': supported_files,
                    })
                except Exception as count_err:
                    logger.warning(f"Could not count objects: {count_err}")
                    return Response({'valid': True, 'objects_found': 0, 'supported_files': 0})
            else:
                return Response({'valid': False, 'error': result.error})

        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return Response({'valid': False, 'error': str(e)})

    @extend_schema(
        summary="Upload document to source",
        description="Upload a document file to a document_upload source.",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'file': {'type': 'string', 'format': 'binary'},
                },
                'required': ['file'],
            }
        },
        responses={
            201: {
                'description': 'Document uploaded',
                'content': {
                    'application/json': {
                        'schema': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'string', 'format': 'uuid'},
                                'source': {'type': 'string', 'format': 'uuid'},
                                'title': {'type': 'string'},
                                'status': {'type': 'string'},
                            },
                        }
                    }
                }
            },
            400: {'description': 'Invalid file or source type'},
            404: {'description': 'Source not found'},
        }
    )
    @action(detail=True, methods=['post'], url_path='upload', parser_classes=[MultiPartParser])
    def upload(self, request, pk=None):
        """Upload a document to a document_upload source."""
        source = self.get_object()

        # Verify source type
        if source.source_type != KnowledgeSource.SourceType.DOCUMENT_UPLOAD:
            return Response(
                {'error': 'Only document_upload sources accept file uploads'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get file from request
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.knowledge.services.providers.document_upload_provider import (
                DocumentUploadProvider,
                validate_upload_file,
            )

            # Validate file
            is_valid, error_msg = validate_upload_file(file)
            if not is_valid:
                return Response(
                    {'error': error_msg},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Handle upload (sync - saves file, creates item, returns immediately)
            # Text extraction and processing happen in background
            item = DocumentUploadProvider.handle_upload(source, file)

            logger.info(f"Uploaded document {file.name} to source {source.id}")

            return Response({
                'id': str(item.id),
                'source': str(source.id),
                'title': item.title,
                'status': item.status,
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return Response(
                {'error': f'Upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Search sources and items",
        description=(
            "Search knowledge items by title/URL, including all items from "
            "sources whose name matches. Returns a flat paginated list of items "
            "grouped by source on the client."
        ),
        parameters=[
            {
                'name': 'q',
                'in': 'query',
                'required': True,
                'schema': {'type': 'string', 'minLength': 2},
                'description': 'Search query (min 2 characters)',
            },
        ],
        responses={200: KnowledgeItemListSerializer(many=True)},
    )
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search items by title/url and by source name, returned as a flat paginated list."""
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response(
                {'error': 'Query parameter "q" must be at least 2 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        base_sources = self.get_queryset()

        # Items matching by title or URL
        item_matches = Q(title__icontains=query) | Q(url__icontains=query)
        # Items belonging to sources whose name matches
        source_name_matches = Q(source__name__icontains=query)

        matching_items = (
            KnowledgeItem.objects.filter(source__in=base_sources)
            .filter(item_matches | source_name_matches)
        )

        # Per-source total counts (clean queryset without ordering/distinct)
        source_counts = dict(
            matching_items
            .values('source_id')
            .annotate(cnt=Count('id'))
            .values_list('source_id', 'cnt')
        )

        items_qs = (
            matching_items
            .select_related('source')
            .order_by('source__name', '-created_at')
            .distinct()
        )

        page = self.paginate_queryset(items_qs)
        if page is None:
            page = list(items_qs)

        serializer = KnowledgeItemListSerializer(page, many=True)
        response = self.get_paginated_response(serializer.data)
        response.data['source_counts'] = {
            str(sid): cnt for sid, cnt in source_counts.items()
        }
        return response
