"""
Tests for KnowledgeGraphEdge model.

Tests the polymorphic edge model that connects articles and chunks
in the knowledge graph.
"""
import pytest
from uuid import uuid4
from django.db import IntegrityError

from common.models.knowledge_chunk import KnowledgeChunk
from common.models.knowledge_graph_edge import KnowledgeGraphEdge


@pytest.fixture
def source_chunk(db, organization):
    """Create a source chunk for edges."""
    return KnowledgeChunk.objects.create(
        organization=organization,
        source_type=KnowledgeChunk.SourceType.ARTICLE,
        source_id=uuid4(),
        title="Source Chunk",
        content="This is the source content.",
        chunk_type=KnowledgeChunk.ChunkType.CONCEPT,
        content_hash="source_hash_123",
    )


@pytest.fixture
def target_chunk(db, organization):
    """Create a target chunk for edges."""
    return KnowledgeChunk.objects.create(
        organization=organization,
        source_type=KnowledgeChunk.SourceType.ARTICLE,
        source_id=uuid4(),
        title="Target Chunk",
        content="This is the target content.",
        chunk_type=KnowledgeChunk.ChunkType.PROCEDURE,
        content_hash="target_hash_456",
    )


class TestKnowledgeGraphEdgeModel:
    """Test KnowledgeGraphEdge model basics."""

    def test_create_article_to_article_edge(self, db, organization):
        """Test creating an edge between two articles."""
        source_article_id = uuid4()
        target_article_id = uuid4()

        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            source_article_id=source_article_id,
            target_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            target_article_id=target_article_id,
            relationship="prerequisite_for",
            inverse_relationship="requires",
            fact_statement="Article A is a prerequisite for Article B",
            created_by=KnowledgeGraphEdge.CreatedBy.LIBRARIAN,
            confidence=0.85,
        )

        assert edge.id is not None
        assert edge.source_type == KnowledgeGraphEdge.NodeType.ARTICLE
        assert edge.target_type == KnowledgeGraphEdge.NodeType.ARTICLE
        assert edge.source_article_id == source_article_id
        assert edge.target_article_id == target_article_id
        assert edge.status == KnowledgeGraphEdge.Status.PENDING  # Default

    def test_create_article_to_chunk_edge(self, db, organization, target_chunk):
        """Test creating an edge from article to chunk (contains)."""
        article_id = uuid4()

        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            source_article_id=article_id,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="contains",
            inverse_relationship="contained_in",
            fact_statement="Article contains this section",
            created_by=KnowledgeGraphEdge.CreatedBy.EXTRACTION,
            status=KnowledgeGraphEdge.Status.ACTIVE,
        )

        assert edge.source_type == KnowledgeGraphEdge.NodeType.ARTICLE
        assert edge.target_type == KnowledgeGraphEdge.NodeType.CHUNK
        assert edge.target_chunk == target_chunk
        assert edge.source_chunk is None

    def test_create_chunk_to_chunk_edge(self, db, organization, source_chunk, target_chunk):
        """Test creating an edge between two chunks."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="prerequisite_for",
            inverse_relationship="requires",
            fact_statement="Source chunk must be understood before target chunk",
            created_by=KnowledgeGraphEdge.CreatedBy.LIBRARIAN,
            confidence=0.75,
        )

        assert edge.source_type == KnowledgeGraphEdge.NodeType.CHUNK
        assert edge.target_type == KnowledgeGraphEdge.NodeType.CHUNK
        assert edge.source_chunk == source_chunk
        assert edge.target_chunk == target_chunk
        assert edge.source_article_id is None
        assert edge.target_article_id is None

    def test_edge_status_workflow(self, db, organization, source_chunk, target_chunk):
        """Test status transitions."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test edge",
            status=KnowledgeGraphEdge.Status.PENDING,
        )

        assert edge.status == KnowledgeGraphEdge.Status.PENDING

        # Approve the edge
        edge.status = KnowledgeGraphEdge.Status.ACTIVE
        edge.save()
        edge.refresh_from_db()
        assert edge.status == KnowledgeGraphEdge.Status.ACTIVE

        # Reject it
        edge.status = KnowledgeGraphEdge.Status.REJECTED
        edge.save()
        edge.refresh_from_db()
        assert edge.status == KnowledgeGraphEdge.Status.REJECTED

    def test_created_by_types(self, db, organization, source_chunk, target_chunk):
        """Test different created_by types."""
        created_by_types = [
            KnowledgeGraphEdge.CreatedBy.EXTRACTION,
            KnowledgeGraphEdge.CreatedBy.LIBRARIAN,
            KnowledgeGraphEdge.CreatedBy.HUMAN,
            KnowledgeGraphEdge.CreatedBy.IMPORT,
        ]

        for i, created_by in enumerate(created_by_types):
            edge = KnowledgeGraphEdge.objects.create(
                organization=organization,
                source_type=KnowledgeGraphEdge.NodeType.CHUNK,
                source_chunk=source_chunk,
                target_type=KnowledgeGraphEdge.NodeType.CHUNK,
                target_chunk=target_chunk,
                relationship=f"test_{i}",
                fact_statement=f"Created by {created_by}",
                created_by=created_by,
            )
            assert edge.created_by == created_by

    def test_str_representation(self, db, organization, source_chunk, target_chunk):
        """Test __str__ method."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test",
        )

        str_repr = str(edge)
        assert "explains" in str_repr
        assert "--[" in str_repr
        assert "]-->" in str_repr


class TestKnowledgeGraphEdgeProperties:
    """Test computed properties on edges."""

    def test_source_property_article(self, db, organization):
        """Test source property returns article UUID."""
        article_id = uuid4()

        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            source_article_id=article_id,
            target_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            target_article_id=uuid4(),
            relationship="related_to",
            fact_statement="Test",
        )

        assert edge.source == article_id

    def test_source_property_chunk(self, db, organization, source_chunk, target_chunk):
        """Test source property returns chunk instance."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test",
        )

        assert edge.source == source_chunk

    def test_target_property_article(self, db, organization):
        """Test target property returns article UUID."""
        target_id = uuid4()

        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            source_article_id=uuid4(),
            target_type=KnowledgeGraphEdge.NodeType.ARTICLE,
            target_article_id=target_id,
            relationship="related_to",
            fact_statement="Test",
        )

        assert edge.target == target_id

    def test_target_property_chunk(self, db, organization, source_chunk, target_chunk):
        """Test target property returns chunk instance."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test",
        )

        assert edge.target == target_chunk


class TestKnowledgeGraphEdgeQueries:
    """Test query patterns for edges."""

    def test_find_outgoing_edges(self, db, organization, source_chunk, target_chunk):
        """Test finding edges from a source chunk."""
        # Create chunk with source_chunk as related_name 'outgoing_edges'
        other_target = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=uuid4(),
            title="Other Target",
            content="Other content",
            content_hash="other_hash",
        )

        # Create edges from source
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Edge 1",
        )
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=other_target,
            relationship="related_to",
            fact_statement="Edge 2",
        )

        # Should find 2 outgoing edges
        outgoing = source_chunk.outgoing_edges.all()
        assert outgoing.count() == 2

    def test_find_incoming_edges(self, db, organization, source_chunk, target_chunk):
        """Test finding edges to a target chunk."""
        # Create another source
        other_source = KnowledgeChunk.objects.create(
            organization=organization,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=uuid4(),
            title="Other Source",
            content="Source content",
            content_hash="other_source_hash",
        )

        # Create edges pointing to target
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="prerequisite_for",
            fact_statement="Edge 1",
        )
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=other_source,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Edge 2",
        )

        # Should find 2 incoming edges
        incoming = target_chunk.incoming_edges.all()
        assert incoming.count() == 2

    def test_filter_by_relationship_type(self, db, organization, source_chunk, target_chunk):
        """Test filtering edges by relationship type."""
        # Create edges with different relationships
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="prerequisite_for",
            fact_statement="Prereq",
        )
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="related_to",
            fact_statement="Related",
        )

        prereqs = KnowledgeGraphEdge.objects.filter(relationship="prerequisite_for")
        assert prereqs.count() == 1

        related = KnowledgeGraphEdge.objects.filter(relationship="related_to")
        assert related.count() == 1

    def test_filter_by_status(self, db, organization, source_chunk, target_chunk):
        """Test filtering by edge status."""
        # Pending edge
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Pending",
            status=KnowledgeGraphEdge.Status.PENDING,
        )

        # Active edge
        KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="related_to",
            fact_statement="Active",
            status=KnowledgeGraphEdge.Status.ACTIVE,
        )

        pending = KnowledgeGraphEdge.objects.filter(
            status=KnowledgeGraphEdge.Status.PENDING
        )
        assert pending.count() == 1

        active = KnowledgeGraphEdge.objects.filter(
            status=KnowledgeGraphEdge.Status.ACTIVE
        )
        assert active.count() == 1


class TestKnowledgeGraphEdgeCascadeDelete:
    """Test cascade delete behavior."""

    def test_delete_chunk_deletes_edges(self, db, organization, source_chunk, target_chunk):
        """Test that deleting a chunk deletes its edges."""
        # Create an edge
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test",
        )
        edge_id = edge.id

        # Delete source chunk
        source_chunk.delete()

        # Edge should be deleted too
        assert not KnowledgeGraphEdge.objects.filter(id=edge_id).exists()

    def test_delete_target_chunk_deletes_edges(self, db, organization, source_chunk, target_chunk):
        """Test that deleting target chunk deletes edges."""
        edge = KnowledgeGraphEdge.objects.create(
            organization=organization,
            source_type=KnowledgeGraphEdge.NodeType.CHUNK,
            source_chunk=source_chunk,
            target_type=KnowledgeGraphEdge.NodeType.CHUNK,
            target_chunk=target_chunk,
            relationship="explains",
            fact_statement="Test",
        )
        edge_id = edge.id

        # Delete target chunk
        target_chunk.delete()

        # Edge should be deleted too
        assert not KnowledgeGraphEdge.objects.filter(id=edge_id).exists()

