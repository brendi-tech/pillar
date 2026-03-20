"""
Admin identity API endpoints.

Authenticated via JWT, scoped to the user's organizations.
Used by the Pillar dashboard for managing identity mappings.
"""
from __future__ import annotations

import logging

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.identity.models import IdentityMapping
from apps.identity.serializers import (
    IdentityMappingBulkCreateSerializer,
    IdentityMappingCreateSerializer,
    IdentityMappingSerializer,
)
from apps.users.permissions import IsAuthenticatedAdmin

logger = logging.getLogger(__name__)


class IdentityMappingViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for identity mappings.

    GET    /api/admin/identity/mappings/          — list (filterable)
    POST   /api/admin/identity/mappings/          — create single mapping
    GET    /api/admin/identity/mappings/<id>/      — retrieve
    DELETE /api/admin/identity/mappings/<id>/      — soft revoke
    POST   /api/admin/identity/mappings/bulk/      — bulk create
    """

    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = IdentityMappingSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['channel', 'is_active', 'linked_via']
    search_fields = ['channel_user_id', 'external_user_id', 'email', 'display_name']

    def get_queryset(self):
        qs = IdentityMapping.objects.filter(
            organization__in=self.request.user.organizations.all(),
        ).select_related('product')

        external_user_id = self.request.query_params.get('external_user_id')
        if external_user_id:
            qs = qs.filter(external_user_id=external_user_id)

        product_id = self.request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(product_id=product_id)

        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return IdentityMappingCreateSerializer
        if self.action == 'bulk_create':
            return IdentityMappingBulkCreateSerializer
        return IdentityMappingSerializer

    def create(self, request, *args, **kwargs):
        serializer = IdentityMappingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        product_id = request.data.get('product_id') or request.query_params.get('product_id')
        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.products.models import Product
        try:
            product = Product.objects.get(
                id=product_id,
                organization__in=request.user.organizations.all(),
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Deactivate existing mapping for same channel user if any
        IdentityMapping.objects.filter(
            product=product,
            channel=data['channel'],
            channel_user_id=data['channel_user_id'],
            is_active=True,
        ).update(is_active=False, revoked_at=timezone.now())

        mapping = IdentityMapping.objects.create(
            organization=product.organization,
            product=product,
            channel=data['channel'],
            channel_user_id=data['channel_user_id'],
            external_user_id=data['external_user_id'],
            email=data.get('email', ''),
            display_name=data.get('display_name', ''),
            linked_via='dashboard',
            linked_by=str(request.user.id),
        )

        return Response(
            IdentityMappingSerializer(mapping).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: set is_active=False instead of deleting."""
        mapping = self.get_object()
        mapping.is_active = False
        mapping.revoked_at = timezone.now()
        mapping.save(update_fields=['is_active', 'revoked_at', 'updated_at'])
        return Response(status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        """Bulk-create identity mappings."""
        serializer = IdentityMappingBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = request.data.get('product_id') or request.query_params.get('product_id')
        if not product_id:
            return Response(
                {'error': 'product_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.products.models import Product
        try:
            product = Product.objects.get(
                id=product_id,
                organization__in=request.user.organizations.all(),
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        mappings_data = serializer.validated_data['mappings']
        created = 0
        skipped = 0

        for item in mappings_data:
            existing = IdentityMapping.objects.filter(
                product=product,
                channel=item['channel'],
                channel_user_id=item['channel_user_id'],
                is_active=True,
            ).exists()

            if existing:
                skipped += 1
                continue

            IdentityMapping.objects.create(
                organization=product.organization,
                product=product,
                channel=item['channel'],
                channel_user_id=item['channel_user_id'],
                external_user_id=item['external_user_id'],
                email=item.get('email', ''),
                display_name=item.get('display_name', ''),
                linked_via='api',
                linked_by=str(request.user.id),
            )
            created += 1

        return Response(
            {'created': created, 'skipped': skipped},
            status=status.HTTP_201_CREATED,
        )
