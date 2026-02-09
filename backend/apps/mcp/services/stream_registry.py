"""
Stream registry for tracking and cancelling active LLM streams.

Provides a centralized registry for managing active streaming requests,
enabling proactive cancellation when users click the Stop button.

Copyright (C) 2025 Pillar Team
"""
import asyncio
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class StreamRegistry:
    """
    Track active LLM streams for cancellation.

    This registry maintains a mapping of request IDs to asyncio.Event objects.
    When a user cancels a stream, we set the event which signals all layers
    of the streaming chain to stop.

    Usage:
        # At stream start
        cancel_event = stream_registry.register(request_id)

        # Pass cancel_event through the call chain
        # Check periodically: if cancel_event.is_set(): break

        # When user clicks Stop
        stream_registry.cancel(request_id)

        # At stream end
        stream_registry.cleanup(request_id)
    """
    _active_streams: Dict[str, asyncio.Event] = {}

    @classmethod
    def register(cls, request_id: str) -> asyncio.Event:
        """
        Register a new stream for potential cancellation.

        Args:
            request_id: Unique identifier for the streaming request

        Returns:
            asyncio.Event that will be set when cancellation is requested
        """
        cancel_event = asyncio.Event()
        cls._active_streams[request_id] = cancel_event
        logger.info(f"[StreamRegistry] Registered stream: {request_id}")
        return cancel_event

    @classmethod
    def cancel(cls, request_id: str) -> bool:
        """
        Signal cancellation for an active stream.

        Args:
            request_id: Unique identifier for the streaming request

        Returns:
            True if stream was found and cancelled, False if not found
        """
        if request_id in cls._active_streams:
            cls._active_streams[request_id].set()
            logger.info(f"[StreamRegistry] Cancelled stream: {request_id}")
            return True
        logger.debug(f"[StreamRegistry] Stream not found: {request_id}")
        return False

    @classmethod
    def cleanup(cls, request_id: str):
        """
        Remove a stream from the registry.

        Should be called when streaming completes (success or cancelled).
        """
        removed = cls._active_streams.pop(request_id, None)
        if removed:
            logger.debug(f"[StreamRegistry] Cleaned up stream: {request_id}")

    @classmethod
    def is_cancelled(cls, request_id: str) -> bool:
        """Check if a stream has been cancelled."""
        event = cls._active_streams.get(request_id)
        return event is not None and event.is_set()

    @classmethod
    def get_active_count(cls) -> int:
        """Get the number of active streams (for monitoring)."""
        return len(cls._active_streams)


# Singleton instance
stream_registry = StreamRegistry()
