"""
Post-message pipeline - fire-and-forget background tasks after message logging.

All tasks run asynchronously via Hatchet and do NOT block the response.
Add new post-message tasks by adding them to PIPELINE_TASKS.
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Callable, List

logger = logging.getLogger(__name__)


@dataclass
class PostMessageContext:
    """Context passed to all pipeline tasks."""
    conversation_id: str
    message_id: str
    organization_id: str
    is_assistant_message: bool
    logging_enabled: bool
    # Product-level scoping
    product_id: str = ''
    # Assistant message data (for async creation)
    response: str = ''
    response_time_ms: int = 0
    chunks_retrieved: list = None
    model_used: str = ''
    display_trace: list = None
    # Token usage tracking (from agentic loop token_summary)
    prompt_tokens: int = None
    completion_tokens: int = None
    total_tokens: int = None
    peak_context_occupancy: float = None
    
    def __post_init__(self):
        if self.chunks_retrieved is None:
            self.chunks_retrieved = []
        if self.display_trace is None:
            self.display_trace = []


# Registry of pipeline tasks
PIPELINE_TASKS: List[Callable] = []


def register_task(fn: Callable):
    """Decorator to register a post-message task."""
    PIPELINE_TASKS.append(fn)
    return fn


@register_task
async def finalize_assistant_message(ctx: PostMessageContext):
    """Finalize pre-created assistant message with metadata after streaming completes."""
    if not ctx.is_assistant_message:
        return
    
    if not ctx.response:
        logger.warning(f"[PostMessagePipeline] No response to log for conversation {ctx.conversation_id}")
        return
    
    from apps.analytics.services import ConversationLoggingService
    
    try:
        await ConversationLoggingService().log_assistant_response(
            conversation_id=ctx.conversation_id,
            organization_id=ctx.organization_id,
            product_id=ctx.product_id,
            response=ctx.response,
            response_time_ms=ctx.response_time_ms,
            chunks_retrieved=ctx.chunks_retrieved,
            model_used=ctx.model_used,
            message_id=ctx.message_id,
            display_trace=ctx.display_trace,
            prompt_tokens=ctx.prompt_tokens,
            completion_tokens=ctx.completion_tokens,
            total_tokens=ctx.total_tokens,
            peak_context_occupancy=ctx.peak_context_occupancy,
        )
        logger.debug(f"[PostMessagePipeline] Finalized assistant message {ctx.message_id} for conversation {ctx.conversation_id}")
    except Exception as e:
        logger.error(f"[PostMessagePipeline] Failed to finalize assistant message: {e}", exc_info=True)


class PostMessagePipeline:
    """
    Fire-and-forget pipeline for post-message background tasks.
    
    Usage:
        await PostMessagePipeline.execute(PostMessageContext(...))
    
    Tasks run in parallel and failures are logged but don't propagate.
    """
    
    @classmethod
    async def execute(cls, ctx: PostMessageContext):
        """
        Execute all registered pipeline tasks.
        
        Non-blocking: spawns tasks and returns immediately.
        """
        async def run_task(task_fn: Callable):
            try:
                await task_fn(ctx)
            except Exception as e:
                logger.warning(
                    f"[PostMessagePipeline] Task {task_fn.__name__} failed: {e}",
                    exc_info=True
                )
        
        # Fire all tasks in parallel, don't wait for completion
        for task_fn in PIPELINE_TASKS:
            asyncio.create_task(run_task(task_fn))
        
        logger.debug(
            f"[PostMessagePipeline] Dispatched {len(PIPELINE_TASKS)} tasks "
            f"for conversation {ctx.conversation_id}"
        )
