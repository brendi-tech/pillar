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
from adrf.viewsets import ModelViewSet as AsyncModelViewSet
from asgiref.sync import async_to_sync, sync_to_async
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Action
from apps.tools.models import MCPToolSource, OpenAPIToolSource, OpenAPIToolSourceVersion, RegisteredSkill, ToolEndpoint
from apps.tools.serializers import (
    MCPToolSourceCreateSerializer,
    MCPToolSourceSerializer,
    OpenAPIOperationConfigSerializer,
    OpenAPIToolSourceCreateSerializer,
    OpenAPIToolSourceSerializer,
    OpenAPIToolSourceVersionDetailSerializer,
    OpenAPIToolSourceVersionSerializer,
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

        # --- Skills registration ---
        skill_names: list[str] = []
        skills_data = data.get("skills", [])
        if skills_data:
            from common.services.embedding_service import get_embedding_service
            embedding_service = get_embedding_service()

            incoming_skill_names = set()
            for skill_def in skills_data:
                s_name = skill_def["name"]
                incoming_skill_names.add(s_name)

                embedding = embedding_service.embed_document(skill_def["description"])

                RegisteredSkill.objects.update_or_create(
                    product=product,
                    name=s_name,
                    defaults={
                        "organization": product.organization,
                        "description": skill_def["description"],
                        "content": skill_def["content"],
                        "endpoint": endpoint,
                        "source_type": RegisteredSkill.SourceType.BACKEND_SDK,
                        "is_active": True,
                        "description_embedding": embedding,
                        "embedding_model": "text-embedding-3-small",
                    },
                )
                skill_names.append(s_name)

            RegisteredSkill.objects.filter(
                product=product,
                source_type=RegisteredSkill.SourceType.BACKEND_SDK,
                is_active=True,
            ).exclude(name__in=incoming_skill_names).update(is_active=False)

            from apps.mcp.services.prompts.capabilities import invalidate_capabilities_cache
            invalidate_capabilities_cache(str(product.id))

        endpoint_verified = self._ping_endpoint(data["endpoint_url"])

        return Response({
            "registered": registered_names,
            "registered_skills": skill_names,
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


class MCPSourceViewSet(AsyncModelViewSet):
    """
    Admin CRUD for MCP tool sources.

    list/create: /api/admin/tools/mcp-sources/
    retrieve/update/destroy: /api/admin/tools/mcp-sources/<id>/
    refresh: /api/admin/tools/mcp-sources/<id>/refresh/
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get_queryset(self):
        qs = MCPToolSource.objects.filter(
            organization__in=self.request.user.organizations.all(),
        ).select_related("product").order_by("-created_at")
        product_id = self.request.query_params.get("product_id")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return MCPToolSourceCreateSerializer
        return MCPToolSourceSerializer

    async def create(self, request: Request, *args, **kwargs) -> Response:
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        await self.aperform_create(write_serializer)
        read_serializer = MCPToolSourceSerializer(write_serializer.instance)
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    async def aperform_create(self, serializer):
        from asgiref.sync import sync_to_async

        from apps.products.models import Product

        product_id = self.request.data.get("product_id")
        product = await Product.objects.select_related("organization").filter(
            id=product_id,
            organization__in=self.request.user.organizations.all(),
        ).afirst()

        if product is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"product_id": "Invalid product."})

        instance = await sync_to_async(serializer.save)(
            product=product,
            organization=product.organization,
        )

        if instance.auth_type == MCPToolSource.AuthType.OAUTH:
            await self._run_oauth_discovery(instance)
        else:
            await self._trigger_discovery(instance)

    @action(detail=False, methods=["post"])
    async def probe(self, request: Request) -> Response:
        """Probe an MCP server URL to detect its auth requirements."""
        url = request.data.get("url")
        if not url:
            return Response(
                {"error": "url is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from dataclasses import asdict

        from apps.tools.services.mcp_probe import probe_mcp_server

        result = await probe_mcp_server(url)
        return Response(asdict(result))

    @action(detail=True, methods=["post"], url_path="refresh")
    async def refresh(self, request: Request, pk=None) -> Response:
        """Re-discover tools from this MCP source."""
        source = await sync_to_async(self.get_object)()
        if source.auth_type == MCPToolSource.AuthType.OAUTH and source.oauth_status != 'authorized':
            await self._run_oauth_discovery(source)
            return Response({"status": "oauth_discovery_started"})
        await self._trigger_discovery(source)
        return Response({"status": "discovery_started"})

    @action(detail=True, methods=["post"], url_path="read-resource")
    async def read_resource(self, request: Request, pk=None) -> Response:
        """Read a resource from this MCP source by URI."""
        source = await sync_to_async(self.get_object)()
        uri = request.data.get("uri")
        if not uri:
            return Response(
                {"error": "uri is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from dataclasses import dataclass

        from apps.tools.services.mcp_client import read_mcp_resource

        @dataclass
        class AdminCaller:
            external_user_id: str = ""
            email: str = ""
            channel: str = "web"
            display_name: str = "Admin"

        user = await sync_to_async(lambda: request.user)()
        caller = AdminCaller(
            external_user_id=str(user.id),
            email=getattr(user, "email", ""),
            display_name=getattr(user, "full_name", "") or getattr(user, "email", ""),
        )

        result = await read_mcp_resource(
            uri=uri,
            mcp_source=source,
            caller=caller,
        )

        if result.get("timed_out"):
            return Response(
                {"error": "Request timed out"},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        if result.get("connection_error"):
            return Response(
                {"error": result.get("error", "Connection error")},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(result)

    @action(detail=True, methods=["get"], url_path="oauth-status")
    def oauth_status(self, request: Request, pk=None) -> Response:
        """Check OAuth status for an MCP source."""
        source = self.get_object()
        data = {
            "oauth_status": source.oauth_status,
            "oauth_token_expires_at": source.oauth_token_expires_at,
            "has_credentials": bool(source.auth_credentials),
        }
        if source.oauth_status == 'authorized' and source.oauth_token_expires_at:
            data["is_expired"] = source.oauth_token_expires_at < timezone.now()
        return Response(data)

    @staticmethod
    async def _run_oauth_discovery(source: MCPToolSource) -> None:
        """Discover OAuth endpoints and attempt DCR for an OAuth MCP source."""
        from apps.mcp_oauth.discovery import discover_auth_server, discover_protected_resource
        from apps.mcp_oauth.token_client import register_client

        source.oauth_status = MCPToolSource.OAuthStatus.DISCOVERING
        await source.asave(update_fields=["oauth_status"])

        try:
            resource_meta = await discover_protected_resource(source.url)

            auth_server_url = source.url
            if resource_meta and resource_meta.authorization_servers:
                auth_server_url = resource_meta.authorization_servers[0]

            as_meta = await discover_auth_server(auth_server_url)

            if not as_meta:
                source.oauth_status = MCPToolSource.OAuthStatus.ERROR
                source.discovery_error = (
                    "Could not discover OAuth endpoints. "
                    "The server may not support OAuth 2.1."
                )
                await source.asave(update_fields=["oauth_status", "discovery_error"])
                return

            source.oauth_authorization_endpoint = as_meta.authorization_endpoint
            source.oauth_token_endpoint = as_meta.token_endpoint
            source.oauth_registration_endpoint = as_meta.registration_endpoint or ''
            source.oauth_scopes = ' '.join(as_meta.scopes_supported) if as_meta.scopes_supported else ''

            if as_meta.registration_endpoint:
                from django.conf import settings
                callback_url = f"{settings.API_BASE_URL}/api/admin/oauth/mcp-callback/"
                reg_result = await register_client(
                    registration_endpoint=as_meta.registration_endpoint,
                    client_name='Pillar',
                    redirect_uris=[callback_url],
                )
                if reg_result and reg_result.get('client_id'):
                    source.oauth_client_id = reg_result['client_id']

            source.oauth_status = MCPToolSource.OAuthStatus.AUTHORIZATION_REQUIRED
            source.discovery_error = ''
            await source.asave(update_fields=[
                "oauth_authorization_endpoint", "oauth_token_endpoint",
                "oauth_registration_endpoint", "oauth_scopes",
                "oauth_client_id", "oauth_status", "discovery_error",
            ])
        except Exception as exc:
            logger.exception("OAuth discovery failed for %s: %s", source, exc)
            source.oauth_status = MCPToolSource.OAuthStatus.ERROR
            source.discovery_error = str(exc)[:1000]
            await source.asave(update_fields=["oauth_status", "discovery_error"])

    @action(detail=True, methods=["patch"], url_path="tool-configs")
    async def update_tool_configs(self, request: Request, pk=None) -> Response:
        """Bulk-update tool configs for an MCP source (review screen)."""
        from apps.tools.models import MCPToolConfig
        from apps.tools.serializers import MCPToolConfigSerializer

        source = await sync_to_async(self.get_object)()
        updates = request.data if isinstance(request.data, list) else []

        updated = []
        for item in updates:
            tool_name = item.get("tool_name")
            if not tool_name:
                continue
            config = await MCPToolConfig.objects.filter(
                mcp_source=source, tool_name=tool_name,
            ).afirst()
            if not config:
                continue
            changed = False
            if "is_enabled" in item:
                config.is_enabled = item["is_enabled"]
                changed = True
            if "requires_confirmation" in item:
                config.requires_confirmation = item["requires_confirmation"]
                changed = True
            if changed:
                await config.asave()
                updated.append(config)

        serializer = MCPToolConfigSerializer(updated, many=True)
        return Response(serializer.data)

    @staticmethod
    async def _trigger_discovery(source: MCPToolSource) -> None:
        """Run MCP tool discovery."""
        from apps.tools.services.mcp_client import discover_and_store

        try:
            await discover_and_store(source)
        except Exception as exc:
            logger.exception("MCP discovery failed for %s: %s", source, exc)
            source.discovery_status = MCPToolSource.DiscoveryStatus.ERROR
            source.discovery_error = str(exc)[:1000]
            await source.asave(update_fields=["discovery_status", "discovery_error"])


class OpenAPISourceViewSet(AsyncModelViewSet):
    """
    Admin CRUD for OpenAPI tool sources.

    list/create: /api/tools/admin/openapi-sources/
    retrieve/update/destroy: /api/tools/admin/openapi-sources/<id>/
    refresh: POST /api/tools/admin/openapi-sources/<id>/refresh/
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get_queryset(self):
        from django.db.models import Count

        qs = OpenAPIToolSource.objects.filter(
            organization__in=self.request.user.organizations.all(),
        ).select_related("product").annotate(
            _version_count=Count("versions"),
        ).order_by("-created_at")
        product_id = self.request.query_params.get("product_id")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return OpenAPIToolSourceCreateSerializer
        return OpenAPIToolSourceSerializer

    async def create(self, request: Request, *args, **kwargs) -> Response:
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        await self._perform_create(write_serializer)
        read_serializer = OpenAPIToolSourceSerializer(write_serializer.instance)
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    async def _perform_create(self, serializer):
        from apps.products.models import Product

        product_id = self.request.data.get("product_id")
        product = await Product.objects.select_related("organization").filter(
            id=product_id,
            organization__in=self.request.user.organizations.all(),
        ).afirst()

        if product is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"product_id": "Invalid product."})

        instance = await sync_to_async(serializer.save)(
            product=product,
            organization=product.organization,
        )
        await self._trigger_discovery(instance)

    async def partial_update(self, request: Request, *args, **kwargs) -> Response:
        instance = await sync_to_async(self.get_object)()
        write_serializer = self.get_serializer(
            instance, data=request.data, partial=True,
        )
        await sync_to_async(write_serializer.is_valid)(raise_exception=True)
        updated = await sync_to_async(write_serializer.save)()

        if 'spec_url' in request.data or 'spec_content' in request.data:
            await self._trigger_discovery(updated)

        read_serializer = OpenAPIToolSourceSerializer(updated)
        return Response(read_serializer.data)

    async def update(self, request: Request, *args, **kwargs) -> Response:
        instance = await sync_to_async(self.get_object)()
        write_serializer = self.get_serializer(instance, data=request.data)
        await sync_to_async(write_serializer.is_valid)(raise_exception=True)
        updated = await sync_to_async(write_serializer.save)()
        await self._trigger_discovery(updated)
        read_serializer = OpenAPIToolSourceSerializer(updated)
        return Response(read_serializer.data)

    @action(detail=True, methods=["post"], url_path="refresh")
    async def refresh(self, request: Request, pk=None) -> Response:
        """Re-parse the OpenAPI spec."""
        source = await sync_to_async(self.get_object)()
        await self._trigger_discovery(source)
        return Response({"status": "discovery_started"})

    @action(detail=False, methods=["post"])
    async def probe(self, request: Request) -> Response:
        """Probe an OpenAPI spec URL or raw content to check if it's valid."""
        spec_url = request.data.get("spec_url")
        spec_content = request.data.get("spec_content")

        if not spec_url and not spec_content:
            return Response(
                {"error": "Either spec_url or spec_content is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.tools.services.openapi_parser import (
            extract_operations,
            extract_security_schemes,
            extract_server_url,
            fetch_and_parse_spec,
            parse_spec_content,
        )

        try:
            if spec_url:
                spec = await fetch_and_parse_spec(spec_url)
            else:
                spec = parse_spec_content(spec_content)

            operations = extract_operations(spec)
            server_url = extract_server_url(spec)
            security_schemes = extract_security_schemes(spec)
            spec_info = spec.get("info", {})

            return Response({
                "valid": True,
                "title": spec_info.get("title", ""),
                "version": spec_info.get("version", ""),
                "server_url": server_url,
                "operation_count": len(operations),
                "security_schemes": security_schemes,
                "operations_preview": [
                    {
                        "operation_id": op["operation_id"],
                        "method": op["method"],
                        "path": op["path"],
                        "summary": op.get("summary", ""),
                    }
                    for op in operations[:20]
                ],
            })
        except Exception as exc:
            return Response({
                "valid": False,
                "error": str(exc),
            })

    @action(detail=True, methods=["get"], url_path="versions")
    async def list_versions(self, request: Request, pk=None) -> Response:
        """List all spec versions for this source."""
        source = await sync_to_async(self.get_object)()
        versions = OpenAPIToolSourceVersion.objects.filter(
            source=source,
        ).order_by("-version_number")
        versions_list = [v async for v in versions]
        serializer = OpenAPIToolSourceVersionSerializer(versions_list, many=True)
        return Response(serializer.data)

    @action(
        detail=True, methods=["get"],
        url_path=r"versions/(?P<version_number>\d+)",
        url_name="version-detail",
    )
    async def version_detail(self, request: Request, pk=None, version_number=None) -> Response:
        """Get full details of a specific version."""
        source = await sync_to_async(self.get_object)()
        try:
            version = await OpenAPIToolSourceVersion.objects.aget(
                source=source, version_number=int(version_number),
            )
        except OpenAPIToolSourceVersion.DoesNotExist:
            return Response(
                {"error": "Version not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OpenAPIToolSourceVersionDetailSerializer(version)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="operation-configs")
    async def update_operation_configs(self, request: Request, pk=None) -> Response:
        """Bulk-update operation configs for a source (review screen)."""
        from apps.tools.models import OpenAPIOperationConfig

        source = await sync_to_async(self.get_object)()
        updates = request.data if isinstance(request.data, list) else []

        updated = []
        for item in updates:
            tool_name = item.get("tool_name")
            if not tool_name:
                continue
            config = await OpenAPIOperationConfig.objects.filter(
                openapi_source=source, tool_name=tool_name,
            ).afirst()
            if not config:
                continue
            changed = False
            if "is_enabled" in item:
                config.is_enabled = item["is_enabled"]
                changed = True
            if "requires_confirmation" in item:
                config.requires_confirmation = item["requires_confirmation"]
                changed = True
            if changed:
                await config.asave()
                updated.append(config)

        serializer = OpenAPIOperationConfigSerializer(updated, many=True)
        return Response(serializer.data)

    @staticmethod
    async def _trigger_discovery(source: OpenAPIToolSource) -> None:
        """Parse the OpenAPI spec and store operations."""
        from apps.tools.services.openapi_parser import discover_and_store

        try:
            await discover_and_store(source)
        except Exception as exc:
            logger.exception("OpenAPI discovery failed for %s: %s", source, exc)
            source.discovery_status = OpenAPIToolSource.DiscoveryStatus.ERROR
            source.discovery_error = str(exc)[:1000]
            await source.asave(update_fields=["discovery_status", "discovery_error"])
