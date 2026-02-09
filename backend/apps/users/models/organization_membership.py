"""
OrganizationMembership model for user-organization relationships.
"""
from django.db import models
from common.models import BaseModel


class OrganizationMembership(BaseModel):
    """
    Junction table for User-Organization relationship with roles.
    """
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        MEMBER = 'member', 'Member'

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='organization_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER
    )

    # Invitation metadata
    invited_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invitations_sent'
    )
    invitation_accepted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'users_organizationmembership'
        verbose_name = 'Organization Membership'
        verbose_name_plural = 'Organization Memberships'
        unique_together = [['organization', 'user']]
        ordering = ['-created_at']
        indexes = [
            # Performance indexes
            models.Index(fields=['user', 'organization']),
            models.Index(fields=['organization', 'role']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.organization.name} ({self.role})"

    @property
    def is_admin(self):
        """Check if user has admin privileges."""
        return self.role == self.Role.ADMIN
