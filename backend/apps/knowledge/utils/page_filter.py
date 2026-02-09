"""
Utilities for filtering pages during crawling.

Ports essential skip logic from the old backend's CrawlSkipService to filter out
error pages (404s, 500s) and soft 404s (SPAs returning 200 with error content).
"""
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def should_skip_page(page_data: dict, url: str) -> Tuple[bool, str]:
    """
    Check if a crawled page should be skipped.
    
    Filters out:
    - 4xx client errors (404 Not Found, etc.)
    - 5xx server errors (500 Internal Server Error, etc.)
    - Soft 404s (pages returning 200 but displaying error content)
    
    Args:
        page_data: Raw page data from Firecrawl containing metadata, markdown, etc.
        url: The URL of the page (for logging)
    
    Returns:
        Tuple of (should_skip, reason)
        - should_skip: True if the page should be skipped
        - reason: String describing why the page was skipped (empty if not skipped)
    """
    metadata = page_data.get('metadata', {})
    
    # Check HTTP status code - Firecrawl returns it as 'statusCode' or 'status_code'
    status_code = metadata.get('statusCode') or metadata.get('status_code', 200)
    if status_code >= 500:
        logger.debug(f"Skipping server error page {url}: HTTP {status_code}")
        return True, f'server_error_{status_code}'
    if status_code >= 400:
        logger.debug(f"Skipping client error page {url}: HTTP {status_code}")
        return True, f'client_error_{status_code}'
    
    # Check for soft 404 (page returns 200 but is actually an error page)
    title = metadata.get('title', '')
    markdown = page_data.get('markdown', '')
    if is_soft_404(title, markdown):
        logger.debug(f"Skipping soft 404 page: {url}")
        return True, 'soft_404'
    
    return False, ''


def is_soft_404(title: str, content: str) -> bool:
    """
    Detect soft 404s - pages that return HTTP 200 but are actually error pages.
    
    Many SPAs (Next.js, React Router, etc.) return HTTP 200 for all routes
    and display "404 Not Found" content in the browser. This function detects
    those pages by checking the title and content for common 404 patterns.
    
    Args:
        title: Page title from metadata
        content: Markdown content of the page
    
    Returns:
        True if the page appears to be a soft 404
    """
    # Check title for 404 patterns
    if title:
        title_lower = title.lower().strip()
        soft_404_patterns = [
            '404',
            'not found',
            'page not found',
            "page doesn't exist",
            "page cannot be found",
        ]
        if any(pattern in title_lower for pattern in soft_404_patterns):
            return True
    
    # Check content for soft 404 indicators
    if content:
        # Only check the first 1000 chars - 404 messages usually appear early
        sample = content[:1000].lower()
        soft_404_keywords = [
            '404',
            'not found',
            'page not found',
            "page doesn't exist",
            'cannot find the page',
            'no longer exists',
            'has been removed',
            'the page you are looking for',
        ]
        keyword_count = sum(1 for kw in soft_404_keywords if kw in sample)
        
        # Short content with 404 keywords = likely error page
        if len(content.strip()) < 500 and keyword_count >= 1:
            return True
        
        # Multiple 404 keywords = likely error page regardless of length
        if keyword_count >= 2:
            return True
    
    return False
