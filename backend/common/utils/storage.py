"""
Storage utility functions for S3/GCS object storage.
"""
import os
import logging
from typing import Optional, BinaryIO
from django.conf import settings

logger = logging.getLogger(__name__)

# Lazy import for optional dependencies
boto3 = None
ClientError = None


class StorageClient:
    """
    Unified interface for object storage (S3/GCS/local).
    """

    def __init__(self):
        self.backend = getattr(settings, 'STORAGE_BACKEND', 'local')

        if self.backend == 's3':
            global boto3, ClientError
            import boto3 as _boto3
            from botocore.exceptions import ClientError as _ClientError
            boto3 = _boto3
            ClientError = _ClientError

            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            self.bucket = settings.AWS_STORAGE_BUCKET_NAME

        elif self.backend == 'gcs':
            from google.cloud import storage
            self.gcs_client = storage.Client(project=settings.GS_PROJECT_ID)
            self.bucket = self.gcs_client.bucket(settings.GS_BUCKET_NAME)

        elif self.backend == 'local':
            self.local_root = getattr(settings, 'MEDIA_ROOT', '/tmp/media')

    def save(
        self,
        file_path: str,
        file_content: BinaryIO,
        content_type: Optional[str] = None
    ) -> str:
        """
        Save a file to storage.

        Args:
            file_path: Path within storage (e.g., "crawls/site123/page.html")
            file_content: File content as binary stream
            content_type: MIME type of the file

        Returns:
            The storage path/URL of the saved file
        """
        try:
            if self.backend == 's3':
                return self._save_s3(file_path, file_content, content_type)
            elif self.backend == 'gcs':
                return self._save_gcs(file_path, file_content, content_type)
            else:
                return self._save_local(file_path, file_content)
        except Exception as e:
            logger.error(f"Failed to save file {file_path}: {e}")
            raise

    def _save_s3(self, file_path: str, file_content: BinaryIO, content_type: Optional[str]) -> str:
        """Save to S3."""
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type

        self.s3_client.upload_fileobj(
            file_content,
            self.bucket,
            file_path,
            ExtraArgs=extra_args
        )

        return f"s3://{self.bucket}/{file_path}"

    def _save_gcs(self, file_path: str, file_content: BinaryIO, content_type: Optional[str]) -> str:
        """Save to GCS."""
        blob = self.bucket.blob(file_path)
        if content_type:
            blob.content_type = content_type

        blob.upload_from_file(file_content)
        return f"gs://{self.bucket.name}/{file_path}"

    def _save_local(self, file_path: str, file_content: BinaryIO) -> str:
        """Save to local filesystem."""
        full_path = os.path.join(self.local_root, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb') as f:
            f.write(file_content.read())

        return full_path

    def get(self, file_path: str) -> bytes:
        """
        Retrieve a file from storage.

        Args:
            file_path: Path within storage

        Returns:
            File content as bytes
        """
        try:
            if self.backend == 's3':
                response = self.s3_client.get_object(Bucket=self.bucket, Key=file_path)
                return response['Body'].read()

            elif self.backend == 'gcs':
                blob = self.bucket.blob(file_path)
                return blob.download_as_bytes()

            else:  # local
                full_path = os.path.join(self.local_root, file_path)
                with open(full_path, 'rb') as f:
                    return f.read()

        except Exception as e:
            logger.error(f"Failed to retrieve file {file_path}: {e}")
            raise

    def delete(self, file_path: str) -> bool:
        """
        Delete a file from storage.

        Args:
            file_path: Path within storage

        Returns:
            True if successful, False otherwise
        """
        try:
            if self.backend == 's3':
                self.s3_client.delete_object(Bucket=self.bucket, Key=file_path)

            elif self.backend == 'gcs':
                blob = self.bucket.blob(file_path)
                blob.delete()

            else:  # local
                full_path = os.path.join(self.local_root, file_path)
                if os.path.exists(full_path):
                    os.remove(full_path)

            return True

        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    def exists(self, file_path: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            file_path: Path within storage

        Returns:
            True if file exists, False otherwise
        """
        try:
            if self.backend == 's3':
                try:
                    self.s3_client.head_object(Bucket=self.bucket, Key=file_path)
                    return True
                except ClientError:
                    return False

            elif self.backend == 'gcs':
                blob = self.bucket.blob(file_path)
                return blob.exists()

            else:  # local
                full_path = os.path.join(self.local_root, file_path)
                return os.path.exists(full_path)

        except Exception as e:
            logger.error(f"Failed to check file existence {file_path}: {e}")
            return False

    def generate_signed_url(self, file_path: str, expiration: int = 172800) -> str:
        """
        Generate signed URL for private file (48hr default).
        
        Args:
            file_path: Path within storage (e.g., "conversations/images/site-id/uuid.jpg")
            expiration: Expiration in seconds (default: 48 hours)
        
        Returns:
            Signed URL that expires after specified time
        """
        try:
            if self.backend == 'gcs':
                blob = self.bucket.blob(file_path)
                return blob.generate_signed_url(
                    version="v4",
                    expiration=expiration,
                    method="GET"
                )
            elif self.backend == 's3':
                return self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': file_path},
                    ExpiresIn=expiration
                )
            else:
                # Local development - return direct URL
                from django.conf import settings
                return f"{settings.MEDIA_URL}{file_path}"
        except Exception as e:
            logger.error(f"Signed URL generation failed for {file_path}: {e}")
            raise


# Singleton instance
_storage_client = None


def get_storage_client() -> StorageClient:
    """Get or create a storage client instance."""
    global _storage_client
    if _storage_client is None:
        _storage_client = StorageClient()
    return _storage_client


class _LazyStorageClient:
    """Lazy proxy for storage client that only initializes when accessed."""
    
    def __getattr__(self, name):
        return getattr(get_storage_client(), name)


# Convenience accessor - lazy initialization
storage_client = _LazyStorageClient()

