"""
PendingUpload model - temporary storage for files uploaded before source creation.
"""
from django.db import models
from django.utils import timezone
from datetime import timedelta
from common.models.base import TenantAwareModel


def default_expiry():
    """Return expiry time 24 hours from now."""
    return timezone.now() + timedelta(hours=24)


class PendingUpload(TenantAwareModel):
    """
    Temporary storage for files uploaded before a source is created.
    
    Files are uploaded to staging storage immediately when dragged/dropped,
    then attached to a KnowledgeSource when the user clicks "Create".
    
    Pending uploads expire after 24 hours if not attached to a source.
    A cleanup task periodically removes expired uploads and their files.
    """
    
    # Override organization to use a specific related_name
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='pending_uploads',
        help_text="Organization this upload belongs to"
    )
    
    # File information
    original_filename = models.CharField(
        max_length=255,
        help_text="Original filename as uploaded by user"
    )
    file_path = models.CharField(
        max_length=500,
        help_text="Path in cloud storage: pending/{org_id}/{upload_id}/{filename}"
    )
    file_size = models.BigIntegerField(
        help_text="File size in bytes"
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="MIME type of the file"
    )
    
    # Expiry for cleanup
    expires_at = models.DateTimeField(
        default=default_expiry,
        db_index=True,
        help_text="When this pending upload expires and should be cleaned up"
    )
    
    class Meta:
        db_table = 'knowledge_pending_upload'
        verbose_name = 'Pending Upload'
        verbose_name_plural = 'Pending Uploads'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'expires_at']),
        ]
    
    def __str__(self):
        return f"{self.original_filename} (pending)"
    
    @property
    def is_expired(self) -> bool:
        """Check if this pending upload has expired."""
        return timezone.now() > self.expires_at
    
    @classmethod
    def get_expired(cls):
        """Get queryset of expired pending uploads."""
        return cls.objects.filter(expires_at__lt=timezone.now())
