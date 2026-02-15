"""
Centralized cache key management for the application.

This module provides a single source of truth for all cache keys used
throughout the application, ensuring consistency and avoiding key conflicts.
"""
import hashlib
from django.core.cache import cache


class CacheKeys:
    """Centralized cache key definitions and utilities."""

    # ==================== Suggested Questions ====================

    @staticmethod
    def suggested_questions(site_id: str) -> str:
        """
        Unified cache key for suggested questions.

        Used by:
        - MCP server (widget display)
        - Admin POST endpoint (preview)
        - Question generation workflow

        Args:
            site_id: Site UUID

        Returns:
            Cache key string
        """
        return f"suggested_questions:{site_id}:cached"

    @staticmethod
    def clear_suggested_questions(site_id: str) -> None:
        """
        Clear suggested questions cache for a site.

        Should be called when:
        - Workflow generates new questions
        - User creates/updates/deletes saved questions
        - Questions are reordered

        Args:
            site_id: Site UUID
        """
        cache.delete(CacheKeys.suggested_questions(site_id))

    # ==================== MCP Plan-Based Rate Limiting ====================

    @staticmethod
    def mcp_plan_rate_limit(site_id: str, window: str = 'minute') -> str:
        """
        Cache key for plan-based MCP rate limiting counters.

        Used by MCPPlanLimitMiddleware for enforcing plan-based rate limits
        tied to billing/pricing tiers.

        DISTINCT from custom_rate_limit (which is per-site custom config).

        Args:
            site_id: Site UUID
            window: Time window ('minute', 'hour', 'day')

        Returns:
            Cache key string
        """
        return f"mcp_rate:{site_id}:{window}"

    @staticmethod
    def mcp_monthly_requests(site_id: str, month_key: str) -> str:
        """
        Cache key for monthly MCP request tracking.

        Used for billing and plan limit enforcement. Tracks total requests
        per month per site to enforce max_mcp_requests_per_month limit.

        Args:
            site_id: Site UUID
            month_key: Month key (format: YYYY-MM)

        Returns:
            Cache key string
        """
        return f"mcp_requests:{site_id}:{month_key}"

    @staticmethod
    def mcp_lifetime_requests(org_id: str) -> str:
        """
        Cache key for lifetime MCP request tracking.

        Used for free tier (one-time) limit enforcement. The free tier
        has a lifetime limit (not monthly), so we track total usage
        across all time for the organization.

        Args:
            org_id: Organization UUID

        Returns:
            Cache key string
        """
        return f"mcp_lifetime:{org_id}"

    # ==================== Custom Rate Limiting ====================

    @staticmethod
    def custom_rate_limit(key_base: str, window: str) -> str:
        """
        Cache key for custom rate limiting (per-site RateLimitConfig).

        Used by RateLimiterMiddleware for custom per-site rate limits
        with advanced features (IP whitelist/blacklist, per-IP limits).

        DISTINCT from mcp_plan_rate_limit (which is billing-based).

        Args:
            key_base: Base identifier (usually site_id, or site_id:ip:x.x.x.x)
            window: Time window ('minute', 'hour', 'day')

        Returns:
            Cache key string
        """
        return f"ratelimit:{key_base}:{window}"

    # ==================== MCP Host Resolution ====================

    @staticmethod
    def mcp_host_resolution(host: str) -> str:
        """
        Cache key for host → site_id resolution.

        Used by org_resolver middleware to avoid DB lookups
        on every MCP request. Maps host header to site.

        Args:
            host: Host header value (e.g., "agent.example.com")

        Returns:
            Cache key string
        """
        return f"mcp:host:{host}"

    @staticmethod
    def clear_mcp_host_resolution(host: str) -> None:
        """
        Clear host resolution cache.

        Should be called when:
        - Custom domain is added/updated/deleted
        - Site configuration changes

        Args:
            host: Host header value
        """
        cache.delete(CacheKeys.mcp_host_resolution(host))

    # ==================== Query Embeddings ====================

    @staticmethod
    def query_embedding(question: str) -> str:
        """
        Cache key for query embeddings.

        Used by RAG services (sync and async) to cache expensive
        embedding API calls. Questions are normalized (lowercased)
        and hashed for consistent keys.

        Args:
            question: The query text (will be normalized)

        Returns:
            Cache key string
        """
        question_hash = hashlib.md5(question.lower().encode()).hexdigest()
        return f"query_embedding:{question_hash}"

    # ==================== Feature Flags ====================

    @staticmethod
    def feature_flag(flag_name: str, org_id: str) -> str:
        """
        Cache key for feature flags.

        Used to cache organization-specific feature flag values.

        Args:
            flag_name: Name of the feature flag (e.g., 'competitor-features')
            org_id: Organization UUID

        Returns:
            Cache key string
        """
        return f"feature_flag:{flag_name}:{org_id}"

    @staticmethod
    def clear_feature_flag(flag_name: str, org_id: str) -> None:
        """
        Clear feature flag cache.

        Args:
            flag_name: Name of the feature flag
            org_id: Organization UUID
        """
        cache.delete(CacheKeys.feature_flag(flag_name, org_id))

    # ==================== Image Summaries ====================

    @staticmethod
    def image_summary(image_url: str) -> str:
        """
        Cache key for image summaries generated on upload.

        Used to cache vision model summaries of uploaded images,
        avoiding repeated vision API calls during ReAct iterations.

        Args:
            image_url: The signed GCS URL of the image

        Returns:
            Cache key string
        """
        url_hash = hashlib.md5(image_url.encode()).hexdigest()
        return f"image_summary:{url_hash}"

    # ==================== Agent Score ====================

    @staticmethod
    def agent_score_domain_report(domain: str) -> str:
        """
        Cache key for the latest completed Agent Score report for a domain.

        Used by the lookup-by-domain endpoint to avoid hitting the DB
        on every request. The cached value is the full serialized report JSON.

        Args:
            domain: Normalized domain (e.g. "clerk.com")

        Returns:
            Cache key string
        """
        return f"agent_score:domain:{domain}"

    @staticmethod
    def clear_agent_score_domain_report(domain: str) -> None:
        """
        Clear the cached report for a domain.

        Should be called when:
        - A new report for this domain is marked "complete"

        Args:
            domain: Normalized domain (e.g. "clerk.com")
        """
        cache.delete(CacheKeys.agent_score_domain_report(domain))

    # ==================== Migration Utilities ====================

    @staticmethod
    def clear_legacy_suggested_questions(site_id: str) -> int:
        """
        Clear old suggested questions cache keys from before unification.

        This clears:
        - widget_suggestions:*:{site_id} (old MCP cache)
        - suggested_questions:{site_id}:3 (old admin cache with num)
        - suggested_questions:{site_id}:5 (old admin cache with num)

        Call this during migration to ensure clean state.

        Args:
            site_id: Site UUID

        Returns:
            Number of keys cleared
        """
        from django_redis import get_redis_connection

        try:
            redis_client = get_redis_connection("default")
            keys_to_clear = []

            # Old patterns (these should not exist after unification)
            old_patterns = [
                f"widget_suggestions:*:{site_id}",
                f"suggested_questions:{site_id}:3",
                f"suggested_questions:{site_id}:5",
            ]

            for pattern in old_patterns:
                if '*' in pattern:
                    # Pattern matching (widget_suggestions has org_id we don't know)
                    keys = redis_client.keys(pattern)
                    keys_to_clear.extend(keys)
                else:
                    # Direct key
                    if redis_client.exists(pattern):
                        keys_to_clear.append(pattern)

            if keys_to_clear:
                redis_client.delete(*keys_to_clear)
                return len(keys_to_clear)

            return 0

        except Exception as e:
            # If Redis not configured or error, just clear standard cache
            cache.delete(f"suggested_questions:{site_id}:3")
            cache.delete(f"suggested_questions:{site_id}:5")
            return 2

