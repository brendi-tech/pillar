"""
Session Resumption Service

Handles saving and restoring interrupted agent sessions for resumption.
Enables users to continue conversations after page navigation or disconnect.
"""
import logging
from datetime import datetime
from typing import Any, Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


async def save_interrupt_state(
    message_id: str,
    conversation_id: str,
    user_message: str,
    partial_response: str,
    accomplished: list[dict],
    found_actions: list[str],
    registered_actions: list[dict],
    page_url: str = "",
    streaming_started_at: Optional[datetime] = None,
) -> bool:
    """
    Save the interrupted session state to ChatMessage for later resumption.
    
    Called when client disconnects during streaming. Saves enough context
    for the agent to intelligently continue the conversation.
    
    Args:
        message_id: The assistant message ID being streamed
        conversation_id: The conversation ID
        user_message: Original user question/request
        partial_response: Response tokens sent before disconnect
        accomplished: List of actions executed with results
        found_actions: List of action names discovered
        registered_actions: Full action dicts for tool registration
        page_url: Page URL at time of disconnect
        streaming_started_at: When streaming began
        
    Returns:
        True if state was saved successfully
    """
    from apps.analytics.models import ChatMessage
    
    try:
        # Build agent state snapshot
        agent_state_snapshot = {
            "user_message": user_message,
            "partial_response": partial_response,
            "accomplished": accomplished,
            "found_actions": found_actions,
            "registered_actions": registered_actions,
            "current_page_url": page_url,
            "interrupted_at": timezone.now().isoformat(),
        }
        
        # Update the assistant message with interrupt state
        # role guard prevents accidental overwrite of user messages
        updated = await ChatMessage.objects.filter(
            id=message_id,
            role='assistant',
        ).aupdate(
            streaming_status='interrupted',
            agent_state_snapshot=agent_state_snapshot,
            streaming_started_at=streaming_started_at or timezone.now(),
            content=partial_response,  # Save partial content
        )
        
        if updated:
            logger.info(
                f"[SessionResumption] Saved interrupt state for message {message_id[:8]}... "
                f"(accomplished: {len(accomplished)} actions, response: {len(partial_response)} chars)"
            )
            return True
        else:
            logger.warning(f"[SessionResumption] Message {message_id} not found for interrupt save")
            return False
            
    except Exception as e:
        logger.error(f"[SessionResumption] Failed to save interrupt state: {e}", exc_info=True)
        return False


async def mark_streaming_complete(message_id: str, final_content: str = "") -> bool:
    """
    Mark a message as completed (streaming finished successfully).
    
    Args:
        message_id: The assistant message ID
        final_content: The complete response content
        
    Returns:
        True if status was updated
    """
    from apps.analytics.models import ChatMessage
    
    try:
        updates = {"streaming_status": "completed"}
        if final_content:
            updates["content"] = final_content
            
        # role guard prevents accidental overwrite of user messages
        updated = await ChatMessage.objects.filter(
            id=message_id,
            role='assistant',
        ).aupdate(**updates)
        
        if updated:
            logger.debug(f"[SessionResumption] Marked message {message_id[:8]}... as completed")
        return bool(updated)
        
    except Exception as e:
        logger.error(f"[SessionResumption] Failed to mark complete: {e}", exc_info=True)
        return False


async def get_resumable_session(conversation_id: str) -> Optional[dict]:
    """
    Check if a conversation has a resumable interrupted session.
    
    Args:
        conversation_id: The conversation UUID
        
    Returns:
        Dict with resumable session info or None
    """
    from apps.analytics.models import ChatMessage
    
    try:
        message = await ChatMessage.objects.filter(
            conversation_id=conversation_id,
            role='assistant',
            streaming_status='interrupted',
        ).order_by('-timestamp').afirst()
        
        if not message:
            return None
            
        snapshot = message.agent_state_snapshot or {}
        elapsed_ms = 0
        if message.streaming_started_at:
            elapsed_ms = (timezone.now() - message.streaming_started_at).total_seconds() * 1000
        
        return {
            "resumable": True,
            "message_id": str(message.id),
            "conversation_id": str(message.conversation_id),
            "elapsed_ms": elapsed_ms,
            "user_message": snapshot.get("user_message", ""),
            "partial_response": snapshot.get("partial_response", ""),
            "accomplished": snapshot.get("accomplished", []),
            "found_actions": snapshot.get("found_actions", []),
            "registered_actions": snapshot.get("registered_actions", []),
            "summary": build_resume_summary(snapshot),
        }
        
    except Exception as e:
        logger.error(f"[SessionResumption] Failed to get resumable session: {e}", exc_info=True)
        return None


def build_resume_summary(snapshot: dict) -> str:
    """
    Build a human-readable summary of what was accomplished.
    
    Args:
        snapshot: The agent_state_snapshot dict
        
    Returns:
        Summary string for display in resume UI
    """
    accomplished = snapshot.get("accomplished", [])
    partial = snapshot.get("partial_response", "")
    
    parts = []
    
    if accomplished:
        action_names = [a.get("action", "unknown") for a in accomplished]
        parts.append(f"Executed {len(accomplished)} action(s): {', '.join(action_names)}")
    
    if partial:
        parts.append(f"Started response: \"{partial}\"")
    
    if not parts:
        parts.append("Session interrupted before any progress")
    
    return " | ".join(parts)


async def clear_interrupted_status(message_id: str) -> bool:
    """
    Clear the interrupted status (e.g., when user discards or resumes).
    
    Args:
        message_id: The message to clear
        
    Returns:
        True if cleared
    """
    from apps.analytics.models import ChatMessage
    
    try:
        updated = await ChatMessage.objects.filter(id=message_id).aupdate(
            streaming_status='completed',  # Mark as completed to prevent re-resume
        )
        return bool(updated)
    except Exception as e:
        logger.error(f"[SessionResumption] Failed to clear interrupted status: {e}", exc_info=True)
        return False
