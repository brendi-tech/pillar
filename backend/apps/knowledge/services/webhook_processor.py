"""
Webhook processor for Firecrawl webhook events.

Handles real-time notifications from Firecrawl when crawl events occur
for KnowledgeSource syncs.
"""
import hashlib
import logging
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

from django.utils import timezone
from django.db import transaction

from common.task_router import TaskRouter
from apps.knowledge.utils.page_filter import should_skip_page

logger = logging.getLogger(__name__)


class WebhookProcessorError(Exception):
    """Custom exception for webhook processing errors"""
    pass


class KnowledgeWebhookProcessor:
    """
    Service class for processing Firecrawl webhook events for Knowledge sources.
    
    Handles different event types:
    - started: Crawl has started
    - page: Individual page has been crawled (streaming)
    - completed: Crawl has completed successfully
    - failed: Crawl has failed
    """
    
    def process_event(
        self,
        event_type: str,
        event_data: Union[Dict[str, Any], List[Any], None],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a webhook event based on its type.
        
        Args:
            event_type: Type of event (started, page, completed, failed)
            event_data: Event payload data from Firecrawl
            metadata: Optional metadata (crawl_uuid, source_uuid)
            
        Returns:
            Dict containing processing result
            
        Raises:
            WebhookProcessorError: If processing fails
        """
        logger.info(f"Processing webhook event: {event_type}")
        # Handle both dict and list event data (Firecrawl sends list for page events)
        if isinstance(event_data, dict):
            logger.debug(f"Event data keys: {event_data.keys()}")
        elif isinstance(event_data, list):
            logger.debug(f"Event data is a list with {len(event_data)} items")
        else:
            logger.debug(f"Event data: {type(event_data)}")
        logger.debug(f"Metadata: {metadata}")
        
        # Extract source UUID from metadata
        # We use crawl_uuid which is set to the source_id when starting the crawl
        if not metadata:
            raise WebhookProcessorError("Missing metadata in webhook")
        
        source_uuid = metadata.get('crawl_uuid') or metadata.get('source_uuid')
        if not source_uuid:
            raise WebhookProcessorError("Missing source identifier in webhook metadata")
        
        # Route to appropriate handler
        if event_type == 'started':
            return self._process_started_event(source_uuid, event_data, metadata)
        elif event_type == 'page':
            return self._process_page_event(source_uuid, event_data, metadata)
        elif event_type == 'completed':
            return self._process_completed_event(source_uuid, event_data, metadata)
        elif event_type == 'failed':
            return self._process_failed_event(source_uuid, event_data, metadata)
        else:
            logger.warning(f"Unknown webhook event type: {event_type}")
            return {'status': 'ignored', 'reason': 'unknown_event_type'}
    
    def _process_started_event(
        self,
        source_uuid: str,
        event_data: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a 'started' webhook event.
        
        Updates source status to SYNCING.
        """
        from apps.knowledge.models import KnowledgeSource
        
        try:
            source = KnowledgeSource.objects.get(id=source_uuid)
            
            with transaction.atomic():
                source.status = KnowledgeSource.Status.SYNCING
                source.error_message = ''
                source.save(update_fields=['status', 'error_message'])
            
            logger.info(f"Knowledge source {source_uuid} crawl started via webhook")
            
            return {'status': 'success', 'source_id': str(source.id)}
            
        except KnowledgeSource.DoesNotExist:
            logger.error(f"KnowledgeSource not found: {source_uuid}")
            raise WebhookProcessorError(f"KnowledgeSource not found: {source_uuid}")
        except Exception as e:
            logger.error(f"Failed to process started event: {e}", exc_info=True)
            raise WebhookProcessorError(f"Failed to process started event: {str(e)}")
    
    def _process_page_event(
        self,
        source_uuid: str,
        event_data: Any,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a 'page' webhook event.
        
        Creates/updates KnowledgeItem as pages arrive (streaming).
        
        Firecrawl can send page data in two formats:
        - List format: [{"url": "...", "markdown": "...", ...}]
        - Dict format: {"url": "...", "markdown": "...", ...}
        """
        from apps.knowledge.models import KnowledgeSource, KnowledgeItem
        
        try:
            source = KnowledgeSource.objects.select_related('organization').get(id=source_uuid)
        except KnowledgeSource.DoesNotExist:
            logger.error(f"KnowledgeSource not found: {source_uuid}")
            raise WebhookProcessorError(f"KnowledgeSource not found: {source_uuid}")
        
        # Normalize to list
        if isinstance(event_data, dict):
            pages = [event_data]
        elif isinstance(event_data, list):
            pages = event_data
        else:
            logger.warning(f"Unexpected event_data type: {type(event_data)}")
            return {'status': 'ignored', 'reason': 'invalid_data_format'}
        
        pages_created = 0
        pages_updated = 0
        pages_skipped = 0
        
        for page_data in pages:
            try:
                result = self._process_single_page(source, page_data)
                if result == 'created':
                    pages_created += 1
                elif result == 'updated':
                    pages_updated += 1
                elif result == 'skipped':
                    pages_skipped += 1
            except Exception as e:
                logger.error(f"Error processing page: {e}")
                pages_skipped += 1
        
        logger.info(
            f"Processed {len(pages)} pages for source {source_uuid}: "
            f"{pages_created} created, {pages_updated} updated, {pages_skipped} skipped"
        )
        
        # Accumulate counts on the sync history record
        if pages_created or pages_updated:
            crawl_config = source.crawl_config or {}
            sync_history_id = crawl_config.get('sync_history_id')
            if sync_history_id:
                self._increment_sync_history_counts(
                    sync_history_id, pages_created, pages_updated
                )
        
        return {
            'status': 'success',
            'pages_created': pages_created,
            'pages_updated': pages_updated,
            'pages_skipped': pages_skipped,
        }
    
    def _process_single_page(self, source, page_data: dict) -> str:
        """
        Process a single crawled page into a KnowledgeItem.
        
        Returns: 'created', 'updated', or 'skipped'
        """
        from apps.knowledge.models import KnowledgeItem
        
        # Extract URL
        url = page_data.get('url')
        if not url:
            page_metadata = page_data.get('metadata', {})
            url = page_metadata.get('url') or page_metadata.get('sourceURL')
        
        if not url:
            logger.info("[KNOWLEDGE WEBHOOK] Skipping page: no URL in page data")
            return 'skipped'
        
        # Check for error pages (404s, 500s, soft 404s)
        skip, reason = should_skip_page(page_data, url)
        if skip:
            logger.info(f"[KNOWLEDGE WEBHOOK] Skipping page {url}: {reason}")
            return 'skipped'
        
        # Check for minimal content
        markdown = page_data.get('markdown', '')
        if len(markdown) < 100:
            logger.info(
                f"[KNOWLEDGE WEBHOOK] Skipping page {url}: "
                f"content too short ({len(markdown)} chars)"
            )
            return 'skipped'
        
        # Log domain mismatches but don't skip — Firecrawl's allow_subdomains
        # and allow_external_links settings handle domain filtering at crawl time.
        source_host = urlparse(source.url).netloc.lower()
        url_host = urlparse(url).netloc.lower()
        if url_host != source_host:
            logger.warning(
                f"[KNOWLEDGE WEBHOOK] Domain mismatch for {url}: "
                f"page={url_host}, source={source_host} (processing anyway)"
            )
        
        # Extract metadata
        page_metadata = page_data.get('metadata', {})
        title = (page_metadata.get('title') or url)[:500]
        description = page_metadata.get('description', '') or ''
        
        # Generate external ID
        external_id = KnowledgeItem.generate_external_id(url)
        content_hash = hashlib.md5(markdown.encode()).hexdigest()
        
        # Check for existing item
        try:
            existing = KnowledgeItem.objects.get(
                source=source,
                external_id=external_id,
            )
            
            # Skip only if content unchanged AND already successfully indexed
            if existing.content_hash == content_hash and existing.status == KnowledgeItem.Status.INDEXED:
                return 'skipped'
            
            # Update existing
            existing.title = title
            existing.raw_content = markdown
            existing.content_hash = content_hash
            existing.excerpt = description[:500]
            existing.status = KnowledgeItem.Status.PENDING
            existing.metadata = {
                'word_count': len(markdown.split()),
                'scraped_at': timezone.now().isoformat(),
            }
            existing.save()
            
            # Trigger processing workflow
            self._spawn_item_processing(existing)
            
            return 'updated'
            
        except KnowledgeItem.DoesNotExist:
            # Create new item
            item = KnowledgeItem.objects.create(
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
            
            # Trigger processing workflow
            self._spawn_item_processing(item)
            
            return 'created'
    
    def _increment_sync_history_counts(
        self,
        sync_history_id: str,
        pages_created: int,
        pages_updated: int,
    ) -> None:
        """
        Atomically increment sync history counts as page events stream in.

        Uses F() expressions so concurrent page webhooks don't clobber each other.
        """
        from django.db.models import F
        from apps.knowledge.models import KnowledgeSyncHistory

        try:
            KnowledgeSyncHistory.objects.filter(id=sync_history_id).update(
                items_created=F('items_created') + pages_created,
                items_updated=F('items_updated') + pages_updated,
                items_synced=F('items_synced') + pages_created + pages_updated,
            )
        except Exception as e:
            logger.error(f"Failed to update sync history counts: {e}")

    def _spawn_item_processing(self, item) -> None:
        """Spawn a processing workflow for a knowledge item."""
        try:
            TaskRouter.execute(
                'knowledge-process-item',
                item_id=str(item.id),
                organization_id=str(item.organization_id),
            )
        except Exception as e:
            logger.error(f"Failed to spawn processing for item {item.id}: {e}")
    
    def _process_completed_event(
        self,
        source_uuid: str,
        event_data: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a 'completed' webhook event.
        
        Updates source status and sync history to completed.
        """
        from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory
        
        try:
            source = KnowledgeSource.objects.get(id=source_uuid)
            
            with transaction.atomic():
                # Update source status
                source.status = KnowledgeSource.Status.ACTIVE
                source.last_synced_at = timezone.now()
                source.error_message = ''
                source.save(update_fields=['status', 'last_synced_at', 'error_message'])
                
                # Update sync history if available
                crawl_config = source.crawl_config or {}
                sync_history_id = crawl_config.get('sync_history_id')
                
                if sync_history_id:
                    try:
                        sync_history = KnowledgeSyncHistory.objects.get(id=sync_history_id)
                        sync_history.status = KnowledgeSyncHistory.Status.COMPLETED
                        sync_history.completed_at = timezone.now()
                        sync_history.save(update_fields=[
                            'status', 'completed_at', 'updated_at'
                        ])
                        logger.info(
                            f"Updated sync history {sync_history_id} to COMPLETED "
                            f"({sync_history.items_created} created, "
                            f"{sync_history.items_updated} updated)"
                        )
                    except KnowledgeSyncHistory.DoesNotExist:
                        logger.warning(f"Sync history {sync_history_id} not found")
            
            logger.info(f"Knowledge source {source_uuid} crawl completed via webhook")
            
            return {'status': 'success', 'source_id': str(source.id)}
            
        except KnowledgeSource.DoesNotExist:
            logger.error(f"KnowledgeSource not found: {source_uuid}")
            raise WebhookProcessorError(f"KnowledgeSource not found: {source_uuid}")
        except Exception as e:
            logger.error(f"Failed to process completed event: {e}", exc_info=True)
            raise WebhookProcessorError(f"Failed to process completed event: {str(e)}")
    
    def _process_failed_event(
        self,
        source_uuid: str,
        event_data: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a 'failed' webhook event.
        
        Updates source status and sync history to failed.
        """
        from apps.knowledge.models import KnowledgeSource, KnowledgeSyncHistory
        
        error_message = event_data.get('error', 'Firecrawl job failed')
        if isinstance(error_message, dict):
            error_message = error_message.get('message', str(error_message))
        
        try:
            source = KnowledgeSource.objects.get(id=source_uuid)
            
            with transaction.atomic():
                # Update source status
                source.status = KnowledgeSource.Status.ERROR
                source.error_message = str(error_message)[:500]
                source.save(update_fields=['status', 'error_message'])
                
                # Update sync history if available
                crawl_config = source.crawl_config or {}
                sync_history_id = crawl_config.get('sync_history_id')
                
                if sync_history_id:
                    try:
                        sync_history = KnowledgeSyncHistory.objects.get(id=sync_history_id)
                        sync_history.status = KnowledgeSyncHistory.Status.FAILED
                        sync_history.completed_at = timezone.now()
                        sync_history.error_message = str(error_message)[:500]
                        sync_history.save(update_fields=[
                            'status', 'completed_at', 'error_message', 'updated_at'
                        ])
                        logger.info(f"Updated sync history {sync_history_id} to FAILED")
                    except KnowledgeSyncHistory.DoesNotExist:
                        logger.warning(f"Sync history {sync_history_id} not found")
            
            logger.info(f"Knowledge source {source_uuid} crawl failed via webhook: {error_message}")
            
            return {'status': 'success', 'source_id': str(source.id), 'error': error_message}
            
        except KnowledgeSource.DoesNotExist:
            logger.error(f"KnowledgeSource not found: {source_uuid}")
            raise WebhookProcessorError(f"KnowledgeSource not found: {source_uuid}")
        except Exception as e:
            logger.error(f"Failed to process failed event: {e}", exc_info=True)
            raise WebhookProcessorError(f"Failed to process failed event: {str(e)}")


# Singleton instance for easy importing
webhook_processor = KnowledgeWebhookProcessor()
