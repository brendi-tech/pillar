"""
Push service for sending real-time WebSocket events to connected clients.

This module provides a simple API for pushing events to WebSocket clients
connected to specific help centers. It can be called from anywhere
in the application: views, Celery tasks, signals, etc.

Usage:
    from common.services import push
    
    # Push an event to all clients connected to a help center
    push.send(
        help_center_config_id=str(help_center_config.id),
        event_type='page.created',
        data={'page_id': str(page.id), 'title': page.title}
    )

Event Types (suggested conventions):
    - Model CRUD: 'model.created', 'model.updated', 'model.deleted'
      Examples: 'page.created', 'site.updated', 'competitor.deleted'
    
    - Business events: 'task.event'
      Examples: 'crawl.started', 'crawl.completed', 'crawl.failed',
                'analysis.completed', 'optimization.ready'
    
    - Progress updates: 'task.progress'
      Examples: 'crawl.progress', 'indexing.progress'
"""
import asyncio
import logging
from typing import Any, Dict, Optional
from uuid import UUID

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def _serialize_for_msgpack(obj: Any) -> Any:
    """
    Recursively convert objects to msgpack-serializable types.
    
    Converts UUIDs to strings and recursively processes dicts and lists.
    This ensures all data can be serialized by msgpack for Redis.
    
    Args:
        obj: The object to serialize
        
    Returns:
        The serialized object with all UUIDs converted to strings
    """
    if isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: _serialize_for_msgpack(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [_serialize_for_msgpack(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(_serialize_for_msgpack(item) for item in obj)
    else:
        return obj


def _call_async_from_sync(async_func, *args, **kwargs):
    """
    Safely call an async function from a sync context.
    
    Handles two cases:
    1. Event loop exists (Celery): Schedule task and don't wait (fire-and-forget)
    2. No event loop (Django): Use async_to_sync to execute immediately
    
    Args:
        async_func: The async function to call
        *args: Positional arguments to pass to the function
        **kwargs: Keyword arguments to pass to the function
        
    Returns:
        The result of the async function (only in Django context)
    """
    try:
        loop = asyncio.get_running_loop()
        # We're in an event loop (Celery) - fire and forget
        logger.info("Detected running event loop, scheduling task fire-and-forget")
        asyncio.create_task(async_func(*args, **kwargs))
    except RuntimeError:
        # No running event loop (Django) - use async_to_sync
        logger.info("No running event loop detected, using async_to_sync")
        return async_to_sync(async_func)(*args, **kwargs)


def send(help_center_config_id: str, event_type: str, data: Dict[str, Any], *, user_id: Optional[str] = None):
    """
    Push an event to all WebSocket clients connected to a help center.
    
    This function sends a real-time event to all users connected to the
    specified help center's WebSocket channel. The event is delivered immediately
    to all active connections.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID (string format)
        event_type: Event type identifier (e.g., 'page.created', 'crawl.completed')
        data: Event payload dictionary (will be JSON serialized)
        user_id: Optional user ID if event is user-specific (for future filtering)
    
    Example:
        >>> from common.services import push
        >>> push.send(
        ...     help_center_config_id='123e4567-e89b-12d3-a456-426614174000',
        ...     event_type='page.updated',
        ...     data={'page_id': 'abc-123', 'title': 'New Title', 'status': 'published'}
        ... )
    
    Note:
        - This function is synchronous and can be called from anywhere
        - If no clients are connected, the event is silently discarded
        - The channel layer uses Redis pub/sub for message delivery
        - Events are not persisted - only delivered to active connections
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning(
                f"Channel layer not configured. Unable to send event {event_type} to help center {help_center_config_id}"
            )
            return
        
        # Send to all clients in the help center's group
        group_name = f'hc_{help_center_config_id}'
        
        # Serialize data to ensure all UUIDs and other non-msgpack types are converted
        serialized_data = _serialize_for_msgpack(data)
        
        # Use our helper to safely call the async function
        # This handles both regular sync contexts and gevent/async contexts
        _call_async_from_sync(
            channel_layer.group_send,
            group_name,
            {
                'type': 'push_event',  # This maps to the consumer's push_event method
                'event_type': event_type,
                'data': serialized_data,
            }
        )
        
        logger.info(f"Pushed event '{event_type}' to help center {help_center_config_id}")
        
    except Exception as e:
        # Log error but don't raise - push failures shouldn't break the app
        logger.error(
            f"Failed to push event '{event_type}' to help center {help_center_config_id}: {e}",
            exc_info=True
        )


def send_to_user(user_id: str, event_type: str, data: Dict[str, Any]):
    """
    Push an event to a specific user across all their connections.
    
    Note: This is a placeholder for future user-specific events.
    Currently, events are help center-scoped only. To implement user-specific
    events, you would need to create user-specific channel groups.
    
    Args:
        user_id: User UUID (string format)
        event_type: Event type identifier
        data: Event payload dictionary
    """
    # TODO: Implement user-specific channels if needed
    logger.warning("send_to_user is not yet implemented. Use send() with help_center_config_id instead.")


# Convenience functions for common event types

def notify_model_created(help_center_config_id: str, model_name: str, instance_id: str, data: Optional[Dict] = None):
    """
    Notify that a model instance was created.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        model_name: Model name (e.g., 'page', 'article')
        instance_id: Created instance ID
        data: Optional additional data
    """
    payload = {'id': instance_id}
    if data:
        payload.update(data)
    
    send(help_center_config_id, f'{model_name}.created', payload)


def notify_model_updated(help_center_config_id: str, model_name: str, instance_id: str, data: Optional[Dict] = None):
    """
    Notify that a model instance was updated.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        model_name: Model name (e.g., 'page', 'article')
        instance_id: Updated instance ID
        data: Optional additional data (e.g., changed fields)
    """
    payload = {'id': instance_id}
    if data:
        payload.update(data)
    
    send(help_center_config_id, f'{model_name}.updated', payload)


def notify_model_deleted(help_center_config_id: str, model_name: str, instance_id: str):
    """
    Notify that a model instance was deleted.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        model_name: Model name (e.g., 'page', 'article')
        instance_id: Deleted instance ID
    """
    send(help_center_config_id, f'{model_name}.deleted', {'id': instance_id})


def notify_task_progress(help_center_config_id: str, task_name: str, progress: int, total: int, message: str = ''):
    """
    Notify about task progress.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        task_name: Task name (e.g., 'crawl', 'indexing')
        progress: Current progress count
        total: Total items to process
        message: Optional progress message
    """
    send(
        help_center_config_id,
        f'{task_name}.progress',
        {
            'progress': progress,
            'total': total,
            'percentage': int((progress / total) * 100) if total > 0 else 0,
            'message': message,
        }
    )


def notify_task_completed(help_center_config_id: str, task_name: str, result: Optional[Dict] = None):
    """
    Notify that a task completed successfully.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        task_name: Task name (e.g., 'crawl', 'analysis')
        result: Optional result data
    """
    payload = {'status': 'completed'}
    if result:
        payload.update(result)
    
    send(help_center_config_id, f'{task_name}.completed', payload)


def notify_task_failed(help_center_config_id: str, task_name: str, error: str):
    """
    Notify that a task failed.
    
    Args:
        help_center_config_id: HelpCenterConfig UUID
        task_name: Task name (e.g., 'crawl', 'analysis')
        error: Error message
    """
    send(
        help_center_config_id,
        f'{task_name}.failed',
        {'status': 'failed', 'error': error}
    )

