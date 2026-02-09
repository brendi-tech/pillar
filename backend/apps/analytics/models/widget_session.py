"""
WidgetSession model - tracks visitor sessions across widget interactions.

Used for passive analytics capture from SDK request headers.
"""
from django.db import models
from common.models.base import TenantAwareModel


class WidgetSession(TenantAwareModel):
    """
    Tracks a visitor session across page views and interactions.

    Created/updated passively from API request headers sent by the SDK.
    Links to chat conversations, article views, and searches for analytics.
    """

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='analytics_widget_sessions',
        help_text="Organization this session belongs to"
    )

    # Visitor identification
    visitor_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Persistent visitor ID from SDK (stored in localStorage)"
    )
    session_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Session ID from SDK (stored in sessionStorage)"
    )

    # Optional customer user identification
    user_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        db_index=True,
        help_text="Customer's authenticated user ID (passed via SDK config)"
    )
    user_profile = models.JSONField(
        default=dict,
        blank=True,
        help_text="User profile data from SDK UserProfile"
    )

    # Session metadata
    first_page_url = models.URLField(
        max_length=2000,
        blank=True,
        default='',
        help_text="First page URL where the session started"
    )
    last_page_url = models.URLField(
        max_length=2000,
        blank=True,
        default='',
        help_text="Last page URL seen in this session"
    )
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="User agent string"
    )

    # Timestamps
    started_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the session started"
    )
    last_seen_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="Last activity in this session"
    )

    # Aggregates (updated on each request)
    page_count = models.PositiveIntegerField(
        default=1,
        help_text="Number of unique pages visited in this session"
    )
    chat_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of chat conversations started in this session"
    )
    search_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of searches performed in this session"
    )

    class Meta:
        # NO db_table - Django creates 'analytics_widgetsession'
        verbose_name = 'Widget Session'
        verbose_name_plural = 'Widget Sessions'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['organization', 'visitor_id']),
            models.Index(fields=['organization', '-started_at']),
            models.Index(fields=['visitor_id', '-started_at']),
        ]

    def __str__(self):
        return f"Session {self.session_id[:8]}... ({self.visitor_id[:8]}...)"
