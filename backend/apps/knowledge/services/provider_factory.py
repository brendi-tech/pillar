"""
Provider factory for knowledge sources.

Maps source types to their corresponding provider implementations.
"""
import logging
from typing import TYPE_CHECKING

from apps.knowledge.services.providers.base import BaseProvider

if TYPE_CHECKING:
    from apps.knowledge.models import KnowledgeSource

logger = logging.getLogger(__name__)


class ProviderNotFoundError(Exception):
    """Raised when no provider is available for a source type."""

    pass


def get_provider(source: "KnowledgeSource") -> BaseProvider:
    """
    Get the appropriate provider for a knowledge source.

    Args:
        source: KnowledgeSource instance

    Returns:
        BaseProvider subclass instance for the source type

    Raises:
        ProviderNotFoundError: If no provider exists for the source type
    """
    source_type = source.source_type

    # Lazy import providers to avoid circular imports
    if source_type in ("help_center", "marketing_site", "website_crawl"):
        from apps.knowledge.services.providers.firecrawl_provider import (
            FirecrawlProvider,
        )

        return FirecrawlProvider()

    elif source_type == "integration":
        from apps.knowledge.services.providers.unified_provider import (
            UnifiedProvider,
        )

        return UnifiedProvider()

    elif source_type == "cloud_storage":
        from apps.knowledge.services.providers.cloud_storage_provider import (
            CloudStorageProvider,
        )

        return CloudStorageProvider()

    elif source_type == "document_upload":
        from apps.knowledge.services.providers.document_upload_provider import (
            DocumentUploadProvider,
        )

        return DocumentUploadProvider()

    elif source_type == "snippets":
        # Snippets don't need a provider - they're created directly
        raise ProviderNotFoundError(
            "Snippets source type does not support sync operations"
        )

    else:
        raise ProviderNotFoundError(f"No provider for source type: {source_type}")


def get_provider_for_type(source_type: str) -> BaseProvider:
    """
    Get a provider by source type string.

    Useful when you need a provider without a source instance.

    Args:
        source_type: Source type string (help_center, integration, etc.)

    Returns:
        BaseProvider subclass instance

    Raises:
        ProviderNotFoundError: If no provider exists for the source type
    """
    # Create a mock source-like object for the factory
    class MockSource:
        def __init__(self, source_type: str):
            self.source_type = source_type

    return get_provider(MockSource(source_type))


# Registry of available providers for introspection
PROVIDER_REGISTRY = {
    "help_center": "FirecrawlProvider",
    "marketing_site": "FirecrawlProvider",
    "website_crawl": "FirecrawlProvider",
    "integration": "UnifiedProvider",
    "cloud_storage": "CloudStorageProvider",
    "document_upload": "DocumentUploadProvider",
}


def list_available_providers() -> dict[str, str]:
    """
    List all available source types and their providers.

    Returns:
        Dict mapping source_type to provider class name
    """
    return PROVIDER_REGISTRY.copy()
