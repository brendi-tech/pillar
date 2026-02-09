"""
Processing service for Knowledge items.

Handles LLM optimization, chunking, and embedding generation.
"""
import logging
import hashlib
import time
import traceback
from typing import Optional
from dataclasses import dataclass, field

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils import timezone

from llama_index.core import Document

from common.utils.markdown_chunker import HybridMarkdownChunker
from common.services.embedding_service import get_embedding_service
from apps.knowledge.models import KnowledgeItem, KnowledgeChunk

logger = logging.getLogger(__name__)


@dataclass
class ProcessingResult:
    """Result of processing a KnowledgeItem."""
    chunks_created: int
    chunks_updated: int
    chunks_deleted: int
    optimized: bool
    error: Optional[str] = None
    # Step timings in milliseconds
    timings: dict = field(default_factory=dict)


class ProcessingService:
    """
    Service for processing KnowledgeItems into indexed chunks.

    Processing pipeline:
    1. LLM optimization (clean content for RAG)
    2. Chunk content using hybrid markdown chunker
    3. Generate embeddings for each chunk
    4. Create/update KnowledgeChunk records
    """

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.embedding_model = getattr(settings, 'RAG_EMBEDDING_MODEL', 'text-embedding-3-small')

        # Get embed model for semantic sub-chunking of large sections
        # This enables intelligent splitting when a section exceeds max_chunk_size
        from common.utils.embedding_cache import get_embedding_model, GoogleEmbeddingWrapper
        embed_model = get_embedding_model()

        # If using Google wrapper, get the underlying document model for the chunker
        if isinstance(embed_model, GoogleEmbeddingWrapper):
            embed_model_for_chunker = embed_model.document_model
        else:
            embed_model_for_chunker = embed_model

        self.chunker = HybridMarkdownChunker(
            max_chunk_size=getattr(settings, 'RAG_CHUNK_SIZE', 1500),
            min_chunk_size=200,
            heading_levels_to_split=[1, 2],
            embed_model=embed_model_for_chunker,  # Enable semantic sub-chunking
        )

    async def process_item(self, item: KnowledgeItem) -> ProcessingResult:
        """
        Process a KnowledgeItem: optimize, chunk, and embed.

        For document uploads, this also handles text extraction from the file.

        Args:
            item: KnowledgeItem to process

        Returns:
            ProcessingResult with stats and per-step timings
        """
        pipeline_start = time.time()
        logger.info(
            f"[KNOWLEDGE] Processing {item.id}: {item.title} "
            f"(type={item.item_type}, content={len(item.raw_content or '')} chars)"
        )

        result = ProcessingResult(
            chunks_created=0,
            chunks_updated=0,
            chunks_deleted=0,
            optimized=False,
        )

        try:
            # Mark as processing
            item.status = KnowledgeItem.Status.PROCESSING
            await item.asave(update_fields=['status'])

            # Step 0: Extract text from document uploads if raw_content is empty
            if not item.raw_content and item.metadata.get('file_path'):
                t0 = time.time()
                extracted_text = await self._extract_document_text(item)
                if extracted_text:
                    item.raw_content = extracted_text
                    await item.asave(update_fields=['raw_content'])
                    result.timings['extract_ms'] = int((time.time() - t0) * 1000)
                    logger.info(
                        f"[KNOWLEDGE] Extracted {item.id}: "
                        f"{len(extracted_text)} chars in {result.timings['extract_ms']}ms"
                    )
                else:
                    raise ValueError(f"Failed to extract text from document: {item.metadata.get('file_path')}")

            # Step 1: LLM optimization (for pages, not snippets)
            t1 = time.time()
            if item.item_type == KnowledgeItem.ItemType.PAGE:
                logger.info(
                    f"[KNOWLEDGE] Optimizing {item.id}: "
                    f"input={len(item.raw_content or '')} chars"
                )
                # Native async LLM call -- no thread pool bottleneck
                optimized_content = await self._optimize_content_async(item)
                optimize_ms = int((time.time() - t1) * 1000)
                result.timings['optimize_ms'] = optimize_ms
                if optimized_content:
                    item.optimized_content = optimized_content
                    result.optimized = True
                    logger.info(
                        f"[KNOWLEDGE] Optimized {item.id}: "
                        f"output={len(optimized_content)} chars in {optimize_ms}ms"
                    )
                else:
                    # Fallback to raw content if optimization fails
                    item.optimized_content = item.raw_content
                    logger.warning(
                        f"[KNOWLEDGE] Optimization failed for {item.id}, "
                        f"falling back to raw content ({optimize_ms}ms)"
                    )
            else:
                # Snippets don't need optimization
                item.optimized_content = item.raw_content
                result.timings['optimize_ms'] = 0

            # Step 2: Chunk the content (may use embeddings for semantic chunking)
            t2 = time.time()
            # thread_sensitive=False: run in thread pool, not event loop thread
            chunks_data = await sync_to_async(self._chunk_content, thread_sensitive=False)(item)
            chunk_ms = int((time.time() - t2) * 1000)
            result.timings['chunk_ms'] = chunk_ms
            avg_size = int(sum(len(c['content']) for c in chunks_data) / max(len(chunks_data), 1))
            logger.info(
                f"[KNOWLEDGE] Chunked {item.id}: "
                f"{len(chunks_data)} chunks, avg={avg_size} chars in {chunk_ms}ms"
            )

            # Step 3: Delete old chunks
            t3 = time.time()
            deleted_count, _ = await KnowledgeChunk.objects.filter(
                knowledge_item=item
            ).adelete()
            result.chunks_deleted = deleted_count
            delete_ms = int((time.time() - t3) * 1000)
            result.timings['delete_ms'] = delete_ms

            # Step 4: Create new chunks with embeddings
            t4 = time.time()
            for i, chunk_data in enumerate(chunks_data):
                chunk = await self._create_chunk(item, chunk_data, i)
                result.chunks_created += 1
            embed_ms = int((time.time() - t4) * 1000)
            result.timings['embed_ms'] = embed_ms
            logger.info(
                f"[KNOWLEDGE] Embedded {item.id}: "
                f"{result.chunks_created} chunks in {embed_ms}ms"
            )

            # Update item status (use update_fields to avoid full save in async)
            item.status = KnowledgeItem.Status.INDEXED
            item.last_indexed_at = timezone.now()
            item.processing_error = ''
            item.update_content_hash()
            await item.asave(update_fields=[
                'status', 'last_indexed_at', 'processing_error',
                'content_hash', 'optimized_content', 'excerpt',
            ])

            total_ms = int((time.time() - pipeline_start) * 1000)
            result.timings['total_ms'] = total_ms
            logger.info(
                f"[KNOWLEDGE] Item {item.id} complete: "
                f"{result.chunks_created} chunks in {total_ms}ms "
                f"(optimize={result.timings.get('optimize_ms', 0)}ms, "
                f"chunk={chunk_ms}ms, embed={embed_ms}ms)"
            )

        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            total_ms = int((time.time() - pipeline_start) * 1000)
            result.timings['total_ms'] = total_ms
            logger.error(
                f"[KNOWLEDGE] Failed {item.id} after {total_ms}ms: {e}\n"
                f"[KNOWLEDGE] Traceback:\n{tb}"
            )
            result.error = error_msg

            # Store clean error message for UI display (full traceback is in logs)
            item.status = KnowledgeItem.Status.FAILED
            item.processing_error = error_msg
            await item.asave(update_fields=['status', 'processing_error'])

        return result

    async def _optimize_content_async(self, item: KnowledgeItem) -> Optional[str]:
        """
        Use LLM to clean and optimize content for RAG (async, no thread pool).

        Calls LLMClient.complete_async() directly, avoiding the thread pool
        bottleneck when processing many items concurrently.

        Args:
            item: KnowledgeItem with raw_content

        Returns:
            Optimized content string, or None if optimization fails
        """
        try:
            from common.utils.llm_client import LLMClient
            from common.utils.llm_config import LLMConfigService
            from common.utils.json_parser import parse_json_from_llm

            model_name = LLMConfigService.resolve_model('google/budget')
            openrouter_model = LLMConfigService.get_openrouter_model(model_name)
            max_tokens = getattr(settings, 'OPTIMIZATION_LLM_MAX_TOKENS', 65536)

            logger.info(
                f"[KNOWLEDGE] LLM optimize (async) {item.id}: "
                f"model={openrouter_model}, max_tokens={max_tokens}"
            )

            client = LLMClient(model=openrouter_model)

            system_prompt = (
                "You optimize scraped web content for a knowledge base. "
                "Return a JSON object with exactly these keys: "
                "optimized_content, excerpt."
            )

            raw_content = (item.raw_content or '')

            prompt = f"""Optimize this scraped web page content for a help center knowledge base.

Page title: {item.title}
Source URL: {item.url or ''}

INSTRUCTIONS for optimized_content:
- REMOVE: The main title/H1 heading, navigation, breadcrumbs, footers, headers
- REMOVE: 'More resources', 'Related articles', 'See also' sections
- REMOVE: Share buttons, social links, reading time, dates, author bylines
- REMOVE: Newsletter signups, comments, CTAs, website chrome/boilerplate
- REMOVE: Decorative images (logos, icons, brand images, avatars, stock photos)
- KEEP: Section headings (## and ###, NOT #), lists, code blocks, tables
- KEEP: Inline formatting (bold, italic, links)
- KEEP: Helpful images (screenshots, diagrams, product UI, workflow illustrations)
- Start directly with the first paragraph or section heading (##), NOT the title

Return a JSON object with:
- "optimized_content": the cleaned markdown content
- "excerpt": a 1-2 sentence summary of the article

RAW CONTENT:
{raw_content}"""

            response = await client.complete_async(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=0.1,
            )

            parsed = parse_json_from_llm(response, expected_type="object", sanitize=False)
            optimized = parsed.get('optimized_content', '')

            if optimized and len(optimized) > 100:
                # Use LLM-generated excerpt if available
                excerpt = parsed.get('excerpt', '')
                if excerpt:
                    item.excerpt = excerpt
                return optimized

        except Exception as e:
            logger.warning(
                f"[KNOWLEDGE] Async optimization failed for {item.id}: {e}"
            )

        return None

    def _chunk_content(self, item: KnowledgeItem) -> list[dict]:
        """
        Chunk the optimized content.

        Args:
            item: KnowledgeItem with optimized_content

        Returns:
            List of chunk dictionaries with content and metadata
        """
        content = item.optimized_content or item.raw_content
        if not content:
            return []

        # Create a LlamaIndex document
        doc = Document(
            text=f"# {item.title}\n\n{content}",
            metadata={
                'title': item.title,
                'url': item.url or '',
                'item_id': str(item.id),
                'item_type': item.item_type,
            }
        )

        # Chunk the document
        nodes = self.chunker.get_nodes_from_documents([doc])

        chunks_data = []
        for node in nodes:
            # Extract heading hierarchy from metadata
            heading_path = []
            if hasattr(node, 'metadata'):
                # Look for heading info in metadata
                heading_path = node.metadata.get('header_hierarchy', [])
                if not heading_path:
                    heading_path = node.metadata.get('heading_hierarchy', [])

            chunks_data.append({
                'title': heading_path[-1] if heading_path else item.title,
                'content': node.text,
                'heading_path': heading_path,
            })

        return chunks_data

    async def _create_chunk(
        self,
        item: KnowledgeItem,
        chunk_data: dict,
        index: int,
    ) -> KnowledgeChunk:
        """
        Create a KnowledgeChunk with embedding.

        Args:
            item: Parent KnowledgeItem
            chunk_data: Dict with title, content, heading_path
            index: Chunk index within item

        Returns:
            Created KnowledgeChunk
        """
        content = chunk_data['content']
        content_hash = hashlib.md5(content.encode()).hexdigest()

        # Generate embedding (use async variant to avoid SynchronousOnlyOperation in async context)
        embedding = await self.embedding_service.embed_document_async(content)

        # Use FK ids to avoid SynchronousOnlyOperation (accessing item.organization/item.product in async can trigger sync DB)
        chunk = await KnowledgeChunk.objects.acreate(
            organization_id=item.organization_id,
            product_id=item.product_id,  # Denormalized from item for query performance
            knowledge_item=item,
            title=chunk_data['title'],
            content=content,
            heading_path=chunk_data.get('heading_path', []),
            chunk_index=index,
            embedding=embedding,
            embedding_model=self.embedding_model,
            content_hash=content_hash,
        )

        return chunk

    async def _extract_document_text(self, item: KnowledgeItem) -> Optional[str]:
        """
        Extract text from a document file.

        Uses the DocumentUploadProvider's text extraction methods.

        Args:
            item: KnowledgeItem with file_path in metadata

        Returns:
            Extracted text, or None if extraction fails
        """
        from django.core.files.storage import default_storage
        from apps.knowledge.services.providers.document_upload_provider import (
            DocumentUploadProvider,
        )

        file_path = item.metadata.get('file_path')
        filename = item.metadata.get('original_filename', file_path)

        if not file_path:
            logger.warning(f"No file_path in metadata for item {item.id}")
            return None

        try:
            # Read file from storage (sync Django storage API — single thread pool call)
            def _read_file_from_storage():
                if not default_storage.exists(file_path):
                    return None
                with default_storage.open(file_path, 'rb') as f:
                    return f.read()

            content_bytes = await sync_to_async(
                _read_file_from_storage, thread_sensitive=False,
            )()
            if content_bytes is None:
                logger.error(f"File not found: {file_path}")
                return None

            # Extract text using the provider's method
            text = await DocumentUploadProvider._extract_text_static(content_bytes, filename)

            if not text or len(text.strip()) < 10:
                logger.warning(f"Extracted text too short for item {item.id}")
                return f"[Unable to extract meaningful text from {filename}]"

            return text

        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            return None

    async def reprocess_item(self, item: KnowledgeItem) -> ProcessingResult:
        """
        Reprocess an item (delete chunks and re-index).

        Args:
            item: KnowledgeItem to reprocess

        Returns:
            ProcessingResult with stats
        """
        # Reset status and process again
        item.status = KnowledgeItem.Status.PENDING
        await item.asave(update_fields=['status'])

        return await self.process_item(item)
