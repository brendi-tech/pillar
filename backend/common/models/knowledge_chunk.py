"""
KnowledgeChunk model - unified semantic content with vector embedding.

Replaces VectorEmbedding + arbitrary chunking with structured, typed content
that participates in the knowledge graph.
"""
from django.db import models
from django.contrib.postgres.fields import ArrayField
from pgvector.django import VectorField

from common.models.base import TenantAwareModel


class KnowledgeChunk(TenantAwareModel):
    """
    Unified model for semantically meaningful content with vector embedding.

    Replaces VectorEmbedding + arbitrary chunking with structured,
    typed content that participates in the knowledge graph.

    Key features:
    - Semantic type (procedure, concept, warning, etc.)
    - Full provenance (source article, heading, hierarchy)
    - Vector embedding for semantic search
    - Hash-based staleness detection
    - Knowledge graph participation via KnowledgeGraphEdge
    """

    class ChunkType(models.TextChoices):
        PROCEDURE = 'procedure', 'Step-by-step procedure'
        CONCEPT = 'concept', 'Explanation or definition'
        PREREQUISITE = 'prerequisite', 'Requirement or prerequisite'
        WARNING = 'warning', 'Caution or limitation'
        FAQ = 'faq', 'Question and answer'
        REFERENCE = 'reference', 'Reference information (tables, specs)'
        OVERVIEW = 'overview', 'Introduction or overview'
        EXAMPLE = 'example', 'Example or use case'

    class SourceType(models.TextChoices):
        ARTICLE = 'article', 'Help Article'
        TUTORIAL = 'tutorial', 'Tutorial'
        INTERNAL_PAGE = 'internal_page', 'Internal Page'
        INTERNAL_KMS = 'internal_kms', 'Internal KMS Page'
        INTERNAL_TICKET = 'internal_ticket', 'Internal Ticket'

    # === SOURCE PROVENANCE ===
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        db_index=True,
        help_text="Type of content this chunk was extracted from"
    )
    # Generic source reference (UUID of the source content)
    source_id = models.UUIDField(
        db_index=True,
        help_text="UUID of the source content (article, tutorial, etc.)"
    )
    # Location within source
    source_heading = models.CharField(
        max_length=500,
        blank=True,
        help_text="H2/H3 heading this chunk came from"
    )
    source_heading_hierarchy = ArrayField(
        models.CharField(max_length=200),
        default=list,
        blank=True,
        help_text="Full heading hierarchy: ['H1 Title', 'H2 Section', 'H3 Subsection']"
    )

    # === CONTENT ===
    title = models.CharField(
        max_length=500,
        help_text="Title of this chunk (usually the heading)"
    )
    content = models.TextField(
        help_text="The actual text content of this chunk"
    )
    summary = models.TextField(
        blank=True,
        help_text="AI-generated summary (optional, for display in search results)"
    )
    chunk_type = models.CharField(
        max_length=20,
        choices=ChunkType.choices,
        default=ChunkType.CONCEPT,
        db_index=True,
        help_text="Semantic type of this chunk"
    )

    # === SEMANTIC METADATA ===
    topics = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text="Extracted topic tags for filtering"
    )

    # === VECTOR EMBEDDING ===
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

    # === SYNC TRACKING ===
    content_hash = models.CharField(
        max_length=32,
        db_index=True,
        help_text="MD5 hash of source content for staleness detection"
    )
    is_stale = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if source content has changed since extraction"
    )
    extracted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this chunk was extracted"
    )
    last_indexed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When embedding was last generated"
    )

    class Meta:
        db_table = 'common_knowledgechunk'
        verbose_name = 'Knowledge Chunk'
        verbose_name_plural = 'Knowledge Chunks'
        indexes = [
            models.Index(fields=['organization', 'source_type', 'source_id']),
            models.Index(fields=['organization', 'chunk_type']),
            models.Index(fields=['organization', 'is_stale']),
            models.Index(fields=['source_id', 'content_hash']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'source_type', 'source_id', 'content_hash'],
                name='unique_chunk_per_source_content'
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.chunk_type})"

    def mark_stale(self) -> None:
        """Mark this chunk as stale (source content has changed)."""
        self.is_stale = True

    def needs_embedding(self) -> bool:
        """Check if this chunk needs its embedding regenerated."""
        return self.embedding is None or self.is_stale

