"""
Vector embeddings model for Help Center RAG retrieval.

This model stores embeddings for help center content (articles, tutorials, etc.)
using pgvector for efficient similarity search.
"""
from django.db import models
from pgvector.django import VectorField


class VectorEmbedding(models.Model):
    """
    Vector embeddings for RAG retrieval.

    Help center version - references articles and tutorials instead of site pages.
    Uses a generic content_type/content_id pattern to support multiple content types.
    """
    id = models.BigAutoField(primary_key=True)

    # Organization scope
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='vector_embeddings'
    )

    # Content reference - generic to support articles, tutorials, etc.
    content_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Type of content: 'article', 'tutorial', 'category', etc."
    )
    content_id = models.UUIDField(
        db_index=True,
        help_text="UUID of the content item"
    )

    # Embedding data
    text = models.TextField(
        blank=True,
        help_text="The text that was embedded"
    )
    metadata = models.JSONField(
        default=dict,
        db_column='metadata_',
        help_text="Additional metadata (heading hierarchy, chunk info, etc.)"
    )
    node_id = models.CharField(
        max_length=512,
        null=True,
        blank=True,
        help_text="LlamaIndex node ID for tracking"
    )
    embedding = VectorField(
        dimensions=1536,  # Default, can be configured via settings
        help_text="Vector embedding from embedding model"
    )

    # Versioning for embedding model tracking
    embedding_model = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name of the embedding model used"
    )
    embedding_provider = models.CharField(
        max_length=50,
        blank=True,
        help_text="Provider: 'openai', 'google', etc."
    )
    embedding_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="Version string for cache invalidation"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'help_center_vector_embeddings'
        indexes = [
            models.Index(
                fields=['organization', 'content_type', 'content_id'],
                name='hc_embed_org_content_idx'
            ),
            models.Index(
                fields=['content_type', 'content_id'],
                name='hc_embed_content_idx'
            ),
            models.Index(
                fields=['embedding_version'],
                name='hc_embed_version_idx'
            ),
        ]

    def __str__(self):
        return f"VectorEmbedding({self.content_type}:{self.content_id})"

    @classmethod
    def delete_for_content(cls, organization_id, content_type: str, content_id) -> int:
        """
        Delete all embeddings for a specific content item.

        Args:
            organization_id: Organization UUID
            content_type: Type of content ('article', 'tutorial', etc.)
            content_id: UUID of the content item

        Returns:
            Number of embeddings deleted
        """
        deleted_count, _ = cls.objects.filter(
            organization_id=organization_id,
            content_type=content_type,
            content_id=content_id
        ).delete()
        return deleted_count

    @classmethod
    def get_stats_for_organization(cls, organization_id) -> dict:
        """
        Get embedding statistics for an organization.

        Returns:
            Dict with counts by content_type
        """
        from django.db.models import Count

        stats = cls.objects.filter(
            organization_id=organization_id
        ).values('content_type').annotate(
            count=Count('id')
        )

        return {
            item['content_type']: item['count']
            for item in stats
        }

    @classmethod
    def get_embedding_version(cls, organization_id, content_type: str, content_id) -> str:
        """
        Get the current embedding version for a content item.

        Returns:
            Version string or empty string if no embeddings exist
        """
        embedding = cls.objects.filter(
            organization_id=organization_id,
            content_type=content_type,
            content_id=content_id
        ).first()

        return embedding.embedding_version if embedding else ''
