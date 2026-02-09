"""
Firecrawl provider for website crawling.

Handles help_center and marketing_site source types by:
1. Discovering URLs using Firecrawl's site mapper
2. Scraping each page for markdown content
3. Returning pages as RawItems
"""
import hashlib
import logging
from typing import TYPE_CHECKING

from common.utils.firecrawl_service import FirecrawlService, FirecrawlAPIError
from apps.knowledge.services.providers.base import (
    BaseProvider,
    RawItem,
    ValidationResult,
)

if TYPE_CHECKING:
    from apps.knowledge.models import KnowledgeSource

logger = logging.getLogger(__name__)


class FirecrawlProvider(BaseProvider):
    """
    Provider for website crawling via Firecrawl.

    Handles source types:
    - help_center: External help/docs sites
    - marketing_site: Company marketing/product pages

    Uses Firecrawl API to:
    1. Map: Discover all URLs on the site
    2. Scrape: Get markdown content from each page
    """

    source_type = "help_center"  # Also handles marketing_site

    def __init__(self):
        self.firecrawl = FirecrawlService()

    async def validate_config(self, source: "KnowledgeSource") -> ValidationResult:
        """
        Validate that the source URL is accessible.

        Args:
            source: KnowledgeSource with url field

        Returns:
            ValidationResult with valid=True if URL is crawlable
        """
        if not source.url:
            return ValidationResult(valid=False, error="URL is required for crawling")

        try:
            # Try to scrape the root URL to verify access
            result = self.firecrawl.scrape_page(
                url=source.url,
                formats=["markdown"],
            )

            if result and result.get("markdown"):
                return ValidationResult(valid=True)
            else:
                return ValidationResult(
                    valid=False, error="URL returned no content"
                )

        except FirecrawlAPIError as e:
            return ValidationResult(valid=False, error=f"Firecrawl error: {e}")
        except Exception as e:
            return ValidationResult(valid=False, error=f"URL validation failed: {e}")

    async def fetch_items(self, source: "KnowledgeSource") -> list[RawItem]:
        """
        Crawl the source URL and return pages as RawItems.

        Args:
            source: KnowledgeSource to crawl

        Returns:
            List of RawItem, one per discovered page
        """
        if not source.url:
            raise ValueError("Source URL is required for crawling")

        logger.info(f"Starting crawl for source {source.id}: {source.name} ({source.url})")

        # Step 1: Discover URLs
        urls = self._discover_urls(source)
        logger.info(f"Discovered {len(urls)} URLs for source {source.id}")

        # Step 2: Scrape each URL
        items = []
        for url in urls:
            try:
                item = self._scrape_url(source, url)
                if item:
                    items.append(item)
            except Exception as e:
                logger.error(f"Error scraping {url}: {e}")
                # Continue with other URLs

        logger.info(f"Fetched {len(items)} pages from source {source.id}")
        return items

    def _discover_urls(self, source: "KnowledgeSource") -> list[str]:
        """
        Discover URLs from a source using Firecrawl map.

        Args:
            source: KnowledgeSource to map

        Returns:
            List of discovered URLs
        """
        max_pages = source.get_max_pages()

        try:
            map_result = self.firecrawl.map_site(
                url=source.url,
                limit=max_pages,
            )

            if not map_result.get("success"):
                raise FirecrawlAPIError("Map operation failed")

            links = map_result.get("links", [])
            urls = []

            for link in links:
                url = link.get("url") if isinstance(link, dict) else link
                if url and self._should_include_url(source, url):
                    urls.append(url)

            return urls[:max_pages]

        except Exception as e:
            logger.error(f"URL discovery failed for source {source.id}: {e}")
            raise

    def _should_include_url(self, source: "KnowledgeSource", url: str) -> bool:
        """
        Check if URL should be included based on source config.

        Args:
            source: KnowledgeSource with path filters
            url: URL to check

        Returns:
            True if URL should be included
        """
        include_paths = source.get_include_paths()
        exclude_paths = source.get_exclude_paths()

        # If include paths specified, URL must match at least one
        if include_paths:
            matches_include = any(path in url for path in include_paths)
            if not matches_include:
                return False

        # If exclude paths specified, URL must not match any
        if exclude_paths:
            matches_exclude = any(path in url for path in exclude_paths)
            if matches_exclude:
                return False

        return True

    def _scrape_url(self, source: "KnowledgeSource", url: str) -> RawItem | None:
        """
        Scrape a URL and return as RawItem.

        Args:
            source: Parent KnowledgeSource
            url: URL to scrape

        Returns:
            RawItem with scraped content, or None if scraping failed
        """
        try:
            scrape_result = self.firecrawl.scrape_page(
                url=url,
                formats=["markdown"],
            )

            if not scrape_result:
                logger.warning(f"No scrape result for {url}")
                return None

            markdown = scrape_result.get("markdown", "")
            if not markdown:
                logger.warning(f"No markdown content for {url}")
                return None

            metadata = scrape_result.get("metadata", {})
            title = metadata.get("title", url)

            # Generate external_id from URL (MD5 hash)
            external_id = hashlib.md5(url.encode()).hexdigest()

            return RawItem(
                external_id=external_id,
                title=title,
                raw_content=markdown,
                url=url,
                metadata={
                    "word_count": len(markdown.split()),
                    "source_type": source.source_type,
                    **metadata,
                },
            )

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            return None


# Factory function for backwards compatibility
def get_firecrawl_provider() -> FirecrawlProvider:
    """Get a FirecrawlProvider instance."""
    return FirecrawlProvider()
