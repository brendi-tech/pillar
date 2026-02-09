"""
SyncSecret model for multi-secret action sync from CI/CD pipelines.
"""
import re
from django.core.exceptions import ValidationError
from django.db import models

from common.fields import EncryptedTextField
from common.models.base import TenantAwareModel


def validate_secret_name(value: str) -> None:
    """
    Validate secret name format.

    Rules:
    - 1-50 characters
    - Lowercase alphanumeric and hyphens only
    - Cannot start or end with hyphen
    """
    if not value:
        raise ValidationError("Secret name is required")

    if len(value) > 50:
        raise ValidationError("Secret name must be 50 characters or less")

    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$', value):
        raise ValidationError(
            "Secret name must contain only lowercase letters, numbers, and hyphens, "
            "and cannot start or end with a hyphen"
        )


class SyncSecret(TenantAwareModel):
    """
    Named sync secret for code-first action sync from CI/CD pipelines.

    Allows multiple secrets per product for environment isolation
    (e.g., production, staging, dev-ci).
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='sync_secrets',
        help_text="Product this secret belongs to"
    )

    name = models.CharField(
        max_length=50,
        validators=[validate_secret_name],
        help_text="Human-readable name for this secret (e.g., 'production', 'staging')"
    )

    secret_hash = EncryptedTextField(
        help_text="The sync secret (encrypted at rest)"
    )

    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_sync_secrets',
        help_text="User who created this secret"
    )

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Last time this secret was used for a sync"
    )

    class Meta:
        verbose_name = 'Sync Secret'
        verbose_name_plural = 'Sync Secrets'
        unique_together = ['product', 'name']
        indexes = [
            models.Index(fields=['product', '-created_at']),
        ]

    def __str__(self):
        return f"{self.product.subdomain}/{self.name}"
