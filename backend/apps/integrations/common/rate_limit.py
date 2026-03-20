"""
Channel-agnostic rate limiting for integrations.

Uses Redis sorted sets for sliding-window rate limiting.
Works for Slack (team_id), Discord (guild_id), or any channel.
"""
import asyncio
import logging
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

DEFAULT_LIMITS = {
    'user': 10,
    'channel': 20,
    'workspace': 60,
}


def check_rate_limit(
    workspace_id: str,
    user_id: str,
    channel_id: str,
    limits: dict | None = None,
    window: int = 60,
) -> bool:
    """
    Check rate limits using Redis cache counters.

    Returns True if the message should be processed, False if rate-limited.
    Uses simple cache-based counters (not sorted sets) for compatibility
    with Django's cache backend.
    """
    effective_limits = limits or DEFAULT_LIMITS
    now = int(time.time())
    window_key = now // window

    checks = [
        (f"rl:user:{workspace_id}:{user_id}:{window_key}", effective_limits.get('user', 10)),
        (f"rl:chan:{workspace_id}:{channel_id}:{window_key}", effective_limits.get('channel', 20)),
        (f"rl:ws:{workspace_id}:{window_key}", effective_limits.get('workspace', 60)),
    ]

    for key, limit in checks:
        current = cache.get(key, 0)
        if current >= limit:
            logger.warning(
                "[RATE_LIMIT] Exceeded %s=%d for workspace=%s",
                key.split(':')[1], limit, workspace_id,
            )
            return False

    for key, _ in checks:
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=window + 10)

    return True


async def slack_api_call_with_retry(func, *args, max_retries: int = 3, **kwargs):
    """
    Wrapper that handles Slack 429 rate limiting with exponential backoff.
    """
    from asgiref.sync import sync_to_async
    from slack_sdk.errors import SlackApiError

    for attempt in range(max_retries):
        try:
            return await sync_to_async(func)(*args, **kwargs)
        except SlackApiError as e:
            if e.response.status_code == 429:
                retry_after = int(e.response.headers.get('Retry-After', 1))
                wait_time = min(retry_after * (2 ** attempt), 30)
                logger.warning(
                    "[SLACK] Rate limited on %s, waiting %ds (attempt %d)",
                    getattr(func, '__name__', str(func)), wait_time, attempt + 1,
                )
                await asyncio.sleep(wait_time)
            else:
                raise

    raise Exception(f"Exhausted {max_retries} retries for Slack API call")
