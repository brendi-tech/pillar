"""
Helper methods for the agent answer service.

Contains utility functions for context management, action lookups,
and query result waiting.

NOTE: Message generation functions have been moved to:
    apps.mcp.services.agent.messages

For smart default actions when LLM calls fail, use:
    apps.mcp.services.agent.recovery

For resilient LLM calls with retry logic, use:
    common.utils.llm_resilience
"""
import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ============================================================================
# Query Result Registry
# Uses Redis pub/sub for cross-worker signaling with in-memory fallback.
# ============================================================================

# In-memory registry (fallback when Redis unavailable)
# session_id -> {action_name: asyncio.Event}
_pending_queries: Dict[str, Dict[str, asyncio.Event]] = {}

# session_id -> {action_name: result_data}
_query_results: Dict[str, Dict[str, Any]] = {}

# Cleanup threshold: remove entries older than this (seconds)
_RESULT_TTL_SECONDS = 300  # 5 minutes

# Redis key prefixes
_REDIS_RESULT_PREFIX = "mcp:query_result:"
_REDIS_CHANNEL_PREFIX = "mcp:query_signal:"


def _get_redis_client():
    """Get the Redis client from Django cache."""
    try:
        from django_redis import get_redis_connection
        return get_redis_connection("default")
    except Exception as e:
        logger.debug(f"[QueryResult] Redis unavailable: {e}")
        return None


def _get_result_key(session_id: str, tool_call_id: str) -> str:
    """Get Redis key for storing result."""
    return f"{_REDIS_RESULT_PREFIX}{session_id}:{tool_call_id}"


def _get_channel_name(session_id: str, tool_call_id: str) -> str:
    """Get Redis pub/sub channel name."""
    return f"{_REDIS_CHANNEL_PREFIX}{session_id}:{tool_call_id}"


def get_smart_context(result: Dict) -> str:
    """Return content from a search result dict."""
    return result.get('content', '')


def build_user_context_prompt(user_context: List[Dict]) -> str:
    """
    Build a prompt section from user context items.
    
    Args:
        user_context: List of context items (highlighted text, etc.)
        
    Returns:
        Formatted string to include in the prompt, or empty string if no context.
    """
    if not user_context:
        return ""
    
    parts = []
    for item in user_context:
        context_type = item.get('type', '')
        
        if context_type == 'highlighted_text':
            text = item.get('text_content', '')
            url = item.get('url_origin', '')
            if text:
                parts.append(f'The user highlighted this text: "{text}"')
                if url:
                    parts.append(f'(from: {url})')
        
        elif context_type == 'dom_snapshot':
            # DOM snapshot contains pre-formatted compact text representation
            # Format: text content interspersed with interactables like "BUTTON: Label [[ref]]"
            content = item.get('content', '')
            if content:
                parts.append(content)
    
    if not parts:
        return ""
    
    context_text = '\n'.join(parts)
    return f"\n=== USER-PROVIDED CONTEXT ===\n{context_text}\n"


async def get_defer_action(help_center_config) -> Optional[Dict[str, Any]]:
    """
    Look up the special 'defer' action for this product.
    
    Developers register an action named 'defer' to handle cases where
    the AI cannot answer. This action typically opens a support channel
    (Intercom, Zendesk, Calendly, email form, etc.).
    
    Args:
        help_center_config: HelpCenterConfig instance
    
    Returns:
        Action dict if found, None otherwise
    """
    from apps.products.models import Action
    
    try:
        action = await Action.objects.filter(
            product=help_center_config,
            name='defer',
            status='published',
        ).afirst()
        
        if action:
            logger.info(f"[Agent] Found defer action: {action.action_type}")
            return {
                'name': action.name,
                'description': action.description,
                'action_type': action.action_type,
                'path_template': action.path_template,
                'external_url': action.external_url,
                'data': action.default_data,
                'auto_run': False,  # Never auto-run defer - user should choose
            }
        return None
    except Exception as e:
        logger.warning(f"[Agent] Failed to lookup defer action: {e}")
        return None


async def get_escalate_action(help_center_config) -> Optional[Dict[str, Any]]:
    """
    Look up the 'escalate' action for explicit human handoff.
    
    Developers can register an 'escalate' action for when users explicitly
    request human support. Falls back to 'defer' action if not found.
    
    Args:
        help_center_config: HelpCenterConfig instance
    
    Returns:
        Action dict if found, None otherwise
    """
    from apps.products.models import Action
    
    try:
        # First try to find an 'escalate' action
        action = await Action.objects.filter(
            product=help_center_config,
            name='escalate',
            status='published',
        ).afirst()
        
        if action:
            logger.info(f"[Agent] Found escalate action: {action.action_type}")
            return {
                'name': action.name,
                'description': action.description,
                'action_type': action.action_type,
                'path_template': action.path_template,
                'external_url': action.external_url,
                'data': action.default_data,
                'auto_run': False,  # Never auto-run - user should confirm
            }
        
        # Fall back to 'defer' action if no 'escalate' action configured
        logger.info("[Agent] No escalate action found, falling back to defer action")
        return await get_defer_action(help_center_config)
        
    except Exception as e:
        logger.warning(f"[Agent] Failed to lookup escalate action: {e}")
        return None


async def hybrid_search(
    organization,
    product,
    query: str,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    Hybrid search using KnowledgeRAGService.

    Uses the unified KnowledgeRAGService which combines semantic and keyword
    search with RRF fusion.
    
    Args:
        organization: Organization instance
        product: Product instance (for product-level gating)
        query: Search query
        top_k: Number of results to return
    
    Returns:
        List of search result dicts
    """
    from apps.knowledge.services import KnowledgeRAGServiceAsync

    try:
        rag_service = KnowledgeRAGServiceAsync(
            organization_id=str(organization.id),
            product_id=str(product.id)
        )
        search_results = await rag_service.hybrid_search(
            query=query,
            top_k=top_k,
        )

        # Convert SearchResult objects to dicts
        results = [
            {
                'title': r.title,
                'url': r.url or '',
                'content': r.content,
                'score': r.score,
                'source_type': r.item_type,
            }
            for r in search_results
        ]

        logger.info(f"[ReAct] Hybrid search: {len(results)} results")

        return results

    except Exception as e:
        logger.error(f"[ReAct] Hybrid search error: {e}", exc_info=True)
        return {
            "error": f"Knowledge search failed: {str(e)}",
            "tool": "search",
            "recoverable": True,
            "hint": "The knowledge base may be temporarily unavailable. Consider retrying.",
        }


async def wait_for_query_result(
    session_id: str,
    action_name: str,
    tool_call_id: str,
    timeout: float = 30.0,
    cancel_event=None,
) -> Optional[Dict[str, Any]]:
    """
    Wait for a query action result from the client.
    
    Uses Redis pub/sub for cross-worker signaling with in-memory fallback.
    The client executes query actions and sends results back via the
    action/result endpoint, which publishes to Redis.
    
    Args:
        session_id: Session ID to correlate the result
        action_name: Name of the action we're waiting for
        tool_call_id: Unique ID for this specific tool invocation
        timeout: Maximum seconds to wait (default 30s)
        cancel_event: Optional event to cancel waiting
        
    Returns:
        The action result dict, or None if timeout/cancelled/no session
    """
    if not session_id:
        logger.warning(f"[QueryResult] No session_id provided for action {action_name}")
        return {
            "error": f"No session_id provided for action {action_name}",
            "tool": "execute",
            "recoverable": False,
            "hint": "Session ID is required for action execution. This is a configuration error.",
        }
    
    logger.info(
        f"[QueryResult] Waiting for result: session={session_id[:8]}..., "
        f"action={action_name}, tool_call_id={tool_call_id}, timeout={timeout}s"
    )
    
    # Try Redis-based waiting first (works across workers)
    redis_client = _get_redis_client()
    if redis_client:
        result = await _wait_for_result_redis(
            redis_client, session_id, action_name, tool_call_id, timeout, cancel_event
        )
        if result is not None:
            return result
        # If Redis wait failed/timed out, check if result arrived in-memory as fallback
        result = _query_results.get(session_id, {}).get(tool_call_id)
        if result:
            logger.info(f"[QueryResult] Found result in memory fallback for {action_name}")
            return result
        return None
    
    # Fallback to in-memory only (single worker mode)
    logger.debug(f"[QueryResult] Using in-memory fallback for {action_name}")
    return await _wait_for_result_memory(
        session_id, action_name, tool_call_id, timeout, cancel_event
    )


async def _wait_for_result_redis(
    redis_client,
    session_id: str,
    action_name: str,
    tool_call_id: str,
    timeout: float,
    cancel_event,
) -> Optional[Dict[str, Any]]:
    """Wait for result using Redis pub/sub."""
    channel_name = _get_channel_name(session_id, tool_call_id)
    result_key = _get_result_key(session_id, tool_call_id)
    
    # First check if result already exists in Redis (race condition handling)
    try:
        existing = redis_client.get(result_key)
        if existing:
            logger.info(f"[QueryResult] Found existing result in Redis for {action_name} (tool_call_id={tool_call_id})")
            return json.loads(existing)
    except Exception as e:
        logger.warning(f"[QueryResult] Redis get failed: {e}")
    
    # Subscribe to the channel for real-time notification
    pubsub = None
    try:
        pubsub = redis_client.pubsub()
        pubsub.subscribe(channel_name)
        
        # Poll for messages with timeout
        start_time = time.time()
        poll_interval = 0.1  # 100ms polling
        
        while True:
            # Check cancellation
            if cancel_event and cancel_event.is_set():
                logger.info(f"[QueryResult] Cancelled while waiting for {action_name}")
                return None
            
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed >= timeout:
                logger.info(f"[QueryResult] Timeout waiting for {action_name} (Redis)")
                return {
                    "error": f"Timeout waiting for {action_name} after {timeout}s",
                    "tool": "execute",
                    "action_name": action_name,
                    "timeout": True,
                    "recoverable": True,
                    "hint": "The client may be slow to respond. Consider retrying or checking the action parameters.",
                }
            
            # Check for message (non-blocking)
            message = pubsub.get_message(timeout=poll_interval)
            if message and message['type'] == 'message':
                # Signal received - fetch result from Redis
                try:
                    result_data = redis_client.get(result_key)
                    if result_data:
                        result = json.loads(result_data)
                        logger.info(f"[QueryResult] Received result for {action_name} (Redis)")
                        return result
                except Exception as e:
                    logger.error(f"[QueryResult] Failed to fetch result from Redis: {e}")
                    return None
            
            # Yield to event loop
            await asyncio.sleep(0)
            
    except Exception as e:
        logger.warning(f"[QueryResult] Redis pub/sub error: {e}")
        return {
            "error": f"Communication error while waiting for {action_name}: {str(e)}",
            "tool": "execute",
            "action_name": action_name,
            "recoverable": True,
            "hint": "Redis communication failed. The query may still be processing.",
        }
    finally:
        if pubsub:
            try:
                pubsub.unsubscribe(channel_name)
                pubsub.close()
            except Exception:
                pass


async def _wait_for_result_memory(
    session_id: str,
    action_name: str,
    tool_call_id: str,
    timeout: float,
    cancel_event,
) -> Optional[Dict[str, Any]]:
    """Wait for result using in-memory event (fallback)."""
    # Create event for this query
    if session_id not in _pending_queries:
        _pending_queries[session_id] = {}
    
    event = asyncio.Event()
    _pending_queries[session_id][tool_call_id] = event
    
    try:
        # Wait for the event to be set (or timeout/cancel)
        if cancel_event:
            # Create a task for both the event wait and cancel event
            wait_task = asyncio.create_task(event.wait())
            cancel_task = asyncio.create_task(_wait_for_cancel(cancel_event))
            
            done, pending = await asyncio.wait(
                [wait_task, cancel_task],
                timeout=timeout,
                return_when=asyncio.FIRST_COMPLETED,
            )
            
            # Cancel pending tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            
            # Check if we got the result or were cancelled
            if wait_task in done and wait_task.result():
                result = _query_results.get(session_id, {}).get(tool_call_id)
                logger.info(f"[QueryResult] Received result for {action_name} (memory)")
                return result
            elif cancel_task in done:
                logger.info(f"[QueryResult] Cancelled while waiting for {action_name}")
                return {
                    "error": f"Request cancelled while waiting for {action_name}",
                    "tool": "execute",
                    "action_name": action_name,
                    "cancelled": True,
                    "recoverable": False,
                }
            else:
                logger.info(f"[QueryResult] Timeout waiting for {action_name} (memory)")
                return {
                    "error": f"Timeout waiting for {action_name}",
                    "tool": "execute",
                    "action_name": action_name,
                    "timeout": True,
                    "recoverable": True,
                    "hint": "The client may be slow to respond. Consider retrying.",
                }
        else:
            # Simple wait with timeout
            await asyncio.wait_for(event.wait(), timeout=timeout)
            result = _query_results.get(session_id, {}).get(tool_call_id)
            logger.info(f"[QueryResult] Received result for {action_name} (memory)")
            return result
            
    except asyncio.TimeoutError:
        logger.info(f"[QueryResult] Timeout waiting for {action_name} (memory)")
        return {
            "error": f"Timeout waiting for {action_name}",
            "tool": "execute",
            "action_name": action_name,
            "timeout": True,
            "recoverable": True,
            "hint": "The client may be slow to respond. Consider retrying.",
        }
        
    finally:
        # Cleanup the pending query entry
        if session_id in _pending_queries:
            _pending_queries[session_id].pop(tool_call_id, None)
            if not _pending_queries[session_id]:
                del _pending_queries[session_id]


async def _wait_for_cancel(cancel_event) -> bool:
    """Helper to wait for a cancel event."""
    while not cancel_event.is_set():
        await asyncio.sleep(0.1)
    return True


def signal_query_result(session_id: str, action_name: str, result: Any, tool_call_id: str) -> bool:
    """
    Signal that a query result has been received from the client.
    
    Uses Redis pub/sub for cross-worker signaling with in-memory fallback.
    Called by the action/result endpoint handler.
    
    Args:
        session_id: Session ID the result belongs to
        action_name: Name of the action that returned the result
        result: The result data from the client
        tool_call_id: Unique ID for this specific tool invocation
        
    Returns:
        True if signaling succeeded, False otherwise
    """
    if not session_id:
        logger.warning(f"[QueryResult] Cannot signal result without session_id")
        return False
    
    # Try Redis first (works across workers)
    redis_client = _get_redis_client()
    if redis_client:
        signaled = _signal_result_redis(redis_client, session_id, action_name, result, tool_call_id)
        if signaled:
            return True
        # Fall through to in-memory as backup
    
    # In-memory fallback
    return _signal_result_memory(session_id, action_name, result, tool_call_id)


def _signal_result_redis(
    redis_client,
    session_id: str,
    action_name: str,
    result: Any,
    tool_call_id: str,
) -> bool:
    """Signal result using Redis pub/sub."""
    channel_name = _get_channel_name(session_id, tool_call_id)
    result_key = _get_result_key(session_id, tool_call_id)
    
    try:
        # Store result in Redis with TTL
        result_json = json.dumps(result, default=str)
        redis_client.setex(result_key, _RESULT_TTL_SECONDS, result_json)
        
        # Publish notification to channel
        subscribers = redis_client.publish(channel_name, "result_ready")
        
        logger.info(
            f"[QueryResult] Signaled via Redis: session={session_id[:8]}..., "
            f"action={action_name}, tool_call_id={tool_call_id}, subscribers={subscribers}"
        )
        return True
    except Exception as e:
        logger.warning(f"[QueryResult] Redis signal failed: {e}")
        return False


def _signal_result_memory(session_id: str, action_name: str, result: Any, tool_call_id: str) -> bool:
    """Signal result using in-memory event (fallback)."""
    # Store the result
    if session_id not in _query_results:
        _query_results[session_id] = {}
    _query_results[session_id][tool_call_id] = result
    
    # Signal the waiting event if one exists
    event = _pending_queries.get(session_id, {}).get(tool_call_id)
    
    if event:
        event.set()
        logger.info(
            f"[QueryResult] Signaled in-memory: session={session_id[:8]}..., "
            f"action={action_name}, tool_call_id={tool_call_id}"
        )
        return True
    else:
        logger.warning(
            f"[QueryResult] No waiting loop for: session={session_id[:8]}..., "
            f"action={action_name}, tool_call_id={tool_call_id}"
        )
        return False


def cleanup_stale_results(max_age_seconds: float = None) -> int:
    """
    Clean up stale query results that are older than max_age.
    
    Call this periodically to prevent memory leaks from abandoned queries.
    
    Args:
        max_age_seconds: Maximum age in seconds (default: _RESULT_TTL_SECONDS)
        
    Returns:
        Number of entries cleaned up
    """
    # Note: This is a simple cleanup. For production, consider using
    # Redis with TTL or a more sophisticated approach.
    if max_age_seconds is None:
        max_age_seconds = _RESULT_TTL_SECONDS
    
    # For now, just clear all results (simple approach)
    # A more sophisticated approach would track timestamps
    count = len(_query_results)
    _query_results.clear()
    _pending_queries.clear()
    
    if count > 0:
        logger.info(f"[QueryResult] Cleaned up {count} stale result entries")
    
    return count
