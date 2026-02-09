"""
RAG (Retrieval-Augmented Generation) service for Help Center content.

This module provides indexing and retrieval for help center articles and tutorials
using pgvector for similarity search.
"""
import logging
import time
import hashlib
from typing import List, Dict, Optional, Any
from uuid import UUID

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from pgvector.django import CosineDistance

from llama_index.core import Document
from llama_index.core.schema import TextNode

from common.utils.embedding_cache import get_embedding_model
from common.utils.markdown_chunker import HybridMarkdownChunker
from common.cache_keys import CacheKeys
from common.models.embeddings import VectorEmbedding

logger = logging.getLogger(__name__)


class HelpCenterRAGService:
    """
    RAG service for Help Center content.

    Handles:
    - Indexing articles and tutorials
    - Semantic search across content
    - Embedding management
    """

    def __init__(self, organization_id: str):
        """
        Initialize RAG service for an organization.

        Args:
            organization_id: UUID of the organization
        """
        self.organization_id = organization_id
        self.embed_model = get_embedding_model()

        # Get settings
        self.embedding_model = getattr(settings, 'RAG_EMBEDDING_MODEL', 'gemini-embedding-001')
        self.embedding_dimensions = getattr(settings, 'RAG_EMBEDDING_DIMENSIONS', 1536)
        self.embedding_provider = getattr(settings, 'RAG_EMBEDDING_PROVIDER', 'google')
        self.embedding_version = getattr(settings, 'RAG_EMBEDDING_VERSION', 'v1.0')
        self.chunk_size = getattr(settings, 'RAG_CHUNK_SIZE', 1024)
        self.chunk_overlap = getattr(settings, 'RAG_CHUNK_OVERLAP', 200)

    def index_content(
        self,
        content_type: str,
        content_id: UUID,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Index content (article, tutorial, etc.) for semantic search.

        Args:
            content_type: Type of content ('article', 'tutorial', etc.)
            content_id: UUID of the content
            title: Title of the content
            content: Markdown/text content to index
            metadata: Additional metadata to store with embeddings

        Returns:
            Number of chunks created
        """
        logger.info(f"Indexing {content_type} {content_id}: {title[:50]}...")

        # Delete existing embeddings for this content
        deleted = VectorEmbedding.delete_for_content(
            self.organization_id,
            content_type,
            content_id
        )
        if deleted:
            logger.info(f"Deleted {deleted} existing embeddings")

        # Prepare content for chunking
        full_content = f"# {title}\n\n{content}" if title else content

        # Create document for chunking
        doc = Document(
            text=full_content,
            metadata={
                'content_type': content_type,
                'content_id': str(content_id),
                'title': title,
                **(metadata or {})
            }
        )

        # Chunk the content
        chunker = HybridMarkdownChunker(
            max_chunk_size=self.chunk_size,
            heading_levels_to_split=[1, 2]
        )
        nodes = chunker.chunk_document(doc)

        logger.info(f"Created {len(nodes)} chunks from content")

        # Create embeddings and store
        embeddings_created = 0
        for i, node in enumerate(nodes):
            try:
                # Generate embedding
                embedding = self.embed_model.get_text_embedding(node.text)

                # Store in database
                VectorEmbedding.objects.create(
                    organization_id=self.organization_id,
                    content_type=content_type,
                    content_id=content_id,
                    text=node.text,
                    metadata={
                        'chunk_index': i,
                        'total_chunks': len(nodes),
                        'title': title,
                        **node.metadata,
                        **(metadata or {})
                    },
                    node_id=node.node_id if hasattr(node, 'node_id') else f"{content_id}_{i}",
                    embedding=embedding,
                    embedding_model=self.embedding_model,
                    embedding_provider=self.embedding_provider,
                    embedding_version=self.embedding_version
                )
                embeddings_created += 1

            except Exception as e:
                logger.error(f"Failed to create embedding for chunk {i}: {e}")

        logger.info(f"Created {embeddings_created} embeddings for {content_type} {content_id}")
        return embeddings_created

    def query(
        self,
        query: str,
        content_types: Optional[List[str]] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant content using semantic similarity.

        Args:
            query: Search query
            content_types: Filter by content types (e.g., ['article', 'tutorial'])
            top_k: Number of results to return
            similarity_threshold: Minimum similarity score (0-1)

        Returns:
            List of results with content, metadata, and scores
        """
        logger.info(f"RAG query: '{query[:50]}...' (top_k={top_k})")

        # Check cache for query embedding
        cache_key = CacheKeys.query_embedding(query)
        query_embedding = cache.get(cache_key)

        if query_embedding is None:
            # Generate query embedding
            start = time.time()
            query_embedding = self.embed_model.get_query_embedding(query)
            embed_time = (time.time() - start) * 1000
            logger.info(f"Generated query embedding in {embed_time:.0f}ms")

            # Cache for 1 hour
            cache.set(cache_key, query_embedding, 3600)

        # Build query
        queryset = VectorEmbedding.objects.filter(
            organization_id=self.organization_id
        ).annotate(
            distance=CosineDistance('embedding', query_embedding)
        ).order_by('distance')

        # Filter by content types if specified
        if content_types:
            queryset = queryset.filter(content_type__in=content_types)

        # Get results
        results = []
        for embedding in queryset[:top_k * 2]:  # Get extra for filtering
            # Convert distance to similarity score (cosine distance = 1 - similarity)
            similarity = 1 - embedding.distance

            if similarity < similarity_threshold:
                continue

            results.append({
                'content_type': embedding.content_type,
                'content_id': str(embedding.content_id),
                'text': embedding.text,
                'metadata': embedding.metadata,
                'score': similarity,
                'chunk_index': embedding.metadata.get('chunk_index', 0),
                'title': embedding.metadata.get('title', ''),
            })

            if len(results) >= top_k:
                break

        logger.info(f"RAG query returned {len(results)} results")
        return results

    def delete_content_embeddings(self, content_type: str, content_id: UUID) -> int:
        """
        Delete all embeddings for a content item.

        Args:
            content_type: Type of content
            content_id: UUID of the content

        Returns:
            Number of embeddings deleted
        """
        return VectorEmbedding.delete_for_content(
            self.organization_id,
            content_type,
            content_id
        )

    def get_stats(self) -> Dict[str, int]:
        """
        Get embedding statistics for the organization.

        Returns:
            Dict with counts by content_type
        """
        return VectorEmbedding.get_stats_for_organization(self.organization_id)


# Singleton cache for RAG service instances
_rag_service_cache: Dict[str, HelpCenterRAGService] = {}


def get_rag_service(organization_id: str) -> HelpCenterRAGService:
    """
    Get or create RAG service for an organization.

    Args:
        organization_id: UUID of the organization

    Returns:
        HelpCenterRAGService instance
    """
    org_id_str = str(organization_id)
    if org_id_str not in _rag_service_cache:
        _rag_service_cache[org_id_str] = HelpCenterRAGService(org_id_str)
    return _rag_service_cache[org_id_str]
