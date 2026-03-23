"""
Views for server-side tool infrastructure.

- ToolRegistrationView: SDK-facing endpoint for registering tools + endpoint URL
- EndpointStatusView: Admin-facing endpoint health status
- MCPSourceViewSet: Admin CRUD for MCP tool sources
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from asgiref.sync import async_to_sync
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Action
from apps.tools.models import MCPToolSource, ToolEndpoint
from apps.tools.serializers import (
    MCPToolSourceCreateSerializer,
    MCPToolSourceSerializer,
    ToolEndpointSerializer,
    ToolRegistrationSerializer,
)
from apps.tools.services.auth import authenticate_sdk_request
from apps.users.permissions import IsAuthenticatedAdmin

logger = logging.getLogger(__name__)


class ToolRegistrationView(APIView):
    """
    SDK-facing endpoint: register server-side tools and their HTTP endpoint.

    POST /api/tools/register/
    Authorization: Bearer <sync_secret>
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        product = async_to_sync(authenticate_sdk_request)(request)
        if product is None:
            return Response(
                {"error": "Invalid or missing API key."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ToolRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        endpoint, _ = ToolEndpoint.objects.update_or_create(
            product=product,
            organization=product.organization,
            is_active=True,
            defaults={
                "endpoint_url": data["endpoint_url"],
                "registered_tools": data["tools"],
                "sdk_version": data.get("sdk_version", ""),
            },
        )

        registered_names: list[str] = []
        warnings: list[str] = []

        for tool_def in data["tools"]:
            name = tool_def["name"]
            defaults: dict[str, Any] = {
                "description": tool_def.get("description", ""),
                "tool_type": Action.ToolType.SERVER_SIDE,
                "data_schema": tool_def.get("parameters") or tool_def.get("inputSchema") or {},
                "guidance": tool_def.get("guidance", ""),
                "output_schema": tool_def.get("outputSchema", {}),
                "channel_compatibility": tool_def.get(
                    "channel_compatibility",
                    ["web", "slack", "discord", "email", "api"],
                ),
            }

            action_obj, created = Action.objects.update_or_create(
                product=product,
                name=name,
                source_type=Action.SourceType.BACKEND_SDK,
                defaults={
                    **defaults,
                    "status": Action.Status.PUBLISHED,
                    "organization": product.organization,
                },
            )

            registered_names.append(name)

        endpoint_verified = self._ping_endpoint(data["endpoint_url"])

        return Response({
            "registered": registered_names,
            "warnings": warnings,
            "endpoint_verified": endpoint_verified,
        })

    @staticmethod
    def _ping_endpoint(url: str) -> bool:
        """Send a verification ping to the customer's endpoint."""
        try:
            resp = httpx.post(
                url,
                json={"action": "ping"},
                timeout=10.0,
            )
            return resp.status_code == 200
        except Exception:
            return False


class EndpointStatusView(APIView):
    """
    Admin-facing: show endpoint health for a product.

    GET /api/admin/tools/endpoint/?product_id=<uuid>
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request: Request) -> Response:
        product_id = request.query_params.get("product_id")
        if not product_id:
            return Response(
                {"error": "product_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        endpoint = (
            ToolEndpoint.objects
            .filter(
                product_id=product_id,
                product__organization__in=request.user.organizations.all(),
                is_active=True,
            )
            .first()
        )

        if endpoint is None:
            return Response({
                "status": "no_endpoint",
                "message": "No endpoint registered for this product.",
            })

        serializer = ToolEndpointSerializer(endpoint)
        return Response({
            "status": "active" if endpoint.last_ping_success else "unreachable",
            "endpoint": serializer.data,
        })


class MCPSourceViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for MCP tool sources.

    list/create: /api/admin/tools/mcp-sources/
    retrieve/update/destroy: /api/admin/tools/mcp-sources/<id>/
    refresh: /api/admin/tools/mcp-sources/<id>/refresh/
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get_queryset(self):
        return MCPToolSource.objects.filter(
            organization__in=self.request.user.organizations.all(),
        ).select_related("product").order_by("-created_at")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return MCPToolSourceCreateSerializer
        return MCPToolSourceSerializer

    def perform_create(self, serializer):
        product_id = self.request.data.get("product_id")
        from apps.products.models import Product

        product = Product.objects.filter(
            id=product_id,
            organization__in=self.request.user.organizations.all(),
        ).first()

        if product is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"product_id": "Invalid product."})

        instance = serializer.save(
            product=product,
            organization=product.organization,
        )

        self._trigger_discovery(instance)

    @action(detail=True, methods=["post"], url_path="refresh")
    def refresh(self, request: Request, pk=None) -> Response:
        """Re-discover tools from this MCP source."""
        source = self.get_object()
        self._trigger_discovery(source)
        return Response({"status": "discovery_started"})

    @staticmethod
    def _trigger_discovery(source: MCPToolSource) -> None:
        """Run MCP tool discovery (inline for now, Hatchet task later)."""
        from apps.tools.services.mcp_client import discover_and_sync_tools

        try:
            discover_and_sync_tools(source)
        except Exception as exc:
            logger.exception("MCP discovery failed for %s: %s", source, exc)
            source.discovery_status = MCPToolSource.DiscoveryStatus.ERROR
            source.discovery_error = str(exc)[:1000]
            source.save(update_fields=["discovery_status", "discovery_error"])
