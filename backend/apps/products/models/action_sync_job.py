"""
ActionSyncJob model - tracks async action sync jobs for CI/CD pipelines.

This model tracks the progress of async action synchronization workflows,
allowing CI/CD scripts to poll for completion status.
"""
from django.db import models
from django.utils import timezone
from common.models.base import TenantAwareModel


class ActionSyncJobStatus(models.TextChoices):
    """Status of an action sync job."""
    PENDING = 'pending', 'Pending'
    PROCESSING = 'processing', 'Processing'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'


class ActionSyncJob(TenantAwareModel):
    """
    Tracks an async action sync job.
    
    Created when a sync request is received, updated as the workflow progresses,
    and marked complete only after all steps (actions, embeddings, deployment) succeed.
    """
    
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='action_sync_jobs',
        help_text="Product this sync job belongs to"
    )
    
    # === Platform & Version ===
    platform = models.CharField(
        max_length=20,
        choices=[
            ('web', 'Web'),
            ('ios', 'iOS'),
            ('android', 'Android'),
            ('desktop', 'Desktop'),
        ],
        db_index=True,
        help_text="Platform this sync is for"
    )
    version = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Semantic version or git SHA (e.g., '1.2.3' or 'abc123')"
    )
    git_sha = models.CharField(
        max_length=40,
        blank=True,
        help_text="Git commit SHA for this sync"
    )
    manifest_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA256 hash of the action manifest for deduplication"
    )
    
    # === Status ===
    status = models.CharField(
        max_length=20,
        choices=ActionSyncJobStatus.choices,
        default=ActionSyncJobStatus.PENDING,
        db_index=True,
        help_text="Current status of the sync job"
    )
    progress = models.JSONField(
        default=dict,
        blank=True,
        help_text="Progress tracking: {total, processed, created, updated, deleted}"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if job failed"
    )
    
    # === Completion Tracking ===
    is_complete = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True only when ALL steps completed successfully (actions, embeddings, deployment)"
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When processing started"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When job completed (successfully or failed)"
    )
    
    # === Result ===
    deployment = models.ForeignKey(
        'products.ActionDeployment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sync_jobs',
        help_text="Deployment created by this sync job (if successful)"
    )
    
    class Meta:
        verbose_name = 'Action Sync Job'
        verbose_name_plural = 'Action Sync Jobs'
        ordering = ['-created_at']
        indexes = [
            # Explicit names matching migration 0010 renames
            models.Index(fields=['product', 'status'], name='products_ac_product_69b6f9_idx'),
            models.Index(fields=['product', 'platform', 'version'], name='products_ac_product_29becf_idx'),
            models.Index(fields=['manifest_hash'], name='products_ac_manifes_abfb83_idx'),
            models.Index(fields=['organization', 'status'], name='products_ac_organiz_6c5fe5_idx'),
            models.Index(fields=['is_complete'], name='products_ac_is_comp_8b2ce9_idx'),
        ]
    
    def __str__(self):
        return f"Sync {self.platform}@{self.version} ({self.product.subdomain}) - {self.status}"


ToolSyncJob = ActionSyncJob
ToolSyncJobStatus = ActionSyncJobStatus
