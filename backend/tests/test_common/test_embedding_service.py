"""
Tests for EmbeddingService.

These tests verify that the unified embedding service works correctly
in both sync and async contexts, respects configuration, and provides
consistent results.
"""
import pytest
import numpy as np
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from common.services.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    reset_embedding_service
)


@pytest.fixture(autouse=True)
def reset_service():
    """Reset the singleton before and after each test."""
    reset_embedding_service()
    yield
    reset_embedding_service()


@pytest.fixture
def mock_embedding_model():
    """Create a mock embedding model."""
    model = Mock()

    # Mock query embedding (returns a 1536-dim vector)
    model.get_query_embedding.return_value = [0.1] * 1536

    # Mock document embedding (returns a 1536-dim vector)
    model.get_text_embedding.return_value = [0.2] * 1536

    # Mock async methods
    model.aget_query_embedding = AsyncMock(return_value=[0.1] * 1536)
    model.aget_text_embedding = AsyncMock(return_value=[0.2] * 1536)

    return model


class TestEmbeddingServiceBasics:
    """Test basic EmbeddingService functionality."""

    def test_singleton_pattern(self):
        """Test that get_embedding_service returns the same instance."""
        service1 = get_embedding_service()
        service2 = get_embedding_service()

        assert service1 is service2, "Should return same singleton instance"

    def test_reset_singleton(self):
        """Test that reset creates a new instance."""
        service1 = get_embedding_service()
        reset_embedding_service()
        service2 = get_embedding_service()

        assert service1 is not service2, "Should return new instance after reset"

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_initialization(self, mock_get_model, mock_embedding_model):
        """Test service initialization."""
        mock_get_model.return_value = mock_embedding_model

        service = EmbeddingService()

        assert service._model is mock_embedding_model
        mock_get_model.assert_called_once()


class TestEmbedQuery:
    """Test embed_query method."""

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_embed_query_success(self, mock_get_model, mock_embedding_model):
        """Test successful query embedding generation."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        result = service.embed_query("What is the pricing?")

        assert isinstance(result, list)
        assert len(result) == 1536
        mock_embedding_model.get_query_embedding.assert_called_once_with(
            "What is the pricing?"
        )

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_embed_query_empty_text(self, mock_get_model, mock_embedding_model):
        """Test that empty text raises ValueError."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        with pytest.raises(ValueError, match="Text cannot be empty"):
            service.embed_query("")

        with pytest.raises(ValueError, match="Text cannot be empty"):
            service.embed_query("   ")

        with pytest.raises(ValueError, match="Text cannot be empty"):
            service.embed_query(None)

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_embed_query_model_error(self, mock_get_model, mock_embedding_model):
        """Test that model errors are propagated."""
        mock_get_model.return_value = mock_embedding_model
        mock_embedding_model.get_query_embedding.side_effect = RuntimeError("API error")

        service = get_embedding_service()

        with pytest.raises(RuntimeError, match="API error"):
            service.embed_query("test query")


class TestEmbedDocument:
    """Test embed_document method."""

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_embed_document_success(self, mock_get_model, mock_embedding_model):
        """Test successful document embedding generation."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        result = service.embed_document("This is document content.")

        assert isinstance(result, list)
        assert len(result) == 1536
        mock_embedding_model.get_text_embedding.assert_called_once_with(
            "This is document content."
        )

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_embed_document_empty_text(self, mock_get_model, mock_embedding_model):
        """Test that empty text raises ValueError."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        with pytest.raises(ValueError, match="Text cannot be empty"):
            service.embed_document("")


class TestAsyncMethods:
    """Test async embedding methods."""

    @pytest.mark.asyncio
    @patch('common.utils.embedding_cache.get_embedding_model')
    async def test_embed_query_async(self, mock_get_model, mock_embedding_model):
        """Test async query embedding."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        result = await service.embed_query_async("async query test")

        assert isinstance(result, list)
        assert len(result) == 1536
        mock_embedding_model.aget_query_embedding.assert_called_once_with(
            "async query test"
        )

    @pytest.mark.asyncio
    @patch('common.utils.embedding_cache.get_embedding_model')
    async def test_embed_document_async(self, mock_get_model, mock_embedding_model):
        """Test async document embedding."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        result = await service.embed_document_async("async document test")

        assert isinstance(result, list)
        assert len(result) == 1536
        mock_embedding_model.aget_text_embedding.assert_called_once_with(
            "async document test"
        )

    @pytest.mark.asyncio
    @patch('common.utils.embedding_cache.get_embedding_model')
    async def test_embed_query_async_empty_text(self, mock_get_model, mock_embedding_model):
        """Test async query with empty text raises ValueError."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        with pytest.raises(ValueError, match="Text cannot be empty"):
            await service.embed_query_async("")


class TestCalculateSimilarity:
    """Test similarity calculation."""

    def test_calculate_similarity_identical(self):
        """Test similarity of identical vectors."""
        service = EmbeddingService()

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]

        similarity = service.calculate_similarity(vec1, vec2)

        assert similarity == pytest.approx(1.0, abs=0.001)

    def test_calculate_similarity_opposite(self):
        """Test similarity of opposite vectors."""
        service = EmbeddingService()

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [-1.0, 0.0, 0.0]

        similarity = service.calculate_similarity(vec1, vec2)

        assert similarity == pytest.approx(-1.0, abs=0.001)

    def test_calculate_similarity_orthogonal(self):
        """Test similarity of perpendicular vectors."""
        service = EmbeddingService()

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [0.0, 1.0, 0.0]

        similarity = service.calculate_similarity(vec1, vec2)

        assert similarity == pytest.approx(0.0, abs=0.001)

    def test_calculate_similarity_partial(self):
        """Test similarity of partially similar vectors."""
        service = EmbeddingService()

        # 45 degree angle -> cos(45°) ≈ 0.707
        vec1 = [1.0, 0.0]
        vec2 = [1.0, 1.0]

        similarity = service.calculate_similarity(vec1, vec2)

        assert similarity == pytest.approx(0.707, abs=0.01)

    def test_calculate_similarity_different_dimensions(self):
        """Test that different dimensions raise ValueError."""
        service = EmbeddingService()

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0]

        with pytest.raises(ValueError, match="dimensions must match"):
            service.calculate_similarity(vec1, vec2)

    def test_calculate_similarity_empty_vectors(self):
        """Test that empty vectors raise ValueError."""
        service = EmbeddingService()

        with pytest.raises(ValueError, match="cannot be None or empty"):
            service.calculate_similarity([], [1.0])

        with pytest.raises(ValueError, match="cannot be None or empty"):
            service.calculate_similarity(None, [1.0])

    def test_calculate_similarity_zero_length(self):
        """Test that zero-length vectors return 0."""
        service = EmbeddingService()

        vec1 = [0.0, 0.0, 0.0]
        vec2 = [1.0, 1.0, 1.0]

        similarity = service.calculate_similarity(vec1, vec2)

        assert similarity == 0.0


class TestBatchEmbedDocuments:
    """Test batch document embedding."""

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_batch_embed_success(self, mock_get_model, mock_embedding_model):
        """Test successful batch embedding."""
        mock_get_model.return_value = mock_embedding_model
        # Return different embeddings for different calls
        mock_embedding_model.get_text_embedding.side_effect = [
            [0.1] * 1536,
            [0.2] * 1536,
            [0.3] * 1536
        ]

        service = get_embedding_service()

        texts = ["Doc 1", "Doc 2", "Doc 3"]
        embeddings = service.batch_embed_documents(texts)

        assert len(embeddings) == 3
        assert all(len(emb) == 1536 for emb in embeddings)
        assert embeddings[0][0] == pytest.approx(0.1)
        assert embeddings[1][0] == pytest.approx(0.2)
        assert embeddings[2][0] == pytest.approx(0.3)

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_batch_embed_empty_list(self, mock_get_model, mock_embedding_model):
        """Test batch embedding with empty list."""
        mock_get_model.return_value = mock_embedding_model
        service = get_embedding_service()

        embeddings = service.batch_embed_documents([])

        assert embeddings == []
        mock_embedding_model.get_text_embedding.assert_not_called()

    @patch('common.utils.embedding_cache.get_embedding_model')
    def test_batch_embed_with_error(self, mock_get_model, mock_embedding_model):
        """Test that errors stop batch processing."""
        mock_get_model.return_value = mock_embedding_model
        # First succeeds, second fails
        mock_embedding_model.get_text_embedding.side_effect = [
            [0.1] * 1536,
            RuntimeError("API error")
        ]

        service = get_embedding_service()

        texts = ["Doc 1", "Doc 2", "Doc 3"]

        with pytest.raises(RuntimeError, match="API error"):
            service.batch_embed_documents(texts)


class TestIntegrationWithRealModel:
    """
    Integration tests with real embedding model (requires API keys).

    These tests are skipped in CI but useful for local testing.
    """

    @pytest.mark.skip(reason="Requires real API keys - run locally only")
    def test_real_embedding_generation(self):
        """Test with real embedding model (manual test)."""
        # This test requires real API configuration
        # It's marked to skip in automated testing
        reset_embedding_service()

        service = get_embedding_service()

        # Generate embeddings
        query_emb = service.embed_query("What is the pricing?")
        doc_emb = service.embed_document("The Pro plan costs $99/month")

        # Basic assertions
        assert isinstance(query_emb, list)
        assert isinstance(doc_emb, list)
        assert len(query_emb) == 1536
        assert len(doc_emb) == 1536

        # Calculate similarity
        similarity = service.calculate_similarity(query_emb, doc_emb)
        assert -1.0 <= similarity <= 1.0
