"""
KnowledgeChunk model - vector chunks for RAG retrieval.
"""
import hashlib
from django.db import models
from django.contrib.postgres.fields import ArrayField
from pgvector.django import HnswIndex, VectorField
from common.models.base import TenantAwareModel


class KnowledgeChunk(TenantAwareModel):
    """
    A chunk of content with vector embedding for semantic search.

    Each KnowledgeItem is split into multiple chunks for better
    RAG retrieval. Chunks maintain context about their source
    (heading hierarchy, position) for accurate citations.
    """

    # Override TenantAwareModel's organization field to avoid clash with common.KnowledgeChunk
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='knowledge_chunks',
        help_text="Organization this chunk belongs to"
    )

    # Product-level scoping (denormalized from item.source for query performance)
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='knowledge_chunks',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Product this chunk belongs to (denormalized from item.source)"
    )

    # Relationship
    knowledge_item = models.ForeignKey(
        'knowledge.KnowledgeItem',
        on_delete=models.CASCADE,
        related_name='chunks',
        help_text="Item this chunk belongs to"
    )

    # Content
    title = models.TextField(
        help_text="Chunk title (usually the heading)"
    )
    content = models.TextField(
        help_text="The actual text content of this chunk"
    )
    heading_path = ArrayField(
        models.CharField(max_length=200),
        default=list,
        blank=True,
        help_text="Heading hierarchy: ['H1 Title', 'H2 Section', 'H3 Subsection']"
    )
    chunk_index = models.IntegerField(
        default=0,
        help_text="Position of this chunk within the item"
    )

    # Vector embedding
    embedding = VectorField(
        dimensions=1536,
        null=True,
        blank=True,
        help_text="Vector embedding for semantic search"
    )
    embedding_model = models.CharField(
        max_length=100,
        blank=True,
        help_text="Model used to generate embedding"
    )

    # Change detection
    content_hash = models.CharField(
        max_length=32,
        db_index=True,
        help_text="MD5 hash of content for staleness detection"
    )

    class Meta:
        db_table = 'knowledge_chunk'
        verbose_name = 'Knowledge Chunk'
        verbose_name_plural = 'Knowledge Chunks'
        indexes = [
            models.Index(fields=['knowledge_item', 'chunk_index']),
            models.Index(fields=['organization']),
            models.Index(fields=['product']),
            models.Index(fields=['content_hash']),
            HnswIndex(
                name='kchunk_embedding_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]
        ordering = ['knowledge_item', 'chunk_index']

    def __str__(self):
        return f"{self.title} (chunk {self.chunk_index})"

    def calculate_content_hash(self) -> str:
        """Calculate MD5 hash of content."""
        return hashlib.md5(self.content.encode()).hexdigest()

    def needs_embedding(self) -> bool:
        """Check if this chunk needs its embedding generated."""
        return self.embedding is None
