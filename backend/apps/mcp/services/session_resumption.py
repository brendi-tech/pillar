"""Session state helpers -- status transitions, resumable session lookup, and
turn persistence for non-streaming channels (Slack, Discord)."""
import logging
import uuid
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


def _extract_session_data(message, user_msg, elapsed_ms: float) -> dict:
    """Build session metadata from a ChatMessage (excludes conversation history)."""
    return {
        "resumable": True,
        "message_id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "elapsed_ms": elapsed_ms,
        "user_message": user_msg.content if user_msg else "",
        "partial_response": message.content,
        "display_trace": message.display_trace or [],
    }


async def mark_completed(message_id: str, latency_ms: int = None):
    """Set streaming_status='completed'. Data already flushed."""
    from apps.analytics.models import ChatMessage
    from apps.billing.metering import report_usage

    updates = {"streaming_status": "completed"}
    if latency_ms is not None:
        updates["latency_ms"] = latency_ms
    await ChatMessage.objects.filter(id=message_id, role='assistant').aupdate(**updates)

    try:
        await report_usage(message_id)
    except Exception:
        logger.exception("Failed to report billing usage for message %s", message_id)


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

    result = _extract_session_data(message, user_msg, elapsed_ms)
    history = await load_conversation_history(conversation_id)
    result["llm_messages"] = history["messages"]
    result["registered_tools"] = history["registered_tools"]
    return result


async def load_conversation_history(conversation_id: str | None) -> dict:
    """Reconstruct the full LLM conversation state for a conversation.

    Each ``ChatMessage`` stores only its *turn's* messages in ``llm_message``
    (the agentic loop slices from ``turn_start_idx``).  To get the complete
    history we iterate every row in chronological order and stitch them
    together.

    Also collects ``registered_tools`` from the most recent assistant
    message so callers can restore tool state.

    Returns::

        {"messages": [...], "registered_tools": [...]}

    Returns empty lists when *conversation_id* is ``None`` or no rows exist.
    """
    if not conversation_id:
        return {"messages": [], "registered_tools": []}

    from apps.analytics.models import ChatMessage

    messages: list[dict] = []
    registered_tools: list[dict] = []

    try:
        async for msg in (
            ChatMessage.objects
            .filter(conversation_id=conversation_id)
            .order_by('timestamp')
        ):
            if msg.role == ChatMessage.Role.USER:
                messages.append({"role": "user", "content": msg.content})
            elif msg.role == ChatMessage.Role.ASSISTANT:
                llm_data = msg.llm_message or {}
                if isinstance(llm_data, dict) and "messages" in llm_data:
                    messages.extend(llm_data["messages"])
                    registered_tools = llm_data.get(
                        "registered_tools",
                        llm_data.get("registered_actions", []),
                    )
                elif isinstance(llm_data, list) and llm_data:
                    messages.extend(llm_data)
                else:
                    if msg.content:
                        messages.append({"role": "assistant", "content": msg.content})
    except Exception as e:
        logger.warning("Failed to load conversation history: %s", e)
        return {"messages": [], "registered_tools": []}

    if messages:
        logger.info(
            "[ConversationHistory] Loaded %d messages, %d tools for conversation %s",
            len(messages), len(registered_tools), conversation_id,
        )

    return {"messages": messages, "registered_tools": registered_tools}


async def create_turn_messages(
    conversation_id: str,
    organization_id: str,
    product_id: str,
    user_text: str,
    channel: str = '',
) -> str:
    """Create user + assistant ChatMessage rows for a single conversation turn.

    The assistant row is created with ``streaming_status='streaming'`` and
    empty content.  The caller is responsible for calling :func:`finalize_turn`
    once the agentic loop completes.

    Returns the ``assistant_message_id`` (str UUID).
    """
    from apps.analytics.models import ChatMessage

    user_msg_id = str(uuid.uuid4())
    assistant_msg_id = str(uuid.uuid4())

    await ChatMessage.objects.acreate(
        id=user_msg_id,
        organization_id=organization_id,
        product_id=product_id,
        conversation_id=conversation_id,
        role=ChatMessage.Role.USER,
        content=user_text,
    )
    await ChatMessage.objects.acreate(
        id=assistant_msg_id,
        organization_id=organization_id,
        product_id=product_id,
        conversation_id=conversation_id,
        role=ChatMessage.Role.ASSISTANT,
        content='',
        streaming_status=ChatMessage.StreamingStatus.STREAMING,
    )

    logger.info(
        "[TurnPersistence] Created user=%s + assistant=%s for conversation=%s",
        user_msg_id, assistant_msg_id, conversation_id,
    )
    return assistant_msg_id


async def finalize_turn(
    assistant_message_id: str,
    response_text: str,
    llm_messages: list,
    registered_tools: list,
    model_used: str = '',
) -> None:
    """Persist the final agentic loop state to the assistant ChatMessage row."""
    from apps.analytics.models import ChatMessage

    llm_message = {
        "messages": llm_messages,
        "registered_tools": registered_tools,
    }
    updates = {
        "content": response_text,
        "llm_message": llm_message,
        "streaming_status": "completed",
    }
    if model_used:
        updates["model_used"] = model_used

    await ChatMessage.objects.filter(
        id=assistant_message_id, role='assistant',
    ).aupdate(**updates)

    logger.info(
        "[TurnPersistence] Finalized assistant=%s (%d llm msgs, %d tools)",
        assistant_message_id, len(llm_messages), len(registered_tools),
    )


async def get_latest_session(conversation_id: str) -> Optional[dict]:
    """Load full conversation state for recovery/resumption paths.

    Thin wrapper around :func:`load_conversation_history` that returns
    the shape expected by the Slack confirmation-recovery handler.
    """
    result = await load_conversation_history(conversation_id)
    if not result["messages"]:
        return None
    return {
        "llm_messages": result["messages"],
        "registered_tools": result["registered_tools"],
        "conversation_id": conversation_id,
    }
