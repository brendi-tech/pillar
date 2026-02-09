"""
Hatchet workflows for KnowledgeItem indexing operations.

This module contains indexing workflow implementations for:
- KnowledgeItem content indexing to KnowledgeChunks
- Deletion of indexed content
"""
import logging
import time
import traceback
from datetime import timedelta
from typing import Optional

from asgiref.sync import sync_to_async
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client
from common.task_router import TaskRouter

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class IndexItemInput(BaseModel):
    """Input for the knowledge-index-item workflow."""
    item_id: str
    organization_id: Optional[str] = None


class DeleteItemIndexInput(BaseModel):
    """Input for the knowledge-delete-item-index workflow."""
    item_id: str
    organization_id: Optional[str] = None


@hatchet.task(
    name="knowledge-index-item",
    retries=3,
    execution_timeout=timedelta(minutes=5),
    input_validator=IndexItemInput,
)
async def index_knowledge_item_workflow(workflow_input: IndexItemInput, context: Context):
    """
    Index a KnowledgeItem into KnowledgeChunks for RAG.

    This workflow:
    1. Fetches KnowledgeItem by ID
    2. Validates item is active and ready for indexing
    3. Extracts semantic chunks from content
    4. Generates embeddings for each chunk
    5. Stores KnowledgeChunk records
    6. Updates KnowledgeItem status to INDEXED

    Args:
        workflow_input: IndexItemInput with item_id and organization_id
        context: Hatchet execution context
    """
    from apps.knowledge.models import KnowledgeItem
    from apps.knowledge.services import ProcessingService

    # Extract input
    item_id = getattr(workflow_input, 'item_id', None)
    organization_id = getattr(workflow_input, 'organization_id', None)

    if not item_id:
        logger.error("[KNOWLEDGE] Missing required item_id in workflow input")
        return {'error': 'Missing item_id'}

    task_start = time.time()
    logger.info(f"[KNOWLEDGE] Starting indexing for item {item_id}")

    try:
        # Fetch item with related data
        try:
            item = await KnowledgeItem.objects.select_related(
                'source',
                'organization',
                'product',
            ).aget(id=item_id)
        except KnowledgeItem.DoesNotExist:
            logger.warning(f"[KNOWLEDGE] Item {item_id} not found, skipping indexing")
            return {'error': f'Item not found: {item_id}'}

        # Skip if not active
        if not item.is_active:
            logger.info(f"[KNOWLEDGE] Item {item_id} is inactive, skipping")
            return {'skipped': True, 'reason': 'inactive'}

        # Get content to index (prefer optimized, fall back to raw)
        content = item.optimized_content or item.raw_content
        if not content:
            logger.warning(f"[KNOWLEDGE] Item {item_id} has no content, skipping")
            return {'skipped': True, 'reason': 'no_content'}

        # Init ProcessingService in thread pool (constructor loads embedding models)
        # process_item() handles all status transitions (PROCESSING -> INDEXED/FAILED)
        processing_service = await sync_to_async(ProcessingService, thread_sensitive=False)()
        result = await processing_service.process_item(item)

        if result.error:
            logger.error(f"[KNOWLEDGE] Indexing failed for item {item_id}: {result.error}")
            return {
                'item_id': str(item_id),
                'error': result.error,
            }

        elapsed = time.time() - task_start
        timings = result.timings
        logger.info(
            f"[KNOWLEDGE] Successfully indexed item {item_id} "
            f"({item.title}): {result.chunks_created} chunks in {elapsed:.1f}s "
            f"(type={item.item_type}, source={item.source_id}, "
            f"content={len(content)} chars)"
        )

        return {
            'item_id': str(item_id),
            'chunks_created': result.chunks_created,
            'chunks_deleted': result.chunks_deleted,
            'optimized': result.optimized,
            'elapsed_seconds': elapsed,
            'timings': timings,
        }

    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(
            f"[KNOWLEDGE] Failed to index item {item_id}: {exc}\n"
            f"[KNOWLEDGE] Full traceback:\n{tb}"
        )

        # Update item status with clean error message (full traceback is in logs)
        try:
            item = await KnowledgeItem.objects.aget(id=item_id)
            item.status = KnowledgeItem.Status.FAILED
            item.processing_error = str(exc)
            await item.asave(update_fields=['status', 'processing_error'])
        except KnowledgeItem.DoesNotExist:
            pass
        except Exception as e:
            logger.error(f"[KNOWLEDGE] Failed to update error status: {e}")

        raise  # Hatchet handles retry automatically


@hatchet.task(
    name="knowledge-delete-item-index",
    retries=3,
    execution_timeout=timedelta(minutes=5),
    input_validator=DeleteItemIndexInput,
)
async def delete_knowledge_item_index_workflow(workflow_input: DeleteItemIndexInput, context: Context):
    """
    Remove all KnowledgeChunks for a KnowledgeItem.

    Used when:
    - Item is deleted
    - Item is deactivated
    - Item needs full reindexing

    Safety: SAFE (delete is idempotent)

    Args:
        workflow_input: DeleteItemIndexInput with item_id and organization_id
        context: Hatchet execution context
    """
    from apps.knowledge.models import KnowledgeChunk

    # Extract input
    item_id = getattr(workflow_input, 'item_id', None)
    organization_id = getattr(workflow_input, 'organization_id', None)

    if not item_id:
        logger.error("[KNOWLEDGE] Missing required item_id in workflow input")
        return {'error': 'Missing item_id'}

    logger.info(f"[KNOWLEDGE] Deleting index for item {item_id}")

    try:
        # Delete all chunks for this item
        deleted_count, _ = await KnowledgeChunk.objects.filter(
            knowledge_item_id=item_id,
        ).adelete()

        logger.info(f"[KNOWLEDGE] Deleted {deleted_count} chunks for item {item_id}")

        return {
            'item_id': str(item_id),
            'chunks_deleted': deleted_count,
        }

    except Exception as e:
        logger.error(f"[KNOWLEDGE] Failed to delete index for item {item_id}: {e}", exc_info=True)
        # Don't raise - deletion should be best-effort
        return {'error': str(e)}


# =============================================================================
# Trigger Functions
# =============================================================================


def trigger_index_knowledge_item(item_id: str, organization_id: str) -> str:
    """
    Trigger indexing workflow for a KnowledgeItem.

    Args:
        item_id: ID of the KnowledgeItem to index
        organization_id: ID of the organization

    Returns:
        Workflow run ID
    """
    logger.info(f"[KNOWLEDGE] Triggering indexing for item {item_id}")
    return TaskRouter.execute(
        'knowledge-index-item',
        organization_id=organization_id,
        item_id=item_id,
    )


def trigger_delete_knowledge_item_index(item_id: str, organization_id: str) -> str:
    """
    Trigger index deletion workflow for a KnowledgeItem.

    Args:
        item_id: ID of the KnowledgeItem to delete index for
        organization_id: ID of the organization

    Returns:
        Workflow run ID
    """
    logger.info(f"[KNOWLEDGE] Triggering index deletion for item {item_id}")
    return TaskRouter.execute(
        'knowledge-delete-item-index',
        organization_id=organization_id,
        item_id=item_id,
    )


async def trigger_index_knowledge_item_async(item_id: str, organization_id: str) -> str:
    """
    Async version of trigger_index_knowledge_item.

    Args:
        item_id: ID of the KnowledgeItem to index
        organization_id: ID of the organization

    Returns:
        Workflow run ID
    """
    import asyncio
    logger.info(f"[KNOWLEDGE] Triggering indexing for item {item_id}")
    # TaskRouter.execute is sync, run in thread to avoid blocking
    return await asyncio.to_thread(
        TaskRouter.execute,
        'knowledge-index-item',
        organization_id=organization_id,
        item_id=item_id,
    )
