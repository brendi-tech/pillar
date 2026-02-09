"""
Tests for ChunkExtractionService.

Tests the service that parses TipTap JSON documents and extracts
semantic chunks for the knowledge graph.
"""
import pytest
from uuid import uuid4

from common.models.knowledge_chunk import KnowledgeChunk
from common.models.knowledge_graph_edge import KnowledgeGraphEdge
from common.services.chunk_extraction_service import (
    ChunkExtractionService,
    get_chunk_extraction_service,
    ExtractedSection,
)


@pytest.fixture
def extraction_service(organization):
    """Create a ChunkExtractionService instance."""
    return get_chunk_extraction_service(organization.id)


@pytest.fixture
def simple_tiptap_doc():
    """A simple TipTap document with H2 sections."""
    return {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 1},
                "content": [{"type": "text", "text": "Getting Started"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Welcome to the guide."}]
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "Installation"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Here's how to install:"}]
            },
            {
                "type": "orderedList",
                "content": [
                    {
                        "type": "listItem",
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "Download the package"}]}
                        ]
                    },
                    {
                        "type": "listItem",
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "Run the installer"}]}
                        ]
                    }
                ]
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "Configuration"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "After installation, configure:"}]
            },
        ]
    }


@pytest.fixture
def complex_tiptap_doc():
    """A more complex TipTap document with various chunk types."""
    return {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "Prerequisites"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Before you begin, ensure you have:"}]
            },
            {
                "type": "bulletList",
                "content": [
                    {"type": "listItem", "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": "Node.js 18+"}]}
                    ]},
                    {"type": "listItem", "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": "Python 3.10+"}]}
                    ]},
                ]
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "How to Install"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Follow these steps to install:"}]
            },
            {
                "type": "orderedList",
                "content": [
                    {"type": "listItem", "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": "Clone the repo"}]}
                    ]},
                    {"type": "listItem", "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": "Install dependencies"}]}
                    ]},
                ]
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "Warning: Security"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Important: Never share your API keys."}]
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "FAQ"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Q: How long does installation take?"}]
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "A: About 5 minutes."}]
            },
        ]
    }


class TestExtractedSection:
    """Test ExtractedSection dataclass."""

    def test_content_hash_auto_generated(self):
        """Test that content_hash is auto-generated from content."""
        section = ExtractedSection(
            heading="Test",
            heading_level=2,
            heading_hierarchy=["Test"],
            content="This is test content.",
            nodes=[],
        )

        assert section.content_hash is not None
        assert len(section.content_hash) == 32  # MD5 hex digest

    def test_same_content_same_hash(self):
        """Test that identical content produces same hash."""
        content = "Identical content for both sections."

        section1 = ExtractedSection(
            heading="Section 1",
            heading_level=2,
            heading_hierarchy=["Section 1"],
            content=content,
            nodes=[],
        )

        section2 = ExtractedSection(
            heading="Section 2",  # Different heading
            heading_level=2,
            heading_hierarchy=["Section 2"],
            content=content,  # Same content
            nodes=[],
        )

        assert section1.content_hash == section2.content_hash

    def test_different_content_different_hash(self):
        """Test that different content produces different hash."""
        section1 = ExtractedSection(
            heading="Test",
            heading_level=2,
            heading_hierarchy=["Test"],
            content="Content version 1.",
            nodes=[],
        )

        section2 = ExtractedSection(
            heading="Test",
            heading_level=2,
            heading_hierarchy=["Test"],
            content="Content version 2.",
            nodes=[],
        )

        assert section1.content_hash != section2.content_hash


class TestSectionExtraction:
    """Test section extraction from TipTap JSON."""

    def test_extract_sections_simple(self, extraction_service, simple_tiptap_doc):
        """Test extracting sections from simple document."""
        sections = extraction_service._extract_sections_from_tiptap(
            simple_tiptap_doc, "Getting Started Guide"
        )

        assert len(sections) == 3  # Intro + 2 H2 sections

        # Check first section (content before first H2)
        assert sections[0].heading == "Getting Started Guide"
        assert "Welcome to the guide" in sections[0].content

        # Check Installation section
        assert sections[1].heading == "Installation"
        assert "how to install" in sections[1].content.lower()

        # Check Configuration section
        assert sections[2].heading == "Configuration"
        assert "configure" in sections[2].content.lower()

    def test_extract_sections_complex(self, extraction_service, complex_tiptap_doc):
        """Test extracting sections from complex document."""
        sections = extraction_service._extract_sections_from_tiptap(
            complex_tiptap_doc, "Complex Guide"
        )

        # Should have 4 sections (Prerequisites, How to Install, Warning, FAQ)
        assert len(sections) == 4

        headings = [s.heading for s in sections]
        assert "Prerequisites" in headings
        assert "How to Install" in headings
        assert "Warning: Security" in headings
        assert "FAQ" in headings

    def test_extract_sections_preserves_hierarchy(self, extraction_service, simple_tiptap_doc):
        """Test that heading hierarchy is preserved."""
        sections = extraction_service._extract_sections_from_tiptap(
            simple_tiptap_doc, "Main Title"
        )

        # Installation should have hierarchy [Main Title, Installation]
        installation_section = next(s for s in sections if s.heading == "Installation")
        assert "Main Title" in installation_section.heading_hierarchy
        assert "Installation" in installation_section.heading_hierarchy

    def test_empty_document(self, extraction_service):
        """Test handling of empty document."""
        empty_doc = {"type": "doc", "content": []}
        sections = extraction_service._extract_sections_from_tiptap(empty_doc, "Empty")

        assert sections == []

    def test_invalid_document(self, extraction_service):
        """Test handling of invalid document."""
        invalid_doc = {"type": "not_a_doc", "content": []}
        sections = extraction_service._extract_sections_from_tiptap(invalid_doc, "Invalid")

        assert sections == []

    def test_none_document(self, extraction_service):
        """Test handling of None document."""
        sections = extraction_service._extract_sections_from_tiptap(None, "None")
        assert sections == []


class TestChunkTypeClassification:
    """Test chunk type classification heuristics."""

    def test_classify_procedure(self, extraction_service):
        """Test classification of procedure chunks."""
        # Heading contains 'how to'
        section = ExtractedSection(
            heading="How to Install Docker",
            heading_level=2,
            heading_hierarchy=["How to Install Docker"],
            content="Follow these steps...",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.PROCEDURE

        # Content has numbered list
        section2 = ExtractedSection(
            heading="Installation",
            heading_level=2,
            heading_hierarchy=["Installation"],
            content="Steps:\n1. Download\n2. Install\n3. Configure",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section2) == KnowledgeChunk.ChunkType.PROCEDURE

    def test_classify_warning(self, extraction_service):
        """Test classification of warning chunks."""
        section = ExtractedSection(
            heading="Warning: Security Considerations",
            heading_level=2,
            heading_hierarchy=["Warning: Security Considerations"],
            content="Be careful with...",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.WARNING

    def test_classify_faq(self, extraction_service):
        """Test classification of FAQ chunks."""
        section = ExtractedSection(
            heading="Frequently Asked Questions",
            heading_level=2,
            heading_hierarchy=["FAQ"],
            content="Q: What is this? A: A product.",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.FAQ

    def test_classify_prerequisite(self, extraction_service):
        """Test classification of prerequisite chunks."""
        section = ExtractedSection(
            heading="Prerequisites",
            heading_level=2,
            heading_hierarchy=["Prerequisites"],
            content="You need Python 3.10+",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.PREREQUISITE

    def test_classify_overview(self, extraction_service):
        """Test classification of overview chunks."""
        section = ExtractedSection(
            heading="Overview",
            heading_level=2,
            heading_hierarchy=["Overview"],
            content="This guide covers...",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.OVERVIEW

    def test_classify_reference(self, extraction_service):
        """Test classification of reference chunks (tables)."""
        section = ExtractedSection(
            heading="API Reference",
            heading_level=2,
            heading_hierarchy=["API Reference"],
            content="| Method | Path | Description |\n| GET | /api | Get data |",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.REFERENCE

    def test_classify_default_concept(self, extraction_service):
        """Test that unmatched sections default to concept."""
        section = ExtractedSection(
            heading="Some Generic Section",
            heading_level=2,
            heading_hierarchy=["Some Generic Section"],
            content="Just some content about things.",
            nodes=[],
        )
        assert extraction_service._classify_chunk_type(section) == KnowledgeChunk.ChunkType.CONCEPT


class TestTopicExtraction:
    """Test topic extraction from sections."""

    def test_extract_topics_from_heading(self, extraction_service):
        """Test topic extraction from heading words."""
        section = ExtractedSection(
            heading="Docker Installation Guide",
            heading_level=2,
            heading_hierarchy=["Docker Installation Guide"],
            content="How to install Docker.",
            nodes=[],
        )

        topics = extraction_service._extract_topics(section)

        assert "docker" in topics
        assert "installation" in topics
        assert "guide" in topics

    def test_stopwords_removed(self, extraction_service):
        """Test that stopwords are removed from topics."""
        section = ExtractedSection(
            heading="How to Install the Application",
            heading_level=2,
            heading_hierarchy=["How to Install the Application"],
            content="Instructions here.",
            nodes=[],
        )

        topics = extraction_service._extract_topics(section)

        # 'how', 'to', 'the' should be removed
        assert "how" not in topics
        assert "the" not in topics
        assert "install" in topics
        assert "application" in topics

    def test_topics_limited_to_five(self, extraction_service):
        """Test that at most 5 topics are returned."""
        section = ExtractedSection(
            heading="Very Long Heading With Many Different Words Inside",
            heading_level=2,
            heading_hierarchy=["Very Long Heading"],
            content="Content.",
            nodes=[],
        )

        topics = extraction_service._extract_topics(section)

        assert len(topics) <= 5

