"""
SyncSecret model — product-level API key for CLI sync, backend SDK auth,
and webhook signature generation.
"""
import re

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

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
    Product API key used for CLI sync, backend SDK registration,
    and webhook signature generation.

    Allows multiple secrets per product for environment isolation
    and key rotation (e.g., production, staging, backend-sdk).
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
        help_text="The secret value (encrypted at rest via Fernet)"
    )

    last_four = models.CharField(
        max_length=4,
        blank=True,
        default='',
        help_text="Last 4 characters of the secret for dashboard display"
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
        help_text="Last time this secret was used"
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this secret can be used for authentication"
    )

    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this secret was revoked"
    )

    class Meta:
        verbose_name = 'Sync Secret'
        verbose_name_plural = 'Sync Secrets'
        unique_together = ['product', 'name']
        indexes = [
            models.Index(
                fields=['product', '-created_at'],
                name='syncsecret_product_created_idx',
            ),
            models.Index(
                fields=['product', 'is_active'],
                name='syncsecret_product_active_idx',
            ),
        ]

    def __str__(self):
        display = f"••••{self.last_four}" if self.last_four else self.name
        return f"{self.product.subdomain}/{display}"

    def revoke(self) -> None:
        """Revoke this secret so it can no longer be used."""
        self.is_active = False
        self.revoked_at = timezone.now()
        self.save(update_fields=['is_active', 'revoked_at', 'updated_at'])
