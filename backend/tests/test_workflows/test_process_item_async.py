"""
Tests that the KnowledgeItem processing pipeline works in an async context.

The critical bug: accessing item.product (a FK) inside _create_chunk triggers
SynchronousOnlyOperation if the item wasn't loaded with select_related('product').
These tests verify the full process_item flow runs without sync-in-async errors.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from apps.knowledge.models import KnowledgeItem, KnowledgeSource, KnowledgeChunk


@pytest.fixture
def knowledge_source(db, organization, product):
    """Create a knowledge source for testing."""
    return KnowledgeSource.objects.create(
        organization=organization,
        product=product,
        name="Test Docs",
        source_type=KnowledgeSource.SourceType.HELP_CENTER,
        url="https://docs.example.com",
    )


@pytest.fixture
def knowledge_item(db, organization, product, knowledge_source):
    """Create a knowledge item with content ready for processing."""
    return KnowledgeItem.objects.create(
        organization=organization,
        product=product,
        source=knowledge_source,
        item_type=KnowledgeItem.ItemType.PAGE,
        title="Getting Started Guide",
        raw_content=(
            "# Getting Started\n\n"
            "## Installation\n\n"
            "Run `pip install example` to get started.\n\n"
            "## Configuration\n\n"
            "Create a config file with your API key.\n\n"
            "## Usage\n\n"
            "Import the library and call `example.init()` to begin."
        ),
        url="https://docs.example.com/getting-started",
        status=KnowledgeItem.Status.PENDING,
        is_active=True,
    )


# transaction=True is required because async Django ORM calls run in a separate
# thread with its own DB connection, which cannot see data in an uncommitted
# test-wrapper transaction.
@pytest.mark.django_db(transaction=True)
class TestProcessItemAsyncSafety:
    """
    Verify that process_item runs without SynchronousOnlyOperation errors.

    The processing pipeline runs in an async Hatchet worker. Any lazy FK access
    (e.g. item.product, item.organization) that isn't pre-loaded via
    select_related will raise SynchronousOnlyOperation.
    """

    @patch('apps.knowledge.services.processing_service.ProcessingService._optimize_content_async')
    @patch('common.services.embedding_service.EmbeddingService.embed_document_async')
    async def test_process_item_completes_in_async_context(
        self, mock_embed, mock_optimize, knowledge_item
    ):
        """
        Full process_item pipeline should complete without sync-in-async errors.

        Mocks the LLM optimization and embedding generation (external APIs),
        but exercises the real Django ORM async path including:
        - item.asave() for status updates
        - KnowledgeChunk.objects.adelete() for old chunks
        - KnowledgeChunk.objects.acreate() with item.product and item.organization
        """
        from asgiref.sync import sync_to_async
        from apps.knowledge.services.processing_service import ProcessingService

        # Mock LLM optimization to return cleaned content
        mock_optimize.return_value = knowledge_item.raw_content

        # Mock embedding to return a fake vector
        mock_embed.return_value = [0.1] * 1536

        # Load item the same way the workflow does — with select_related
        item = await KnowledgeItem.objects.select_related(
            'source', 'organization', 'product'
        ).aget(id=knowledge_item.id)

        # Init ProcessingService in thread pool (mirrors the workflow)
        processing_service = await sync_to_async(
            ProcessingService, thread_sensitive=False
        )()
        result = await processing_service.process_item(item)

        # Should complete without error
        assert result.error is None, f"process_item failed: {result.error}"
        assert result.chunks_created > 0
        assert result.optimized is True

        # Verify chunks were actually created in the DB
        chunk_count = await KnowledgeChunk.objects.filter(
            knowledge_item=item
        ).acount()
        assert chunk_count == result.chunks_created

        # Verify item status is INDEXED
        await item.arefresh_from_db()
        assert item.status == KnowledgeItem.Status.INDEXED
        assert item.last_indexed_at is not None

    @patch('apps.knowledge.services.processing_service.ProcessingService._optimize_content_async')
    @patch('common.services.embedding_service.EmbeddingService.embed_document_async')
    async def test_process_item_fails_without_select_related_product(
        self, mock_embed, mock_optimize, knowledge_item
    ):
        """
        Loading item WITHOUT select_related('product') should fail with
        SynchronousOnlyOperation when _create_chunk accesses item.product.

        This is the exact bug that was happening in production.
        """
        from asgiref.sync import sync_to_async
        from django.core.exceptions import SynchronousOnlyOperation
        from apps.knowledge.services.processing_service import ProcessingService

        # Mock external services
        mock_optimize.return_value = knowledge_item.raw_content
        mock_embed.return_value = [0.1] * 1536

        # Load item WITHOUT product in select_related — simulates the old bug
        item = await KnowledgeItem.objects.select_related(
            'source', 'organization'
        ).aget(id=knowledge_item.id)

        # Clear any cached product to force a lazy load
        if 'product' in item._state.fields_cache:
            del item._state.fields_cache['product']

        processing_service = await sync_to_async(
            ProcessingService, thread_sensitive=False
        )()
        result = await processing_service.process_item(item)

        # Should fail with the sync-in-async error
        assert result.error is not None
        assert "async context" in result.error or "SynchronousOnlyOperation" in result.error

    @patch('apps.knowledge.services.processing_service.ProcessingService._optimize_content_async')
    @patch('common.services.embedding_service.EmbeddingService.embed_document_async')
    async def test_snippet_item_processes_without_optimization(
        self, mock_embed, mock_optimize, organization, product, knowledge_source
    ):
        """Snippet items skip LLM optimization but still chunk and embed."""
        from asgiref.sync import sync_to_async
        from apps.knowledge.services.processing_service import ProcessingService

        # Create a snippet item via async ORM (we're in an async test function)
        snippet = await sync_to_async(KnowledgeItem.objects.create)(
            organization=organization,
            product=product,
            source=knowledge_source,
            item_type=KnowledgeItem.ItemType.SNIPPET,
            title="Custom Instruction",
            raw_content="Always greet users by name when possible.",
            status=KnowledgeItem.Status.PENDING,
            is_active=True,
        )

        mock_embed.return_value = [0.1] * 1536

        item = await KnowledgeItem.objects.select_related(
            'source', 'organization', 'product'
        ).aget(id=snippet.id)

        processing_service = await sync_to_async(
            ProcessingService, thread_sensitive=False
        )()
        result = await processing_service.process_item(item)

        assert result.error is None, f"process_item failed: {result.error}"
        assert result.chunks_created > 0
        # Snippets should NOT be optimized
        assert result.optimized is False
        # _optimize_content_async should not have been called
        mock_optimize.assert_not_called()
