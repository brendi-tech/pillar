"""
KnowledgeItem ViewSet.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.knowledge.models import KnowledgeItem
from apps.products.models import Product
from apps.knowledge.admin.views.mixins import ProductResolveMixin
from apps.knowledge.admin.serializers import (
    KnowledgeItemSerializer,
    KnowledgeItemListSerializer,
    KnowledgeItemUpdateSerializer,
)

logger = logging.getLogger(__name__)


class KnowledgeItemFilter(filters.FilterSet):
    """Filters for knowledge items."""

    source = filters.UUIDFilter()
    item_type = filters.ChoiceFilter(choices=KnowledgeItem.ItemType.choices)
    status = filters.ChoiceFilter(choices=KnowledgeItem.Status.choices)
    is_active = filters.BooleanFilter()

    class Meta:
        model = KnowledgeItem
        fields = ['source', 'item_type', 'status', 'is_active']


@extend_schema_view(
    list=extend_schema(summary="List knowledge items"),
    retrieve=extend_schema(summary="Get knowledge item details"),
    partial_update=extend_schema(summary="Update knowledge item"),
    destroy=extend_schema(summary="Delete knowledge item"),
)
class ItemViewSet(ProductResolveMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing knowledge items.

    Items are created by sync workflows. This ViewSet allows
    viewing, updating (is_active, title, etc.), and deleting items.
    """

    permission_classes = [IsAuthenticated]
    filterset_class = KnowledgeItemFilter
    http_method_names = ['get', 'post', 'patch', 'delete']
    ordering = ['-created_at']
    ordering_fields = ['created_at', 'title', 'status']
    search_fields = ['title', 'url']

    def get_queryset(self):
        """Filter items by user's organizations and product."""
        user_orgs = self.request.user.organizations.all()
        product_param = self.request.query_params.get('product')

        if product_param:
            product = self._resolve_product()
            queryset = KnowledgeItem.objects.filter(
                organization__in=user_orgs, product=product
            )
        elif self.action in ('list', 'create'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'product': 'Product ID is required.'})
        else:
            queryset = KnowledgeItem.objects.filter(organization__in=user_orgs)

        return queryset.select_related('source').order_by('-created_at')

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return KnowledgeItemListSerializer
        if self.action == 'partial_update':
            return KnowledgeItemUpdateSerializer
        return KnowledgeItemSerializer

    @extend_schema(
        summary="Reprocess knowledge item",
        description="Re-run LLM optimization and re-index this item.",
        responses={
            202: {"description": "Reprocessing started"},
        }
    )
    @action(detail=True, methods=['post'], url_path='reprocess')
    def reprocess(self, request, pk=None):
        """Trigger reprocessing for this item."""
        item = self.get_object()

        try:
            from common.task_router import TaskRouter

            # Reset status and trigger processing
            item.status = KnowledgeItem.Status.PENDING
            item.save(update_fields=['status'])

            TaskRouter.execute(
                'knowledge-process-item',
                item_id=str(item.id),
                organization_id=str(item.organization_id),
            )

            logger.info(f"Triggered reprocessing for item {item.id}: {item.title}")

            return Response(
                {'status': 'reprocessing_started', 'item_id': str(item.id)},
                status=status.HTTP_202_ACCEPTED
            )

        except Exception as e:
            logger.error(f"Failed to trigger reprocessing for item {item.id}: {e}")
            return Response(
                {'error': f'Failed to start reprocessing: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get document download URL",
        description="Generate a signed URL for downloading the original document file.",
        responses={
            200: {"description": "Download URL generated successfully"},
            404: {"description": "No file associated with this item"},
        }
    )
    @action(detail=True, methods=['get'], url_path='download-url')
    def download_url(self, request, pk=None):
        """Generate a signed URL for downloading the document."""
        from django.core.files.storage import default_storage
        from django.urls import reverse

        item = self.get_object()
        file_path = item.metadata.get('file_path')

        if not file_path:
            return Response(
                {'error': 'No file associated with this item'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Use Django's default storage - generates signed URL when querystring_auth=True
            signed_url = default_storage.url(file_path)

            # For local development, convert relative URL to absolute
            if signed_url.startswith('/'):
                signed_url = request.build_absolute_uri(signed_url)

            return Response({
                'download_url': signed_url,
                'filename': item.metadata.get('original_filename'),
                'file_type': item.metadata.get('file_type'),
                'file_size_bytes': item.metadata.get('file_size_bytes'),
            })

        except Exception as e:
            # If signing fails (e.g., local dev with ADC), fall back to direct download endpoint
            logger.warning(f"Signed URL generation failed for item {item.id}, using proxy: {e}")

            # Return URL to the direct download endpoint as fallback
            download_endpoint = request.build_absolute_uri(
                f"/api/admin/knowledge/items/{item.id}/download/"
            )

            return Response({
                'download_url': download_endpoint,
                'filename': item.metadata.get('original_filename'),
                'file_type': item.metadata.get('file_type'),
                'file_size_bytes': item.metadata.get('file_size_bytes'),
            })

    @extend_schema(
        summary="Download document directly",
        description="Stream the document file directly. Used as fallback when signed URLs aren't available.",
        responses={
            200: {"description": "File content"},
            404: {"description": "No file associated with this item"},
        }
    )
    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Stream the document file directly (fallback for local dev)."""
        from django.core.files.storage import default_storage
        from django.http import FileResponse, Http404
        import mimetypes

        item = self.get_object()
        file_path = item.metadata.get('file_path')

        if not file_path:
            raise Http404("No file associated with this item")

        try:
            # Open the file from storage
            file = default_storage.open(file_path, 'rb')

            # Determine content type
            filename = item.metadata.get('original_filename', 'document')
            content_type, _ = mimetypes.guess_type(filename)
            if not content_type:
                content_type = 'application/octet-stream'

            response = FileResponse(file, content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(f"Failed to download file for item {item.id}: {e}")
            raise Http404(f"File not found: {str(e)}")
