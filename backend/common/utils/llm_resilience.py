"""
LLM Resilience utilities for handling transient failures and empty responses.

Provides a resilient wrapper around LLM calls with:
- Retry logic with exponential backoff
- Error classification (retryable vs non-retryable)
- Smart default actions when LLM fails
- API health tracking for graceful degradation during outages

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from common.exceptions import LLMAPIError

logger = logging.getLogger(__name__)


class ErrorType(Enum):
    """Classification of LLM errors for handling strategy."""
    EMPTY_RESPONSE = "empty_response"
    RETRYABLE = "retryable"  # 429, 503, timeout, connection
    NON_RETRYABLE = "non_retryable"  # 400, 401, content_filter
    PARSE_FAILURE = "parse_failure"
    UNKNOWN = "unknown"


@dataclass
class LLMCallResult:
    """Result of a resilient LLM call."""
    content: str
    success: bool
    retried: bool = False
    retry_count: int = 0
    recovery_used: bool = False
    error_type: Optional[ErrorType] = None
    original_error: Optional[str] = None
    fallback_action: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, int]] = None  # Token usage: prompt_tokens, completion_tokens, total_tokens


def classify_error(error: Exception) -> ErrorType:
    """
    Classify an LLM error to determine handling strategy.
    
    Args:
        error: The exception that occurred
        
    Returns:
        ErrorType indicating whether to retry, skip to fallback, etc.
    """
    error_str = str(error).lower()
    
    # Retryable errors - worth trying again
    if any(x in error_str for x in ['429', 'rate limit', 'too many requests']):
        return ErrorType.RETRYABLE
    if any(x in error_str for x in ['503', 'service unavailable', 'overloaded']):
        return ErrorType.RETRYABLE
    if any(x in error_str for x in ['timeout', 'timed out', 'connection']):
        return ErrorType.RETRYABLE
    if 'ssl' in error_str or 'network' in error_str:
        return ErrorType.RETRYABLE
    if any(x in error_str for x in ['502', 'bad gateway']):
        return ErrorType.RETRYABLE
    
    # Non-retryable errors - skip directly to fallback
    if any(x in error_str for x in ['400', '401', '403', 'unauthorized', 'forbidden']):
        return ErrorType.NON_RETRYABLE
    if 'content_filter' in error_str or 'content policy' in error_str:
        return ErrorType.NON_RETRYABLE
    if 'invalid' in error_str and 'api key' in error_str:
        return ErrorType.NON_RETRYABLE
    if 'model not found' in error_str:
        return ErrorType.NON_RETRYABLE
    
    return ErrorType.UNKNOWN


class APIHealthTracker:
    """
    Track LLM API health to enable fast-fail during outages.
    
    After N consecutive failures, skip LLM calls entirely and use
    smart defaults until the API recovers.
    
    Thread-safe for use across concurrent requests.
    """
    
    def __init__(self, failure_threshold: int = 3, recovery_time: float = 60.0):
        """
        Initialize the health tracker.
        
        Args:
            failure_threshold: Number of consecutive failures before degraded mode
            recovery_time: Seconds to wait before attempting recovery
        """
        self.consecutive_failures = 0
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.last_failure_time: Optional[float] = None
        self.is_degraded = False
        self._lock = asyncio.Lock()
    
    async def record_failure(self):
        """Record an API failure."""
        async with self._lock:
            self.consecutive_failures += 1
            self.last_failure_time = time.time()
            
            if self.consecutive_failures >= self.failure_threshold and not self.is_degraded:
                self.is_degraded = True
                logger.warning(
                    "[LLMResilience] API degraded mode activated",
                    extra={
                        "event_type": "llm_degraded_mode_enter",
                        "consecutive_failures": self.consecutive_failures,
                    }
                )
    
    async def record_success(self):
        """Record a successful API call."""
        async with self._lock:
            was_degraded = self.is_degraded
            self.consecutive_failures = 0
            self.is_degraded = False
            
            if was_degraded:
                logger.info(
                    "[LLMResilience] API recovered, exiting degraded mode",
                    extra={"event_type": "llm_degraded_mode_exit"}
                )
    
    async def should_skip_llm(self) -> bool:
        """
        Check if we should skip LLM calls due to degraded state.
        
        Returns:
            True if API is degraded and we should use fallbacks
        """
        async with self._lock:
            if not self.is_degraded:
                return False
            
            # Check if enough time has passed to try again
            if self.last_failure_time:
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_time:
                    logger.info(
                        "[LLMResilience] Attempting API recovery check",
                        extra={
                            "event_type": "llm_recovery_attempt",
                            "elapsed_seconds": elapsed,
                        }
                    )
                    return False  # Try again
            
            return True


# Global health tracker instance
_api_health = APIHealthTracker()


def get_api_health_tracker() -> APIHealthTracker:
    """Get the global API health tracker instance."""
    return _api_health


async def resilient_complete(
    llm_client,
    prompt: str,
    system_prompt: str,
    max_retries: int = 2,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
    timeout: float = 30.0,
    temperature: float = 0.2,
    retry_temperature_bump: float = 0.1,
    context: Optional[dict] = None,
    **kwargs
) -> LLMCallResult:
    """
    Resilient LLM completion with tiered error handling.
    
    Strategy:
    1. Make initial call with timeout
    2. On retryable error/empty: retry with exponential backoff
    3. On continued failure: return result with fallback_action populated
    
    Args:
        llm_client: The LLM client instance
        prompt: User prompt
        system_prompt: System prompt
        max_retries: Max retry attempts for retryable errors
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
        timeout: Timeout per LLM call (seconds)
        temperature: Initial temperature for LLM call
        retry_temperature_bump: Temperature increase per retry
        context: Context dict for smart defaults (iteration, question, etc.)
        **kwargs: Additional args passed to llm_client.complete_async()
    
    Returns:
        LLMCallResult with either successful content or fallback_action
    """
    from apps.mcp.services.agent.recovery import get_smart_default_action
    
    context = context or {}
    question = context.get("question", "")
    iteration = context.get("iteration", 0)
    found_tools = context.get("found_tools")
    found_knowledge = context.get("found_knowledge")
    query_results = context.get("query_results")
    
    last_error: Optional[str] = None
    last_error_type: Optional[ErrorType] = None
    retry_count = 0
    current_temp = temperature
    
    for attempt in range(max_retries + 1):
        try:
            # Make the LLM call with timeout, requesting usage info
            response = await asyncio.wait_for(
                llm_client.complete_async(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=current_temp,
                    return_usage=True,
                    **kwargs
                ),
                timeout=timeout,
            )
            
            # Extract content and usage from response dict
            if isinstance(response, dict):
                content = response.get('content', '')
                usage = response.get('usage')
            else:
                # Fallback for legacy string response
                content = response
                usage = None
            
            # Check for empty response
            if not content or not content.strip():
                logger.warning(
                    f"[LLMResilience] Empty response on attempt {attempt + 1}",
                    extra={
                        "event_type": "llm_empty_response",
                        "attempt": attempt + 1,
                        "question_preview": question[:50] if question else "",
                    }
                )
                last_error = "Empty response from LLM"
                last_error_type = ErrorType.EMPTY_RESPONSE
                
                if attempt < max_retries:
                    # Retry with slightly higher temperature
                    current_temp = min(current_temp + retry_temperature_bump, 1.0)
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    await asyncio.sleep(delay)
                    retry_count += 1
                    continue
                else:
                    # Max retries reached - return with fallback
                    break
            
            # Success!
            logger.debug(
                f"[LLMResilience] Success on attempt {attempt + 1}",
                extra={
                    "event_type": "llm_success",
                    "attempt": attempt + 1,
                    "retried": retry_count > 0,
                    "prompt_tokens": usage.get('prompt_tokens') if usage else None,
                    "completion_tokens": usage.get('completion_tokens') if usage else None,
                }
            )
            return LLMCallResult(
                content=content,
                success=True,
                retried=retry_count > 0,
                retry_count=retry_count,
                usage=usage,
            )
            
        except asyncio.TimeoutError:
            last_error = f"LLM call timed out after {timeout}s"
            last_error_type = ErrorType.RETRYABLE
            logger.warning(
                f"[LLMResilience] Timeout on attempt {attempt + 1}",
                extra={
                    "event_type": "llm_timeout",
                    "attempt": attempt + 1,
                    "timeout_seconds": timeout,
                }
            )
            
            if attempt < max_retries:
                delay = min(base_delay * (2 ** attempt), max_delay)
                await asyncio.sleep(delay)
                retry_count += 1
                continue
            else:
                break
                
        except LLMAPIError as e:
            last_error = str(e)
            last_error_type = classify_error(e)
            
            logger.warning(
                f"[LLMResilience] LLM error on attempt {attempt + 1}: {e}",
                extra={
                    "event_type": "llm_error",
                    "attempt": attempt + 1,
                    "error_type": last_error_type.value,
                    "error": str(e)[:200],
                }
            )
            
            # Only retry if error is retryable
            if last_error_type == ErrorType.RETRYABLE and attempt < max_retries:
                delay = min(base_delay * (2 ** attempt), max_delay)
                await asyncio.sleep(delay)
                retry_count += 1
                continue
            else:
                # Non-retryable or max retries reached
                break
                
        except Exception as e:
            last_error = str(e)
            last_error_type = classify_error(e)
            
            logger.error(
                f"[LLMResilience] Unexpected error on attempt {attempt + 1}: {e}",
                extra={
                    "event_type": "llm_unexpected_error",
                    "attempt": attempt + 1,
                    "error_type": last_error_type.value,
                    "error": str(e)[:200],
                },
                exc_info=True,
            )
            
            if last_error_type == ErrorType.RETRYABLE and attempt < max_retries:
                delay = min(base_delay * (2 ** attempt), max_delay)
                await asyncio.sleep(delay)
                retry_count += 1
                continue
            else:
                break
    
    # All attempts failed - get smart default action
    logger.info(
        "[LLMResilience] All attempts failed, using smart default",
        extra={
            "event_type": "llm_fallback_triggered",
            "retry_count": retry_count,
            "error_type": last_error_type.value if last_error_type else "unknown",
            "question_preview": question[:50] if question else "",
        }
    )
    
    fallback_action = get_smart_default_action(
        question=question,
        iteration=iteration,
        found_tools=found_tools,
        found_knowledge=found_knowledge,
        query_results=query_results,
        error_type=last_error_type.value if last_error_type else None,
    )
    
    return LLMCallResult(
        content="",
        success=False,
        retried=retry_count > 0,
        retry_count=retry_count,
        error_type=last_error_type,
        original_error=last_error,
        fallback_action=fallback_action,
    )


async def resilient_complete_with_health_check(
    llm_client,
    prompt: str,
    system_prompt: str,
    context: Optional[dict] = None,
    **kwargs
) -> LLMCallResult:
    """
    Resilient completion that respects API health state.
    
    If API is in degraded mode, skip directly to smart defaults
    to avoid wasting time on calls that will fail.
    
    Args:
        llm_client: The LLM client instance
        prompt: User prompt
        system_prompt: System prompt
        context: Context dict for smart defaults
        **kwargs: Additional args passed to resilient_complete()
    
    Returns:
        LLMCallResult with either successful content or fallback_action
    """
    from apps.mcp.services.agent.recovery import get_smart_default_action
    
    context = context or {}
    
    # Check if we should skip LLM due to degraded API
    if await _api_health.should_skip_llm():
        logger.info(
            "[LLMResilience] Skipping LLM call - API in degraded mode",
            extra={"event_type": "llm_skip_degraded"}
        )
        
        fallback_action = get_smart_default_action(
            question=context.get("question", ""),
            iteration=context.get("iteration", 0),
            found_tools=context.get("found_tools"),
            found_knowledge=context.get("found_knowledge"),
            query_results=context.get("query_results"),
            error_type="api_degraded",
        )
        
        return LLMCallResult(
            content="",
            success=False,
            error_type=ErrorType.RETRYABLE,
            original_error="API in degraded mode",
            fallback_action=fallback_action,
        )
    
    # Normal resilient call
    result = await resilient_complete(
        llm_client=llm_client,
        prompt=prompt,
        system_prompt=system_prompt,
        context=context,
        **kwargs
    )
    
    # Update health tracker
    if result.success:
        await _api_health.record_success()
    elif result.error_type in [ErrorType.RETRYABLE, ErrorType.UNKNOWN]:
        await _api_health.record_failure()
    
    return result


async def resilient_stream_with_health_check(
    llm_client,
    prompt: str,
    system_prompt: str,
    context: Optional[dict] = None,
    timeout: float = 60.0,
    **kwargs
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Resilient streaming wrapper that respects API health state.
    
    Streams thinking and content tokens from the LLM. On error or if API
    is in degraded mode, yields a fallback tool_decision event.
    
    This is useful for streaming tool decisions where we want to forward
    thinking tokens in real-time but still have fallback behavior.
    
    Args:
        llm_client: The LLM client instance
        prompt: User prompt
        system_prompt: System prompt
        context: Context dict for smart defaults (question, iteration, etc.)
        timeout: Overall timeout for the streaming call
        **kwargs: Additional args passed to stream_complete_async()
    
    Yields:
        {'type': 'thinking', 'content': '...'} - Reasoning tokens
        {'type': 'token', 'content': '...'} - Content tokens
        {'type': 'done', 'usage': {...}} - Completion info
        {'type': 'fallback', 'action': {...}} - Fallback action on error
    """
    from apps.mcp.services.agent.recovery import get_smart_default_action
    
    context = context or {}
    
    # Check if we should skip LLM due to degraded API
    if await _api_health.should_skip_llm():
        logger.info(
            "[LLMResilience] Skipping streaming call - API in degraded mode",
            extra={"event_type": "llm_stream_skip_degraded"}
        )
        
        fallback_action = get_smart_default_action(
            question=context.get("question", ""),
            iteration=context.get("iteration", 0),
            found_tools=context.get("found_tools"),
            found_knowledge=context.get("found_knowledge"),
            query_results=context.get("query_results"),
            error_type="api_degraded",
        )
        
        yield {"type": "fallback", "action": fallback_action}
        return
    
    stream_success = False
    
    try:
        # Create a timeout wrapper for the entire stream
        async def stream_with_timeout():
            async for chunk in llm_client.stream_complete_async(
                prompt=prompt,
                system_prompt=system_prompt,
                **kwargs
            ):
                yield chunk
        
        # Stream chunks with timeout
        async for chunk in stream_with_timeout():
            yield chunk
            
            # Mark success on done event
            if chunk.get('type') == 'done':
                stream_success = True
        
        # Update health tracker on success
        if stream_success:
            await _api_health.record_success()
            
    except asyncio.TimeoutError:
        logger.warning(
            f"[LLMResilience] Streaming timeout after {timeout}s",
            extra={"event_type": "llm_stream_timeout"}
        )
        await _api_health.record_failure()
        
        fallback_action = get_smart_default_action(
            question=context.get("question", ""),
            iteration=context.get("iteration", 0),
            found_tools=context.get("found_tools"),
            found_knowledge=context.get("found_knowledge"),
            query_results=context.get("query_results"),
            error_type="timeout",
        )
        yield {"type": "fallback", "action": fallback_action}
        
    except Exception as e:
        error_type = classify_error(e)
        logger.error(
            f"[LLMResilience] Streaming error: {e}",
            extra={"event_type": "llm_stream_error", "error_type": error_type.value}
        )
        
        # Update health tracker for retryable errors
        if error_type in [ErrorType.RETRYABLE, ErrorType.UNKNOWN]:
            await _api_health.record_failure()
        
        fallback_action = get_smart_default_action(
            question=context.get("question", ""),
            iteration=context.get("iteration", 0),
            found_tools=context.get("found_tools"),
            found_knowledge=context.get("found_knowledge"),
            query_results=context.get("query_results"),
            error_type=error_type.value,
        )
        yield {"type": "fallback", "action": fallback_action}
