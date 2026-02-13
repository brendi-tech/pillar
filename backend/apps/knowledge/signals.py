"""
Django signals for the Knowledge app.

Handles WebSocket notifications for:
- Knowledge item creation
- Source sync completion
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.knowledge.models import KnowledgeItem, KnowledgeSource
from common.services import push

logger = logging.getLogger(__name__)


@receiver(post_save, sender=KnowledgeItem)
def notify_knowledge_item_created(sender, instance, created, **kwargs):
    """Send WebSocket notification when a KnowledgeItem is created."""
    if not created:
        return  # Only notify on creation, not updates

    # Need product_id for the WebSocket channel
    if not instance.product_id:
        logger.debug(f"Skipping WebSocket notification for item {instance.id}: no product_id")
        return

    try:
        # Include full item data so frontend can add to cache without refetching
        push.send(
            help_center_config_id=str(instance.product_id),
            event_type='knowledge_item.created',
            data={
                # Core fields
                'id': str(instance.id),
                'source': str(instance.source_id) if instance.source_id else None,
                'source_name': instance.source.name if instance.source else '',
                'item_type': instance.item_type,
                'url': instance.url or '',
                'external_id': instance.external_id or '',
                'title': instance.title or '',
                'excerpt': instance.excerpt or '',
                'status': instance.status,
                'status_display': instance.get_status_display(),
                'is_active': instance.is_active,
                'has_optimized_content': bool(instance.optimized_content),
                'chunk_count': 0,  # New items have no chunks yet
                'created_at': instance.created_at.isoformat() if instance.created_at else None,
                'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
            }
        )
    except Exception as e:
        # Don't let push failures break item creation
        logger.error(f"Failed to send WebSocket notification for item {instance.id}: {e}")


# Track previous status for detecting sync completion
_source_previous_status = {}


@receiver(pre_save, sender=KnowledgeSource)
def track_source_status_change(sender, instance, **kwargs):
    """Track the previous status before save to detect sync completion."""
    if instance.pk:
        try:
            old_instance = KnowledgeSource.objects.get(pk=instance.pk)
            _source_previous_status[instance.pk] = old_instance.status
        except KnowledgeSource.DoesNotExist:
            pass


@receiver(post_save, sender=KnowledgeSource)
def notify_source_sync_completed(sender, instance, created, **kwargs):
    """Send WebSocket notification when a source sync completes."""
    if created:
        return  # Not interested in new source creation

    # Check if status changed from SYNCING to ACTIVE (sync completed)
    previous_status = _source_previous_status.pop(instance.pk, None)
    
    if previous_status == KnowledgeSource.Status.SYNCING and instance.status == KnowledgeSource.Status.ACTIVE:
        if not instance.product_id:
            logger.debug(f"Skipping sync completed notification for source {instance.id}: no product_id")
            return

        try:
            push.send(
                help_center_config_id=str(instance.product_id),
                event_type='source.sync_completed',
                data={
                    'source_id': str(instance.id),
                    'source_name': instance.name,
                    'item_count': instance.item_count,
                    'last_synced_at': instance.last_synced_at.isoformat() if instance.last_synced_at else None,
                }
            )
            logger.info(f"Sent sync completed notification for source {instance.id}")
        except Exception as e:
            logger.error(f"Failed to send sync completed notification for source {instance.id}: {e}")
    
    # Also notify if sync failed
    elif previous_status == KnowledgeSource.Status.SYNCING and instance.status == KnowledgeSource.Status.ERROR:
        if not instance.product_id:
            return

        try:
            push.send(
                help_center_config_id=str(instance.product_id),
                event_type='source.sync_failed',
                data={
                    'source_id': str(instance.id),
                    'source_name': instance.name,
                    'error_message': instance.error_message or 'Unknown error',
                }
            )
            logger.info(f"Sent sync failed notification for source {instance.id}")
        except Exception as e:
            logger.error(f"Failed to send sync failed notification for source {instance.id}: {e}")
