"""
Hatchet workflow for syncing a KnowledgeSource.

Triggers the async crawl workflow which handles the actual crawling.
Supports URL-based sources (Firecrawl) and cloud storage sources.
"""
import logging
import time
from datetime import timedelta
from typing import Optional

from django.utils import timezone
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client
from common.task_router import TaskRouter

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class SyncSourceInput(BaseModel):
    """Input for the knowledge-sync-source workflow."""
    source_id: str
    organization_id: Optional[str] = None
    sync_history_id: Optional[str] = None  # If set, API already created the record (for immediate UI visibility)


@hatchet.task(
    name="knowledge-sync-source",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=SyncSourceInput,
)
async def sync_source_workflow(workflow_input: SyncSourceInput, context: Context):
    """
    Sync a KnowledgeSource by triggering the appropriate sync workflow.

    Routes to different sync strategies based on source type:
    - URL-based (help_center, marketing_site, website_crawl): Firecrawl async crawl
    - Cloud storage: Direct provider fetch
    - Document upload: Skipped (handled at upload time)
    - Snippets: Skipped (no sync needed)

    Args:
        workflow_input: SyncSourceInput with source_id and organization_id
        context: Hatchet execution context
    """
    from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory

    # Extract input (getattr is a safety net if input_validator wasn't applied, e.g. old worker)
    source_id = getattr(workflow_input, 'source_id', None)
    organization_id = getattr(workflow_input, 'organization_id', None)
    sync_history_id_from_api = getattr(workflow_input, 'sync_history_id', None)
    if not source_id:
        logger.error("[KNOWLEDGE] Missing required source_id in workflow input")
        return {'error': 'Missing source_id'}

    sync_start = time.time()
    logger.info(f"[KNOWLEDGE] Starting source sync for {source_id}")

    sync_history = None

    try:
        # Fetch source
        source = await KnowledgeSource.objects.select_related('organization').aget(
            id=source_id
        )

        logger.info(
            f"[KNOWLEDGE] Source: {source.name} (type={source.source_type}, "
            f"url={source.url or 'N/A'})"
        )

        # Route based on source type
        if source.source_type == KnowledgeSource.SourceType.SNIPPETS:
            logger.error(f"[KNOWLEDGE] Cannot sync snippets source: {source_id}")
            # Reset status since API set it to SYNCING
            source.status = KnowledgeSource.Status.ACTIVE
            await source.asave(update_fields=['status'])
            return {'error': 'Cannot sync snippets source'}

        if source.source_type == KnowledgeSource.SourceType.DOCUMENT_UPLOAD:
            logger.info(f"[KNOWLEDGE] Document upload sources sync at upload time: {source_id}")
            # Reset status since API set it to SYNCING
            source.status = KnowledgeSource.Status.ACTIVE
            await source.asave(update_fields=['status'])
            return {'status': 'skipped', 'reason': 'document_upload_syncs_at_upload'}

        if source.source_type == KnowledgeSource.SourceType.CLOUD_STORAGE:
            # Cloud storage sources use connection_config, not URL
            if not source.connection_config:
                logger.error(f"[KNOWLEDGE] Cloud storage source has no connection config: {source_id}")
                # Reset status since API set it to SYNCING
                source.status = KnowledgeSource.Status.ERROR
                source.error_message = 'Cloud storage source has no connection config'
                await source.asave(update_fields=['status', 'error_message'])
                return {'error': 'Cloud storage source has no connection config'}
            
            # Route to cloud storage sync workflow
            return await _sync_cloud_storage_source(source)

        # URL-based sources (help_center, marketing_site, website_crawl)
        if not source.url:
            logger.error(f"[KNOWLEDGE] Source has no URL: {source_id}")
            # Reset status since API set it to SYNCING
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = 'Source has no URL configured'
            await source.asave(update_fields=['status', 'error_message'])
            return {'error': 'Source has no URL configured'}

        # Use sync history created by API (for immediate UI visibility) or create one here
        if sync_history_id_from_api:
            sync_history = await KnowledgeSyncHistory.objects.aget(id=sync_history_id_from_api)
            logger.info(f"[KNOWLEDGE] Using sync history {sync_history.id} from API for source: {source.name}")
        else:
            sync_history = await KnowledgeSyncHistory.objects.acreate(
                organization=source.organization,
                source=source,
                sync_type=KnowledgeSyncHistory.SyncType.FULL,
                status=KnowledgeSyncHistory.Status.RUNNING,
                started_at=timezone.now(),
            )
            logger.info(f"[KNOWLEDGE] Created sync history {sync_history.id} for source: {source.name} ({source.url})")

        # Store sync_history_id in crawl_config so async workflow can update it
        crawl_config = source.crawl_config.copy() if source.crawl_config else {}
        crawl_config['sync_history_id'] = str(sync_history.id)
        source.crawl_config = crawl_config
        await source.asave(update_fields=['crawl_config'])

        # Trigger async crawl workflow
        TaskRouter.execute(
            'knowledge-start-async-crawl',
            source_id=str(source_id),
            organization_id=str(source.organization_id),
        )

        elapsed = time.time() - sync_start
        logger.info(
            f"[KNOWLEDGE] Triggered async crawl for source {source_id} "
            f"({source.name}) in {elapsed:.1f}s"
        )

        return {
            'source_id': str(source_id),
            'sync_history_id': str(sync_history.id),
            'status': 'async_crawl_started',
        }

    except KnowledgeSource.DoesNotExist:
        logger.error(f"[KNOWLEDGE] Source not found: {source_id}")
        return {'error': f'Source not found: {source_id}'}

    except Exception as e:
        logger.exception(f"[KNOWLEDGE] Source sync failed for {source_id}: {e}")

        # Update sync history with failure
        if sync_history:
            try:
                sync_history.status = KnowledgeSyncHistory.Status.FAILED
                sync_history.completed_at = timezone.now()
                sync_history.error_message = str(e)
                await sync_history.asave(update_fields=[
                    'status', 'completed_at', 'error_message', 'updated_at'
                ])
            except Exception:
                pass

        # Try to update source status
        try:
            source = await KnowledgeSource.objects.aget(id=source_id)
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = str(e)
            await source.asave(update_fields=['status', 'error_message'])
        except Exception:
            pass

        return {'error': str(e)}


async def _sync_cloud_storage_source(source) -> dict:
    """
    Sync a cloud storage source by fetching files from S3/GCS.

    Pipeline:
    1. Create sync history record
    2. Update source status to SYNCING
    3. Fetch items using CloudStorageProvider
    4. Create/update KnowledgeItems for each file
    5. Trigger indexing workflow for each item
    6. Update sync history and source status

    Args:
        source: KnowledgeSource with source_type=CLOUD_STORAGE

    Returns:
        Dict with sync results
    """
    import hashlib
    from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory, KnowledgeItem
    from apps.knowledge.services.providers.cloud_storage_provider import CloudStorageProvider

    source_id = str(source.id)
    sync_history = None

    try:
        # Create sync history record
        sync_history = await KnowledgeSyncHistory.objects.acreate(
            organization=source.organization,
            source=source,
            sync_type=KnowledgeSyncHistory.SyncType.FULL,
            status=KnowledgeSyncHistory.Status.RUNNING,
            started_at=timezone.now(),
        )

        logger.info(
            f"[CLOUD STORAGE] Starting sync for source {source.name} "
            f"(history: {sync_history.id})"
        )

        # Update source status to syncing
        source.status = KnowledgeSource.Status.SYNCING
        source.error_message = ''
        await source.asave(update_fields=['status', 'error_message'])

        # Fetch items from cloud storage
        provider = CloudStorageProvider()
        raw_items = await provider.fetch_items(source)

        logger.info(f"[CLOUD STORAGE] Fetched {len(raw_items)} items from bucket")

        items_created = 0
        items_updated = 0
        items_skipped = 0
        created_item_ids = []
        seen_external_ids: set[str] = set()

        for raw_item in raw_items:
            try:
                # Generate external_id from the object key (etag)
                external_id = raw_item.external_id or hashlib.md5(
                    raw_item.url.encode()
                ).hexdigest()
                seen_external_ids.add(external_id)

                # Calculate content hash
                content_hash = hashlib.md5(raw_item.raw_content.encode()).hexdigest()

                # Check for existing item
                existing = await KnowledgeItem.objects.filter(
                    source=source,
                    external_id=external_id,
                ).afirst()

                if existing:
                    # Check if content changed AND item is already indexed
                    # If content is same but item failed/pending, re-trigger indexing
                    if existing.content_hash == content_hash:
                        if existing.status == KnowledgeItem.Status.INDEXED:
                            items_skipped += 1
                            continue
                        else:
                            # Content same but not indexed - re-trigger indexing
                            logger.info(
                                f"[CLOUD STORAGE] Re-indexing {existing.title} "
                                f"(status: {existing.status})"
                            )
                            existing.status = KnowledgeItem.Status.PENDING
                            await existing.asave(update_fields=['status'])
                            created_item_ids.append(str(existing.id))
                            items_updated += 1
                            continue

                    # Update existing item
                    existing.title = raw_item.title
                    existing.raw_content = raw_item.raw_content
                    existing.content_hash = content_hash
                    existing.url = raw_item.url
                    existing.status = KnowledgeItem.Status.PENDING
                    existing.metadata = raw_item.metadata or {}
                    existing.metadata['word_count'] = len(raw_item.raw_content.split())
                    existing.metadata['synced_at'] = timezone.now().isoformat()
                    await existing.asave()

                    created_item_ids.append(str(existing.id))
                    items_updated += 1
                else:
                    # Create new item
                    item = await KnowledgeItem.objects.acreate(
                        organization=source.organization,
                        product=source.product,  # Denormalized from source
                        source=source,
                        item_type=KnowledgeItem.ItemType.PAGE,
                        external_id=external_id,
                        url=raw_item.url,
                        title=raw_item.title,
                        raw_content=raw_item.raw_content,
                        content_hash=content_hash,
                        excerpt=raw_item.raw_content[:500] if raw_item.raw_content else '',
                        status=KnowledgeItem.Status.PENDING,
                        is_active=True,
                        metadata={
                            **(raw_item.metadata or {}),
                            'word_count': len(raw_item.raw_content.split()),
                            'synced_at': timezone.now().isoformat(),
                        },
                    )
                    created_item_ids.append(str(item.id))
                    items_created += 1

            except Exception as e:
                logger.error(f"[CLOUD STORAGE] Error processing item {raw_item.title}: {e}")
                continue

        # Delete orphaned items no longer found in the bucket
        items_deleted = 0
        if seen_external_ids:
            orphaned_qs = KnowledgeItem.objects.filter(source=source).exclude(
                external_id__in=seen_external_ids,
            )
            items_deleted = await orphaned_qs.acount()
            if items_deleted:
                await orphaned_qs.adelete()
                logger.info(
                    f"[CLOUD STORAGE] Deleted {items_deleted} orphaned items "
                    f"for source {source_id}"
                )

        # Trigger indexing for all created/updated items
        dispatched_count = 0
        for item_id in created_item_ids:
            TaskRouter.execute('knowledge-index-item', item_id=item_id)
            dispatched_count += 1

        logger.info(
            f"[CLOUD STORAGE] Dispatched {dispatched_count} items for indexing"
        )
        logger.info(
            f"[CLOUD STORAGE] Sync complete: {items_created} created, "
            f"{items_updated} updated, {items_skipped} skipped, "
            f"{items_deleted} deleted"
        )

        # Update sync history
        sync_history.status = KnowledgeSyncHistory.Status.COMPLETED
        sync_history.completed_at = timezone.now()
        sync_history.items_synced = items_created + items_updated
        sync_history.items_created = items_created
        sync_history.items_updated = items_updated
        sync_history.items_deleted = items_deleted
        await sync_history.asave(update_fields=[
            'status', 'completed_at', 'items_synced',
            'items_created', 'items_updated', 'items_deleted',
        ])

        # Update source status
        source.status = KnowledgeSource.Status.ACTIVE
        source.last_synced_at = timezone.now()
        source.error_message = ''
        await source.asave(update_fields=['status', 'last_synced_at', 'error_message'])

        return {
            'source_id': source_id,
            'sync_history_id': str(sync_history.id),
            'status': 'completed',
            'items_created': items_created,
            'items_updated': items_updated,
            'items_skipped': items_skipped,
            'items_deleted': items_deleted,
        }

    except Exception as e:
        logger.exception(f"[CLOUD STORAGE] Sync failed for source {source_id}: {e}")

        # Update sync history with failure
        if sync_history:
            try:
                sync_history.status = KnowledgeSyncHistory.Status.FAILED
                sync_history.completed_at = timezone.now()
                sync_history.error_message = str(e)
                await sync_history.asave(update_fields=[
                    'status', 'completed_at', 'error_message'
                ])
            except Exception:
                pass

        # Update source status
        try:
            source.status = KnowledgeSource.Status.ERROR
            source.error_message = str(e)
            await source.asave(update_fields=['status', 'error_message'])
        except Exception:
            pass

        return {'error': str(e)}
