"""
RAG service for Knowledge retrieval.

Provides vector search over KnowledgeChunks for the Product Assistant.

Optimizations ported from backend/common/utils/django_rag_service.py:
- Query embedding caching (Redis, 1 hour TTL)
- Cohere reranking (cross-encoder for better relevance)
- URL/item diversity filtering (prevents single source domination)
- Deferred embedding field (reduces data transfer by ~6KB per row)
- Two-phase fetch (extra candidates for reranking)
- Performance logging with timing
- Async support for SSE/WebSocket/Hatchet contexts
"""
import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional, Set
from uuid import UUID

from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.core.cache import cache
from django.db.models import F
from pgvector.django import CosineDistance

from common.cache_keys import CacheKeys
from common.services.embedding_service import get_embedding_service
from common.utils.reranker_service import get_reranker
from apps.knowledge.models import KnowledgeChunk, KnowledgeItem

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A search result from the knowledge base."""
    chunk_id: str
    item_id: str
    title: str
    content: str
    url: Optional[str]
    heading_path: list[str]
    score: float
    source_name: str
    item_type: str


class KnowledgeRAGService:
    """
    Service for semantic search over KnowledgeChunks.

    Provides:
    - Vector similarity search with pgvector
    - Query embedding caching (Redis, 1 hour TTL)
    - Cohere reranking for improved relevance
    - Item diversity filtering
    - Filtering by organization and active items
    - Ranked results with source attribution
    """

    def __init__(self, organization_id: str, product_id: str):
        """
        Initialize the RAG service for an organization and product.

        Args:
            organization_id: UUID of the organization to search within
            product_id: UUID of the product to filter by (required for proper gating)
        """
        self.organization_id = organization_id
        self.product_id = product_id
        self.embedding_service = get_embedding_service()
        self.default_top_k = getattr(settings, 'RAG_DEFAULT_TOP_K', 10)

    def _get_cached_query_embedding(self, question: str) -> list[float]:
        """
        Cache query embeddings in Redis (1 hour TTL).

        Query embeddings are expensive to generate (~200ms) and often repeat
        (e.g., "pricing", "shipping", "return policy" queries).

        Args:
            question: User's question text

        Returns:
            List of floats representing the embedding vector
        """
        cache_key = CacheKeys.query_embedding(question)

        # Try cache first
        cached = cache.get(cache_key)
        if cached:
            logger.info(f"[CACHE HIT] Query embedding for: {question[:50]}...")
            return cached

        # Generate and cache
        logger.info(f"[CACHE MISS] Generating embedding for: {question[:50]}...")
        embedding = self.embedding_service.embed_query(question)
        cache.set(cache_key, embedding, 3600)  # 1 hour TTL
        return embedding

    def search(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: float = 0.0,
        item_types: Optional[list[str]] = None,
        source_ids: Optional[list[str]] = None,
        max_chunks_per_item: Optional[int] = None,
    ) -> list[SearchResult]:
        """
        Search the knowledge base for relevant content.

        Optimization pipeline:
        1. Check Redis cache for query embedding
        2. Fetch 3x candidates for reranking
        3. Apply item diversity filter (max chunks per item)
        4. Rerank with Cohere cross-encoder
        5. Return top_k results

        Args:
            query: Natural language search query
            top_k: Maximum number of results (default from settings)
            min_score: Minimum similarity score (0-1, higher = more similar)
            item_types: Filter by item types (e.g., ['page', 'snippet'])
            source_ids: Filter by source IDs
            max_chunks_per_item: Max chunks from same item for diversity

        Returns:
            List of SearchResult objects, ordered by relevance
        """
        query_start = time.time()
        logger.info(f"[TIMING] KnowledgeRAGService.search() starting for '{query[:50]}...'")

        if not query or not query.strip():
            return []

        top_k = top_k or self.default_top_k

        # 1. CACHED QUERY EMBEDDING
        try:
            query_embedding = self._get_cached_query_embedding(query)
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            return []

        after_embedding = time.time()
        logger.info(f"[TIMING] Query embedding (+{(after_embedding - query_start) * 1000:.1f}ms)")

        # 2. BUILD OPTIMIZED QUERYSET
        # Fetch extra candidates for reranking
        if settings.COHERE_RERANK_ENABLED:
            fetch_count = max(top_k * 3, settings.COHERE_RERANK_CANDIDATES)
        else:
            fetch_count = top_k

        chunks = KnowledgeChunk.objects.filter(
            organization_id=self.organization_id,
            knowledge_item__is_active=True,
            knowledge_item__status=KnowledgeItem.Status.INDEXED,
            embedding__isnull=False,
        ).select_related(
            'knowledge_item',
            'knowledge_item__source',
        ).defer(
            'embedding',  # Don't transfer 6KB vector back!
        )

        # Filter by product (required for proper gating)
        chunks = chunks.filter(product_id=self.product_id)

        # Apply filters
        if item_types:
            chunks = chunks.filter(knowledge_item__item_type__in=item_types)
        if source_ids:
            chunks = chunks.filter(knowledge_item__source_id__in=source_ids)

        # 3. VECTOR SEARCH
        chunks = chunks.annotate(
            distance=CosineDistance('embedding', query_embedding)
        ).order_by('distance')[:fetch_count]

        after_search = time.time()
        logger.info(f"[TIMING] Vector search (+{(after_search - after_embedding) * 1000:.1f}ms)")
        logger.info(f"[DEBUG] Query returned {len(list(chunks))} results")

        # 4. FORMAT RESULTS
        results = []
        for chunk in chunks:
            # Convert distance to similarity score (cosine distance: 0 = identical, 2 = opposite)
            score = 1 - (chunk.distance / 2) if chunk.distance is not None else 0

            if score < min_score:
                continue

            results.append({
                'chunk_id': str(chunk.id),
                'item_id': str(chunk.knowledge_item_id),
                'title': chunk.title,
                'content': chunk.content,
                'chunk_text': chunk.content,  # Reranker expects this key
                'url': chunk.knowledge_item.url or None,
                'page_url': chunk.knowledge_item.url or '',  # For reranker logging
                'heading_path': chunk.heading_path or [],
                'score': score,
                'source_name': chunk.knowledge_item.source.name,
                'item_type': chunk.knowledge_item.item_type,
            })

        # 5. DIVERSITY FILTERING
        max_per_item = max_chunks_per_item or getattr(settings, 'RAG_MAX_CHUNKS_PER_URL', 5)
        if max_per_item and max_per_item > 0 and len(results) > 0:
            item_chunks = defaultdict(list)
            for r in results:
                item_chunks[r['item_id']].append(r)

            # Keep top N chunks per item (already sorted by score)
            diverse_results = []
            for item_id, item_results in item_chunks.items():
                diverse_results.extend(item_results[:max_per_item])

            # Re-sort by score to maintain ranking
            diverse_results.sort(key=lambda x: x['score'], reverse=True)

            logger.info(
                f"[RAG] Diversity filter: {len(results)} -> {len(diverse_results)} chunks "
                f"(max {max_per_item}/item, {len(item_chunks)} unique items)"
            )
            results = diverse_results

        # 6. COHERE RERANKING
        if settings.COHERE_RERANK_ENABLED and results:
            reranker = get_reranker()

            rerank_candidates = min(settings.COHERE_RERANK_CANDIDATES, len(results))
            candidates_for_rerank = results[:rerank_candidates]

            logger.info(
                f"[RAG] Reranking {len(candidates_for_rerank)} candidates "
                f"(requested top_k={top_k})"
            )

            results = reranker.rerank(
                query=query,
                documents=candidates_for_rerank,
                top_n=top_k
            )

            after_rerank = time.time()
            logger.info(f"[TIMING] Reranking (+{(after_rerank - after_search) * 1000:.1f}ms)")
            logger.info(f"[RAG] Reranking complete: {len(results)} results returned")
        else:
            # No reranking - just slice to top_k
            results = results[:top_k]
            logger.info(f"[RAG] Reranking disabled, using top {len(results)} vector results")

        # 7. CONVERT TO SearchResult OBJECTS
        final_results = [
            SearchResult(
                chunk_id=r['chunk_id'],
                item_id=r['item_id'],
                title=r['title'],
                content=r['content'],
                url=r.get('url'),
                heading_path=r.get('heading_path', []),
                score=r['score'],
                source_name=r['source_name'],
                item_type=r['item_type'],
            )
            for r in results
        ]

        total_ms = (time.time() - query_start) * 1000
        logger.info(
            f"[TIMING] KnowledgeRAGService.search() completed "
            f"(total: {total_ms:.1f}ms, {len(final_results)} results)"
        )

        return final_results

    def get_context_for_prompt(
        self,
        query: str,
        max_tokens: int = 4000,
        **search_kwargs,
    ) -> str:
        """
        Get formatted context for LLM prompt.

        Args:
            query: Search query
            max_tokens: Approximate max tokens for context
            **search_kwargs: Additional args passed to search()

        Returns:
            Formatted context string for LLM
        """
        results = self.search(query, **search_kwargs)

        if not results:
            return ""

        # Build context with source attribution
        context_parts = []
        approx_tokens = 0
        chars_per_token = 4  # Rough estimate

        for result in results:
            # Format the chunk with metadata
            source_info = f"[Source: {result.source_name}]"
            if result.url:
                source_info += f" ({result.url})"

            chunk_text = f"""
---
{source_info}
{result.title}

{result.content}
---
"""
            chunk_tokens = len(chunk_text) / chars_per_token

            if approx_tokens + chunk_tokens > max_tokens:
                break

            context_parts.append(chunk_text)
            approx_tokens += chunk_tokens

        return "\n".join(context_parts)

    def search_snippets(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[SearchResult]:
        """
        Search only snippets (custom instructions).

        Args:
            query: Search query
            top_k: Max results

        Returns:
            List of SearchResult from snippets only
        """
        return self.search(
            query=query,
            top_k=top_k,
            item_types=[KnowledgeItem.ItemType.SNIPPET],
        )

    def search_pages(
        self,
        query: str,
        top_k: int = 10,
    ) -> list[SearchResult]:
        """
        Search only pages (crawled content).

        Args:
            query: Search query
            top_k: Max results

        Returns:
            List of SearchResult from pages only
        """
        return self.search(
            query=query,
            top_k=top_k,
            item_types=[KnowledgeItem.ItemType.PAGE],
        )


class KnowledgeRAGServiceAsync:
    """
    Async version of KnowledgeRAGService for async contexts.

    Use this in:
    - SSE endpoints
    - WebSocket consumers
    - Hatchet workflows
    - Any async view or task

    Provides the same optimizations as KnowledgeRAGService but with:
    - Django 5.2 native async ORM (async for, etc.)
    - Async Cohere reranking
    - sync_to_async wrappers for cache operations
    """

    def __init__(self, organization_id: str, product_id: str):
        """
        Initialize the async RAG service for an organization and product.

        Args:
            organization_id: UUID of the organization to search within
            product_id: UUID of the product to filter by (required for proper gating)
        """
        self.organization_id = organization_id
        self.product_id = product_id
        self.embedding_service = get_embedding_service()
        self.default_top_k = getattr(settings, 'RAG_DEFAULT_TOP_K', 10)

    async def _get_cached_query_embedding(self, question: str) -> list[float]:
        """
        Cache query embeddings in Redis (1 hour TTL) - async version.

        Args:
            question: User's question text

        Returns:
            List of floats representing the embedding vector
        """
        cache_key = CacheKeys.query_embedding(question)

        # Try cache first (Django cache is sync, wrap it)
        cached = await sync_to_async(cache.get)(cache_key)
        if cached:
            logger.info(f"[CACHE HIT] Query embedding for: {question[:50]}...")
            return cached

        # Generate and cache
        logger.info(f"[CACHE MISS] Generating embedding for: {question[:50]}...")
        embedding = await self.embedding_service.embed_query_async(question)
        await sync_to_async(cache.set)(cache_key, embedding, 3600)
        return embedding

    async def search(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: float = 0.0,
        item_types: Optional[list[str]] = None,
        source_ids: Optional[list[str]] = None,
        max_chunks_per_item: Optional[int] = None,
    ) -> list[SearchResult]:
        """
        Async search the knowledge base for relevant content.

        Uses Django 5.2 async ORM and async Cohere reranking.

        Args:
            query: Natural language search query
            top_k: Maximum number of results (default from settings)
            min_score: Minimum similarity score (0-1, higher = more similar)
            item_types: Filter by item types (e.g., ['page', 'snippet'])
            source_ids: Filter by source IDs
            max_chunks_per_item: Max chunks from same item for diversity

        Returns:
            List of SearchResult objects, ordered by relevance
        """
        query_start = time.time()
        logger.info(f"[TIMING] KnowledgeRAGServiceAsync.search() starting for '{query[:50]}...'")

        if not query or not query.strip():
            return []

        top_k = top_k or self.default_top_k

        # 1. CACHED QUERY EMBEDDING
        try:
            query_embedding = await self._get_cached_query_embedding(query)
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            return []

        after_embedding = time.time()
        logger.info(f"[TIMING] Query embedding (+{(after_embedding - query_start) * 1000:.1f}ms)")

        # 2. BUILD OPTIMIZED QUERYSET
        if settings.COHERE_RERANK_ENABLED:
            fetch_count = max(top_k * 3, settings.COHERE_RERANK_CANDIDATES)
        else:
            fetch_count = top_k

        chunks_qs = KnowledgeChunk.objects.filter(
            organization_id=self.organization_id,
            knowledge_item__is_active=True,
            knowledge_item__status=KnowledgeItem.Status.INDEXED,
            embedding__isnull=False,
        ).select_related(
            'knowledge_item',
            'knowledge_item__source',
        ).defer(
            'embedding',
        )

        # Filter by product (required for proper gating)
        chunks_qs = chunks_qs.filter(product_id=self.product_id)

        # Apply filters
        if item_types:
            chunks_qs = chunks_qs.filter(knowledge_item__item_type__in=item_types)
        if source_ids:
            chunks_qs = chunks_qs.filter(knowledge_item__source_id__in=source_ids)

        # 3. VECTOR SEARCH
        chunks_qs = chunks_qs.annotate(
            distance=CosineDistance('embedding', query_embedding)
        ).order_by('distance')[:fetch_count]

        # Convert to list using async iteration
        chunks = [chunk async for chunk in chunks_qs]

        after_search = time.time()
        logger.info(f"[TIMING] Vector search (+{(after_search - after_embedding) * 1000:.1f}ms)")
        logger.info(f"[DEBUG] Query returned {len(chunks)} results")

        # 4. FORMAT RESULTS
        results = []
        for chunk in chunks:
            score = 1 - (chunk.distance / 2) if chunk.distance is not None else 0

            if score < min_score:
                continue

            results.append({
                'chunk_id': str(chunk.id),
                'item_id': str(chunk.knowledge_item_id),
                'title': chunk.title,
                'content': chunk.content,
                'chunk_text': chunk.content,
                'url': chunk.knowledge_item.url or None,
                'page_url': chunk.knowledge_item.url or '',
                'heading_path': chunk.heading_path or [],
                'score': score,
                'source_name': chunk.knowledge_item.source.name,
                'item_type': chunk.knowledge_item.item_type,
            })

        # 5. DIVERSITY FILTERING
        max_per_item = max_chunks_per_item or getattr(settings, 'RAG_MAX_CHUNKS_PER_URL', 5)
        if max_per_item and max_per_item > 0 and len(results) > 0:
            item_chunks = defaultdict(list)
            for r in results:
                item_chunks[r['item_id']].append(r)

            diverse_results = []
            for item_id, item_results in item_chunks.items():
                diverse_results.extend(item_results[:max_per_item])

            diverse_results.sort(key=lambda x: x['score'], reverse=True)

            logger.info(
                f"[RAG] Diversity filter: {len(results)} -> {len(diverse_results)} chunks "
                f"(max {max_per_item}/item, {len(item_chunks)} unique items)"
            )
            results = diverse_results

        # 6. COHERE RERANKING (async version)
        if settings.COHERE_RERANK_ENABLED and results:
            reranker = get_reranker()

            rerank_candidates = min(settings.COHERE_RERANK_CANDIDATES, len(results))
            candidates_for_rerank = results[:rerank_candidates]

            logger.info(
                f"[RAG] Reranking {len(candidates_for_rerank)} candidates "
                f"(requested top_k={top_k})"
            )

            # Use async reranker
            results = await reranker.rerank_async(
                query=query,
                documents=candidates_for_rerank,
                top_n=top_k
            )

            after_rerank = time.time()
            logger.info(f"[TIMING] Reranking (+{(after_rerank - after_search) * 1000:.1f}ms)")
            logger.info(f"[RAG] Reranking complete: {len(results)} results returned")
        else:
            results = results[:top_k]
            logger.info(f"[RAG] Reranking disabled, using top {len(results)} vector results")

        # 7. CONVERT TO SearchResult OBJECTS
        final_results = [
            SearchResult(
                chunk_id=r['chunk_id'],
                item_id=r['item_id'],
                title=r['title'],
                content=r['content'],
                url=r.get('url'),
                heading_path=r.get('heading_path', []),
                score=r['score'],
                source_name=r['source_name'],
                item_type=r['item_type'],
            )
            for r in results
        ]

        total_ms = (time.time() - query_start) * 1000
        logger.info(
            f"[TIMING] KnowledgeRAGServiceAsync.search() completed "
            f"(total: {total_ms:.1f}ms, {len(final_results)} results)"
        )

        return final_results

    async def get_context_for_prompt(
        self,
        query: str,
        max_tokens: int = 4000,
        **search_kwargs,
    ) -> str:
        """
        Get formatted context for LLM prompt (async version).

        Args:
            query: Search query
            max_tokens: Approximate max tokens for context
            **search_kwargs: Additional args passed to search()

        Returns:
            Formatted context string for LLM
        """
        results = await self.search(query, **search_kwargs)

        if not results:
            return ""

        context_parts = []
        approx_tokens = 0
        chars_per_token = 4

        for result in results:
            source_info = f"[Source: {result.source_name}]"
            if result.url:
                source_info += f" ({result.url})"

            chunk_text = f"""
---
{source_info}
{result.title}

{result.content}
---
"""
            chunk_tokens = len(chunk_text) / chars_per_token

            if approx_tokens + chunk_tokens > max_tokens:
                break

            context_parts.append(chunk_text)
            approx_tokens += chunk_tokens

        return "\n".join(context_parts)

    async def search_snippets(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[SearchResult]:
        """Search only snippets (async version)."""
        return await self.search(
            query=query,
            top_k=top_k,
            item_types=[KnowledgeItem.ItemType.SNIPPET],
        )

    async def search_pages(
        self,
        query: str,
        top_k: int = 10,
    ) -> list[SearchResult]:
        """Search only pages (async version)."""
        return await self.search(
            query=query,
            top_k=top_k,
            item_types=[KnowledgeItem.ItemType.PAGE],
        )

    # =========================================================================
    # Keyword Search Methods
    # =========================================================================

    async def keyword_search(
        self,
        query: str,
        top_k: int = 20,
        source_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Waterfall keyword search over KnowledgeItems.

        Strategy:
        1. Title icontains (highest precision)
        2. optimized_content icontains
        3. PostgreSQL full-text search (broadest)

        Args:
            query: Search query string
            top_k: Maximum results to return
            source_ids: Optional source filter

        Returns:
            List of result dicts with item info
        """
        if not query or not query.strip():
            return []

        query = query.strip()
        logger.info(f"[KeywordSearch] Query: '{query[:50]}' org={self.organization_id}")

        results_found: list[dict] = []
        seen_ids: Set[str] = set()

        # Phase 1: Title search (highest precision)
        title_results = await self._search_by_field(
            query, 'title', top_k, seen_ids, source_ids
        )
        if title_results:
            logger.info(f"[KeywordSearch] Title matches: {len(title_results)}")
            results_found.extend(title_results)
            seen_ids.update(r['id'] for r in title_results)

        if len(results_found) >= top_k:
            return results_found[:top_k]

        # Phase 2: Content search
        remaining = top_k - len(results_found)
        content_results = await self._search_by_field(
            query, 'optimized_content', remaining, seen_ids, source_ids
        )
        if content_results:
            logger.info(f"[KeywordSearch] Content matches: {len(content_results)}")
            results_found.extend(content_results)
            seen_ids.update(r['id'] for r in content_results)

        if len(results_found) >= top_k:
            return results_found[:top_k]

        # Phase 3: Full-text PostgreSQL search
        remaining = top_k - len(results_found)
        fulltext_results = await self._fulltext_search(
            query, remaining, seen_ids, source_ids
        )
        if fulltext_results:
            logger.info(f"[KeywordSearch] Full-text matches: {len(fulltext_results)}")
            results_found.extend(fulltext_results)

        return results_found[:top_k]

    @sync_to_async
    def _search_by_field(
        self,
        query: str,
        field: str,
        limit: int,
        exclude_ids: Set[str],
        source_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Search in a specific field using icontains.

        Args:
            query: Search query
            field: Field to search ('title' or 'optimized_content')
            limit: Max results
            exclude_ids: IDs to exclude (already found)
            source_ids: Optional source filter

        Returns:
            List of result dicts
        """
        # Convert exclude_ids to UUIDs for query
        exclude_uuids = [UUID(id_str) for id_str in exclude_ids if id_str]

        # Base queryset: active, indexed items
        items = KnowledgeItem.objects.filter(
            organization_id=self.organization_id,
            is_active=True,
            status=KnowledgeItem.Status.INDEXED,
        ).select_related('source')

        # Filter by product (required for proper gating)
        items = items.filter(product_id=self.product_id)

        if exclude_uuids:
            items = items.exclude(id__in=exclude_uuids)

        if source_ids:
            items = items.filter(source_id__in=source_ids)

        # Search in field
        field_lookup = f'{field}__icontains'
        items = items.filter(**{field_lookup: query}).distinct()[:limit]

        return [self._item_to_result(item, field) for item in items]

    @sync_to_async
    def _fulltext_search(
        self,
        query: str,
        limit: int,
        exclude_ids: Set[str],
        source_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Full-text search using pre-computed search_vector field with GIN index.

        This uses PostgreSQL's full-text search capabilities with a pre-computed
        tsvector that is auto-updated by a database trigger. The GIN index on
        search_vector makes this O(log n) instead of O(n).

        Args:
            query: Search query
            limit: Max results
            exclude_ids: IDs to exclude
            source_ids: Optional source filter

        Returns:
            List of result dicts with relevance scores
        """
        # Convert exclude_ids to UUIDs
        exclude_uuids = [UUID(id_str) for id_str in exclude_ids if id_str]

        # Build search query
        search_query = SearchQuery(query, config='english')

        # Search in knowledge items using pre-computed search_vector
        items = KnowledgeItem.objects.filter(
            organization_id=self.organization_id,
            is_active=True,
            status=KnowledgeItem.Status.INDEXED,
            search_vector__isnull=False,  # Only items with search vectors
        ).select_related('source')

        # Filter by product (required for proper gating)
        items = items.filter(product_id=self.product_id)

        if exclude_uuids:
            items = items.exclude(id__in=exclude_uuids)

        if source_ids:
            items = items.filter(source_id__in=source_ids)

        # Use pre-computed search_vector with GIN index lookup
        # This is fast because it uses the GIN index on search_vector
        items = items.filter(
            search_vector=search_query  # Fast GIN index lookup
        ).annotate(
            rank=SearchRank(F('search_vector'), search_query)
        ).order_by('-rank')[:limit]

        results = []
        for item in items:
            results.append({
                'id': str(item.id),
                'title': item.title,
                'url': item.url or '',
                'excerpt': item.excerpt or item.optimized_content[:300] if item.optimized_content else '',
                'source_name': item.source.name if item.source else '',
                'item_type': item.item_type,
                'score': float(item.rank) if item.rank else 0.5,
                'match_source': 'fulltext'
            })
        return results

    def _item_to_result(self, item: KnowledgeItem, match_source: str) -> dict:
        """
        Convert KnowledgeItem to result dict.

        Args:
            item: KnowledgeItem instance
            match_source: Which field matched ('title', 'optimized_content')

        Returns:
            Result dict with item info
        """
        return {
            'id': str(item.id),
            'title': item.title,
            'url': item.url or '',
            'excerpt': item.excerpt or item.optimized_content[:300] if item.optimized_content else '',
            'source_name': item.source.name if item.source else '',
            'item_type': item.item_type,
            'score': 1.0,  # icontains matches get high score
            'match_source': match_source
        }

    # =========================================================================
    # Hybrid Search Methods
    # =========================================================================

    RRF_K = 60  # Standard RRF constant from the original paper

    async def hybrid_search(
        self,
        query: str,
        top_k: int = 10,
        semantic_weight: float = 0.5,
        source_ids: Optional[list[str]] = None,
    ) -> list[SearchResult]:
        """
        Hybrid search combining semantic + keyword with Reciprocal Rank Fusion.

        RRF Formula: score = sum(1 / (k + rank)) for each ranking list
        where k is a constant (typically 60) that dampens the effect of high rankings.

        Args:
            query: Search query
            top_k: Number of results to return
            semantic_weight: Weight for semantic results (0.0-1.0)
                           - 0.0 = keyword only
                           - 0.5 = equal weight (default)
                           - 1.0 = semantic only
            source_ids: Optional source filter

        Returns:
            Fused and ranked results list
        """
        if not query or not query.strip():
            return []

        query = query.strip()
        logger.info(
            f"[HybridSearch] Query: '{query[:50]}' "
            f"(top_k={top_k}, semantic_weight={semantic_weight})"
        )

        # Over-retrieve to account for deduplication
        retrieve_k = top_k * 2

        # Run both searches in parallel
        try:
            semantic_results, keyword_results = await asyncio.gather(
                self.search(query, top_k=retrieve_k, source_ids=source_ids),
                self.keyword_search(query, top_k=retrieve_k, source_ids=source_ids)
            )
        except Exception as e:
            logger.error(f"[HybridSearch] Search failed: {e}", exc_info=True)
            # Fall back to keyword only if semantic fails
            keyword_results = await self.keyword_search(query, top_k=retrieve_k, source_ids=source_ids)
            semantic_results = []

        logger.info(
            f"[HybridSearch] Results - Semantic: {len(semantic_results)}, "
            f"Keyword: {len(keyword_results)}"
        )

        # Fuse with RRF
        fused = self._fuse_results_rrf(
            semantic_results, keyword_results,
            semantic_weight, top_k
        )

        logger.info(f"[HybridSearch] Fused results: {len(fused)}")
        return fused

    def _fuse_results_rrf(
        self,
        semantic: list[SearchResult],
        keyword: list[dict],
        semantic_weight: float,
        top_k: int
    ) -> list[SearchResult]:
        """
        Apply Reciprocal Rank Fusion to merge result lists.

        Args:
            semantic: Semantic search results (SearchResult objects)
            keyword: Keyword search results (dicts)
            semantic_weight: Weight for semantic (0-1), keyword gets (1-weight)
            top_k: Number of final results

        Returns:
            Merged and re-ranked SearchResult list
        """
        scores: dict[str, float] = {}
        result_data: dict[str, dict] = {}
        result_sources: dict[str, list[str]] = {}

        keyword_weight = 1.0 - semantic_weight

        # Score semantic results
        for rank, result in enumerate(semantic):
            item_id = result.item_id
            if not item_id:
                continue

            rrf_score = semantic_weight * (1.0 / (self.RRF_K + rank))
            scores[item_id] = scores.get(item_id, 0) + rrf_score

            if item_id not in result_data:
                result_data[item_id] = {
                    'chunk_id': result.chunk_id,
                    'item_id': result.item_id,
                    'title': result.title,
                    'content': result.content,
                    'url': result.url,
                    'heading_path': result.heading_path,
                    'source_name': result.source_name,
                    'item_type': result.item_type,
                }
                result_sources[item_id] = []
            result_sources[item_id].append('semantic')

        # Score keyword results
        for rank, result in enumerate(keyword):
            item_id = result.get('id')
            if not item_id:
                continue

            rrf_score = keyword_weight * (1.0 / (self.RRF_K + rank))
            scores[item_id] = scores.get(item_id, 0) + rrf_score

            if item_id not in result_data:
                result_data[item_id] = {
                    'chunk_id': '',  # Keyword doesn't have chunks
                    'item_id': item_id,
                    'title': result.get('title', ''),
                    'content': result.get('excerpt', ''),
                    'url': result.get('url'),
                    'heading_path': [],
                    'source_name': result.get('source_name', ''),
                    'item_type': result.get('item_type', ''),
                }
                result_sources[item_id] = []
            if 'keyword' not in result_sources.get(item_id, []):
                result_sources[item_id].append('keyword')

        # Sort by RRF score
        sorted_ids = sorted(
            scores.keys(),
            key=lambda x: scores[x],
            reverse=True
        )

        # Build merged results
        merged = []
        for item_id in sorted_ids[:top_k]:
            data = result_data[item_id]

            merged.append(SearchResult(
                chunk_id=data['chunk_id'],
                item_id=data['item_id'],
                title=data['title'],
                content=data['content'],
                url=data.get('url'),
                heading_path=data.get('heading_path', []),
                score=round(scores[item_id], 6),
                source_name=data['source_name'],
                item_type=data['item_type'],
            ))

        return merged


def get_knowledge_rag_service(
    organization_id: str,
    product_id: str
) -> KnowledgeRAGService:
    """
    Factory function to get a KnowledgeRAGService for an organization and product.

    Args:
        organization_id: UUID of the organization
        product_id: UUID of the product to filter by (required for proper gating)

    Returns:
        KnowledgeRAGService instance
    """
    return KnowledgeRAGService(organization_id=organization_id, product_id=product_id)


def get_knowledge_rag_service_async(
    organization_id: str,
    product_id: str
) -> KnowledgeRAGServiceAsync:
    """
    Factory function to get an async KnowledgeRAGService for an organization and product.

    Use this in async contexts (SSE, WebSocket, Hatchet workflows).

    Args:
        organization_id: UUID of the organization
        product_id: UUID of the product to filter by (required for proper gating)

    Returns:
        KnowledgeRAGServiceAsync instance
    """
    return KnowledgeRAGServiceAsync(organization_id=organization_id, product_id=product_id)
