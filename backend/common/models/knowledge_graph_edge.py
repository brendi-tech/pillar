"""
KnowledgeGraphEdge model - relationships between knowledge graph nodes.

Enables prerequisite chains, related content, and semantic links between
articles and chunks.
"""
from django.db import models
from pgvector.django import VectorField

from common.models.base import TenantAwareModel


class KnowledgeGraphEdge(TenantAwareModel):
    """
    Relationship between knowledge graph nodes.

    Nodes can be articles (by UUID) or chunks (by FK).
    Enables prerequisite chains, related content, and semantic links.

    Relationship types include:
    - contains: Article contains chunk
    - prerequisite_for: Chunk A must be understood before chunk B
    - next_step: Chunk A is typically followed by chunk B
    - explains: Chunk A provides context for chunk B
    - alternative_to: Different approaches to same goal
    - related_to: General semantic relationship
    - supersedes: New content replaces old (for articles)
    """

    class NodeType(models.TextChoices):
        ARTICLE = 'article', 'Article'
        CHUNK = 'chunk', 'Knowledge Chunk'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        ACTIVE = 'active', 'Active'
        REJECTED = 'rejected', 'Rejected'
        ARCHIVED = 'archived', 'Archived'

    class CreatedBy(models.TextChoices):
        EXTRACTION = 'extraction', 'Chunk Extraction'
        LIBRARIAN = 'librarian', 'Librarian Agent'
        HUMAN = 'human', 'Human'
        IMPORT = 'import', 'Imported'

    # === SOURCE NODE ===
    source_type = models.CharField(
        max_length=10,
        choices=NodeType.choices,
        help_text="Type of the source node"
    )
    source_article_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of source article (if source_type='article')"
    )
    source_chunk = models.ForeignKey(
        'common.KnowledgeChunk',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='outgoing_edges',
        help_text="Source chunk (if source_type='chunk')"
    )

    # === TARGET NODE ===
    target_type = models.CharField(
        max_length=10,
        choices=NodeType.choices,
        help_text="Type of the target node"
    )
    target_article_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of target article (if target_type='article')"
    )
    target_chunk = models.ForeignKey(
        'common.KnowledgeChunk',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='incoming_edges',
        help_text="Target chunk (if target_type='chunk')"
    )

    # === RELATIONSHIP ===
    relationship = models.CharField(
        max_length=200,
        db_index=True,
        help_text="Relationship type: 'prerequisite_for', 'explains', 'next_step', 'contains', etc."
    )
    inverse_relationship = models.CharField(
        max_length=200,
        blank=True,
        help_text="Inverse relationship: 'requires', 'is_explained_by', 'previous_step', etc."
    )
    is_symmetric = models.BooleanField(
        default=False,
        help_text="Whether this relationship is bidirectional (e.g., 'related_to')"
    )

    # === SEMANTIC DEDUPLICATION ===
    fact_statement = models.TextField(
        help_text="Natural language description of this relationship"
    )
    fact_embedding = VectorField(
        dimensions=1536,
        null=True,
        blank=True,
        help_text="Embedding of fact_statement for semantic deduplication"
    )

    # === PROVENANCE ===
    created_by = models.CharField(
        max_length=20,
        choices=CreatedBy.choices,
        default=CreatedBy.EXTRACTION,
        help_text="What created this edge"
    )
    confidence = models.FloatField(
        default=1.0,
        help_text="Confidence score (0.0-1.0) for AI-generated edges"
    )
    reasoning = models.TextField(
        blank=True,
        help_text="Explanation of why this relationship was identified"
    )

    # === WORKFLOW ===
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        help_text="Current status of this edge"
    )
    reviewed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_knowledge_edges',
        help_text="User who reviewed this edge"
    )
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this edge was reviewed"
    )

    class Meta:
        db_table = 'common_knowledgegraphedge'
        verbose_name = 'Knowledge Graph Edge'
        verbose_name_plural = 'Knowledge Graph Edges'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'relationship']),
            models.Index(fields=['source_type', 'source_article_id']),
            models.Index(fields=['source_type', 'source_chunk']),
            models.Index(fields=['target_type', 'target_article_id']),
            models.Index(fields=['target_type', 'target_chunk']),
            models.Index(fields=['created_by', '-created_at']),
        ]
        constraints = [
            # Ensure correct FK is set based on source type
            models.CheckConstraint(
                check=(
                    models.Q(
                        source_type='article',
                        source_article_id__isnull=False,
                        source_chunk__isnull=True
                    ) |
                    models.Q(
                        source_type='chunk',
                        source_chunk__isnull=False,
                        source_article_id__isnull=True
                    )
                ),
                name='valid_source_node'
            ),
            # Ensure correct FK is set based on target type
            models.CheckConstraint(
                check=(
                    models.Q(
                        target_type='article',
                        target_article_id__isnull=False,
                        target_chunk__isnull=True
                    ) |
                    models.Q(
                        target_type='chunk',
                        target_chunk__isnull=False,
                        target_article_id__isnull=True
                    )
                ),
                name='valid_target_node'
            ),
        ]

    def __str__(self):
        source = self.source_article_id or self.source_chunk_id
        target = self.target_article_id or self.target_chunk_id
        return f"{source} --[{self.relationship}]--> {target}"

    @property
    def source(self):
        """Get the source node (article UUID or chunk instance)."""
        if self.source_type == self.NodeType.ARTICLE:
            return self.source_article_id
        return self.source_chunk

    @property
    def target(self):
        """Get the target node (article UUID or chunk instance)."""
        if self.target_type == self.NodeType.ARTICLE:
            return self.target_article_id
        return self.target_chunk

