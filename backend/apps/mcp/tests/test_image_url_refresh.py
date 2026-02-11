"""
Tests for image URL refresh in conversation history.

Covers:
- _extract_gcs_path: extracts storage path from GCS signed URLs
- _refresh_image_urls: re-signs images with path, legacy URL, local URL
"""
import pytest
from unittest.mock import patch, MagicMock

from apps.mcp.views.conversation_history import _extract_gcs_path, _refresh_image_urls


# =============================================================================
# Tests: _extract_gcs_path
# =============================================================================

class TestExtractGcsPath:
    """Tests for _extract_gcs_path()."""

    @patch('apps.mcp.views.conversation_history.settings')
    def test_extracts_path_from_valid_gcs_url(self, mock_settings):
        """Should extract the storage path from a standard GCS signed URL."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        url = (
            'https://storage.googleapis.com/pillar-storage/'
            'conversations/images/org-1/hc-2/abc123.jpg'
            '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=...'
        )
        path = _extract_gcs_path(url)
        assert path == 'conversations/images/org-1/hc-2/abc123.jpg'

    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_none_for_non_gcs_url(self, mock_settings):
        """Should return None for non-GCS URLs."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        assert _extract_gcs_path('https://example.com/image.jpg') is None

    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_none_for_wrong_bucket(self, mock_settings):
        """Should return None if the bucket doesn't match."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        url = 'https://storage.googleapis.com/other-bucket/path.jpg?X-Goog-Algorithm=...'
        assert _extract_gcs_path(url) is None

    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_none_for_empty_path(self, mock_settings):
        """Should return None if path portion is empty."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        url = 'https://storage.googleapis.com/pillar-storage/?X-Goog-Algorithm=...'
        assert _extract_gcs_path(url) is None

    @patch('apps.mcp.views.conversation_history.settings')
    def test_handles_url_without_query_string(self, mock_settings):
        """Should still extract path even without a query string."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        url = 'https://storage.googleapis.com/pillar-storage/conversations/images/org-1/img.png'
        path = _extract_gcs_path(url)
        assert path == 'conversations/images/org-1/img.png'

    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_none_for_localhost_url(self, mock_settings):
        """Should return None for localhost URLs."""
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        assert _extract_gcs_path('http://localhost:8000/media/img.jpg') is None


# =============================================================================
# Tests: _refresh_image_urls
# =============================================================================

class TestRefreshImageUrls:
    """Tests for _refresh_image_urls()."""

    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_unchanged_for_local_storage(self, mock_settings):
        """Should return images unchanged when storage backend is local."""
        mock_settings.STORAGE_BACKEND = 'local'
        images = [{'url': 'http://localhost:8000/media/img.jpg', 'detail': 'low'}]
        result = _refresh_image_urls(images)
        assert result == images

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_resigns_image_with_path(self, mock_settings, mock_storage):
        """Should re-sign using the path field when present."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.return_value = 'https://storage.googleapis.com/pillar-storage/img.jpg?fresh-sig'

        images = [{'url': 'https://old-expired-url', 'detail': 'low', 'path': 'conversations/images/img.jpg'}]
        result = _refresh_image_urls(images)

        assert len(result) == 1
        assert result[0]['url'] == 'https://storage.googleapis.com/pillar-storage/img.jpg?fresh-sig'
        assert result[0]['path'] == 'conversations/images/img.jpg'
        assert result[0]['detail'] == 'low'
        mock_storage.url.assert_called_once_with('conversations/images/img.jpg')

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_resigns_legacy_image_by_extracting_path(self, mock_settings, mock_storage):
        """Should extract path from GCS signed URL and re-sign for legacy images."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.return_value = 'https://storage.googleapis.com/pillar-storage/conversations/images/org-1/img.jpg?new-sig'

        legacy_url = (
            'https://storage.googleapis.com/pillar-storage/'
            'conversations/images/org-1/img.jpg'
            '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=172800'
        )
        images = [{'url': legacy_url, 'detail': 'low'}]
        result = _refresh_image_urls(images)

        assert len(result) == 1
        assert 'new-sig' in result[0]['url']
        assert result[0]['path'] == 'conversations/images/org-1/img.jpg'
        mock_storage.url.assert_called_once_with('conversations/images/org-1/img.jpg')

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_returns_unchanged_for_non_gcs_url_on_gcs_backend(self, mock_settings, mock_storage):
        """Non-GCS URLs without path should be returned as-is even on GCS backend."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'

        images = [{'url': 'https://cdn.example.com/img.jpg', 'detail': 'low'}]
        result = _refresh_image_urls(images)

        assert result == images
        mock_storage.url.assert_not_called()

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_handles_resign_failure_gracefully(self, mock_settings, mock_storage):
        """Should return image with original URL if re-signing fails."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.side_effect = Exception("Signing error")

        images = [{'url': 'https://old-url', 'detail': 'low', 'path': 'conversations/images/img.jpg'}]
        result = _refresh_image_urls(images)

        assert len(result) == 1
        assert result[0]['url'] == 'https://old-url'  # Original URL preserved

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_does_not_mutate_original_list(self, mock_settings, mock_storage):
        """Should not mutate the original image dicts."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.return_value = 'https://fresh-url'

        original = {'url': 'https://old-url', 'detail': 'low', 'path': 'img.jpg'}
        images = [original]
        result = _refresh_image_urls(images)

        # Original should be unchanged
        assert original['url'] == 'https://old-url'
        # Result should have fresh URL
        assert result[0]['url'] == 'https://fresh-url'

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_handles_multiple_images(self, mock_settings, mock_storage):
        """Should process multiple images correctly."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.side_effect = lambda p: f'https://fresh/{p}'

        images = [
            {'url': 'https://old-1', 'detail': 'low', 'path': 'img1.jpg'},
            {'url': 'https://old-2', 'detail': 'high', 'path': 'img2.png'},
        ]
        result = _refresh_image_urls(images)

        assert len(result) == 2
        assert result[0]['url'] == 'https://fresh/img1.jpg'
        assert result[1]['url'] == 'https://fresh/img2.png'

    @patch('apps.mcp.views.conversation_history.settings')
    def test_handles_empty_images_list(self, mock_settings):
        """Should return empty list for empty input."""
        mock_settings.STORAGE_BACKEND = 'gcs'
        assert _refresh_image_urls([]) == []

    @patch('apps.mcp.views.conversation_history.default_storage')
    @patch('apps.mcp.views.conversation_history.settings')
    def test_works_with_s3_backend(self, mock_settings, mock_storage):
        """Should also re-sign for S3 backend."""
        mock_settings.STORAGE_BACKEND = 's3'
        mock_settings.GS_BUCKET_NAME = 'pillar-storage'
        mock_storage.url.return_value = 'https://s3-fresh-url'

        images = [{'url': 'https://old', 'detail': 'low', 'path': 'img.jpg'}]
        result = _refresh_image_urls(images)

        assert result[0]['url'] == 'https://s3-fresh-url'
        mock_storage.url.assert_called_once_with('img.jpg')
