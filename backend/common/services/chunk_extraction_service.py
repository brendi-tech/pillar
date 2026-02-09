"""
ChunkExtractionService - Extract semantic chunks from content.

Parses markdown documents to identify meaningful sections and creates
KnowledgeChunk records for RAG indexing and knowledge graph participation.
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone

from common.models.knowledge_chunk import KnowledgeChunk
from common.models.knowledge_graph_edge import KnowledgeGraphEdge
from common.services.tiptap_to_markdown import TipTapToMarkdownConverter

logger = logging.getLogger(__name__)


@dataclass
class ExtractedSection:
    """A section extracted from a document."""
    heading: str
    heading_level: int
    heading_hierarchy: list[str]
    content: str  # Markdown content
    nodes: list[dict] = field(default_factory=list)  # Original TipTap nodes (legacy)
    content_hash: str = ""

    def __post_init__(self):
        if not self.content_hash:
            self.content_hash = hashlib.md5(self.content.encode()).hexdigest()


@dataclass
class ExtractResult:
    """Result of chunk extraction."""
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    stale: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def total_processed(self) -> int:
        return self.created + self.updated + self.unchanged


class ChunkExtractionService:
    """
    Service for extracting semantic chunks from content.

    Parses markdown documents to:
    1. Identify section boundaries (H2/H3 headings)
    2. Extract markdown content for each section
    3. Create/update KnowledgeChunk records
    4. Create 'contains' edges from article to chunks
    5. Mark orphaned chunks as stale
    """

    def __init__(self, organization_id: UUID):
        """
        Initialize the service.

        Args:
            organization_id: UUID of the organization
        """
        self.organization_id = organization_id
        self._converter = TipTapToMarkdownConverter()

    async def extract_chunks_from_article(
        self,
        article_id: UUID,
        body_markdown: str,
        article_title: str = "",
        force_refresh: bool = False,
    ) -> ExtractResult:
        """
        Extract knowledge chunks from article content.

        Uses hash-based detection to only process changed sections.

        Args:
            article_id: UUID of the source article
            body_markdown: Markdown content (primary)
            article_title: Title of the article (used as H1 in hierarchy)
            force_refresh: If True, re-extract all chunks regardless of hash

        Returns:
            ExtractResult with counts of created, updated, unchanged, stale chunks
        """
        result = ExtractResult()

        # Extract sections from markdown
        sections = self._extract_sections_from_markdown(body_markdown, article_title)

        if not sections:
            logger.warning(f"No sections extracted from article {article_id}")
            return result

        logger.info(f"Extracted {len(sections)} sections from article {article_id}")

        # Get existing chunks for this article
        existing_chunks = {
            chunk.content_hash: chunk
            async for chunk in KnowledgeChunk.objects.filter(
                organization_id=self.organization_id,
                source_type=KnowledgeChunk.SourceType.ARTICLE,
                source_id=article_id,
            )
        }

        processed_hashes = set()

        for section in sections:
            processed_hashes.add(section.content_hash)

            if section.content_hash in existing_chunks and not force_refresh:
                # Content unchanged - keep existing chunk
                chunk = existing_chunks[section.content_hash]
                if chunk.is_stale:
                    # Was marked stale but content is back - unmark it
                    chunk.is_stale = False
                    await chunk.asave(update_fields=['is_stale', 'updated_at'])
                    result.updated += 1
                else:
                    result.unchanged += 1
            else:
                # New or changed content - create/update chunk
                try:
                    await self._create_or_update_chunk(
                        article_id=article_id,
                        section=section,
                    )
                    if section.content_hash in existing_chunks:
                        result.updated += 1
                    else:
                        result.created += 1
                except Exception as e:
                    logger.error(f"Failed to create chunk for section '{section.heading}': {e}")
                    result.errors.append(f"Section '{section.heading}': {str(e)}")

        # Mark orphaned chunks as stale
        for content_hash, chunk in existing_chunks.items():
            if content_hash not in processed_hashes:
                chunk.is_stale = True
                await chunk.asave(update_fields=['is_stale', 'updated_at'])
                result.stale += 1
                logger.info(f"Marked chunk {chunk.id} as stale (content_hash: {content_hash})")

        logger.info(
            f"Chunk extraction complete for article {article_id}: "
            f"{result.created} created, {result.updated} updated, "
            f"{result.unchanged} unchanged, {result.stale} stale"
        )

        return result

    def _extract_sections_from_tiptap(
        self,
        doc: dict,
        article_title: str = "",
    ) -> list[ExtractedSection]:
        """
        Extract sections from TipTap JSON by heading boundaries.

        Each H2 heading starts a new section. H3 headings are included
        within their parent H2 section.

        Args:
            doc: TipTap JSON document
            article_title: Article title (used as H1)

        Returns:
            List of ExtractedSection objects
        """
        if not doc or doc.get("type") != "doc":
            return []

        content = doc.get("content", [])
        if not content:
            return []

        sections: list[ExtractedSection] = []
        current_section_nodes: list[dict] = []
        current_heading = article_title or "Introduction"
        current_heading_level = 1
        current_hierarchy = [article_title] if article_title else []

        # Track if we've seen any H2 yet
        seen_h2 = False

        for node in content:
            node_type = node.get("type")

            if node_type == "heading":
                level = node.get("attrs", {}).get("level", 1)
                heading_text = self._extract_heading_text(node)

                if level == 2:
                    # H2 starts a new section - save current section first
                    if current_section_nodes:
                        section_md = self._nodes_to_markdown(current_section_nodes)
                        if section_md.strip():
                            sections.append(ExtractedSection(
                                heading=current_heading,
                                heading_level=current_heading_level,
                                heading_hierarchy=list(current_hierarchy),
                                content=section_md,
                                nodes=list(current_section_nodes),
                            ))

                    # Start new section
                    current_section_nodes = [node]
                    current_heading = heading_text
                    current_heading_level = 2
                    current_hierarchy = [article_title, heading_text] if article_title else [heading_text]
                    seen_h2 = True

                elif level == 3 and seen_h2:
                    # H3 within an H2 section - update hierarchy but keep in same section
                    current_section_nodes.append(node)
                    if len(current_hierarchy) > 2:
                        current_hierarchy = current_hierarchy[:2] + [heading_text]
                    else:
                        current_hierarchy.append(heading_text)
                else:
                    # H1 or H3 before any H2 - include in current section
                    current_section_nodes.append(node)
            else:
                # Non-heading content - add to current section
                current_section_nodes.append(node)

        # Don't forget the last section
        if current_section_nodes:
            section_md = self._nodes_to_markdown(current_section_nodes)
            if section_md.strip():
                sections.append(ExtractedSection(
                    heading=current_heading,
                    heading_level=current_heading_level,
                    heading_hierarchy=list(current_hierarchy),
                    content=section_md,
                    nodes=list(current_section_nodes),
                ))

        return sections

    def _extract_sections_from_markdown(
        self,
        markdown_content: str,
        article_title: str = "",
    ) -> list[ExtractedSection]:
        """
        Extract sections from markdown by heading boundaries.

        Each H2 heading starts a new section. H3 headings are included
        within their parent H2 section.

        Args:
            markdown_content: Raw markdown content
            article_title: Article title (used as H1)

        Returns:
            List of ExtractedSection objects
        """
        if not markdown_content or not markdown_content.strip():
            return []

        sections: list[ExtractedSection] = []
        lines = markdown_content.split('\n')

        current_section_lines: list[str] = []
        current_heading = article_title or "Introduction"
        current_heading_level = 1
        current_hierarchy = [article_title] if article_title else []

        # Regex to match markdown headings (## or ###)
        heading_pattern = re.compile(r'^(#{2,3})\s+(.+)$')
        seen_h2 = False

        for line in lines:
            match = heading_pattern.match(line)
            if match:
                level = len(match.group(1))
                heading_text = match.group(2).strip()

                if level == 2:
                    # H2 starts a new section - save current section first
                    if current_section_lines:
                        section_content = '\n'.join(current_section_lines).strip()
                        if section_content:
                            sections.append(ExtractedSection(
                                heading=current_heading,
                                heading_level=current_heading_level,
                                heading_hierarchy=list(current_hierarchy),
                                content=section_content,
                            ))

                    # Start new section
                    current_section_lines = [line]
                    current_heading = heading_text
                    current_heading_level = 2
                    current_hierarchy = [article_title, heading_text] if article_title else [heading_text]
                    seen_h2 = True

                elif level == 3 and seen_h2:
                    # H3 within an H2 section - update hierarchy but keep in same section
                    current_section_lines.append(line)
                    if len(current_hierarchy) > 2:
                        current_hierarchy = current_hierarchy[:2] + [heading_text]
                    else:
                        current_hierarchy.append(heading_text)
                else:
                    # Other headings - include in current section
                    current_section_lines.append(line)
            else:
                # Non-heading content - add to current section
                current_section_lines.append(line)

        # Don't forget the last section
        if current_section_lines:
            section_content = '\n'.join(current_section_lines).strip()
            if section_content:
                sections.append(ExtractedSection(
                    heading=current_heading,
                    heading_level=current_heading_level,
                    heading_hierarchy=list(current_hierarchy),
                    content=section_content,
                ))

        return sections

    def _extract_heading_text(self, node: dict) -> str:
        """Extract text from a heading node."""
        content = node.get("content", [])
        parts = []
        for child in content:
            if child.get("type") == "text":
                parts.append(child.get("text", ""))
        return "".join(parts)

    def _nodes_to_markdown(self, nodes: list[dict]) -> str:
        """Convert a list of TipTap nodes to markdown."""
        # Create a pseudo-document for the converter
        pseudo_doc = {"type": "doc", "content": nodes}
        return self._converter.convert(pseudo_doc)

    async def _create_or_update_chunk(
        self,
        article_id: UUID,
        section: ExtractedSection,
    ) -> KnowledgeChunk:
        """
        Create or update a KnowledgeChunk for a section.

        Args:
            article_id: UUID of the source article
            section: Extracted section data

        Returns:
            The created/updated KnowledgeChunk
        """
        # Determine chunk type based on content heuristics
        chunk_type = self._classify_chunk_type(section)

        # Extract topics (simple keyword extraction for now)
        topics = self._extract_topics(section)

        # Try to find existing chunk by heading (for updates when hash changes)
        existing = await KnowledgeChunk.objects.filter(
            organization_id=self.organization_id,
            source_type=KnowledgeChunk.SourceType.ARTICLE,
            source_id=article_id,
            source_heading=section.heading,
        ).afirst()

        if existing:
            # Update existing chunk
            existing.content = section.content
            existing.content_hash = section.content_hash
            existing.source_heading_hierarchy = section.heading_hierarchy
            existing.chunk_type = chunk_type
            existing.topics = topics
            existing.is_stale = False
            existing.embedding = None  # Clear embedding to force regeneration
            existing.last_indexed_at = None
            await existing.asave()
            logger.debug(f"Updated chunk {existing.id} for section '{section.heading}'")
            return existing
        else:
            # Create new chunk
            try:
                chunk = await KnowledgeChunk.objects.acreate(
                    organization_id=self.organization_id,
                    source_type=KnowledgeChunk.SourceType.ARTICLE,
                    source_id=article_id,
                    source_heading=section.heading,
                    source_heading_hierarchy=section.heading_hierarchy,
                    title=section.heading,
                    content=section.content,
                    chunk_type=chunk_type,
                    topics=topics,
                    content_hash=section.content_hash,
                    is_stale=False,
                )
            except IntegrityError:
                # Race condition - concurrent workflow already created this chunk
                # Fetch the existing chunk instead of failing
                chunk = await KnowledgeChunk.objects.filter(
                    organization_id=self.organization_id,
                    source_type=KnowledgeChunk.SourceType.ARTICLE,
                    source_id=article_id,
                    content_hash=section.content_hash,
                ).afirst()
                if chunk:
                    logger.info(
                        f"Chunk already exists for section '{section.heading}', using existing"
                    )
                    return chunk
                # If we still can't find it, re-raise the error
                raise

            # Create 'contains' edge from article to chunk
            await KnowledgeGraphEdge.objects.acreate(
                organization_id=self.organization_id,
                source_type=KnowledgeGraphEdge.NodeType.ARTICLE,
                source_article_id=article_id,
                target_type=KnowledgeGraphEdge.NodeType.CHUNK,
                target_chunk=chunk,
                relationship='contains',
                inverse_relationship='contained_in',
                fact_statement=f"Article contains section: {section.heading}",
                created_by=KnowledgeGraphEdge.CreatedBy.EXTRACTION,
                confidence=1.0,
                status=KnowledgeGraphEdge.Status.ACTIVE,
            )

            logger.debug(f"Created chunk {chunk.id} for section '{section.heading}'")
            return chunk

    def _classify_chunk_type(self, section: ExtractedSection) -> str:
        """
        Classify the chunk type based on content heuristics.

        This is a simple heuristic-based classification. Could be enhanced
        with LLM classification in the future.
        """
        content_lower = section.content.lower()
        heading_lower = section.heading.lower()

        # Check for procedure indicators
        procedure_keywords = ['how to', 'step', 'steps', 'guide', 'tutorial', 'instructions']
        if any(kw in heading_lower for kw in procedure_keywords):
            return KnowledgeChunk.ChunkType.PROCEDURE

        # Check for numbered lists (procedures)
        if content_lower.count('\n1.') >= 1 or content_lower.count('\n2.') >= 1:
            return KnowledgeChunk.ChunkType.PROCEDURE

        # Check for warning indicators
        warning_keywords = ['warning', 'caution', 'important', 'note', 'attention']
        if any(kw in heading_lower for kw in warning_keywords):
            return KnowledgeChunk.ChunkType.WARNING

        # Check for FAQ
        faq_keywords = ['faq', 'frequently asked', 'questions']
        if any(kw in heading_lower for kw in faq_keywords):
            return KnowledgeChunk.ChunkType.FAQ

        # Check for prerequisites
        prereq_keywords = ['prerequisite', 'requirement', 'before you', 'getting started']
        if any(kw in heading_lower for kw in prereq_keywords):
            return KnowledgeChunk.ChunkType.PREREQUISITE

        # Check for example
        example_keywords = ['example', 'sample', 'demo']
        if any(kw in heading_lower for kw in example_keywords):
            return KnowledgeChunk.ChunkType.EXAMPLE

        # Check for reference/tables
        if '|' in content_lower and content_lower.count('|') > 4:
            return KnowledgeChunk.ChunkType.REFERENCE

        # Check for overview/introduction
        overview_keywords = ['overview', 'introduction', 'about', 'what is']
        if any(kw in heading_lower for kw in overview_keywords):
            return KnowledgeChunk.ChunkType.OVERVIEW

        # Default to concept
        return KnowledgeChunk.ChunkType.CONCEPT

    def _extract_topics(self, section: ExtractedSection) -> list[str]:
        """
        Extract topic tags from section content.

        Simple keyword extraction for now. Could be enhanced with
        NLP/LLM extraction in the future.
        """
        # Start with the heading words as topics
        heading_words = section.heading.lower().split()
        
        # Filter out common words
        stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
            'this', 'that', 'these', 'those', 'it', 'its', 'how', 'what', 'when',
            'where', 'why', 'who', 'which', 'your', 'you', 'our', 'we', 'their',
        }

        topics = [
            word.strip('.,!?()[]{}":;')
            for word in heading_words
            if word not in stopwords and len(word) > 2
        ]

        # Limit to 5 topics
        return topics[:5]


# Convenience function for getting a service instance
def get_chunk_extraction_service(organization_id: UUID) -> ChunkExtractionService:
    """Get a ChunkExtractionService instance for the given organization."""
    return ChunkExtractionService(organization_id)

