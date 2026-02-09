"""
Tests for KnowledgeChunk model.

Tests the unified semantic content model that replaces VectorEmbedding
and provides structured knowledge for the knowledge graph.
"""
import pytest
from uuid import uuid4
from django.db import IntegrityError

from common.models.knowledge_chunk import KnowledgeChunk


@pytest.fixture
def sample_chunk(db, organization):
    """Create a sample KnowledgeChunk."""
    return KnowledgeChunk.objects.create(
        organization=organization,
        source_type=KnowledgeChunk.SourceType.ARTICLE,
        source_id=uuid4(),
        source_heading="Getting Started",
        source_heading_hierarchy=["Introduction", "Getting Started"],
        title="Getting Started",
        content="This is how you get started with the product.",
        chunk_type=KnowledgeChunk.ChunkType.OVERVIEW,
        topics=["getting-started", "introduction"],
        content_hash="abc123def456",
        is_stale=False,
    )


class TestKnowledgeChunkModel:
    """Test KnowledgeChunk model basics."""

    def test_create_chunk(self, db, organization):
        """Test creating a basic knowledge chunk."""
        chunk = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=uuid4(),
            title="Test Chunk",
            content="Test content",
            content_hash="hash123",
        )

        assert chunk.id is not None
        assert chunk.source_type == KnowledgeChunk.SourceType.ARTICLE
        assert chunk.chunk_type == KnowledgeChunk.ChunkType.CONCEPT  # Default
        assert chunk.is_stale is False
        assert chunk.embedding is None

    def test_chunk_types(self, db, organization):
        """Test different chunk types are stored correctly."""
        source_id = uuid4()

        chunk_types = [
            KnowledgeChunk.ChunkType.PROCEDURE,
            KnowledgeChunk.ChunkType.CONCEPT,
            KnowledgeChunk.ChunkType.PREREQUISITE,
            KnowledgeChunk.ChunkType.WARNING,
            KnowledgeChunk.ChunkType.FAQ,
            KnowledgeChunk.ChunkType.REFERENCE,
            KnowledgeChunk.ChunkType.OVERVIEW,
            KnowledgeChunk.ChunkType.EXAMPLE,
        ]

        for i, chunk_type in enumerate(chunk_types):
            chunk = KnowledgeChunk.objects.create(
                organization=organization,
                source_type=KnowledgeChunk.SourceType.ARTICLE,
                source_id=source_id,
                title=f"Test {chunk_type}",
                content=f"Content for {chunk_type}",
                chunk_type=chunk_type,
                content_hash=f"hash_{i}",
            )
            assert chunk.chunk_type == chunk_type

    def test_source_types(self, db, organization):
        """Test different source types."""
        source_types = [
            KnowledgeChunk.SourceType.ARTICLE,
            KnowledgeChunk.SourceType.TUTORIAL,
            KnowledgeChunk.SourceType.INTERNAL_PAGE,
            KnowledgeChunk.SourceType.INTERNAL_KMS,
            KnowledgeChunk.SourceType.INTERNAL_TICKET,
        ]

        for i, source_type in enumerate(source_types):
            chunk = KnowledgeChunk.objects.create(
                organization=organization,
                source_type=source_type,
                source_id=uuid4(),
                title=f"Test {source_type}",
                content=f"Content from {source_type}",
                content_hash=f"source_hash_{i}",
            )
            assert chunk.source_type == source_type

    def test_topics_array(self, db, organization):
        """Test that topics array field works correctly."""
        topics = ["api", "authentication", "oauth", "security"]

        chunk = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=uuid4(),
            title="Auth Guide",
            content="How to authenticate",
            topics=topics,
            content_hash="topics_hash",
        )

        # Refresh from DB
        chunk.refresh_from_db()
        assert chunk.topics == topics
        assert "api" in chunk.topics
        assert "oauth" in chunk.topics

    def test_heading_hierarchy_array(self, db, organization):
        """Test heading hierarchy array."""
        hierarchy = ["Getting Started", "Installation", "Docker Setup"]

        chunk = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=uuid4(),
            source_heading="Docker Setup",
            source_heading_hierarchy=hierarchy,
            title="Docker Setup",
            content="Docker installation steps",
            content_hash="hierarchy_hash",
        )

        chunk.refresh_from_db()
        assert chunk.source_heading_hierarchy == hierarchy
        assert chunk.source_heading_hierarchy[0] == "Getting Started"
        assert chunk.source_heading_hierarchy[-1] == "Docker Setup"

    def test_str_representation(self, sample_chunk):
        """Test __str__ method."""
        assert str(sample_chunk) == "Getting Started (overview)"

    def test_mark_stale(self, sample_chunk):
        """Test mark_stale method."""
        assert sample_chunk.is_stale is False
        sample_chunk.mark_stale()
        assert sample_chunk.is_stale is True

    def test_needs_embedding(self, sample_chunk):
        """Test needs_embedding method."""
        # No embedding yet
        assert sample_chunk.embedding is None
        assert sample_chunk.needs_embedding() is True

        # Add fake embedding
        sample_chunk.embedding = [0.1] * 1536
        assert sample_chunk.needs_embedding() is False

        # Mark stale - should need embedding again
        sample_chunk.is_stale = True
        assert sample_chunk.needs_embedding() is True


class TestKnowledgeChunkQueries:
    """Test KnowledgeChunk query patterns."""

    def test_filter_by_organization(self, db, organization, other_organization):
        """Test that chunks are properly scoped by organization."""
        source_id = uuid4()

        # Create chunk in main org
        chunk1 = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Org 1 Chunk",
            content="Content",
            content_hash="hash1",
        )

        # Create chunk in other org
        chunk2 = KnowledgeChunk.objects.create(
            organization=other_organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Org 2 Chunk",
            content="Content",
            content_hash="hash2",
        )

        # Query should only return chunks from specified org
        org1_chunks = KnowledgeChunk.objects.filter(organization=organization)
        assert org1_chunks.count() == 1
        assert org1_chunks.first().title == "Org 1 Chunk"

        org2_chunks = KnowledgeChunk.objects.filter(organization=other_organization)
        assert org2_chunks.count() == 1
        assert org2_chunks.first().title == "Org 2 Chunk"

    def test_filter_by_source(self, db, organization):
        """Test filtering chunks by source article."""
        article_id = uuid4()
        other_id = uuid4()

        # Create chunks for same article
        for i in range(3):
            KnowledgeChunk.objects.create(
                organization=organization,
                source_type=KnowledgeChunk.SourceType.ARTICLE,
                source_id=article_id,
                title=f"Section {i}",
                content=f"Content {i}",
                content_hash=f"article_hash_{i}",
            )

        # Create chunks for different article
        KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=other_id,
            title="Other Article",
            content="Other content",
            content_hash="other_hash",
        )

        # Query chunks for specific article
        article_chunks = KnowledgeChunk.objects.filter(
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=article_id,
        )
        assert article_chunks.count() == 3

    def test_filter_by_chunk_type(self, db, organization):
        """Test filtering by chunk type."""
        source_id = uuid4()

        # Create procedure chunks
        for i in range(2):
            KnowledgeChunk.objects.create(
                organization=organization,
                source_type=KnowledgeChunk.SourceType.ARTICLE,
                source_id=source_id,
                title=f"Step {i}",
                content=f"Do this step {i}",
                chunk_type=KnowledgeChunk.ChunkType.PROCEDURE,
                content_hash=f"procedure_{i}",
            )

        # Create concept chunk
        KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="What is X",
            content="X is a concept",
            chunk_type=KnowledgeChunk.ChunkType.CONCEPT,
            content_hash="concept_hash",
        )

        # Filter procedures
        procedures = KnowledgeChunk.objects.filter(
            chunk_type=KnowledgeChunk.ChunkType.PROCEDURE
        )
        assert procedures.count() == 2

        # Filter concepts
        concepts = KnowledgeChunk.objects.filter(
            chunk_type=KnowledgeChunk.ChunkType.CONCEPT
        )
        assert concepts.count() == 1

    def test_filter_stale_chunks(self, db, organization):
        """Test filtering stale vs fresh chunks."""
        source_id = uuid4()

        # Fresh chunk
        KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Fresh",
            content="Fresh content",
            content_hash="fresh_hash",
            is_stale=False,
        )

        # Stale chunk
        KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Stale",
            content="Stale content",
            content_hash="stale_hash",
            is_stale=True,
        )

        fresh_chunks = KnowledgeChunk.objects.filter(is_stale=False)
        assert fresh_chunks.count() == 1
        assert fresh_chunks.first().title == "Fresh"

        stale_chunks = KnowledgeChunk.objects.filter(is_stale=True)
        assert stale_chunks.count() == 1
        assert stale_chunks.first().title == "Stale"


class TestKnowledgeChunkConstraints:
    """Test model constraints."""

    def test_unique_constraint(self, db, organization):
        """Test unique constraint on org + source + hash."""
        source_id = uuid4()

        # Create first chunk
        KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="First",
            content="Content",
            content_hash="same_hash",
        )

        # Attempt to create duplicate should fail
        with pytest.raises(IntegrityError):
            KnowledgeChunk.objects.create(
                organization=organization,
                source_type=KnowledgeChunk.SourceType.ARTICLE,
                source_id=source_id,
                title="Second",
                content="Different content",
                content_hash="same_hash",  # Same hash!
            )

    def test_different_hash_same_source_allowed(self, db, organization):
        """Test that same source can have chunks with different hashes."""
        source_id = uuid4()

        chunk1 = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Section 1",
            content="Content 1",
            content_hash="hash_1",
        )

        chunk2 = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=source_id,
            title="Section 2",
            content="Content 2",
            content_hash="hash_2",
        )

        assert chunk1.id != chunk2.id
        assert KnowledgeChunk.objects.filter(source_id=source_id).count() == 2

