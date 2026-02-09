"""
KnowledgeGraphService - Query and traverse the knowledge graph.

Provides semantic search over KnowledgeChunks and graph traversal
for prerequisite chains and related content.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from django.db.models import F
from pgvector.django import CosineDistance

from common.models.knowledge_chunk import KnowledgeChunk
from common.models.knowledge_graph_edge import KnowledgeGraphEdge
from common.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """
    Service for querying and traversing the knowledge graph.

    Provides:
    - Semantic search over KnowledgeChunk embeddings
    - Graph traversal for prerequisites and related content
    - Context composition with proper ordering
    """

    def __init__(self, organization_id: UUID):
        """
        Initialize the service.

        Args:
            organization_id: UUID of the organization
        """
        self.organization_id = organization_id
        self._embedding_service = get_embedding_service()

    async def semantic_search(
        self,
        query: str,
        top_k: int = 10,
        chunk_types: list[str] | None = None,
        source_types: list[str] | None = None,
        min_similarity: float = 0.5,
    ) -> list[dict[str, Any]]:
        """
        Perform semantic search over KnowledgeChunk embeddings.

        Args:
            query: Search query text
            top_k: Maximum number of results to return
            chunk_types: Optional filter by chunk type (procedure, concept, etc.)
            source_types: Optional filter by source type (article, tutorial, etc.)
            min_similarity: Minimum cosine similarity threshold (0-1)

        Returns:
            List of dicts with chunk data and similarity score
        """
        # Generate query embedding
        query_embedding = await self._embedding_service.embed_query_async(query)

        # Build queryset with filters
        queryset = KnowledgeChunk.objects.filter(
            organization_id=self.organization_id,
            is_stale=False,
            embedding__isnull=False,
        )

        if chunk_types:
            queryset = queryset.filter(chunk_type__in=chunk_types)

        if source_types:
            queryset = queryset.filter(source_type__in=source_types)

        # Annotate with cosine distance and order by similarity
        queryset = queryset.annotate(
            distance=CosineDistance(F('embedding'), query_embedding)
        ).filter(
            distance__lt=(1 - min_similarity)  # Convert similarity to distance threshold
        ).order_by('distance')[:top_k]

        results = []
        async for chunk in queryset:
            similarity = 1 - chunk.distance  # Convert distance back to similarity
            results.append({
                'chunk': chunk,
                'chunk_id': str(chunk.id),
                'title': chunk.title,
                'content': chunk.content,
                'chunk_type': chunk.chunk_type,
                'source_type': chunk.source_type,
                'source_id': str(chunk.source_id),
                'source_heading': chunk.source_heading,
                'topics': chunk.topics,
                'similarity': similarity,
            })

        logger.info(f"Semantic search returned {len(results)} results for query: {query[:50]}...")
        return results

    async def get_prerequisites(
        self,
        chunk: KnowledgeChunk,
        max_depth: int = 3,
    ) -> list[KnowledgeChunk]:
        """
        Traverse 'prerequisite_for' edges to find required chunks.

        Performs breadth-first traversal up to max_depth levels.

        Args:
            chunk: Starting chunk
            max_depth: Maximum traversal depth

        Returns:
            List of prerequisite chunks (ordered from most distant to closest)
        """
        prerequisites = []
        visited = {chunk.id}
        current_level = [chunk]

        for depth in range(max_depth):
            next_level = []

            for current_chunk in current_level:
                # Find edges where current_chunk is the target and relationship is prerequisite
                edges = KnowledgeGraphEdge.objects.filter(
                    organization_id=self.organization_id,
                    target_type=KnowledgeGraphEdge.NodeType.CHUNK,
                    target_chunk=current_chunk,
                    relationship='prerequisite_for',
                    status=KnowledgeGraphEdge.Status.ACTIVE,
                ).select_related('source_chunk')

                async for edge in edges:
                    source_chunk = edge.source_chunk
                    if source_chunk and source_chunk.id not in visited:
                        visited.add(source_chunk.id)
                        prerequisites.append(source_chunk)
                        next_level.append(source_chunk)

            if not next_level:
                break
            current_level = next_level

        # Reverse to get most distant prerequisites first
        prerequisites.reverse()

        logger.debug(f"Found {len(prerequisites)} prerequisites for chunk {chunk.id}")
        return prerequisites

    async def get_next_steps(
        self,
        chunk: KnowledgeChunk,
        max_depth: int = 3,
    ) -> list[KnowledgeChunk]:
        """
        Traverse 'next_step' edges to find follow-up chunks.

        Args:
            chunk: Starting chunk
            max_depth: Maximum traversal depth

        Returns:
            List of next step chunks (ordered from closest to most distant)
        """
        next_steps = []
        visited = {chunk.id}
        current_level = [chunk]

        for depth in range(max_depth):
            next_level = []

            for current_chunk in current_level:
                edges = KnowledgeGraphEdge.objects.filter(
                    organization_id=self.organization_id,
                    source_type=KnowledgeGraphEdge.NodeType.CHUNK,
                    source_chunk=current_chunk,
                    relationship='next_step',
                    status=KnowledgeGraphEdge.Status.ACTIVE,
                ).select_related('target_chunk')

                async for edge in edges:
                    target_chunk = edge.target_chunk
                    if target_chunk and target_chunk.id not in visited:
                        visited.add(target_chunk.id)
                        next_steps.append(target_chunk)
                        next_level.append(target_chunk)

            if not next_level:
                break
            current_level = next_level

        logger.debug(f"Found {len(next_steps)} next steps for chunk {chunk.id}")
        return next_steps

    async def get_related_chunks(
        self,
        chunk: KnowledgeChunk,
        relationship_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Find chunks related via any edge type.

        Args:
            chunk: Source chunk
            relationship_types: Optional filter by relationship type

        Returns:
            List of dicts with related chunk and relationship info
        """
        results = []

        # Outgoing edges (chunk is source)
        outgoing = KnowledgeGraphEdge.objects.filter(
            organization_id=self.organization_id,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            status=KnowledgeGraphEdge.Status.ACTIVE,
        ).select_related('target_chunk')

        if relationship_types:
            outgoing = outgoing.filter(relationship__in=relationship_types)

        async for edge in outgoing:
            if edge.target_chunk:
                results.append({
                    'chunk': edge.target_chunk,
                    'relationship': edge.relationship,
                    'direction': 'outgoing',
                })

        # Incoming edges (chunk is target)
        incoming = KnowledgeGraphEdge.objects.filter(
            organization_id=self.organization_id,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=chunk,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            status=KnowledgeGraphEdge.Status.ACTIVE,
        ).select_related('source_chunk')

        if relationship_types:
            incoming = incoming.filter(relationship__in=relationship_types)

        async for edge in incoming:
            if edge.source_chunk:
                results.append({
                    'chunk': edge.source_chunk,
                    'relationship': edge.inverse_relationship or f"inverse of {edge.relationship}",
                    'direction': 'incoming',
                })

        logger.debug(f"Found {len(results)} related chunks for chunk {chunk.id}")
        return results

    async def get_chunks_for_article(
        self,
        article_id: UUID,
        include_stale: bool = False,
    ) -> list[KnowledgeChunk]:
        """
        Get all chunks extracted from an article.

        Args:
            article_id: UUID of the source article
            include_stale: Whether to include stale chunks

        Returns:
            List of KnowledgeChunk objects
        """
        queryset = KnowledgeChunk.objects.filter(
            organization_id=self.organization_id,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=article_id,
        ).order_by('extracted_at')

        if not include_stale:
            queryset = queryset.filter(is_stale=False)

        return [chunk async for chunk in queryset]

    async def compose_context(
        self,
        chunks: list[KnowledgeChunk],
        include_prerequisites: bool = True,
        max_prereq_depth: int = 2,
    ) -> list[KnowledgeChunk]:
        """
        Order chunks with prerequisites first (topological sort).

        Args:
            chunks: Initial list of chunks
            include_prerequisites: Whether to fetch and include prerequisites
            max_prereq_depth: Maximum depth for prerequisite traversal

        Returns:
            Ordered list with prerequisites first, then original chunks
        """
        if not chunks:
            return []

        ordered = []
        seen = set()

        # Collect all prerequisites if requested
        if include_prerequisites:
            for chunk in chunks:
                prereqs = await self.get_prerequisites(chunk, max_depth=max_prereq_depth)
                for prereq in prereqs:
                    if prereq.id not in seen:
                        seen.add(prereq.id)
                        ordered.append(prereq)

        # Add original chunks
        for chunk in chunks:
            if chunk.id not in seen:
                seen.add(chunk.id)
                ordered.append(chunk)

        logger.debug(f"Composed context: {len(ordered)} chunks (from {len(chunks)} original)")
        return ordered

    async def search_with_context(
        self,
        query: str,
        top_k: int = 5,
        include_prerequisites: bool = True,
        max_prereq_depth: int = 2,
        chunk_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Semantic search with automatic prerequisite expansion.

        Combines semantic search with graph traversal for richer context.

        Args:
            query: Search query
            top_k: Number of direct matches to retrieve
            include_prerequisites: Whether to expand with prerequisites
            max_prereq_depth: Maximum prerequisite depth
            chunk_types: Optional filter by chunk type

        Returns:
            List of result dicts with chunks and metadata
        """
        # Step 1: Semantic search
        search_results = await self.semantic_search(
            query=query,
            top_k=top_k,
            chunk_types=chunk_types,
        )

        if not search_results:
            return []

        # Extract chunks from results
        matched_chunks = [r['chunk'] for r in search_results]

        # Step 2: Compose with prerequisites
        if include_prerequisites:
            all_chunks = await self.compose_context(
                matched_chunks,
                include_prerequisites=True,
                max_prereq_depth=max_prereq_depth,
            )
        else:
            all_chunks = matched_chunks

        # Build result with source info
        results = []
        matched_ids = {str(r['chunk_id']) for r in search_results}

        for chunk in all_chunks:
            is_direct_match = str(chunk.id) in matched_ids
            similarity = next(
                (r['similarity'] for r in search_results if r['chunk_id'] == str(chunk.id)),
                None
            )

            results.append({
                'chunk': chunk,
                'chunk_id': str(chunk.id),
                'title': chunk.title,
                'content': chunk.content,
                'chunk_type': chunk.chunk_type,
                'source_type': chunk.source_type,
                'source_id': str(chunk.source_id),
                'is_direct_match': is_direct_match,
                'is_prerequisite': not is_direct_match,
                'similarity': similarity,
            })

        logger.info(
            f"Search with context: {len(results)} total chunks "
            f"({len(matched_chunks)} matches, {len(results) - len(matched_chunks)} prerequisites)"
        )
        return results


def get_knowledge_graph_service(organization_id: UUID) -> KnowledgeGraphService:
    """Get a KnowledgeGraphService instance for the given organization."""
    return KnowledgeGraphService(organization_id)

