"""
ASGI middleware for detecting client disconnects on SSE streams.

When a client closes the browser tab or refreshes, the ASGI server (Uvicorn)
sends an http.disconnect message through the receive channel. This middleware
intercepts that message and sets a disconnect event on the ASGI scope,
which downstream code can use to cancel long-running operations.

Based on the pattern from sse-starlette (800+ stars):
https://github.com/sysid/sse-starlette/blob/main/sse_starlette/sse.py

And the Django Forum recommended approach:
https://forum.djangoproject.com/t/how-do-i-detect-a-client-disconnect-from-an-async-streaminghttpresponse/22323

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


class ASGIDisconnectMiddleware:
    """
    ASGI middleware that detects client disconnects for SSE streams.

    When a client closes the browser tab or refreshes, the ASGI server
    (Uvicorn) sends an http.disconnect message through the receive channel.
    This middleware intercepts that message and sets a disconnect event on
    the scope, which stream_event_generator bridges to the cancel_event
    that the agentic loop already checks every 100ms.

    This is an ASGI middleware (wraps the ASGI app directly), not a Django
    middleware, because Django's middleware stack does not expose the raw
    ASGI receive channel needed for disconnect detection.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        # Store an asyncio.Event on the scope for disconnect detection.
        # Downstream code (stream_event_generator) can access this via
        # request.scope['_disconnect_event'] to detect browser disconnects.
        disconnect_event = asyncio.Event()
        scope['_disconnect_event'] = disconnect_event

        async def receive_wrapper():
            message = await receive()
            if message['type'] == 'http.disconnect':
                disconnect_event.set()
                logger.info("[ASGIDisconnect] Client disconnect detected")
            return message

        await self.app(scope, receive_wrapper, send)
