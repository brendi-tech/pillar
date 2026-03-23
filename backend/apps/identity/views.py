"""
Public identity API endpoints.

Authenticated via x-customer-id header (resolved by CustomerIdMiddleware)
or Authorization: Bearer plr_xxx (resolved via SyncSecret lookup).
Used by Pillar's channel connectors and customer backends for account linking.
"""
from __future__ import annotations

import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.serializers import (
    LinkConfirmSerializer,
    LinkRequestSerializer,
    ResolveQuerySerializer,
)
from apps.identity.services import (
    CodeAlreadyUsedError,
    CodeExpiredError,
    CodeNotFoundError,
    confirm_link,
    generate_link_code_sync,
)

logger = logging.getLogger(__name__)


def _get_product_context(request):
    """Extract product and organization from middleware or Bearer auth.

    Tries middleware-resolved attributes first (x-customer-id header).
    Falls back to Bearer token auth (same pattern as ToolRegistrationView)
    so server SDKs can authenticate with their plr_ secret.
    """
    product = getattr(request, 'product', None)
    organization = getattr(request, 'customer_organization', None) or getattr(request, 'organization', None)

    if not product:
        from asgiref.sync import async_to_sync

        from apps.tools.services.auth import authenticate_sdk_request
        product = async_to_sync(authenticate_sdk_request)(request)
        if product:
            organization = product.organization

    return product, organization


class LinkRequestView(APIView):
    """
    POST /api/public/identity/link-request/

    Generate a one-time link code for account linking.
    Called by Pillar's channel connectors when a user initiates linking.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        product, organization = _get_product_context(request)
        if not product:
            return Response(
                {'error': 'Product context not available. Provide x-customer-id header or Authorization: Bearer <secret>.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = LinkRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        link_code = generate_link_code_sync(
            product=product,
            channel=data['channel'],
            channel_user_id=data['channel_user_id'],
            channel_display_name=data.get('channel_display_name', ''),
            channel_email=data.get('channel_email', ''),
        )

        link_url = ''
        if product.identity_link_url:
            link_url = product.identity_link_url.replace('{code}', link_code.code)

        return Response({
            'code': link_code.code,
            'link_url': link_url,
            'expires_at': link_code.expires_at.isoformat(),
        })


class LinkConfirmView(APIView):
    """
    POST /api/public/identity/link-confirm/

    Confirm a link code and create an IdentityMapping.
    Called by the customer's backend after the user authenticates.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        product, organization = _get_product_context(request)
        if not product:
            return Response(
                {'error': 'Product context not available. Provide x-customer-id header or Authorization: Bearer <secret>.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = LinkConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            mapping = confirm_link(
                code_str=data['code'],
                external_user_id=data['external_user_id'],
            )
        except CodeNotFoundError:
            return Response(
                {'error': 'code_not_found', 'message': 'Link code not found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except CodeExpiredError:
            return Response(
                {'error': 'code_expired', 'message': 'This linking code has expired. Please run /pillar connect again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except CodeAlreadyUsedError:
            return Response(
                {'error': 'code_already_used', 'message': 'This linking code has already been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'success': True,
            'mapping': {
                'channel': mapping.channel,
                'channel_user_id': mapping.channel_user_id,
                'external_user_id': mapping.external_user_id,
                'linked_at': mapping.linked_at.isoformat() if mapping.linked_at else None,
            },
        })


class ResolveView(APIView):
    """
    GET /api/public/identity/resolve/?channel=slack&channel_user_id=U04ABCD1234

    Check whether a channel user is linked.
    Called by customers to check identity status before their own processing.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        product, organization = _get_product_context(request)
        if not product:
            return Response(
                {'error': 'Product context not available. Provide x-customer-id header or Authorization: Bearer <secret>.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ResolveQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from apps.identity.models import IdentityMapping

        mapping = IdentityMapping.objects.filter(
            product=product,
            channel=data['channel'],
            channel_user_id=data['channel_user_id'],
            is_active=True,
        ).first()

        if mapping:
            return Response({
                'is_linked': True,
                'external_user_id': mapping.external_user_id,
                'email': mapping.email,
                'linked_at': mapping.linked_at.isoformat() if mapping.linked_at else None,
            })

        return Response({
            'is_linked': False,
            'external_user_id': None,
        })
