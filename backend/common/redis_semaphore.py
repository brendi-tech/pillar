"""
Redis-backed distributed semaphore for fleet-wide concurrency control.

Each token is a unique key with a TTL (lease). If a worker OOMs or is
SIGKILLed, the key expires and the slot is reclaimed automatically.

Usage::

    from common.redis_semaphore import RedisDistributedSemaphore

    stagehand_sem = RedisDistributedSemaphore(
        name="stagehand",
        max_concurrent=10,
        lease_ttl_seconds=600,
    )

    async with stagehand_sem:
        # only 10 of these run fleet-wide at once
        session = await client.sessions.start(...)
        ...
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from types import TracebackType
from typing import Self

import redis.asyncio as aioredis
from django.conf import settings

logger = logging.getLogger(__name__)


class RedisDistributedSemaphore:
    """
    Async context-manager that limits fleet-wide concurrency via Redis.

    Tokens are stored as individual Redis keys with a TTL (the *lease*).
    Acquiring counts how many keys exist for the semaphore prefix; if below
    ``max_concurrent``, a new key is SET with EX.  Otherwise the caller
    retries with exponential backoff + jitter.

    The lease is refreshed periodically in the background so long-running
    sessions don't lose their token while still alive.
    """

    KEY_PREFIX = "semaphore"

    def __init__(
        self,
        *,
        name: str,
        max_concurrent: int,
        lease_ttl_seconds: int = 600,
        poll_interval: float = 2.0,
        max_wait_seconds: float = 300.0,
    ) -> None:
        self.name = name
        self.max_concurrent = max_concurrent
        self.lease_ttl_seconds = lease_ttl_seconds
        self.poll_interval = poll_interval
        self.max_wait_seconds = max_wait_seconds

        self._token: str | None = None
        self._refresh_task: asyncio.Task | None = None

    # ---- Redis client (lazy, per-acquire) ----

    def _redis_url(self) -> str:
        return getattr(settings, "REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6379"))

    def _key_pattern(self) -> str:
        return f"{self.KEY_PREFIX}:{self.name}:*"

    def _token_key(self, token: str) -> str:
        return f"{self.KEY_PREFIX}:{self.name}:{token}"

    # ---- Acquire / Release ----

    async def acquire(self) -> str:
        """Block until a slot is available. Returns the token string."""
        client = aioredis.from_url(self._redis_url(), decode_responses=True)
        token = f"{uuid.uuid4().hex[:12]}-{os.getpid()}"

        try:
            elapsed = 0.0
            attempt = 0
            while elapsed < self.max_wait_seconds:
                # Count current holders via SCAN (safe for large keyspaces).
                count = 0
                async for _ in client.scan_iter(match=self._key_pattern(), count=100):
                    count += 1

                if count < self.max_concurrent:
                    # Try to grab a slot atomically (SET NX + EX).
                    key = self._token_key(token)
                    acquired = await client.set(
                        key, "1", ex=self.lease_ttl_seconds, nx=True,
                    )
                    if acquired:
                        self._token = token
                        logger.info(
                            "[Semaphore:%s] Acquired token %s (slot %d/%d)",
                            self.name, token, count + 1, self.max_concurrent,
                        )
                        self._start_refresh(client)
                        return token

                # Backoff with jitter
                attempt += 1
                jitter = random.uniform(0, self.poll_interval * 0.5)
                wait = min(self.poll_interval * (1.1 ** min(attempt, 20)), 15.0) + jitter
                logger.debug(
                    "[Semaphore:%s] Waiting %.1fs for slot (%d/%d active, attempt %d)",
                    self.name, wait, count, self.max_concurrent, attempt,
                )
                await asyncio.sleep(wait)
                elapsed += wait

            raise TimeoutError(
                f"[Semaphore:{self.name}] Could not acquire slot within "
                f"{self.max_wait_seconds}s (max_concurrent={self.max_concurrent})"
            )
        except BaseException:
            await client.aclose()
            raise

    async def release(self) -> None:
        """Release the held token."""
        if self._token is None:
            return

        # Stop the lease-refresh background task
        if self._refresh_task is not None:
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
            self._refresh_task = None

        client = aioredis.from_url(self._redis_url(), decode_responses=True)
        try:
            key = self._token_key(self._token)
            deleted = await client.delete(key)
            logger.info(
                "[Semaphore:%s] Released token %s (deleted=%s)",
                self.name, self._token, bool(deleted),
            )
        except Exception as exc:
            logger.warning(
                "[Semaphore:%s] Error releasing token %s: %s",
                self.name, self._token, exc,
            )
        finally:
            self._token = None
            await client.aclose()

    # ---- Lease refresh ----

    def _start_refresh(self, client: aioredis.Redis) -> None:
        """Launch a background task that refreshes the lease TTL."""
        refresh_interval = max(self.lease_ttl_seconds // 3, 10)

        async def _refresh_loop() -> None:
            try:
                while True:
                    await asyncio.sleep(refresh_interval)
                    if self._token is None:
                        return
                    key = self._token_key(self._token)
                    try:
                        await client.expire(key, self.lease_ttl_seconds)
                    except Exception:
                        pass
            except asyncio.CancelledError:
                await client.aclose()

        self._refresh_task = asyncio.create_task(_refresh_loop())

    # ---- Context manager ----

    async def __aenter__(self) -> Self:
        await self.acquire()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.release()
