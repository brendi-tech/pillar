"""
Admin API views for OAuthProvider configuration.

GET/PUT /api/admin/products/{product_id}/oauth-provider/
POST /api/admin/products/{product_id}/oauth-provider/discover/
"""
from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.mcp_oauth.models import OAuthProvider
from apps.mcp_oauth.serializers import OAuthProviderSerializer
from apps.products.models import Product
from apps.users.permissions import IsAuthenticatedAdmin

logger = logging.getLogger(__name__)


class OAuthProviderView(APIView):
    """
    GET: Retrieve the OAuthProvider for a product.
    PUT: Create or update the OAuthProvider for a product.
    DELETE: Remove the OAuthProvider for a product.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def _get_product(self, request, product_id):
        return Product.objects.filter(
            id=product_id,
            organization__in=request.user.organizations.all(),
        ).first()

    def get(self, request, product_id):
        product = self._get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND,
            )

        try:
            provider = product.oauth_provider
        except OAuthProvider.DoesNotExist:
            return Response(
                {'configured': False}, status=status.HTTP_200_OK,
            )

        serializer = OAuthProviderSerializer(provider)
        data = serializer.data
        data['configured'] = True
        return Response(data)

    def put(self, request, product_id):
        product = self._get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND,
            )

        try:
            provider = product.oauth_provider
            serializer = OAuthProviderSerializer(
                provider, data=request.data, partial=True,
            )
        except OAuthProvider.DoesNotExist:
            serializer = OAuthProviderSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        serializer.save(
            product=product,
            organization=product.organization,
        )

        data = serializer.data
        data['configured'] = True
        return Response(data)

    def delete(self, request, product_id):
        product = self._get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND,
            )

        try:
            product.oauth_provider.delete()
        except OAuthProvider.DoesNotExist:
            pass

        return Response(status=status.HTTP_204_NO_CONTENT)


class OAuthProviderDiscoverView(APIView):
    """
    POST: Discover OIDC endpoints from an issuer URL.

    Takes {"issuer_url": "https://accounts.google.com"} and returns
    discovered endpoints (authorization, token, userinfo).
    """

    permission_classes = [IsAuthenticatedAdmin]

    def post(self, request, product_id):
        issuer_url = request.data.get('issuer_url', '').strip()
        if not issuer_url:
            return Response(
                {'error': 'issuer_url is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.mcp_oauth.discovery import discover_oidc

        oidc_config = async_to_sync(discover_oidc)(issuer_url)
        if not oidc_config:
            return Response(
                {'error': f'Could not discover OIDC configuration at {issuer_url}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'issuer': oidc_config.get('issuer', ''),
            'authorization_endpoint': oidc_config.get('authorization_endpoint', ''),
            'token_endpoint': oidc_config.get('token_endpoint', ''),
            'userinfo_endpoint': oidc_config.get('userinfo_endpoint', ''),
            'scopes_supported': oidc_config.get('scopes_supported', []),
        })
