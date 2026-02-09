"""
OrganizationInvitation model for pending organization invitations.
"""
from django.db import models
from django.utils import timezone
from common.models import BaseModel
import uuid


class OrganizationInvitation(BaseModel):
    """
    Stores pending invitations to join an organization.
    Users can be invited by email even if they don't have an account yet.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        EXPIRED = 'expired', 'Expired'

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    email = models.EmailField(
        help_text='Email address of the invited user'
    )
    role = models.CharField(
        max_length=20,
        choices=[
            ('admin', 'Admin'),
            ('member', 'Member'),
        ],
        default='member'
    )

    # Invitation metadata
    invited_by = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='organization_invitations_sent'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text='Unique token for accepting the invitation'
    )
    expires_at = models.DateTimeField(
        help_text='When the invitation expires'
    )
    accepted_at = models.DateTimeField(blank=True, null=True)
    declined_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'users_organizationinvitation'
        verbose_name = 'Organization Invitation'
        verbose_name_plural = 'Organization Invitations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'status']),
            models.Index(fields=['token']),
        ]

    def __str__(self):
        return f"Invitation to {self.email} for {self.organization.name} ({self.status})"

    def is_valid(self):
        """Check if the invitation is still valid."""
        return (
            self.status == self.Status.PENDING and
            self.expires_at > timezone.now()
        )

    def accept(self, user):
        """Accept the invitation and create the membership."""
        if not self.is_valid():
            raise ValueError("Invitation is not valid")

        if user.email != self.email:
            raise ValueError("User email doesn't match invitation email")

        from apps.users.models import OrganizationMembership

        # Check if user is already a member
        existing_membership = OrganizationMembership.objects.filter(
            organization=self.organization,
            user=user
        ).first()

        if existing_membership:
            # Already a member - just mark invitation as accepted
            self.status = self.Status.ACCEPTED
            self.accepted_at = timezone.now()
            self.save()
            return existing_membership

        # Create the membership
        membership = OrganizationMembership.objects.create(
            organization=self.organization,
            user=user,
            role=self.role,
            invited_by=self.invited_by,
            invitation_accepted_at=timezone.now()
        )

        # Mark invitation as accepted
        self.status = self.Status.ACCEPTED
        self.accepted_at = timezone.now()
        self.save()

        return membership

    def decline(self):
        """Decline the invitation."""
        if self.status != self.Status.PENDING:
            raise ValueError("Can only decline pending invitations")

        self.status = self.Status.DECLINED
        self.declined_at = timezone.now()
        self.save()

    def save(self, *args, **kwargs):
        """Set expiration time if not set."""
        if not self.expires_at:
            # Default to 28 days from now
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(days=28)
        super().save(*args, **kwargs)
