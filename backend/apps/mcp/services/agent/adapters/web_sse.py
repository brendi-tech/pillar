"""
Web SSE adapter -- translates agentic loop events to JSON-RPC SSE format.

This is a reference implementation extracted from the event handling in
streamable_http.py. It is not wired into the SSE path yet -- that
refactor happens when the second channel (Slack) ships.
"""
import asyncio

from apps.mcp.services.agent.response_adapter import ResponseAdapter


class WebSSEAdapter(ResponseAdapter):
    """
    Adapts agentic loop events to JSON-RPC SSE format for the web SDK.

    Writes to an async queue that streamable_http.py reads from.
    """

    def __init__(self, event_queue: asyncio.Queue):
        self._queue = event_queue
        self._collected_text: list[str] = []

    async def on_token(self, text: str) -> None:
        self._collected_text.append(text)
        await self._queue.put(
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progress": {"kind": "token", "token": text}},
            }
        )

    async def on_sources(self, sources: list[dict]) -> None:
        await self._queue.put({"_internal": "sources", "sources": sources})

    async def on_progress(self, progress_data: dict) -> None:
        await self._queue.put(
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progress": progress_data},
            }
        )

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        await self._queue.put(
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {
                    "progress": {
                        "kind": "action_request",
                        "action_name": action_name,
                        "parameters": parameters,
                        "action": action,
                    }
                },
            }
        )

    async def on_complete(self, event: dict) -> None:
        await self._queue.put({"_internal": "complete", "event": event})

    async def on_error(self, message: str, details: dict | None = None) -> None:
        await self._queue.put({"_internal": "error", "message": message})
