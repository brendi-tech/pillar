"""
Hatchet workflow for processing a KnowledgeItem.

Optimizes content, chunks it, and generates embeddings.
"""
import logging
import time
import traceback
from datetime import timedelta
from typing import Optional

from hatchet_sdk import Context
from pydantic import BaseModel

from asgiref.sync import sync_to_async
from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class ProcessItemInput(BaseModel):
    """Input for the knowledge-process-item workflow."""
    item_id: str
    organization_id: Optional[str] = None


@hatchet.task(
    name="knowledge-process-item",
    retries=3,
    execution_timeout=timedelta(minutes=10),
    input_validator=ProcessItemInput,
)
async def process_item_workflow(workflow_input: ProcessItemInput, context: Context):
    """
    Process a KnowledgeItem: optimize, chunk, and embed.

    Pipeline:
    1. Fetch item by ID
    2. LLM optimization (for pages)
    3. Chunk content
    4. Generate embeddings
    5. Create KnowledgeChunk records
    6. Update item status to indexed

    Args:
        workflow_input: ProcessItemInput with item_id and organization_id
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
    logger.info(f"[KNOWLEDGE] Starting item processing for {item_id}")

    try:
        # Fetch item (include product so _create_chunk does not trigger sync DB in async context)
        item = await KnowledgeItem.objects.select_related(
            'source', 'organization', 'product'
        ).aget(id=item_id)

        logger.info(
            f"[KNOWLEDGE] Processing item: {item.title} "
            f"(type={item.item_type}, source={item.source_id})"
        )

        # Init ProcessingService in thread pool (constructor loads embedding models)
        processing_service = await sync_to_async(ProcessingService, thread_sensitive=False)()
        result = await processing_service.process_item(item)

        elapsed = time.time() - task_start

        if result.error:
            logger.error(
                f"[KNOWLEDGE] Item processing FAILED for {item_id} "
                f"({item.title}) after {elapsed:.1f}s: {result.error}"
            )
            return {
                'item_id': str(item_id),
                'error': result.error,
                'elapsed_seconds': elapsed,
            }

        timings = result.timings
        logger.info(
            f"[KNOWLEDGE] Item processing COMPLETE for {item_id} "
            f"({item.title}): {result.chunks_created} chunks in {elapsed:.1f}s "
            f"(optimize={timings.get('optimize_ms', 0)}ms, "
            f"chunk={timings.get('chunk_ms', 0)}ms, "
            f"embed={timings.get('embed_ms', 0)}ms)"
        )

        return {
            'item_id': str(item_id),
            'chunks_created': result.chunks_created,
            'chunks_deleted': result.chunks_deleted,
            'optimized': result.optimized,
            'elapsed_seconds': elapsed,
            'timings': timings,
        }

    except KnowledgeItem.DoesNotExist:
        logger.error(f"[KNOWLEDGE] Item not found: {item_id}")
        return {'error': f'Item not found: {item_id}'}

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(
            f"[KNOWLEDGE] Item processing failed for {item_id}: {e}\n"
            f"[KNOWLEDGE] Full traceback:\n{tb}"
        )

        # Update item status with clean error message (full traceback is in logs)
        try:
            item = await KnowledgeItem.objects.aget(id=item_id)
            item.status = KnowledgeItem.Status.FAILED
            item.processing_error = str(e)
            await item.asave(update_fields=['status', 'processing_error'])
        except Exception:
            pass

        return {'error': str(e)}
