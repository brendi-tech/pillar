"""
KnowledgeSource model - content source connections for the Product Assistant.
"""
from django.db import models
from common.models.base import TenantAwareModel


class KnowledgeSource(TenantAwareModel):
    """
    A content source for the Product Assistant.

    Source types:
    - help_center: External help/docs site to crawl
    - marketing_site: Company marketing/product pages to crawl
    - snippets: Container for manual custom instructions
    """

    # Override TenantAwareModel's organization field with explicit related_name
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='knowledge_sources',
        help_text="Organization this source belongs to"
    )

    # Product-level scoping (sources belong to a specific product)
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='knowledge_sources',
        null=True,  # Nullable for migration - will be required after backfill
        blank=True,
        help_text="Product this source belongs to"
    )

    class SourceType(models.TextChoices):
        HELP_CENTER = 'help_center', 'Help Center'
        MARKETING_SITE = 'marketing_site', 'Marketing Site'
        WEBSITE_CRAWL = 'website_crawl', 'Website Crawl'  # Unified crawl type (frontend uses this)
        SNIPPETS = 'snippets', 'Custom Snippets'
        # New source types for RAG extension
        INTEGRATION = 'integration', 'Integration'  # Unified.to (Pylon, Zendesk, etc.)
        CLOUD_STORAGE = 'cloud_storage', 'Cloud Storage'  # S3/GCS
        DOCUMENT_UPLOAD = 'document_upload', 'Document Upload'  # Direct uploads

    class Visibility(models.TextChoices):
        INTERNAL = 'internal', 'Internal'
        EXTERNAL = 'external', 'External'
        ALL = 'all', 'All'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SYNCING = 'syncing', 'Syncing'
        ERROR = 'error', 'Error'
        PAUSED = 'paused', 'Paused'

    # Identity
    name = models.CharField(
        max_length=200,
        help_text="Display name for this source"
    )
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.ALL,
        db_index=True,
        help_text="Visibility tag for agent knowledge scoping",
    )
    source_type = models.CharField(
        max_length=50,
        choices=SourceType.choices,
        db_index=True,
        help_text="Type of content source"
    )

    # For web sources (help_center, marketing_site)
    url = models.URLField(
        max_length=2000,
        blank=True,
        help_text="Root URL to crawl (blank for snippets)"
    )

    # Crawl configuration (for help_center, marketing_site)
    crawl_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Crawl settings: max_pages, include_paths, exclude_paths, etc."
    )

    # Connection configuration (for integration, cloud_storage)
    # - integration: {unified_connection_id, platform, workspace_name, connected_at}
    # - cloud_storage: {provider, bucket, prefix, region, access_key, secret_key}
    connection_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Connection settings for integrations and cloud storage"
    )

    # Sync status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        help_text="Current sync status"
    )
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last successful sync time"
    )
    error_message = models.TextField(
        blank=True,
        default='',
        help_text="Error message if status is 'error'"
    )

    # Stats
    item_count = models.IntegerField(
        default=0,
        help_text="Number of items from this source"
    )

    class Meta:
        db_table = 'knowledge_source'
        verbose_name = 'Knowledge Source'
        verbose_name_plural = 'Knowledge Sources'
        indexes = [
            models.Index(fields=['organization', 'source_type']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['product', 'source_type']),
            models.Index(fields=['product', 'status']),
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_source_type_display()})"

    def get_max_pages(self) -> int:
        """Get max pages to crawl from config."""
        return self.crawl_config.get('max_pages', 100)

    def get_include_paths(self) -> list[str]:
        """Get URL path patterns to include."""
        return self.crawl_config.get('include_paths', [])

    def get_exclude_paths(self) -> list[str]:
        """Get URL path patterns to exclude."""
        return self.crawl_config.get('exclude_paths', [])
