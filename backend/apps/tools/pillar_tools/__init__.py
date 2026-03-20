"""Pillar backend tools — dogfood the Python SDK within our own Django backend.

Registers server-side tools available on all channels (web, Slack, Discord, etc.)
that query and mutate product data via the ORM directly.
"""
from __future__ import annotations

import logging

from django.conf import settings

from pillar import Pillar

logger = logging.getLogger(__name__)

_secret = getattr(settings, "PILLAR_SDK_SECRET", "")
_endpoint_url = getattr(settings, "PILLAR_SDK_ENDPOINT_URL", "")

pillar = Pillar(
    secret=_secret or "not-configured",
    endpoint_url=_endpoint_url or None,
    base_url=_endpoint_url.rsplit("/api/", 1)[0] if _endpoint_url else "https://api.trypillar.com",
    auto_register=False,
)

# Import tool modules so decorators run and register with the pillar instance.
from apps.tools.pillar_tools import queries  # noqa: F401, E402
from apps.tools.pillar_tools import mutations  # noqa: F401, E402
