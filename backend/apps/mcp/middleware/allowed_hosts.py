"""
Middleware to dynamically allow custom MCP domain hosts.

Django validates the Host header against ALLOWED_HOSTS lazily when
request.get_host() is first called. Since customers can bring any domain
(e.g., mcp.useautumn.com), we check Agent.mcp_domain and add registered
hosts to ALLOWED_HOSTS before downstream code triggers the validation.

Must be placed before any middleware that calls request.get_host().

This middleware is fully async-native to avoid serializing ASGI
requests through Django's single-thread sync_to_async executor.
"""
import logging

from asgiref.sync import iscoroutinefunction, markcoroutinefunction
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "allowed_mcp_domain:"
CACHE_TTL = 300  # 5 minutes


class DynamicAllowedHostsMiddleware:
    """Allow hosts that are registered as Agent.mcp_domain values."""

    async_capable = True
    sync_capable = False

    def __init__(self, get_response):
        self.get_response = get_response
        if iscoroutinefunction(self.get_response):
            markcoroutinefunction(self)

    async def __call__(self, request):
        host = self._extract_host(request)
        if host and not self._is_already_allowed(host):
            if await self._is_registered_mcp_domain(host):
                settings.ALLOWED_HOSTS.append(host)

        return await self.get_response(request)

    @staticmethod
    def _extract_host(request) -> str | None:
        """Read the host from META without triggering Django's host validation."""
        host = request.META.get("HTTP_HOST") or request.META.get("SERVER_NAME")
        if not host:
            return None
        return host.split(":")[0].lower()

    @staticmethod
    def _is_already_allowed(host: str) -> bool:
        for pattern in settings.ALLOWED_HOSTS:
            if pattern == "*":
                return True
            if pattern.startswith(".") and (host.endswith(pattern) or host == pattern[1:]):
                return True
            if pattern == host:
                return True
        return False

    @staticmethod
    async def _is_registered_mcp_domain(host: str) -> bool:
        cache_key = f"{CACHE_KEY_PREFIX}{host}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        from apps.products.models.agent import Agent
        exists = await Agent.objects.filter(
            mcp_domain=host, is_active=True
        ).aexists()

        cache.set(cache_key, exists, CACHE_TTL)
        return exists
