"""
Tests for KnowledgeRAGService.

Tests the RAG service that provides semantic search over KnowledgeChunks
with all the optimizations ported from DjangoRAGService:
- Query embedding caching
- Cohere reranking
- URL/item diversity filtering
- Performance logging
- Async support
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock
from django.test.utils import override_settings
from django.core.cache import cache

from apps.knowledge.services.rag_service import (
    KnowledgeRAGService,
    KnowledgeRAGServiceAsync,
    get_knowledge_rag_service,
    get_knowledge_rag_service_async,
    SearchResult,
)
from apps.knowledge.models import (
    KnowledgeSource,
    KnowledgeItem,
    KnowledgeChunk,
)


@pytest.fixture
def knowledge_source(db, organization, product):
    """Create a knowledge source for testing."""
    return KnowledgeSource.objects.create(
        organization=organization,
        product=product,
        name="Test Documentation",
        source_type=KnowledgeSource.SourceType.SNIPPETS,
        status=KnowledgeSource.Status.ACTIVE,
    )


@pytest.fixture
def knowledge_items(db, organization, product, knowledge_source):
    """Create multiple knowledge items with chunks for testing."""
    items = []
    
    # Item 1: Getting Started
    item1 = KnowledgeItem.objects.create(
        organization=organization,
        product=product,
        source=knowledge_source,
        title="Getting Started with the API",
        url="https://docs.example.com/getting-started",
        external_id="test-getting-started",  # Unique external_id required
        item_type=KnowledgeItem.ItemType.PAGE,
        status=KnowledgeItem.Status.INDEXED,
        is_active=True,
        raw_content="# Getting Started\n\nThis guide helps you get started with our API.",
        optimized_content="# Getting Started\n\nThis guide helps you get started with our API.",
    )
    items.append(item1)
    
    # Item 2: Authentication
    item2 = KnowledgeItem.objects.create(
        organization=organization,
        product=product,
        source=knowledge_source,
        title="API Authentication",
        url="https://docs.example.com/authentication",
        external_id="test-authentication",  # Unique external_id required
        item_type=KnowledgeItem.ItemType.PAGE,
        status=KnowledgeItem.Status.INDEXED,
        is_active=True,
        raw_content="# Authentication\n\nLearn how to authenticate API requests.",
        optimized_content="# Authentication\n\nLearn how to authenticate API requests.",
    )
    items.append(item2)
    
    # Item 3: Pricing (snippet)
    item3 = KnowledgeItem.objects.create(
        organization=organization,
        product=product,
        source=knowledge_source,
        title="Pricing Information",
        external_id="test-pricing",  # Unique external_id required
        item_type=KnowledgeItem.ItemType.SNIPPET,
        status=KnowledgeItem.Status.INDEXED,
        is_active=True,
        raw_content="Our pricing starts at $29/month for the starter plan.",
        optimized_content="Our pricing starts at $29/month for the starter plan.",
    )
    items.append(item3)
    
    return items


@pytest.fixture
def knowledge_chunks(db, organization, product, knowledge_items):
    """Create knowledge chunks with embeddings for testing."""
    chunks = []
    
    # Create fake 1536-dimension embeddings
    fake_embedding = [0.1] * 1536
    
    # Chunks for Getting Started item
    item1 = knowledge_items[0]
    chunks.append(KnowledgeChunk.objects.create(
        organization=organization,
        product=product,
        knowledge_item=item1,
        title="Getting Started Overview",
        content="This guide helps you get started with our API. Follow these steps to begin.",
        heading_path=["Getting Started"],
        chunk_index=0,
        embedding=fake_embedding,
        embedding_model="text-embedding-3-small",
        content_hash="hash1",
    ))
    chunks.append(KnowledgeChunk.objects.create(
        organization=organization,
        product=product,
        knowledge_item=item1,
        title="Installation",
        content="Install the SDK using npm: npm install our-sdk. Then import it in your project.",
        heading_path=["Getting Started", "Installation"],
        chunk_index=1,
        embedding=[0.15] * 1536,  # Slightly different
        embedding_model="text-embedding-3-small",
        content_hash="hash2",
    ))
    
    # Chunks for Authentication item  
    item2 = knowledge_items[1]
    chunks.append(KnowledgeChunk.objects.create(
        organization=organization,
        product=product,
        knowledge_item=item2,
        title="API Key Authentication",
        content="Use your API key in the Authorization header: Bearer YOUR_API_KEY",
        heading_path=["Authentication", "API Key"],
        chunk_index=0,
        embedding=[0.2] * 1536,
        embedding_model="text-embedding-3-small",
        content_hash="hash3",
    ))
    chunks.append(KnowledgeChunk.objects.create(
        organization=organization,
        product=product,
        knowledge_item=item2,
        title="OAuth Authentication",
        content="For OAuth, configure your redirect URI and use the /oauth/authorize endpoint.",
        heading_path=["Authentication", "OAuth"],
        chunk_index=1,
        embedding=[0.25] * 1536,
        embedding_model="text-embedding-3-small",
        content_hash="hash4",
    ))
    
    # Chunk for Pricing item
    item3 = knowledge_items[2]
    chunks.append(KnowledgeChunk.objects.create(
        organization=organization,
        product=product,
        knowledge_item=item3,
        title="Pricing",
        content="Our pricing starts at $29/month for the starter plan. Enterprise pricing available.",
        heading_path=["Pricing"],
        chunk_index=0,
        embedding=[0.3] * 1536,
        embedding_model="text-embedding-3-small",
        content_hash="hash5",
    ))
    
    return chunks


@pytest.fixture
def rag_service(organization, product, knowledge_source, knowledge_items, knowledge_chunks):
    """Create a RAGService with test data already set up."""
    return get_knowledge_rag_service(str(organization.id), str(product.id))


class TestKnowledgeRAGServiceBasics:
    """Test basic KnowledgeRAGService functionality."""

    def test_get_service_creates_instance(self, organization, product):
        """Test that get_knowledge_rag_service creates a service."""
        service = get_knowledge_rag_service(str(organization.id), str(product.id))

        assert service is not None
        assert isinstance(service, KnowledgeRAGService)
        assert service.organization_id == str(organization.id)
        assert service.product_id == str(product.id)

    def test_async_service_creates_instance(self, organization, product):
        """Test that async factory creates correct instance."""
        service = get_knowledge_rag_service_async(str(organization.id), str(product.id))

        assert service is not None
        assert isinstance(service, KnowledgeRAGServiceAsync)
        assert service.organization_id == str(organization.id)
        assert service.product_id == str(product.id)

    def test_service_has_embedding_service(self, rag_service):
        """Test that service has embedding service configured."""
        assert rag_service.embedding_service is not None


@pytest.mark.django_db
class TestKnowledgeRAGServiceSearch:
    """Test search functionality with mocked embeddings."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_returns_results(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test basic search returns results."""
        # Mock embedding close to Getting Started chunks
        mock_embed.return_value = [0.1] * 1536

        results = rag_service.search(
            query="How do I get started?",
            top_k=5,
        )

        assert len(results) > 0
        assert all(isinstance(r, SearchResult) for r in results)
        mock_embed.assert_called_once()

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_respects_top_k(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that top_k limits results."""
        mock_embed.return_value = [0.15] * 1536

        results = rag_service.search(
            query="installation",
            top_k=2,
        )

        assert len(results) <= 2

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_filters_by_item_type(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test filtering by item type."""
        mock_embed.return_value = [0.3] * 1536

        results = rag_service.search(
            query="pricing",
            item_types=[KnowledgeItem.ItemType.SNIPPET],
        )

        # All results should be from snippets
        for result in results:
            assert result.item_type == KnowledgeItem.ItemType.SNIPPET

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_filters_by_source_id(
        self, mock_embed, rag_service, knowledge_chunks, knowledge_source
    ):
        """Test filtering by source ID."""
        mock_embed.return_value = [0.1] * 1536

        results = rag_service.search(
            query="API",
            source_ids=[str(knowledge_source.id)],
        )

        assert len(results) > 0

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_returns_correct_fields(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that SearchResult has all expected fields."""
        mock_embed.return_value = [0.2] * 1536

        results = rag_service.search(query="authentication", top_k=1)

        if results:
            result = results[0]
            assert hasattr(result, 'chunk_id')
            assert hasattr(result, 'item_id')
            assert hasattr(result, 'title')
            assert hasattr(result, 'content')
            assert hasattr(result, 'url')
            assert hasattr(result, 'heading_path')
            assert hasattr(result, 'score')
            assert hasattr(result, 'source_name')
            assert hasattr(result, 'item_type')

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_empty_query_returns_empty(
        self, mock_embed, rag_service
    ):
        """Test that empty query returns empty results."""
        results = rag_service.search(query="")
        assert results == []
        mock_embed.assert_not_called()

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_whitespace_query_returns_empty(
        self, mock_embed, rag_service
    ):
        """Test that whitespace query returns empty results."""
        results = rag_service.search(query="   ")
        assert results == []
        mock_embed.assert_not_called()


@pytest.mark.django_db
class TestQueryEmbeddingCaching:
    """Test query embedding caching functionality."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_embedding_is_cached(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that query embeddings are cached in Redis."""
        mock_embed.return_value = [0.1] * 1536
        
        # Clear cache first
        cache.clear()

        # First call - should generate embedding
        results1 = rag_service.search(query="How do I get started?")
        assert mock_embed.call_count == 1

        # Second call with same query - should use cache
        results2 = rag_service.search(query="How do I get started?")
        # Should still be 1 since second call used cache
        assert mock_embed.call_count == 1

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_different_queries_generate_different_embeddings(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that different queries create separate cache entries."""
        mock_embed.return_value = [0.1] * 1536
        
        cache.clear()

        rag_service.search(query="first query")
        rag_service.search(query="second query")

        # Both queries should generate embeddings
        assert mock_embed.call_count == 2


@pytest.mark.django_db
class TestDiversityFiltering:
    """Test URL/item diversity filtering."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    @override_settings(RAG_MAX_CHUNKS_PER_URL=1, COHERE_RERANK_ENABLED=False)
    def test_diversity_limits_chunks_per_item(
        self, mock_embed, rag_service, knowledge_chunks, knowledge_items
    ):
        """Test that diversity filter limits chunks from same item."""
        # Mock embedding that matches Getting Started item (which has 2 chunks)
        mock_embed.return_value = [0.12] * 1536

        results = rag_service.search(
            query="getting started installation",
            top_k=10,
            max_chunks_per_item=1,
        )

        # Count chunks per item
        items_seen = {}
        for result in results:
            item_id = result.item_id
            items_seen[item_id] = items_seen.get(item_id, 0) + 1

        # Each item should have at most 1 chunk
        for item_id, count in items_seen.items():
            assert count <= 1, f"Item {item_id} has {count} chunks, expected <= 1"


@pytest.mark.django_db
class TestCohereReranking:
    """Test Cohere reranking integration."""

    @patch('common.utils.reranker_service.CohereRerankerService.rerank')
    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    @override_settings(COHERE_RERANK_ENABLED=True, COHERE_RERANK_CANDIDATES=10)
    def test_reranking_is_applied(
        self, mock_embed, mock_rerank, rag_service, knowledge_chunks
    ):
        """Test that Cohere reranking is applied when enabled."""
        mock_embed.return_value = [0.1] * 1536
        
        # Mock reranker to return reordered results
        def rerank_side_effect(query, documents, top_n):
            # Reverse the order to prove reranking was applied
            return list(reversed(documents[:top_n]))
        
        mock_rerank.side_effect = rerank_side_effect

        results = rag_service.search(
            query="API authentication",
            top_k=3,
        )

        mock_rerank.assert_called_once()

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    @override_settings(COHERE_RERANK_ENABLED=False)
    def test_reranking_skipped_when_disabled(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that reranking is skipped when disabled."""
        mock_embed.return_value = [0.1] * 1536

        with patch('common.utils.reranker_service.get_reranker') as mock_get_reranker:
            results = rag_service.search(
                query="getting started",
                top_k=3,
            )
            
            # Reranker should not be instantiated
            mock_get_reranker.assert_not_called()


@pytest.mark.django_db
class TestGetContextForPrompt:
    """Test context formatting for LLM prompts."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_get_context_returns_formatted_string(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that get_context_for_prompt returns formatted context."""
        mock_embed.return_value = [0.1] * 1536

        context = rag_service.get_context_for_prompt(
            query="getting started",
            max_tokens=4000,
        )

        assert isinstance(context, str)
        if context:
            # Should contain source attribution
            assert "[Source:" in context

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_get_context_respects_max_tokens(
        self, mock_embed, rag_service, knowledge_chunks
    ):
        """Test that max_tokens limits context size."""
        mock_embed.return_value = [0.1] * 1536

        # Request very small context
        context = rag_service.get_context_for_prompt(
            query="API",
            max_tokens=50,  # Very small
        )

        # Context should be limited (rough check)
        # 50 tokens ~= 200 chars
        assert len(context) < 500 or context == ""


@pytest.mark.django_db
class TestSearchHelpers:
    """Test convenience search methods."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_snippets_filters_correctly(
        self, mock_embed, rag_service, knowledge_chunks, knowledge_items
    ):
        """Test search_snippets only returns snippets."""
        mock_embed.return_value = [0.3] * 1536

        results = rag_service.search_snippets(query="pricing")

        for result in results:
            assert result.item_type == KnowledgeItem.ItemType.SNIPPET

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_pages_filters_correctly(
        self, mock_embed, rag_service, knowledge_chunks, knowledge_items
    ):
        """Test search_pages only returns pages."""
        mock_embed.return_value = [0.1] * 1536

        results = rag_service.search_pages(query="getting started")

        for result in results:
            assert result.item_type == KnowledgeItem.ItemType.PAGE


@pytest.mark.django_db
@pytest.mark.asyncio
class TestKnowledgeRAGServiceAsync:
    """Test async version of RAGService."""

    async def test_async_service_search(self, organization, product, knowledge_chunks):
        """Test basic async search."""
        service = get_knowledge_rag_service_async(str(organization.id), str(product.id))

        with patch.object(
            service.embedding_service, 'embed_query_async',
            new_callable=AsyncMock, return_value=[0.1] * 1536
        ):
            results = await service.search(query="getting started")

            assert isinstance(results, list)
            assert all(isinstance(r, SearchResult) for r in results)

    async def test_async_caching(self, organization, product, knowledge_chunks):
        """Test that async version also caches embeddings."""
        service = get_knowledge_rag_service_async(str(organization.id), str(product.id))
        cache.clear()

        with patch.object(
            service.embedding_service, 'embed_query_async',
            new_callable=AsyncMock, return_value=[0.1] * 1536
        ) as mock_embed:
            # First call
            await service.search(query="test query")
            assert mock_embed.call_count == 1

            # Second call - should use cache
            await service.search(query="test query")
            assert mock_embed.call_count == 1

    async def test_async_get_context(self, organization, product, knowledge_chunks):
        """Test async context generation."""
        service = get_knowledge_rag_service_async(str(organization.id), str(product.id))

        with patch.object(
            service.embedding_service, 'embed_query_async',
            new_callable=AsyncMock, return_value=[0.1] * 1536
        ):
            context = await service.get_context_for_prompt(query="API")

            assert isinstance(context, str)


@pytest.mark.django_db
class TestOrganizationIsolation:
    """Test that searches are properly isolated by organization."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_search_only_returns_own_organization(
        self, mock_embed, rag_service, organization, other_organization, knowledge_source
    ):
        """Test that search doesn't return other org's chunks."""
        mock_embed.return_value = [0.1] * 1536

        # Create content in other organization
        other_source = KnowledgeSource.objects.create(
            organization=other_organization,
            name="Other Docs",
            source_type=KnowledgeSource.SourceType.SNIPPETS,
            status=KnowledgeSource.Status.ACTIVE,
        )
        other_item = KnowledgeItem.objects.create(
            organization=other_organization,
            source=other_source,
            title="Other Org Content",
            external_id="other-org-content",  # Unique external_id required
            item_type=KnowledgeItem.ItemType.PAGE,
            status=KnowledgeItem.Status.INDEXED,
            is_active=True,
            raw_content="Content from other org",
        )
        other_chunk = KnowledgeChunk.objects.create(
            organization=other_organization,
            knowledge_item=other_item,
            title="Other Chunk",
            content="This is content from another organization",
            chunk_index=0,
            embedding=[0.1] * 1536,
            embedding_model="text-embedding-3-small",
            content_hash="other_hash",
        )

        # Search should not return other org's content
        results = rag_service.search(query="content from another")

        result_titles = [r.title for r in results]
        assert "Other Chunk" not in result_titles


@pytest.mark.django_db
class TestExcludedContent:
    """Test that inactive/non-indexed content is excluded."""

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_inactive_items_excluded(
        self, mock_embed, rag_service, organization, knowledge_source
    ):
        """Test that inactive items are not returned."""
        mock_embed.return_value = [0.1] * 1536

        # Create inactive item
        inactive_item = KnowledgeItem.objects.create(
            organization=organization,
            source=knowledge_source,
            title="Inactive Content",
            item_type=KnowledgeItem.ItemType.PAGE,
            status=KnowledgeItem.Status.INDEXED,
            is_active=False,  # Inactive
            raw_content="This is inactive",
        )
        KnowledgeChunk.objects.create(
            organization=organization,
            knowledge_item=inactive_item,
            title="Inactive Chunk",
            content="Inactive chunk content",
            chunk_index=0,
            embedding=[0.1] * 1536,
            embedding_model="text-embedding-3-small",
            content_hash="inactive_hash",
        )

        results = rag_service.search(query="inactive content")

        result_titles = [r.title for r in results]
        assert "Inactive Chunk" not in result_titles

    @patch('common.services.embedding_service.EmbeddingService.embed_query')
    def test_non_indexed_items_excluded(
        self, mock_embed, rag_service, organization, knowledge_source
    ):
        """Test that non-indexed items are not returned."""
        mock_embed.return_value = [0.1] * 1536

        # Create pending item
        pending_item = KnowledgeItem.objects.create(
            organization=organization,
            source=knowledge_source,
            title="Pending Content",
            item_type=KnowledgeItem.ItemType.PAGE,
            status=KnowledgeItem.Status.PENDING,  # Not indexed
            is_active=True,
            raw_content="This is pending",
        )
        KnowledgeChunk.objects.create(
            organization=organization,
            knowledge_item=pending_item,
            title="Pending Chunk",
            content="Pending chunk content",
            chunk_index=0,
            embedding=[0.1] * 1536,
            embedding_model="text-embedding-3-small",
            content_hash="pending_hash",
        )

        results = rag_service.search(query="pending content")

        result_titles = [r.title for r in results]
        assert "Pending Chunk" not in result_titles
