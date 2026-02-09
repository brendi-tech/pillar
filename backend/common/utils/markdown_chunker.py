"""
Markdown-aware chunking utilities for improved RAG performance.

This module provides hybrid chunking that combines:
1. Structure-aware splitting (respects headings, code blocks, tables)
2. Semantic splitting for large sections
3. Metadata enrichment with hierarchical context
"""

import re
import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from llama_index.core import Document
from llama_index.core.schema import BaseNode, TextNode
from llama_index.core.node_parser import (
    TokenTextSplitter,
    SemanticSplitterNodeParser,
    MarkdownNodeParser
)

logger = logging.getLogger(__name__)


@dataclass
class MarkdownSection:
    """Represents a section of a Markdown document."""
    text: str
    heading_hierarchy: List[str]  # ["H1 Title", "H2 Subtitle", "H3 Section"]
    heading_levels: List[int]     # [1, 2, 3]
    depth: int
    start_pos: int
    end_pos: int
    element_type: str = "text"    # text, code, table, list


class HybridMarkdownChunker:
    """
    Intelligent Markdown chunker that combines structural and semantic splitting.

    Strategy:
    1. Parse Markdown structure (headings, code blocks, tables)
    2. Split at heading boundaries to preserve sections
    3. For large sections (>max_chunk_size), apply semantic splitting
    4. Enrich with hierarchical metadata

    Args:
        max_chunk_size: Maximum tokens per chunk before sub-chunking
        min_chunk_size: Minimum tokens per chunk
        semantic_threshold: Percentile threshold for semantic splitting
        preserve_code_blocks: Never split code blocks
        heading_levels_to_split: Which heading levels to use as boundaries (e.g., [1, 2])
        embed_model: Embedding model for semantic splitting (optional)
    """

    def __init__(
        self,
        max_chunk_size: int = 2000,
        min_chunk_size: int = 200,
        semantic_threshold: int = 95,
        preserve_code_blocks: bool = True,
        heading_levels_to_split: Optional[List[int]] = None,
        embed_model = None
    ):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
        self.semantic_threshold = semantic_threshold
        self.preserve_code_blocks = preserve_code_blocks
        self.heading_levels = heading_levels_to_split or [1, 2]

        # Initialize parsers
        self.markdown_parser = MarkdownNodeParser(
            include_metadata=True,
            include_prev_next_rel=True
        )

        self.token_parser = TokenTextSplitter(
            chunk_size=max_chunk_size,
            chunk_overlap=200
        )

        # Only initialize semantic parser if embed_model provided
        self.semantic_parser = None
        if embed_model:
            self.semantic_parser = SemanticSplitterNodeParser(
                embed_model=embed_model,
                buffer_size=1,
                breakpoint_percentile_threshold=semantic_threshold
            )

    def get_nodes_from_documents(self, documents: List[Document]) -> List[BaseNode]:
        """
        LlamaIndex-compatible method for chunking documents.

        Args:
            documents: List of LlamaIndex Documents to chunk

        Returns:
            List of TextNode objects with enriched metadata
        """
        all_nodes = []
        for document in documents:
            nodes = self.chunk_document(document)
            all_nodes.extend(nodes)
        return all_nodes

    def chunk_document(self, document: Document) -> List[BaseNode]:
        """
        Main chunking method.

        Args:
            document: LlamaIndex Document to chunk

        Returns:
            List of TextNode objects with enriched metadata
        """
        logger.info(f"Starting hybrid Markdown chunking for document {document.doc_id}")

        # Step 1: Parse Markdown structure
        sections = self._parse_markdown_structure(document.text)
        logger.debug(f"Parsed {len(sections)} structural sections")

        # Step 2: Convert sections to nodes
        nodes = []
        for i, section in enumerate(sections):
            # Estimate token count (rough: 1 token ~ 4 chars)
            estimated_tokens = len(section.text) // 4

            # Decide chunking strategy based on size
            if estimated_tokens > self.max_chunk_size and self.semantic_parser:
                # Large section -> semantic sub-chunking
                logger.debug(
                    f"Section {i} is large ({estimated_tokens} tokens), "
                    f"applying semantic sub-chunking"
                )
                sub_nodes = self._semantic_subchunk(section, document)
                nodes.extend(sub_nodes)
            else:
                # Small/medium section -> keep intact
                node = self._section_to_node(section, document, chunk_index=i)
                nodes.append(node)

        # Step 3: Enrich metadata
        for i, node in enumerate(nodes):
            node.metadata['chunk_index'] = i
            node.metadata['total_chunks'] = len(nodes)
            node.metadata['chunking_strategy'] = 'hybrid_markdown'

        logger.info(
            f"Completed hybrid chunking: {len(sections)} sections -> "
            f"{len(nodes)} final chunks"
        )

        return nodes

    def _parse_markdown_structure(self, text: str) -> List[MarkdownSection]:
        """
        Parse Markdown text into structured sections.

        Respects:
        - Headings (# H1, ## H2, etc.)
        - Code blocks (```...```)
        - Tables (| ... |)
        - Lists (-, *, 1.)
        """
        sections = []
        lines = text.split('\n')

        current_section = []
        heading_stack = []  # Track heading hierarchy
        in_code_block = False
        code_block_start = None

        i = 0
        while i < len(lines):
            line = lines[i]

            # Track code blocks
            if line.strip().startswith('```'):
                if not in_code_block:
                    in_code_block = True
                    code_block_start = i
                else:
                    # End of code block
                    in_code_block = False
                    if self.preserve_code_blocks and current_section:
                        # Save code block as separate section
                        code_text = '\n'.join(lines[code_block_start:i+1])
                        sections.append(MarkdownSection(
                            text=code_text,
                            heading_hierarchy=heading_stack.copy(),
                            heading_levels=[h[0] for h in heading_stack],
                            depth=len(heading_stack),
                            start_pos=code_block_start,
                            end_pos=i,
                            element_type='code'
                        ))
                        current_section = []
                i += 1
                continue

            # Skip processing inside code blocks
            if in_code_block:
                i += 1
                continue

            # Check for headings
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
            if heading_match:
                level = len(heading_match.group(1))
                heading_text = heading_match.group(2).strip()

                # Should we split at this heading level?
                if level in self.heading_levels:
                    # Save previous section
                    if current_section:
                        section_text = '\n'.join(current_section)
                        if section_text.strip():
                            sections.append(MarkdownSection(
                                text=section_text,
                                heading_hierarchy=heading_stack.copy(),
                                heading_levels=[h[0] for h in heading_stack],
                                depth=len(heading_stack),
                                start_pos=i - len(current_section),
                                end_pos=i - 1,
                                element_type='text'
                            ))

                    # Reset for new section
                    current_section = [line]

                    # Update heading stack
                    # Remove deeper headings
                    heading_stack = [(lvl, txt) for lvl, txt in heading_stack if lvl < level]
                    heading_stack.append((level, heading_text))
                else:
                    # Include heading in current section
                    current_section.append(line)
                    # Update stack for context
                    heading_stack = [(lvl, txt) for lvl, txt in heading_stack if lvl < level]
                    heading_stack.append((level, heading_text))
            else:
                current_section.append(line)

            i += 1

        # Don't forget the last section
        if current_section:
            section_text = '\n'.join(current_section)
            if section_text.strip():
                sections.append(MarkdownSection(
                    text=section_text,
                    heading_hierarchy=heading_stack.copy(),
                    heading_levels=[h[0] for h in heading_stack],
                    depth=len(heading_stack),
                    start_pos=len(lines) - len(current_section),
                    end_pos=len(lines) - 1,
                    element_type='text'
                ))

        return sections

    def _semantic_subchunk(
        self,
        section: MarkdownSection,
        document: Document
    ) -> List[BaseNode]:
        """
        Apply semantic splitting to a large section.

        Args:
            section: The section to split
            document: Original document (for metadata)

        Returns:
            List of semantically chunked nodes
        """
        if not self.semantic_parser:
            # Fallback to token splitting if no semantic parser
            logger.warning("No semantic parser available, using token splitting")
            return self._token_subchunk(section, document)

        # Create temporary document for this section
        temp_doc = Document(
            text=section.text,
            metadata=document.metadata.copy()
        )

        try:
            # Apply semantic splitting
            sub_nodes = self.semantic_parser.get_nodes_from_documents([temp_doc])

            # Enrich with section metadata
            for node in sub_nodes:
                node.metadata.update({
                    'heading_hierarchy': [h[1] for h in section.heading_hierarchy],
                    'section_depth': section.depth,
                    'element_type': section.element_type,
                    'was_subchunked': True
                })

            return sub_nodes

        except Exception as e:
            logger.warning(f"Semantic splitting failed: {e}, falling back to token splitting")
            return self._token_subchunk(section, document)

    def _token_subchunk(
        self,
        section: MarkdownSection,
        document: Document
    ) -> List[BaseNode]:
        """Fallback token-based splitting for large sections."""
        temp_doc = Document(
            text=section.text,
            metadata=document.metadata.copy()
        )

        sub_nodes = self.token_parser.get_nodes_from_documents([temp_doc])

        # Enrich with section metadata
        for node in sub_nodes:
            node.metadata.update({
                'heading_hierarchy': [h[1] for h in section.heading_hierarchy],
                'section_depth': section.depth,
                'element_type': section.element_type,
                'was_subchunked': True
            })

        return sub_nodes

    def _section_to_node(
        self,
        section: MarkdownSection,
        document: Document,
        chunk_index: int = 0
    ) -> TextNode:
        """Convert a MarkdownSection to a TextNode."""
        node = TextNode(
            text=section.text,
            metadata={
                **document.metadata,
                'heading_hierarchy': [h[1] for h in section.heading_hierarchy],
                'heading_levels': section.heading_levels,
                'section_depth': section.depth,
                'element_type': section.element_type,
                'chunk_index': chunk_index,
                'was_subchunked': False
            }
        )

        return node


class MarkdownMetadataExtractor:
    """
    Utility to extract rich metadata from Markdown chunks.

    Can be used to enrich existing chunks with Markdown-specific metadata.
    """

    @staticmethod
    def extract_headings(text: str) -> List[Dict[str, any]]:
        """
        Extract all headings from Markdown text.

        Returns:
            List of dicts with {level, text, position}
        """
        headings = []
        for match in re.finditer(r'^(#{1,6})\s+(.+)$', text, re.MULTILINE):
            headings.append({
                'level': len(match.group(1)),
                'text': match.group(2).strip(),
                'position': match.start()
            })
        return headings

    @staticmethod
    def has_code_block(text: str) -> bool:
        """Check if text contains code blocks."""
        return '```' in text

    @staticmethod
    def has_table(text: str) -> bool:
        """Check if text contains Markdown tables."""
        # Simple heuristic: look for pipe chars and horizontal rules
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if '|' in line and i + 1 < len(lines):
                next_line = lines[i + 1]
                if re.match(r'^\|?\s*[-:]+\s*\|', next_line):
                    return True
        return False

    @staticmethod
    def count_lists(text: str) -> int:
        """Count list items in text."""
        # Unordered lists (-, *, +)
        unordered = len(re.findall(r'^\s*[-*+]\s+', text, re.MULTILINE))
        # Ordered lists (1., 2., etc.)
        ordered = len(re.findall(r'^\s*\d+\.\s+', text, re.MULTILINE))
        return unordered + ordered

    @staticmethod
    def classify_element_type(text: str) -> str:
        """
        Classify the primary element type of the text.

        Returns: 'code', 'table', 'list', or 'text'
        """
        if MarkdownMetadataExtractor.has_code_block(text):
            return 'code'
        elif MarkdownMetadataExtractor.has_table(text):
            return 'table'
        elif MarkdownMetadataExtractor.count_lists(text) > 2:
            return 'list'
        else:
            return 'text'


def quick_markdown_chunk(
    text: str,
    max_chunk_size: int = 2000,
    embed_model = None
) -> List[str]:
    """
    Quick utility function for simple Markdown chunking.

    Args:
        text: Markdown text to chunk
        max_chunk_size: Maximum chunk size in tokens
        embed_model: Optional embedding model for semantic splitting

    Returns:
        List of text chunks
    """
    document = Document(text=text)
    chunker = HybridMarkdownChunker(
        max_chunk_size=max_chunk_size,
        embed_model=embed_model
    )
    nodes = chunker.chunk_document(document)
    return [node.text for node in nodes]
