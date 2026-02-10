"""Session state helpers -- status transitions and resumable session lookup."""
import logging
from typing import Optional
from django.utils import timezone

logger = logging.getLogger(__name__)


async def mark_completed(message_id: str, latency_ms: int = None):
    """Set streaming_status='completed'. Data already flushed."""
    from apps.analytics.models import ChatMessage
    updates = {"streaming_status": "completed"}
    if latency_ms is not None:
        updates["latency_ms"] = latency_ms
    await ChatMessage.objects.filter(id=message_id, role='assistant').aupdate(**updates)


async def mark_disconnected(message_id: str):
    """Set streaming_status='disconnected'. Data already flushed."""
    from apps.analytics.models import ChatMessage
    await ChatMessage.objects.filter(id=message_id, role='assistant').aupdate(
        streaming_status='disconnected',
    )


async def clear_disconnected_status(message_id: str):
    """Clear disconnected status when user resumes or discards."""
    from apps.analytics.models import ChatMessage
    await ChatMessage.objects.filter(id=message_id).aupdate(streaming_status='completed')


async def get_resumable_session(conversation_id: str) -> Optional[dict]:
    """Check for a disconnected session that can be resumed."""
    from apps.analytics.models import ChatMessage

    message = await ChatMessage.objects.filter(
        conversation_id=conversation_id,
        role='assistant',
        streaming_status='disconnected',
    ).order_by('-timestamp').afirst()

    if not message:
        return None

    user_msg = await ChatMessage.objects.filter(
        conversation_id=conversation_id,
        role='user',
    ).order_by('-timestamp').afirst()

    elapsed_ms = 0
    if message.streaming_started_at:
        elapsed_ms = (timezone.now() - message.streaming_started_at).total_seconds() * 1000

    llm_data = message.llm_message or {}
    return {
        "resumable": True,
        "message_id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "elapsed_ms": elapsed_ms,
        "user_message": user_msg.content if user_msg else "",
        "partial_response": message.content,
        "display_trace": message.display_trace or [],
        "llm_messages": llm_data.get("messages", []) if isinstance(llm_data, dict) else llm_data if isinstance(llm_data, list) else [],
        "registered_actions": llm_data.get("registered_actions", []) if isinstance(llm_data, dict) else [],
    }
