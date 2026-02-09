"""
KnowledgeSyncHistory model - tracks sync operations for knowledge sources.
"""
from django.db import models
from common.models.base import TenantAwareModel


class KnowledgeSyncHistory(TenantAwareModel):
    """
    Tracks the history of sync operations for a KnowledgeSource.

    Created when a sync starts, updated as it progresses and completes.
    """

    # Override TenantAwareModel's organization field with explicit related_name
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='knowledge_sync_history',
        help_text="Organization this sync belongs to"
    )

    class SyncType(models.TextChoices):
        FULL = 'full', 'Full'
        INCREMENTAL = 'incremental', 'Incremental'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    # Relationship
    source = models.ForeignKey(
        'knowledge.KnowledgeSource',
        on_delete=models.CASCADE,
        related_name='sync_history',
        help_text="Source this sync belongs to"
    )

    # Sync details
    sync_type = models.CharField(
        max_length=20,
        choices=SyncType.choices,
        default=SyncType.FULL,
        help_text="Type of sync operation"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        help_text="Current status of the sync"
    )

    # Timing
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the sync started"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the sync completed"
    )

    # Stats
    items_synced = models.IntegerField(
        default=0,
        help_text="Total items processed"
    )
    items_created = models.IntegerField(
        default=0,
        help_text="New items created"
    )
    items_updated = models.IntegerField(
        default=0,
        help_text="Existing items updated"
    )
    items_failed = models.IntegerField(
        default=0,
        help_text="Items that failed to process"
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        default='',
        help_text="Error message if sync failed"
    )

    class Meta:
        db_table = 'knowledge_sync_history'
        verbose_name = 'Knowledge Sync History'
        verbose_name_plural = 'Knowledge Sync History'
        indexes = [
            models.Index(fields=['source', 'status']),
            models.Index(fields=['source', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.source.name} - {self.get_sync_type_display()} ({self.get_status_display()})"

    def mark_running(self):
        """Mark the sync as running."""
        from django.utils import timezone
        self.status = self.Status.RUNNING
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at', 'updated_at'])

    def mark_completed(self, items_synced=0, items_created=0, items_updated=0, items_failed=0):
        """Mark the sync as completed with stats."""
        from django.utils import timezone
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.items_synced = items_synced
        self.items_created = items_created
        self.items_updated = items_updated
        self.items_failed = items_failed
        self.save(update_fields=[
            'status', 'completed_at', 'items_synced',
            'items_created', 'items_updated', 'items_failed', 'updated_at'
        ])

    def mark_failed(self, error_message: str):
        """Mark the sync as failed with an error message."""
        from django.utils import timezone
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.error_message = error_message
        self.save(update_fields=['status', 'completed_at', 'error_message', 'updated_at'])
