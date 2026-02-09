"""
KnowledgeItem model - a piece of content the Product Assistant can use.
"""
import hashlib
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from common.models.base import TenantAwareModel


class KnowledgeItem(TenantAwareModel):
    """
    A piece of content for the Product Assistant.

    Item types:
    - page: Crawled from a help center or marketing site
    - snippet: Manually created custom instruction
    - correction: Generated from admin-submitted correction feedback
    """

    # Override TenantAwareModel's organization field with explicit related_name
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='knowledge_items',
        help_text="Organization this item belongs to"
    )

    # Product-level scoping (denormalized from source for query performance)
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='knowledge_items',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Product this item belongs to (denormalized from source)"
    )

    class ItemType(models.TextChoices):
        PAGE = 'page', 'Web Page'
        SNIPPET = 'snippet', 'Snippet'
        CORRECTION = 'correction', 'Correction'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        INDEXED = 'indexed', 'Indexed'
        FAILED = 'failed', 'Failed'

    # Relationship
    source = models.ForeignKey(
        'knowledge.KnowledgeSource',
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Source this item belongs to"
    )

    # Identity
    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        db_index=True,
        help_text="Type of content item"
    )
    external_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="Unique identifier (URL hash for pages)"
    )
    url = models.URLField(
        max_length=2000,
        blank=True,
        help_text="Source URL for pages"
    )

    # Content
    title = models.CharField(
        max_length=500,
        help_text="Title of the content"
    )
    raw_content = models.TextField(
        blank=True,
        help_text="Original content (markdown/HTML from crawl or user input)"
    )
    optimized_content = models.TextField(
        blank=True,
        help_text="LLM-cleaned content for RAG indexing"
    )
    excerpt = models.TextField(
        blank=True,
        help_text="Short summary/description"
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        help_text="Processing status"
    )
    content_hash = models.CharField(
        max_length=32,
        blank=True,
        db_index=True,
        help_text="MD5 hash of raw_content for change detection"
    )
    last_indexed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this item was last indexed"
    )
    processing_error = models.TextField(
        null=True,
        blank=True,
        default=None,
        help_text="Error message if processing failed"
    )

    # AI availability
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this item is available to the Product Assistant"
    )

    # Metadata (type-specific)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Type-specific data: {word_count, priority, etc.}"
    )

    # Full-text search vector (auto-updated by PostgreSQL trigger)
    search_vector = SearchVectorField(
        null=True,
        blank=True,
        help_text="Pre-computed tsvector for full-text search (title + optimized_content)"
    )

    class Meta:
        db_table = 'knowledge_item'
        verbose_name = 'Knowledge Item'
        verbose_name_plural = 'Knowledge Items'
        unique_together = [['source', 'external_id']]
        indexes = [
            models.Index(fields=['organization', 'status', 'is_active']),
            models.Index(fields=['product', 'status', 'is_active']),
            models.Index(fields=['source', 'item_type']),
            models.Index(fields=['source', 'status']),
            models.Index(fields=['content_hash']),
            # Full-text search GIN index (for fast keyword search)
            GinIndex(fields=['search_vector'], name='knowledge_item_search_gin'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_item_type_display()})"

    def calculate_content_hash(self) -> str:
        """Calculate MD5 hash of raw_content."""
        return hashlib.md5(self.raw_content.encode()).hexdigest()

    def update_content_hash(self) -> bool:
        """
        Recalculate and update content_hash.

        Returns True if hash changed (content was modified).
        """
        new_hash = self.calculate_content_hash()
        changed = new_hash != self.content_hash
        self.content_hash = new_hash
        return changed

    def needs_processing(self) -> bool:
        """Check if this item needs (re)processing."""
        if self.status in [self.Status.PENDING, self.Status.FAILED]:
            return True
        # Check if content changed
        return self.calculate_content_hash() != self.content_hash

    @classmethod
    def generate_external_id(cls, url: str) -> str:
        """Generate external_id from URL (MD5 hash)."""
        return hashlib.md5(url.encode()).hexdigest()
