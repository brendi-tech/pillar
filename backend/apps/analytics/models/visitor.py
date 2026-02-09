"""
Visitor model - tracks identified and anonymous visitors across sessions.

Used for:
- Linking conversations to users across sessions and devices
- Supporting anonymous-to-authenticated visitor transitions
- Enabling cross-device conversation history retrieval
"""
import uuid_utils
from django.db import models
from common.models.base import TenantAwareModel


class Visitor(TenantAwareModel):
    """
    Represents a visitor who interacts with the widget.

    Visitors can be:
    - Anonymous: identified only by visitor_id (localStorage UUID)
    - Authenticated: linked to client's user via external_user_id

    When an anonymous visitor logs in, their record is upgraded with
    external_user_id, enabling cross-device conversation history.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid_utils.uuid7,
        editable=False,
        help_text="Unique visitor ID"
    )

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='analytics_visitors',
        help_text="Organization this visitor belongs to"
    )

    # Visitor identification
    visitor_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Persistent visitor ID from SDK (stored in localStorage)"
    )
    external_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Client's authenticated user ID (enables cross-device history)"
    )

    # User profile
    name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="User's display name"
    )
    email = models.EmailField(
        blank=True,
        default='',
        help_text="User's email address"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata from client application"
    )

    # Timestamps
    first_seen_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the visitor was first seen"
    )
    last_seen_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When the visitor was last active"
    )

    class Meta:
        # NO db_table - Django creates 'analytics_visitor'
        verbose_name = 'Visitor'
        verbose_name_plural = 'Visitors'
        ordering = ['-last_seen_at']
        constraints = [
            # Each visitor_id is unique within an organization
            models.UniqueConstraint(
                fields=['organization', 'visitor_id'],
                name='analytics_visitor_org_visitor_id_uniq'
            ),
            # Each external_user_id is unique within an organization (when not null)
            models.UniqueConstraint(
                fields=['organization', 'external_user_id'],
                name='analytics_visitor_org_external_user_id_uniq',
                condition=models.Q(external_user_id__isnull=False),
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'visitor_id']),
            models.Index(fields=['organization', 'external_user_id']),
            models.Index(fields=['organization', '-last_seen_at']),
            models.Index(fields=['visitor_id', '-last_seen_at']),
        ]

    def __str__(self):
        if self.external_user_id:
            return f"Visitor {self.visitor_id[:8]}... (user: {self.external_user_id})"
        return f"Visitor {self.visitor_id[:8]}... (anonymous)"

    @property
    def is_authenticated(self) -> bool:
        """Whether this visitor has been linked to an authenticated user."""
        return bool(self.external_user_id)
