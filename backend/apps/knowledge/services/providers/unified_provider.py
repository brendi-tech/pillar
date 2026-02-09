"""
Unified.to provider for help desk integrations.

Handles the 'integration' source type by fetching articles from
external help desks via Unified.to's normalized KMS API.

Supported platforms:
- Pylon (usepylon.com)
- Zendesk
- Intercom
- Freshdesk
- HelpScout
- Notion
- Confluence
"""
import logging
import re
from typing import TYPE_CHECKING, Optional

from django.conf import settings

from apps.knowledge.services.providers.base import (
    BaseProvider,
    RawItem,
    ValidationResult,
)

if TYPE_CHECKING:
    from apps.knowledge.models import KnowledgeSource

logger = logging.getLogger(__name__)


class UnifiedProvider(BaseProvider):
    """
    Provider for help desk integrations via Unified.to KMS API.

    Uses Unified.to to provide a normalized interface across
    multiple help desk platforms.

    connection_config schema:
    {
        "unified_connection_id": "conn_abc123",
        "platform": "pylon",
        "workspace_name": "Acme Support",
        "connected_at": "2024-01-15T10:00:00Z",
    }
    """

    source_type = "integration"

    def __init__(self):
        self._client: Optional["UnifiedKMSClient"] = None

    @property
    def client(self) -> "UnifiedKMSClient":
        """Lazy-load the Unified.to client."""
        if self._client is None:
            self._client = UnifiedKMSClient()
        return self._client

    async def validate_config(self, source: "KnowledgeSource") -> ValidationResult:
        """
        Verify Unified.to connection is valid.

        Args:
            source: KnowledgeSource with connection_config

        Returns:
            ValidationResult indicating if connection is usable
        """
        connection_id = source.connection_config.get("unified_connection_id")
        if not connection_id:
            return ValidationResult(
                valid=False, error="No Unified.to connection ID configured"
            )

        try:
            is_valid = await self.client.test_connection(connection_id)
            if is_valid:
                return ValidationResult(valid=True)
            else:
                return ValidationResult(
                    valid=False, error="Connection test failed - token may be expired"
                )
        except Exception as e:
            logger.error(f"Unified.to connection validation failed: {e}")
            return ValidationResult(
                valid=False, error=f"Connection validation failed: {e}"
            )

    async def fetch_items(self, source: "KnowledgeSource") -> list[RawItem]:
        """
        Fetch articles from connected help desk via Unified.to.

        Args:
            source: KnowledgeSource with connection_config

        Returns:
            List of RawItem, one per article
        """
        connection_id = source.connection_config.get("unified_connection_id")
        platform = source.connection_config.get("platform", "unknown")

        if not connection_id:
            raise ValueError("No Unified.to connection ID configured")

        logger.info(
            f"Fetching articles from {platform} "
            f"(connection: {connection_id[:8]}...) for source {source.id}"
        )

        # Fetch articles via Unified.to KMS API
        articles = await self.client.list_kms_pages(connection_id)

        items = []
        for article in articles:
            try:
                item = self._convert_article(article, platform)
                if item:
                    items.append(item)
            except Exception as e:
                logger.error(f"Error converting article {article.get('id')}: {e}")
                continue

        logger.info(
            f"Fetched {len(items)} articles from {platform} for source {source.id}"
        )
        return items

    def _convert_article(self, article: dict, platform: str) -> Optional[RawItem]:
        """
        Convert a Unified.to KMS page to RawItem.

        Args:
            article: Article dict from Unified.to API
            platform: Platform name for metadata

        Returns:
            RawItem or None if article is empty/invalid
        """
        article_id = article.get("id")
        title = article.get("title", "")

        if not article_id:
            return None

        # Get content - prefer raw markdown, fall back to HTML conversion
        content = article.get("raw") or ""
        if not content and article.get("body_html"):
            content = self._html_to_markdown(article["body_html"])

        if not content or len(content.strip()) < 10:
            logger.debug(f"Skipping empty article: {article_id}")
            return None

        return RawItem(
            external_id=str(article_id),
            title=title or f"Untitled ({article_id})",
            raw_content=content,
            url=article.get("web_url"),
            metadata={
                "platform": platform,
                "remote_updated_at": article.get("updated_at"),
                "categories": article.get("category_ids") or [],
                "space_id": article.get("space_id"),
                "parent_id": article.get("parent_id"),
            },
        )

    def _html_to_markdown(self, html: str) -> str:
        """
        Convert HTML to markdown.

        Uses html2text library if available, otherwise
        does basic tag stripping.

        Args:
            html: HTML string

        Returns:
            Markdown string
        """
        try:
            import html2text

            h = html2text.HTML2Text()
            h.ignore_links = False
            h.ignore_images = False
            h.body_width = 0  # Don't wrap lines
            return h.handle(html)
        except ImportError:
            # Fallback: basic HTML stripping
            # Remove script and style tags entirely
            html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
            html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL)
            # Replace common block tags with newlines
            html = re.sub(r"<(p|br|div|h[1-6])[^>]*>", "\n", html)
            # Remove remaining tags
            html = re.sub(r"<[^>]+>", "", html)
            # Clean up whitespace
            html = re.sub(r"\n{3,}", "\n\n", html)
            return html.strip()


class UnifiedKMSClient:
    """
    Client for Unified.to KMS (Knowledge Management System) API.

    Provides methods to interact with help desk integrations
    through Unified.to's normalized interface.
    """

    def __init__(self):
        api_key = getattr(settings, "UNIFIED_TO_API_KEY", None)
        if not api_key:
            raise ValueError("UNIFIED_TO_API_KEY not configured in settings")
        self.api_key = api_key
        self.workspace_id = getattr(settings, "UNIFIED_TO_WORKSPACE_ID", None)
        self.base_url = getattr(
            settings, "UNIFIED_TO_BASE_URL", "https://api.unified.to"
        )

    async def test_connection(self, connection_id: str) -> bool:
        """
        Test if a connection is still valid.

        Args:
            connection_id: Unified.to connection ID

        Returns:
            True if connection is valid, False otherwise
        """
        try:
            # Try to list 1 page to verify access
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/kms/{connection_id}/page",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    params={"limit": 1},
                    timeout=10.0,
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    async def get_connection(self, connection_id: str) -> dict:
        """
        Get connection details from Unified.to.

        Args:
            connection_id: Unified.to connection ID

        Returns:
            Connection details dict
        """
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/unified/connection/{connection_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()

    async def list_kms_pages(self, connection_id: str) -> list[dict]:
        """
        List all pages/articles from a connected platform.

        Handles pagination automatically.

        Args:
            connection_id: Unified.to connection ID

        Returns:
            List of page dicts with:
            - id: Platform's article ID
            - title: Article title
            - raw: Markdown content (if available)
            - body_html: HTML content
            - web_url: Public URL
            - updated_at: Last modified timestamp
            - category_ids: Category/collection IDs
        """
        import httpx

        pages = []
        cursor = None

        async with httpx.AsyncClient() as client:
            while True:
                params = {"limit": 100}
                if cursor:
                    params["cursor"] = cursor

                response = await client.get(
                    f"{self.base_url}/kms/{connection_id}/page",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    params=params,
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                # Handle both array response and paginated response
                if isinstance(data, list):
                    pages.extend(data)
                    break
                else:
                    pages.extend(data.get("results", []))
                    cursor = data.get("next_cursor")
                    if not cursor:
                        break

        return pages

    async def create_link_url(
        self,
        integration_type: str,
        redirect_url: str,
        state: str,
    ) -> str:
        """
        Create an OAuth link URL for connecting a platform.

        Args:
            integration_type: Platform name (pylon, zendesk, etc.)
            redirect_url: Where to redirect after OAuth
            state: State to pass through (source_id)

        Returns:
            OAuth URL to redirect user to
        """
        import httpx

        # Build the link request payload
        payload = {
            "categories": ["kms"],
            "integration_type": integration_type,
            "redirect_url": redirect_url,
            "state": state,
        }

        # Include workspace ID if configured
        if self.workspace_id:
            payload["workspace_id"] = self.workspace_id

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/unified/integration/workspace/{self.workspace_id}/link"
                if self.workspace_id
                else f"{self.base_url}/unified/link",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("link_url", "")


def get_unified_provider() -> UnifiedProvider:
    """Get a UnifiedProvider instance."""
    return UnifiedProvider()
