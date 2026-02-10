"""
E2E tests for KnowledgeRAGService with real embeddings.

These tests use REAL API calls to generate embeddings and verify
the full RAG pipeline works end-to-end.

Usage:
    # Local - load env first, then run with e2e settings
    export $(grep -v '^#' .env.local | xargs)
    cd backend
    .venv/bin/python -m pytest tests/test_services/test_knowledge_rag_e2e.py -m e2e -v

Requirements:
    - GOOGLE_API_KEY set for embedding generation
    - PostgreSQL with pgvector extension (not SQLite)
"""
import pytest
import logging
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from asgiref.sync import sync_to_async

from apps.knowledge.services.rag_service import (
    get_knowledge_rag_service,
    get_knowledge_rag_service_async,
    SearchResult,
)
from apps.knowledge.models import (
    KnowledgeSource,
    KnowledgeItem,
    KnowledgeChunk,
)
from common.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


# =============================================================================
# Test content definitions
# =============================================================================

TEST_CONTENT = [
    {
        'title': 'Getting Started Guide',
        'url': 'https://docs.example.com/getting-started',
        'item_type': 'page',
        'chunks': [
            {
                'title': 'Introduction',
                'content': (
                    "Welcome to our platform! This guide will help you get started "
                    "quickly. Our platform provides powerful APIs for building "
                    "modern applications with ease."
                ),
                'heading_path': ['Getting Started', 'Introduction'],
            },
            {
                'title': 'Installation',
                'content': (
                    "To install our SDK, run: npm install our-sdk. "
                    "For Python users: pip install our-sdk. "
                    "After installation, import the SDK in your project and "
                    "configure it with your API key."
                ),
                'heading_path': ['Getting Started', 'Installation'],
            },
            {
                'title': 'Quick Start',
                'content': (
                    "Create your first project by initializing the client with "
                    "your API key. Then make your first API call to verify "
                    "everything is working correctly."
                ),
                'heading_path': ['Getting Started', 'Quick Start'],
            },
        ],
    },
    {
        'title': 'API Authentication',
        'url': 'https://docs.example.com/authentication',
        'item_type': 'page',
        'chunks': [
            {
                'title': 'API Key Authentication',
                'content': (
                    "Use your API key in the Authorization header: "
                    "Authorization: Bearer YOUR_API_KEY. "
                    "API keys can be created in your dashboard settings. "
                    "Keep your API key secret and never commit it to version control."
                ),
                'heading_path': ['Authentication', 'API Key'],
            },
            {
                'title': 'OAuth 2.0 Authentication',
                'content': (
                    "For OAuth 2.0, configure your redirect URI in the dashboard. "
                    "Use the /oauth/authorize endpoint to initiate the OAuth flow. "
                    "Exchange the authorization code for an access token."
                ),
                'heading_path': ['Authentication', 'OAuth 2.0'],
            },
        ],
    },
    {
        'title': 'Pricing Information',
        'item_type': 'snippet',
        'chunks': [
            {
                'title': 'Pricing Plans',
                'content': (
                    "Our pricing starts at $29/month for the Starter plan. "
                    "The Pro plan at $99/month includes advanced features. "
                    "Enterprise pricing is available for large organizations "
                    "with custom requirements and dedicated support."
                ),
                'heading_path': ['Pricing'],
            },
        ],
    },
    {
        'title': 'Troubleshooting Common Issues',
        'url': 'https://docs.example.com/troubleshooting',
        'item_type': 'page',
        'chunks': [
            {
                'title': 'Authentication Errors',
                'content': (
                    "If you see 'Invalid API key' errors, verify your API key "
                    "is correct and hasn't expired. Check that you're using "
                    "the correct environment (production vs staging)."
                ),
                'heading_path': ['Troubleshooting', 'Authentication Errors'],
            },
            {
                'title': 'Rate Limiting',
                'content': (
                    "Rate limit errors (429) occur when you exceed the allowed "
                    "requests per minute. Implement exponential backoff in your "
                    "code. Contact support to increase your limits if needed."
                ),
                'heading_path': ['Troubleshooting', 'Rate Limiting'],
            },
        ],
    },
]

ITEM_TYPE_MAP = {
    'page': KnowledgeItem.ItemType.PAGE,
    'snippet': KnowledgeItem.ItemType.SNIPPET,
}


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope='session')
def e2e_embeddings(django_db_setup, django_db_blocker):
    """Generate REAL embeddings once per session (expensive API calls).

    Returns a dict mapping chunk content -> embedding vector.
    Session-scoped so we only call the embedding API once,
    even though DB data is recreated per-test.
    """
    with django_db_blocker.unblock():
        embedding_service = get_embedding_service()
        embeddings: dict[str, list[float]] = {}
        for item_data in TEST_CONTENT:
            for chunk_data in item_data['chunks']:
                content = chunk_data['content']
                embeddings[content] = embedding_service.embed_document(content)
                logger.info(f"Generated embedding for: {chunk_data['title']}")
        logger.info(f"Generated {len(embeddings)} embeddings for session")
        return embeddings


@pytest.fixture
def e2e_indexed_content(db, e2e_embeddings):
    """Create indexed content with cached embeddings for each test.

    Uses pre-generated embeddings from the session-scoped fixture
    but creates fresh DB records per-test (TransactionTestCase
    truncates after each test).
    """
    from apps.users.models import Organization
    from apps.products.models import Product

    org, _ = Organization.objects.get_or_create(
        name="E2E RAG Test Org",
        defaults={'plan': 'pro', 'subscription_status': 'active'},
    )
    product, _ = Product.objects.get_or_create(
        organization=org,
        subdomain="e2e-rag-test",
        defaults={'name': 'E2E RAG Test Product'},
    )
    source, _ = KnowledgeSource.objects.get_or_create(
        organization=org,
        product=product,
        name="E2E Test Documentation",
        defaults={
            'source_type': KnowledgeSource.SourceType.SNIPPETS,
            'status': KnowledgeSource.Status.ACTIVE,
        },
    )

    chunks_created: list[KnowledgeChunk] = []

    for item_data in TEST_CONTENT:
        url = item_data.get('url') or f"https://docs.example.com/{uuid4()}"
        external_id = KnowledgeItem.generate_external_id(url)
        item_type = ITEM_TYPE_MAP[item_data['item_type']]

        item = KnowledgeItem.objects.create(
            organization=org,
            product=product,
            source=source,
            title=item_data['title'],
            url=url,
            external_id=external_id,
            item_type=item_type,
            status=KnowledgeItem.Status.INDEXED,
            is_active=True,
            raw_content='\n\n'.join(c['content'] for c in item_data['chunks']),
            optimized_content='\n\n'.join(c['content'] for c in item_data['chunks']),
        )

        for idx, chunk_data in enumerate(item_data['chunks']):
            chunk = KnowledgeChunk.objects.create(
                organization=org,
                product=product,
                knowledge_item=item,
                title=chunk_data['title'],
                content=chunk_data['content'],
                heading_path=chunk_data['heading_path'],
                chunk_index=idx,
                embedding=e2e_embeddings[chunk_data['content']],
                embedding_model=settings.RAG_EMBEDDING_MODEL,
                content_hash=str(uuid4())[:32],
            )
            chunks_created.append(chunk)

    logger.info(f"Created {len(chunks_created)} chunks with cached embeddings")

    return {
        'organization': org,
        'product': product,
        'source': source,
        'chunks': chunks_created,
    }


# =============================================================================
# Tests
# =============================================================================

@pytest.mark.e2e
@pytest.mark.django_db(transaction=True)
class TestKnowledgeRAGE2E:
    """E2E tests for KnowledgeRAGService with real embeddings.

    Tests the full RAG pipeline:
    1. Query embedding generation (real API call)
    2. Vector similarity search (pgvector)
    3. Diversity filtering
    4. Result ranking
    5. Async variants
    6. Context generation for LLM prompts
    """

    # -- helpers --

    def _service(self, data):
        """Build a sync RAG service from fixture data."""
        org_id = str(data['organization'].id)
        product_id = str(data['product'].id)
        return get_knowledge_rag_service(org_id, product_id)

    def _async_service(self, data):
        """Build an async RAG service from fixture data."""
        org_id = str(data['organization'].id)
        product_id = str(data['product'].id)
        return get_knowledge_rag_service_async(org_id, product_id)

    # -- core search --

    def test_search_finds_relevant_content(self, e2e_indexed_content):
        """Search for installation instructions returns relevant results."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(query="How do I install the SDK?", top_k=5)

        assert len(results) > 0, "Expected results for installation query"
        for r in results:
            assert isinstance(r, SearchResult)
            assert r.chunk_id
            assert r.content
            assert r.score > 0

        installation_found = any(
            'install' in r.content.lower() or 'install' in r.title.lower()
            for r in results[:3]
        )
        assert installation_found, (
            f"Expected installation content in top 3. "
            f"Got: {[r.title for r in results[:3]]}"
        )

    def test_search_authentication_query(self, e2e_indexed_content):
        """Search for authentication returns auth-related content."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(
            query="How do I authenticate API requests?", top_k=5
        )

        assert len(results) > 0, "Expected results for auth query"
        auth_found = any(
            'api key' in r.content.lower()
            or 'oauth' in r.content.lower()
            or 'authentication' in r.title.lower()
            for r in results[:3]
        )
        assert auth_found, "Expected authentication content in results"

    def test_search_pricing_query(self, e2e_indexed_content):
        """Search for pricing returns pricing content."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(query="What is the pricing?", top_k=5)

        assert len(results) > 0, "Expected results for pricing query"
        pricing_found = any(
            '$' in r.content
            or 'pricing' in r.title.lower()
            or 'plan' in r.content.lower()
            for r in results[:3]
        )
        assert pricing_found, "Expected pricing content in results"

    def test_search_filters_by_item_type(self, e2e_indexed_content):
        """item_type filter restricts results to that type."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(
            query="pricing plans",
            top_k=10,
            item_types=[KnowledgeItem.ItemType.SNIPPET],
        )

        assert len(results) > 0, "Expected snippet results for pricing query"
        for r in results:
            assert r.item_type == KnowledgeItem.ItemType.SNIPPET

    # -- caching and infrastructure --

    def test_embedding_caching_works(self, e2e_indexed_content):
        """Same query twice returns identical results (cached embedding)."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        query = "How do I get started with the platform?"
        results1 = service.search(query=query, top_k=3)
        results2 = service.search(query=query, top_k=3)

        assert len(results1) == len(results2)
        for r1, r2 in zip(results1, results2):
            assert r1.chunk_id == r2.chunk_id

    def test_diversity_filtering(self, e2e_indexed_content):
        """max_chunks_per_item=1 limits to one chunk per item."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(
            query="getting started tutorial",
            top_k=10,
            max_chunks_per_item=1,
        )

        items_seen: dict[str, int] = {}
        for r in results:
            items_seen[r.item_id] = items_seen.get(r.item_id, 0) + 1
        for item_id, count in items_seen.items():
            assert count <= 1, f"Item {item_id} has {count} chunks, expected <= 1"

    # -- context generation --

    def test_get_context_for_prompt(self, e2e_indexed_content):
        """get_context_for_prompt returns attributed context string."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        context = service.get_context_for_prompt(
            query="How do I authenticate?", max_tokens=2000
        )

        assert isinstance(context, str)
        assert len(context) > 0, "Expected non-empty context"
        assert '[Source:' in context, "Expected source attribution in context"

    # -- async variants --

    @pytest.mark.asyncio
    async def test_async_search(self, e2e_indexed_content):
        """Async search returns results with correct types."""
        service = self._async_service(e2e_indexed_content)
        await sync_to_async(cache.clear)()

        results = await service.search(
            query="What is rate limiting?", top_k=5
        )

        assert len(results) > 0
        assert all(isinstance(r, SearchResult) for r in results)
        rate_limit_found = any(
            'rate' in r.content.lower() or '429' in r.content
            for r in results[:3]
        )
        assert rate_limit_found, "Expected rate limiting content in results"

    @pytest.mark.asyncio
    async def test_async_caching(self, e2e_indexed_content):
        """Async caching returns same chunks on repeat query.

        Uses top_k=10 (larger than total chunks) so that Cohere
        reranking differences don't change which chunks are included
        in the result set.
        """
        service = self._async_service(e2e_indexed_content)
        await sync_to_async(cache.clear)()

        query = "OAuth authentication setup"
        results1 = await service.search(query=query, top_k=10)
        results2 = await service.search(query=query, top_k=10)

        assert len(results1) == len(results2)
        ids1 = {r.chunk_id for r in results1}
        ids2 = {r.chunk_id for r in results2}
        assert ids1 == ids2, (
            f"Cached query should return same chunks. "
            f"Got {ids1} vs {ids2}"
        )

    # -- relevance quality --

    def test_semantic_understanding(self, e2e_indexed_content):
        """Semantic search finds relevant content without keyword overlap."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        # Query that doesn't contain exact keywords from content
        # but should match semantically
        results = service.search(
            query="How do I set up my development environment?", top_k=5
        )

        assert len(results) > 0
        relevant_found = any(
            'install' in r.content.lower()
            or 'quick start' in r.title.lower()
            or 'getting started' in str(r.heading_path).lower()
            for r in results[:3]
        )
        assert relevant_found, (
            "Expected setup-related content for development environment query"
        )

    def test_troubleshooting_queries(self, e2e_indexed_content):
        """Troubleshooting-style queries match relevant content."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(
            query="My API calls are failing with error code 429", top_k=5
        )

        assert len(results) > 0
        rate_limit_found = any(
            '429' in r.content
            or 'rate limit' in r.content.lower()
            or 'rate limiting' in r.title.lower()
            for r in results[:3]
        )
        assert rate_limit_found, "Expected rate limiting troubleshooting content"

    def test_scores_are_reasonable(self, e2e_indexed_content):
        """Relevance scores are valid and properly ordered."""
        service = self._service(e2e_indexed_content)
        cache.clear()

        results = service.search(query="API key authentication", top_k=5)

        assert len(results) > 0

        for r in results:
            assert 0 <= r.score <= 1, f"Score {r.score} out of range"

        scores = [r.score for r in results]
        assert scores == sorted(scores, reverse=True), "Results not sorted by score"

        assert results[0].score > 0.5, (
            f"Expected high score for exact match, got {results[0].score}"
        )
