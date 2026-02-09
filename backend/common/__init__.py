"""
Common utilities shared across all Help Center Django apps.

This module provides shared infrastructure including:
- Custom exception classes
- Hatchet client for background tasks
- Common models (BaseModel, TenantAwareModel, VectorEmbedding)
- LLM utilities
- RAG services

Note: Imports are done lazily to avoid circular dependencies during Django startup.
Import directly from submodules (e.g., `from common.exceptions import LLMAPIError`).
"""

# For convenience, expose commonly used items via __all__
# but don't import them at module level to avoid circular imports
__all__ = [
    # Exceptions (import from common.exceptions)
    "LLMAPIError",
    "PlanLimitExceeded",
    "FeatureNotAvailableOnPlan",
    "OrganizationMismatchError",
    "RateLimitExceeded",
    "CrawlError",
    # Hatchet (import from common.hatchet_client)
    "get_hatchet_client",
    "reset_hatchet_client",
]


def __getattr__(name):
    """
    Lazy import handler for commonly used items.
    This avoids circular imports during Django app loading.
    """
    if name in (
        "LLMAPIError",
        "PlanLimitExceeded",
        "FeatureNotAvailableOnPlan",
        "OrganizationMismatchError",
        "RateLimitExceeded",
        "CrawlError",
    ):
        from . import exceptions
        return getattr(exceptions, name)

    if name in ("get_hatchet_client", "reset_hatchet_client"):
        from . import hatchet_client
        return getattr(hatchet_client, name)

    raise AttributeError(f"module 'common' has no attribute '{name}'")
