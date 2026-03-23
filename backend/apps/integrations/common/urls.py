"""Shared URL helpers for integration views."""

from django.http import HttpRequest


def get_api_base(request: HttpRequest) -> str:
    """
    Derive the public-facing API base URL from the incoming request.

    Uses the Host header and X-Forwarded-Proto (via SECURE_PROXY_SSL_HEADER)
    so it auto-resolves in every environment:
      - local:  http://localhost:8003
      - dev:    https://help-api.pillar.bot
      - prod:   https://help-api.trypillar.com
    """
    return request.build_absolute_uri('/').rstrip('/')
