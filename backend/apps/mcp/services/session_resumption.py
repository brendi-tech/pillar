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
    """Check for a disconnected or still-streaming session that can be resumed.

    If the client is asking about status via a *new* HTTP request while the
    message is still ``streaming``, the client must have disconnected (no
    client polls status for a conversation it is still receiving).  In that
    case we treat it as disconnected and mark it accordingly.
    """
    from apps.analytics.models import ChatMessage

    # First, look for an explicitly disconnected message
    message = await ChatMessage.objects.filter(
        conversation_id=conversation_id,
        role='assistant',
        streaming_status='disconnected',
    ).order_by('-timestamp').afirst()

    # If no disconnected message, check for a still-streaming message.
    # A client asking about status via a new request means it disconnected
    # from the original stream (race condition: backend hasn't detected the
    # disconnect yet because it's still waiting on an LLM/tool call).
    if not message:
        streaming_msg = await ChatMessage.objects.filter(
            conversation_id=conversation_id,
            role='assistant',
            streaming_status='streaming',
        ).order_by('-timestamp').afirst()

        if streaming_msg:
            # Mark it as disconnected so subsequent checks are consistent
            await mark_disconnected(str(streaming_msg.id))
            message = streaming_msg

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
