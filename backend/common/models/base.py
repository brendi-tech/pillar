"""
Base model classes for all Django models.
"""
import uuid_utils.compat as uuid_utils
from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """
    Abstract base model with common timestamp fields and UUID primary key.
    All models should inherit from this or TenantAwareModel.

    Uses UUIDv7 for primary keys - time-ordered UUIDs that index efficiently
    in B-trees since they're roughly monotonically increasing.
    """
    id = models.UUIDField(primary_key=True, default=uuid_utils.uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class TenantAwareModel(BaseModel):
    """
    Abstract base model for all tenant-specific (multi-tenant) data.
    Includes organization foreign key for data isolation.
    """
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='%(app_label)s_%(class)s_set',
        db_index=True,
        help_text="Organization that owns this data"
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']
        # Default indexes for tenant queries
        indexes = [
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['organization', '-updated_at']),
        ]
