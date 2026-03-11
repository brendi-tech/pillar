"""
Snippet ViewSet - convenience wrapper for KnowledgeItems with item_type='snippet'.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.knowledge.models import KnowledgeItem, KnowledgeSource
from apps.products.models import Product
from apps.knowledge.admin.views.mixins import ProductResolveMixin
from apps.knowledge.admin.serializers import (
    SnippetSerializer,
    SnippetCreateSerializer,
    SnippetListSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(summary="List snippets"),
    retrieve=extend_schema(summary="Get snippet details"),
    create=extend_schema(summary="Create snippet"),
    partial_update=extend_schema(summary="Update snippet"),
    destroy=extend_schema(summary="Delete snippet"),
)
class SnippetViewSet(ProductResolveMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing snippets (custom AI instructions).

    Snippets are KnowledgeItems with item_type='snippet'.
    This ViewSet provides a cleaner API for creating/managing snippets.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        """Filter to snippets in user's organizations and product."""
        user_orgs = self.request.user.organizations.all()
        product_param = self.request.query_params.get('product')

        if product_param:
            product = self._resolve_product()
            queryset = KnowledgeItem.objects.filter(
                organization__in=user_orgs,
                item_type=KnowledgeItem.ItemType.SNIPPET,
                product=product,
            )
        elif self.action in ('list', 'create'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'product': 'Product ID is required.'})
        else:
            queryset = KnowledgeItem.objects.filter(
                organization__in=user_orgs,
                item_type=KnowledgeItem.ItemType.SNIPPET,
            )

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return SnippetListSerializer
        if self.action == 'create':
            return SnippetCreateSerializer
        return SnippetSerializer

    def perform_update(self, serializer):
        """Handle snippet updates."""
        instance = serializer.instance

        # Get the content field if provided (maps to raw_content)
        content = self.request.data.get('content')
        if content is not None:
            instance.raw_content = content
            instance.optimized_content = content  # Snippets don't need LLM optimization
            instance.status = KnowledgeItem.Status.PENDING  # Re-process for embeddings

        serializer.save()

        # Trigger reprocessing if content changed
        if content is not None:
            try:
                from common.task_router import TaskRouter

                TaskRouter.execute(
                    'knowledge-process-item',
                    item_id=str(instance.id),
                    organization_id=str(instance.organization_id),
                )
                logger.info(f"Triggered reprocessing for updated snippet {instance.id}")
            except Exception as e:
                logger.error(f"Failed to trigger reprocessing for snippet {instance.id}: {e}")

    def perform_create(self, serializer):
        """Handle snippet creation with post-processing."""
        snippet = serializer.save()

        # Trigger processing to create embeddings
        try:
            from common.task_router import TaskRouter

            TaskRouter.execute(
                'knowledge-process-item',
                item_id=str(snippet.id),
                organization_id=str(snippet.organization_id),
            )
            logger.info(f"Triggered processing for new snippet {snippet.id}")
        except Exception as e:
            logger.error(f"Failed to trigger processing for snippet {snippet.id}: {e}")
