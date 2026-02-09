"""
Search model - tracks search queries for analytics.
"""
from django.db import models
from common.models.base import TenantAwareModel


class Search(TenantAwareModel):
    """
    Tracks search queries.

    Used for analytics and content gap detection.
    """

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='analytics_searches',
        help_text="Organization this search belongs to"
    )

    # Search details
    query = models.CharField(
        max_length=500,
        db_index=True,
        help_text="Search query text"
    )
    searched_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the search was performed"
    )

    # Results
    results_count = models.IntegerField(
        default=0,
        help_text="Number of results returned"
    )
    clicked_knowledge_item = models.ForeignKey(
        'knowledge.KnowledgeItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analytics_search_clicks',
        db_column='clicked_article_id',  # Keep old column name for backwards compatibility
        help_text="Knowledge item that was clicked (if any)"
    )

    # Tracking
    session_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        db_index=True,
        help_text="Session ID for tracking user sessions"
    )

    class Meta:
        # NO db_table - Django creates 'analytics_search'
        verbose_name = 'Search'
        verbose_name_plural = 'Searches'
        ordering = ['-searched_at']
        indexes = [
            models.Index(fields=['organization', '-searched_at']),
            models.Index(fields=['query', '-searched_at']),
            models.Index(fields=['session_id', '-searched_at']),
        ]

    def __str__(self):
        return f"{self.query} - {self.searched_at}"
