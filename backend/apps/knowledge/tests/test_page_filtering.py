"""
Tests for page filtering logic in the crawl pipeline.

Covers the webhook processor (_process_single_page) and the batch
crawl processor (_process_page), plus the should_skip_page utility.
"""
import pytest
from unittest.mock import MagicMock, patch

from apps.knowledge.services.webhook_processor import KnowledgeWebhookProcessor
from apps.knowledge.utils.page_filter import should_skip_page


def _make_source(url: str) -> MagicMock:
    """Create a mock KnowledgeSource with the given URL."""
    source = MagicMock()
    source.url = url
    source.id = "test-source-id"
    source.organization_id = "test-org-id"
    source.organization = MagicMock()
    source.organization.id = "test-org-id"
    source.product = MagicMock()
    source.product.id = "test-product-id"
    return source


def _make_page_data(
    url: str = "https://www.example.com/page",
    markdown: str = "A" * 200,
    title: str = "Test Page",
    status_code: int = 200,
) -> dict:
    """Create a mock Firecrawl page data dict."""
    return {
        "url": url,
        "markdown": markdown,
        "metadata": {
            "title": title,
            "description": "A test page",
            "statusCode": status_code,
        },
    }


class TestWebhookPageFiltering:
    """Tests for KnowledgeWebhookProcessor._process_single_page."""

    def setup_method(self):
        self.processor = KnowledgeWebhookProcessor()

    def test_www_domain_mismatch_not_skipped(self, db, organization, product):
        """Page with www.example.com is processed when source is example.com."""
        from apps.knowledge.models import KnowledgeSource

        source = KnowledgeSource.objects.create(
            organization=organization,
            product=product,
            name="Example",
            source_type=KnowledgeSource.SourceType.WEBSITE_CRAWL,
            url="https://example.com",
        )
        page_data = _make_page_data(url="https://www.example.com/about")

        result = self.processor._process_single_page(source, page_data)

        assert result == "created"
        from apps.knowledge.models import KnowledgeItem
        assert KnowledgeItem.objects.filter(source=source).count() == 1

    def test_different_domain_not_skipped(self, db, organization, product):
        """Page from a different domain is still processed (Firecrawl handles filtering)."""
        from apps.knowledge.models import KnowledgeSource

        source = KnowledgeSource.objects.create(
            organization=organization,
            product=product,
            name="Example",
            source_type=KnowledgeSource.SourceType.WEBSITE_CRAWL,
            url="https://example.com",
        )
        page_data = _make_page_data(url="https://otherdomain.com/page")

        result = self.processor._process_single_page(source, page_data)

        assert result == "created"

    @patch("apps.knowledge.services.webhook_processor.logger")
    def test_different_domain_logs_warning(self, mock_logger, db, organization, product):
        """Page from a different domain generates a warning log."""
        from apps.knowledge.models import KnowledgeSource

        source = KnowledgeSource.objects.create(
            organization=organization,
            product=product,
            name="Example",
            source_type=KnowledgeSource.SourceType.WEBSITE_CRAWL,
            url="https://example.com",
        )
        page_data = _make_page_data(url="https://otherdomain.com/page")

        self.processor._process_single_page(source, page_data)

        warning_calls = [str(c) for c in mock_logger.warning.call_args_list]
        assert any("Domain mismatch" in c and "processing anyway" in c for c in warning_calls)

    def test_content_too_short_skipped(self):
        """Page with < 100 chars of markdown is skipped."""
        source = _make_source("https://example.com")
        page_data = _make_page_data(markdown="Short content")

        result = self.processor._process_single_page(source, page_data)

        assert result == "skipped"

    @patch("apps.knowledge.services.webhook_processor.logger")
    def test_content_too_short_logged(self, mock_logger):
        """Content-too-short skip is logged."""
        source = _make_source("https://example.com")
        page_data = _make_page_data(
            url="https://example.com/tiny",
            markdown="Short",
        )

        self.processor._process_single_page(source, page_data)

        info_calls = [str(c) for c in mock_logger.info.call_args_list]
        assert any("content too short" in c for c in info_calls)

    def test_no_url_skipped(self):
        """Page with no URL is skipped."""
        source = _make_source("https://example.com")
        page_data = {"markdown": "A" * 200, "metadata": {}}

        result = self.processor._process_single_page(source, page_data)

        assert result == "skipped"

    @patch("apps.knowledge.services.webhook_processor.logger")
    def test_no_url_logged(self, mock_logger):
        """No-URL skip is logged."""
        source = _make_source("https://example.com")
        page_data = {"markdown": "A" * 200, "metadata": {}}

        self.processor._process_single_page(source, page_data)

        info_calls = [str(c) for c in mock_logger.info.call_args_list]
        assert any("no URL in page data" in c for c in info_calls)

    def test_soft_404_skipped(self):
        """Page with 'Page Not Found' title is skipped."""
        source = _make_source("https://example.com")
        page_data = _make_page_data(title="Page Not Found")

        result = self.processor._process_single_page(source, page_data)

        assert result == "skipped"

    def test_http_404_skipped(self):
        """Page with HTTP 404 status code is skipped."""
        source = _make_source("https://example.com")
        page_data = _make_page_data(status_code=404)

        result = self.processor._process_single_page(source, page_data)

        assert result == "skipped"

    def test_http_500_skipped(self):
        """Page with HTTP 500 status code is skipped."""
        source = _make_source("https://example.com")
        page_data = _make_page_data(status_code=500)

        result = self.processor._process_single_page(source, page_data)

        assert result == "skipped"

    def test_valid_page_created(self, db, organization, product):
        """Normal page with valid content creates a KnowledgeItem."""
        from apps.knowledge.models import KnowledgeSource, KnowledgeItem

        source = KnowledgeSource.objects.create(
            organization=organization,
            product=product,
            name="Example",
            source_type=KnowledgeSource.SourceType.WEBSITE_CRAWL,
            url="https://example.com",
        )
        page_data = _make_page_data(url="https://example.com/docs/guide")

        result = self.processor._process_single_page(source, page_data)

        assert result == "created"
        item = KnowledgeItem.objects.get(source=source)
        assert item.url == "https://example.com/docs/guide"
        assert item.title == "Test Page"
        assert item.status == KnowledgeItem.Status.PENDING
        assert item.item_type == KnowledgeItem.ItemType.PAGE


class TestShouldSkipPage:
    """Tests for the should_skip_page utility."""

    def test_normal_page_not_skipped(self):
        page_data = _make_page_data()
        skip, reason = should_skip_page(page_data, "https://example.com/page")
        assert skip is False
        assert reason == ""

    def test_404_skipped(self):
        page_data = _make_page_data(status_code=404)
        skip, reason = should_skip_page(page_data, "https://example.com/missing")
        assert skip is True
        assert "client_error" in reason

    def test_500_skipped(self):
        page_data = _make_page_data(status_code=500)
        skip, reason = should_skip_page(page_data, "https://example.com/error")
        assert skip is True
        assert "server_error" in reason

    def test_soft_404_by_title(self):
        page_data = _make_page_data(title="404 - Page Not Found")
        skip, reason = should_skip_page(page_data, "https://example.com/gone")
        assert skip is True
        assert reason == "soft_404"

    def test_soft_404_by_content(self):
        page_data = _make_page_data(
            title="My Site",
            markdown="Page not found. The page you are looking for does not exist.",
        )
        skip, reason = should_skip_page(page_data, "https://example.com/gone")
        assert skip is True
        assert reason == "soft_404"

    def test_docs_about_errors_not_false_positive(self):
        """Docs page that discusses error handling should NOT be flagged as soft 404."""
        long_content = (
            "# HTTP Error Handling\n\n"
            "This guide covers how to handle HTTP errors in your application. "
            "When a server returns an error response, your application should "
            "handle it gracefully. Common patterns include retry logic for "
            "transient failures and user-friendly error messages for permanent "
            "failures. Here is how to implement error handling in Python...\n"
            + "More content about error handling patterns. " * 20
        )
        page_data = _make_page_data(
            title="HTTP Error Handling Guide",
            markdown=long_content,
        )
        skip, reason = should_skip_page(page_data, "https://example.com/docs/errors")
        assert skip is False
