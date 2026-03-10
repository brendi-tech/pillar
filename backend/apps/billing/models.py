"""
Billing models.
"""
import uuid

from django.db import models
from django.utils import timezone


class BonusResponseGrantQuerySet(models.QuerySet):
    def active(self):
        """Return only grants that have not expired."""
        now = timezone.now()
        return self.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        )


class BonusResponseGrant(models.Model):
    """
    A grant of free bonus responses for an organization.

    Multiple grants can exist per org and they stack. The effective bonus
    is the sum of all unexpired grants. Grants that pass their expires_at
    silently stop contributing.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "users.Organization",
        on_delete=models.CASCADE,
        related_name="bonus_response_grants",
    )
    amount = models.PositiveIntegerField(
        help_text="Number of bonus responses in this grant",
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When this grant expires (null = never expires)",
    )
    memo = models.CharField(
        max_length=255,
        blank=True,
        help_text="Why this grant was given (e.g. 'Early adopter bonus')",
    )
    granted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Admin who granted this",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = BonusResponseGrantQuerySet.as_manager()

    class Meta:
        db_table = "billing_bonus_response_grant"
        ordering = ["-created_at"]
        verbose_name = "Bonus Response Grant"
        verbose_name_plural = "Bonus Response Grants"

    def __str__(self) -> str:
        org_name = getattr(self.organization, "name", self.organization_id)
        expires = self.expires_at.strftime("%Y-%m-%d") if self.expires_at else "never"
        return f"{self.amount} responses for {org_name} (expires {expires})"

    @property
    def is_active(self) -> bool:
        if self.expires_at is None:
            return True
        return timezone.now() < self.expires_at
