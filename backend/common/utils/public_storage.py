"""
Public storage backend for article images.

Provides a GCS storage class configured for public access (no signed URLs).
Used for help center article images that are meant to be publicly accessible.
"""
import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)


class PublicArticleStorage:
    """
    Storage interface for public article images.
    
    Uses GCS in production with public URLs (no querystring auth).
    Falls back to local filesystem in development.
    """

    def __init__(self):
        self.backend = getattr(settings, 'STORAGE_BACKEND', 'local')
        self._storage = None

    @property
    def storage(self):
        """Lazy-initialize the underlying storage backend."""
        if self._storage is None:
            self._storage = self._create_storage()
        return self._storage

    def _create_storage(self):
        """Create the appropriate storage backend based on settings."""
        if self.backend == 'gcs':
            from storages.backends.gcloud import GoogleCloudStorage

            bucket_name = getattr(settings, 'ARTICLE_IMAGES_BUCKET', 'pillar-public')
            project_id = getattr(settings, 'GS_PROJECT_ID', '')

            kwargs = {
                "bucket_name": bucket_name,
                "project_id": project_id,
                "querystring_auth": False,  # Public URLs, no signing
                "default_acl": "publicRead",
            }

            # Use service account key if available (same as default storage)
            gcs_key_b64 = os.environ.get('GCS_SERVICE_ACCOUNT_KEY_JSON_B64')
            if gcs_key_b64:
                try:
                    import base64
                    import json

                    from google.oauth2 import service_account
                    gcs_key_json = base64.b64decode(gcs_key_b64).decode('utf-8')
                    gcs_key_dict = json.loads(gcs_key_json)
                    kwargs["credentials"] = (
                        service_account.Credentials.from_service_account_info(gcs_key_dict)
                    )
                except Exception as e:
                    logger.warning(f"Failed to load GCS credentials for public storage: {e}")

            return GoogleCloudStorage(**kwargs)
        elif self.backend == 's3':
            from storages.backends.s3boto3 import S3Boto3Storage

            return S3Boto3Storage(
                bucket_name=getattr(settings, 'ARTICLE_IMAGES_BUCKET', 'pillar-public'),
                querystring_auth=False,
                default_acl='public-read',
            )
        else:
            # Local development - use filesystem
            from django.core.files.storage import FileSystemStorage

            media_root = getattr(settings, 'MEDIA_ROOT', '/tmp/media')
            media_url = getattr(settings, 'MEDIA_URL', '/media/')

            return FileSystemStorage(
                location=os.path.join(media_root, 'hc-articles'),
                base_url=f"{media_url}hc-articles/",
            )

    def save(self, name: str, content, max_length: int | None = None) -> str:
        """
        Save a file to storage.
        
        Args:
            name: File path within the storage (e.g., "org_id/uuid.png")
            content: File content (file-like object)
            max_length: Optional max filename length
            
        Returns:
            The actual saved path
        """
        return self.storage.save(name, content, max_length=max_length)

    def url(self, name: str) -> str:
        """
        Get the public URL for a file.
        
        Args:
            name: File path within storage
            
        Returns:
            Public URL to access the file
        """
        return self.storage.url(name)

    def exists(self, name: str) -> bool:
        """Check if a file exists in storage."""
        return self.storage.exists(name)

    def delete(self, name: str) -> None:
        """Delete a file from storage."""
        self.storage.delete(name)


# Singleton instance for convenience
_public_article_storage: PublicArticleStorage | None = None


def get_public_article_storage() -> PublicArticleStorage:
    """Get or create the public article storage instance."""
    global _public_article_storage
    if _public_article_storage is None:
        _public_article_storage = PublicArticleStorage()
    return _public_article_storage


# Lazy accessor
class _LazyPublicArticleStorage:
    """Lazy proxy that initializes storage on first access."""

    def __getattr__(self, name):
        return getattr(get_public_article_storage(), name)


public_article_storage = _LazyPublicArticleStorage()




