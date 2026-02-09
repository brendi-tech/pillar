"""
Async Firecrawl workflow for Knowledge sources.

Handles large site crawls asynchronously:
1. Start crawl job with Firecrawl
2. Poll for completion
3. Process pages in batches and create KnowledgeItems
"""
import asyncio
import hashlib
import logging
import os
from datetime import timedelta
from typing import Optional
from urllib.parse import urlparse

from asgiref.sync import sync_to_async
from django.utils import timezone
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client
from common.task_router import TaskRouter
from apps.knowledge.utils.page_filter import should_skip_page

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class CrawlStartInput(BaseModel):
    """Input for starting an async crawl."""
    source_id: str


class CrawlPollInput(BaseModel):
    """Input for polling crawl status."""
    source_id: str


class CrawlProcessInput(BaseModel):
    """Input for processing crawl results."""
    source_id: str


@hatchet.task(
    name="knowledge-start-async-crawl",
    retries=3,
    execution_timeout=timedelta(minutes=10),
    input_validator=CrawlStartInput,
)
async def start_async_crawl_workflow(workflow_input: CrawlStartInput, context: Context):
    """
    Start a Firecrawl async crawl for a KnowledgeSource.
    
    Stores the job ID in source.crawl_config['firecrawl_job_id'] and
    triggers polling workflow.
    """
    from apps.knowledge.models import KnowledgeSource
    from common.utils.firecrawl_service import firecrawl_service, FirecrawlAPIError
    
    source_id = workflow_input.source_id
    logger.info(f"[KNOWLEDGE CRAWL] Starting async crawl for source {source_id}")
    
    try:
        source = await KnowledgeSource.objects.select_related('organization').aget(id=source_id)
        
        if not source.url:
            logger.error(f"[KNOWLEDGE CRAWL] Source {source_id} has no URL")
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = "No URL configured for crawl"
            await source.asave(update_fields=['status', 'error_message'])
            return {'status': 'error', 'error': 'no_url_configured'}
        
        # Update status
        source.status = KnowledgeSource.Status.SYNCING
        source.error_message = ''
        await source.asave(update_fields=['status', 'error_message'])
        
        # Build crawl config
        config = {
            'limit': source.get_max_pages(),
        }
        include_paths = source.get_include_paths()
        exclude_paths = source.get_exclude_paths()
        if include_paths:
            config['includePaths'] = include_paths
        if exclude_paths:
            config['excludePaths'] = exclude_paths
        
        logger.info(f"[KNOWLEDGE CRAWL] Starting Firecrawl for {source.url}")
        
        # Start async crawl - pass source for webhook configuration
        # The source acts as source_sync for webhook metadata (crawl_uuid = source.id)
        result = await asyncio.to_thread(
            firecrawl_service.start_crawl,
            url=source.url,
            source_sync=source,
            config=config,
        )
        
        job_id = result.get('id')
        if not job_id:
            raise ValueError("Firecrawl did not return a job ID")
        
        # Store job ID in crawl_config
        crawl_config = source.crawl_config.copy() if source.crawl_config else {}
        crawl_config['firecrawl_job_id'] = job_id
        crawl_config['crawl_started_at'] = timezone.now().isoformat()
        crawl_config['pages_discovered'] = 0
        crawl_config['pages_processed'] = 0
        source.crawl_config = crawl_config
        await source.asave(update_fields=['crawl_config'])
        
        logger.info(f"[KNOWLEDGE CRAWL] Job {job_id} started for source {source_id}")
        
        # Trigger polling (with initial delay)
        is_containerized = os.getenv('IS_CONTAINERIZED', 'false').lower() == 'true'
        if not is_containerized:
            await asyncio.sleep(15)
            TaskRouter.execute(
                'knowledge-poll-async-crawl',
                source_id=source_id,
                organization_id=str(source.organization_id),
            )
        
        return {'status': 'started', 'job_id': job_id}
        
    except KnowledgeSource.DoesNotExist:
        logger.error(f"[KNOWLEDGE CRAWL] Source {source_id} not found")
        return {'status': 'error', 'error': 'source_not_found'}
        
    except FirecrawlAPIError as e:
        logger.error(f"[KNOWLEDGE CRAWL] Firecrawl error for source {source_id}: {e}")
        try:
            source = await KnowledgeSource.objects.aget(id=source_id)
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = f"Firecrawl error: {str(e)}"
            await source.asave(update_fields=['status', 'error_message'])
        except Exception:
            pass
        raise
        
    except Exception as e:
        logger.error(f"[KNOWLEDGE CRAWL] Error starting crawl: {e}", exc_info=True)
        raise


@hatchet.task(
    name="knowledge-poll-async-crawl",
    retries=100,
    execution_timeout=timedelta(minutes=5),
    input_validator=CrawlPollInput,
)
async def poll_async_crawl_workflow(workflow_input: CrawlPollInput, context: Context):
    """
    Poll Firecrawl for crawl status and trigger processing when complete.
    """
    from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory
    from common.utils.firecrawl_service import firecrawl_service
    
    source_id = workflow_input.source_id
    logger.info(f"[KNOWLEDGE CRAWL] Polling status for source {source_id}")
    
    try:
        source = await KnowledgeSource.objects.select_related('organization').aget(id=source_id)
        
        # Check if cancelled
        if source.status != KnowledgeSource.Status.SYNCING:
            logger.info(f"[KNOWLEDGE CRAWL] Source {source_id} not syncing, stopping poll")
            return {'status': 'cancelled'}
        
        crawl_config = source.crawl_config or {}
        job_id = crawl_config.get('firecrawl_job_id')
        sync_history_id = crawl_config.get('sync_history_id')
        
        if not job_id:
            logger.error(f"[KNOWLEDGE CRAWL] No job ID for source {source_id}")
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = "No Firecrawl job ID found"
            await source.asave(update_fields=['status', 'error_message'])
            # Update sync history if available
            await _update_sync_history_failed(sync_history_id, "No Firecrawl job ID found")
            return {'status': 'error', 'error': 'no_job_id'}
        
        # Check status
        result = await asyncio.to_thread(
            firecrawl_service.get_crawl_status,
            job_id
        )
        
        fc_status = result.get('status', 'unknown')
        total_pages = result.get('total', 0)
        completed_pages = result.get('completed', 0)
        
        logger.info(
            f"[KNOWLEDGE CRAWL] Job {job_id}: {fc_status} "
            f"({completed_pages}/{total_pages} pages)"
        )
        
        # Update progress
        crawl_config['pages_discovered'] = total_pages
        source.crawl_config = crawl_config
        await source.asave(update_fields=['crawl_config'])
        
        org_id = str(source.organization_id)
        
        if fc_status in ['completed', 'failed']:
            if fc_status == 'failed':
                source.status = KnowledgeSource.Status.ERROR
                source.error_message = "Firecrawl job failed"
                await source.asave(update_fields=['status', 'error_message'])
                # Update sync history
                await _update_sync_history_failed(sync_history_id, "Firecrawl job failed")
                return {'status': 'failed'}
            
            # Trigger batch processing
            logger.info(f"[KNOWLEDGE CRAWL] Crawl complete, processing source {source_id}")
            TaskRouter.execute(
                'knowledge-process-async-crawl',
                source_id=source_id,
                organization_id=org_id,
            )
            return {'status': 'completed', 'total_pages': total_pages}
        else:
            # Schedule next poll
            await asyncio.sleep(20)
            TaskRouter.execute(
                'knowledge-poll-async-crawl',
                source_id=source_id,
                organization_id=org_id,
            )
            return {'status': fc_status, 'total_pages': total_pages}
            
    except Exception as e:
        logger.error(f"[KNOWLEDGE CRAWL] Poll error: {e}", exc_info=True)
        raise


@hatchet.task(
    name="knowledge-process-async-crawl",
    retries=2,
    execution_timeout=timedelta(minutes=30),
    input_validator=CrawlProcessInput,
)
async def process_async_crawl_workflow(workflow_input: CrawlProcessInput, context: Context):
    """
    Process all crawled pages and create/update KnowledgeItems.
    Updates KnowledgeSyncHistory on completion or failure.
    """
    from django.core.cache import cache
    from apps.knowledge.models import KnowledgeSource, KnowledgeItem, KnowledgeSyncHistory
    from common.utils.firecrawl_service import firecrawl_service
    
    source_id = workflow_input.source_id
    sync_history_id = None
    
    # Prevent duplicate processing (wrap sync cache operation for async context)
    lock_key = f"knowledge_crawl_process:{source_id}"
    lock_acquired = await sync_to_async(cache.add)(lock_key, timezone.now().isoformat(), timeout=1800)
    if not lock_acquired:
        logger.info(f"[KNOWLEDGE CRAWL] Already processing source {source_id}")
        return {'status': 'skipped', 'reason': 'already_processing'}
    
    try:
        logger.info(f"[KNOWLEDGE CRAWL] Processing crawl for source {source_id}")
        
        source = await KnowledgeSource.objects.select_related('organization').aget(id=source_id)
        
        crawl_config = source.crawl_config or {}
        job_id = crawl_config.get('firecrawl_job_id')
        sync_history_id = crawl_config.get('sync_history_id')
        
        if not job_id:
            logger.error(f"[KNOWLEDGE CRAWL] No job ID for source {source_id}")
            await _update_sync_history_failed(sync_history_id, "No Firecrawl job ID found")
            return {'status': 'error', 'reason': 'no_job_id'}
        
        # Fetch all crawl data
        all_data = await asyncio.to_thread(
            firecrawl_service.get_all_crawl_data,
            job_id
        )
        pages_data = all_data.get('data', [])
        
        logger.info(f"[KNOWLEDGE CRAWL] Fetched {len(pages_data)} pages")
        
        pages_created = 0
        pages_updated = 0
        pages_skipped = 0
        pages_failed = 0
        
        for page_data in pages_data:
            try:
                result = await _process_page(source, page_data)
                if result == 'created':
                    pages_created += 1
                elif result == 'updated':
                    pages_updated += 1
                elif result == 'skipped':
                    pages_skipped += 1
            except Exception as e:
                logger.error(f"[KNOWLEDGE CRAWL] Page processing error: {e}")
                pages_failed += 1
        
        # Update source (item_count is computed dynamically via annotation)
        crawl_config['pages_processed'] = pages_created + pages_updated
        crawl_config['last_crawl_completed'] = timezone.now().isoformat()
        source.crawl_config = crawl_config
        source.status = KnowledgeSource.Status.ACTIVE
        source.last_synced_at = timezone.now()
        source.error_message = ''
        await source.asave(update_fields=[
            'crawl_config', 'status', 'last_synced_at', 'error_message'
        ])
        
        # Update sync history with success
        if sync_history_id:
            try:
                sync_history = await KnowledgeSyncHistory.objects.aget(id=sync_history_id)
                sync_history.status = KnowledgeSyncHistory.Status.COMPLETED
                sync_history.completed_at = timezone.now()
                sync_history.items_synced = len(pages_data)
                sync_history.items_created = pages_created
                sync_history.items_updated = pages_updated
                sync_history.items_failed = pages_failed
                await sync_history.asave(update_fields=[
                    'status', 'completed_at', 'items_synced',
                    'items_created', 'items_updated', 'items_failed', 'updated_at'
                ])
                logger.info(f"[KNOWLEDGE CRAWL] Updated sync history {sync_history_id} to COMPLETED")
            except KnowledgeSyncHistory.DoesNotExist:
                logger.warning(f"[KNOWLEDGE CRAWL] Sync history {sync_history_id} not found")
        
        # Spawn processing workflows for pending items
        pending_items = KnowledgeItem.objects.filter(
            source=source,
            status=KnowledgeItem.Status.PENDING,
        ).values_list('id', flat=True)
        
        dispatched_count = 0
        dispatch_errors = 0
        async for item_id in pending_items:
            try:
                TaskRouter.execute(
                    'knowledge-process-item',
                    item_id=str(item_id),
                    organization_id=str(source.organization_id),
                )
                dispatched_count += 1
            except Exception as e:
                dispatch_errors += 1
                logger.error(f"[KNOWLEDGE CRAWL] Failed to dispatch processing for {item_id}: {e}")
        
        logger.info(
            f"[KNOWLEDGE CRAWL] Dispatched {dispatched_count} items for processing"
            f"{f' ({dispatch_errors} dispatch errors)' if dispatch_errors else ''}"
        )
        
        logger.info(
            f"[KNOWLEDGE CRAWL] Complete: {pages_created} created, "
            f"{pages_updated} updated, {pages_skipped} skipped, {pages_failed} failed"
        )
        
        return {
            'status': 'success',
            'pages_created': pages_created,
            'pages_updated': pages_updated,
            'pages_skipped': pages_skipped,
            'pages_failed': pages_failed,
        }
        
    except Exception as e:
        logger.error(f"[KNOWLEDGE CRAWL] Processing error: {e}", exc_info=True)
        try:
            source = await KnowledgeSource.objects.aget(id=source_id)
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = str(e)
            await source.asave(update_fields=['status', 'error_message'])
        except Exception:
            pass
        # Update sync history with failure
        await _update_sync_history_failed(sync_history_id, str(e))
        raise
    finally:
        await sync_to_async(cache.delete)(lock_key)


async def _update_sync_history_failed(sync_history_id: Optional[str], error_message: str) -> None:
    """
    Update a KnowledgeSyncHistory record to FAILED status.
    
    Args:
        sync_history_id: UUID of the sync history record (may be None)
        error_message: Error message to record
    """
    if not sync_history_id:
        return
    
    from apps.knowledge.models import KnowledgeSyncHistory
    
    try:
        sync_history = await KnowledgeSyncHistory.objects.aget(id=sync_history_id)
        sync_history.status = KnowledgeSyncHistory.Status.FAILED
        sync_history.completed_at = timezone.now()
        sync_history.error_message = error_message
        await sync_history.asave(update_fields=[
            'status', 'completed_at', 'error_message', 'updated_at'
        ])
        logger.info(f"[KNOWLEDGE CRAWL] Updated sync history {sync_history_id} to FAILED: {error_message}")
    except KnowledgeSyncHistory.DoesNotExist:
        logger.warning(f"[KNOWLEDGE CRAWL] Sync history {sync_history_id} not found for failure update")
    except Exception as e:
        logger.error(f"[KNOWLEDGE CRAWL] Failed to update sync history: {e}")


async def _process_page(source, page_data: dict) -> str:
    """
    Process a single crawled page into a KnowledgeItem.
    
    Returns: 'created', 'updated', or 'skipped'
    """
    from apps.knowledge.models import KnowledgeItem
    
    # Extract URL
    url = page_data.get('url')
    if not url:
        metadata = page_data.get('metadata', {})
        url = metadata.get('url') or metadata.get('sourceURL')
    
    if not url:
        return 'skipped'
    
    # Check for error pages (404s, 500s, soft 404s)
    skip, reason = should_skip_page(page_data, url)
    if skip:
        logger.info(f"[KNOWLEDGE CRAWL] Skipping page {url}: {reason}")
        return 'skipped'
    
    # Check for minimal content
    markdown = page_data.get('markdown', '')
    if len(markdown) < 100:
        return 'skipped'
    
    # Filter to source domain
    source_host = urlparse(source.url).netloc.lower()
    url_host = urlparse(url).netloc.lower()
    if url_host != source_host:
        return 'skipped'
    
    # Extract metadata
    metadata = page_data.get('metadata', {})
    title = (metadata.get('title') or url)[:500]
    description = metadata.get('description', '') or ''
    
    # Generate external ID
    external_id = KnowledgeItem.generate_external_id(url)
    content_hash = hashlib.md5(markdown.encode()).hexdigest()
    
    # Check for existing item
    try:
        existing = await KnowledgeItem.objects.aget(
            source=source,
            external_id=external_id,
        )
        
        # Content unchanged: skip if already indexed; otherwise re-queue for processing (e.g. was FAILED)
        if existing.content_hash == content_hash:
            if existing.status == KnowledgeItem.Status.INDEXED:
                return 'skipped'
            # Same content but not indexed (failed/pending) — re-trigger processing
            existing.status = KnowledgeItem.Status.PENDING
            existing.processing_error = None
            await existing.asave(update_fields=['status', 'processing_error'])
            return 'updated'
        
        # Update existing (content changed)
        existing.title = title
        existing.raw_content = markdown
        existing.content_hash = content_hash
        existing.excerpt = description[:500]
        existing.status = KnowledgeItem.Status.PENDING
        existing.metadata = {
            'word_count': len(markdown.split()),
            'scraped_at': timezone.now().isoformat(),
        }
        await existing.asave()
        return 'updated'
        
    except KnowledgeItem.DoesNotExist:
        # Create new item
        await KnowledgeItem.objects.acreate(
            organization=source.organization,
            product=source.product,  # Denormalized from source
            source=source,
            item_type=KnowledgeItem.ItemType.PAGE,
            external_id=external_id,
            url=url,
            title=title,
            raw_content=markdown,
            content_hash=content_hash,
            excerpt=description[:500],
            status=KnowledgeItem.Status.PENDING,
            is_active=True,
            metadata={
                'word_count': len(markdown.split()),
                'scraped_at': timezone.now().isoformat(),
            },
        )
        return 'created'
