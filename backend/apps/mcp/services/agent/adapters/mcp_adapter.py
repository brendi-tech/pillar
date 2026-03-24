"""
MCPResponseAdapter -- adapter for the MCP channel.

Two modes:
- Accumulator (streaming=False): collects tokens/sources in memory,
  call to_mcp_result() after finalize for the final result dict.
- Queue (streaming=True): pushes MCP-standard JSON-RPC notifications
  to an asyncio.Queue for SSE output via stream_event_generator.

MCP clients (Cursor, Claude Desktop) don't understand Pillar-specific
events like conversation_started, action_request, or debug. This adapter
filters those out and only emits standard MCP content.
"""
import asyncio
import logging

from apps.mcp.services.agent.response_adapter import ResponseAdapter

logger = logging.getLogger(__name__)


class MCPResponseAdapter(ResponseAdapter):
    """Adapter for MCP channel with accumulator + optional streaming."""

    def __init__(
        self,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
        streaming: bool = False,
    ):
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel='mcp',
        )
        self._tokens: list[str] = []
        self._sources: list[dict] = []
        self._error: str | None = None
        self._streaming = streaming
        self._output_queue: asyncio.Queue | None = (
            asyncio.Queue() if streaming else None
        )

    # -- Turn lifecycle -------------------------------------------------------

    async def prepare_turn(
        self,
        user_text: str,
        images: list[dict] | None = None,
    ) -> str:
        """Create turn messages. MCP doesn't need image enrichment."""
        return await super().prepare_turn(user_text)

    async def prepare_resume(
        self,
        conversation_id: str,
        assistant_message_id: str,
    ):
        """Set IDs for resume. Creates assistant ChatMessage row for persistence."""
        from apps.analytics.models import ChatMessage as ChatMessageModel

        self._ensure_persistence_state()
        self.conversation_id = conversation_id
        self.assistant_message_id = assistant_message_id

        await ChatMessageModel.objects.acreate(
            id=assistant_message_id,
            organization_id=self.organization_id,
            product_id=self.product_id,
            conversation_id=conversation_id,
            role=ChatMessageModel.Role.ASSISTANT,
            content='',
            streaming_status=ChatMessageModel.StreamingStatus.STREAMING,
        )

    # -- Event handlers -------------------------------------------------------

    async def on_token(self, text: str) -> None:
        self._tokens.append(text)
        if self._streaming:
            await self._output_queue.put({
                'type': '_mcp_passthrough',
                'payload': {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {
                        'progress': {'kind': 'token', 'token': text},
                    },
                },
            })

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        if self._streaming:
            await self._output_queue.put({
                'type': '_mcp_passthrough',
                'payload': {
                    'jsonrpc': '2.0',
                    'method': 'notifications/progress',
                    'params': {'progress': progress_data},
                },
            })

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict,
        tool_call_id: str = '',
    ) -> None:
        pass

    async def on_complete(self, event: dict) -> None:
        if self._streaming:
            await self._output_queue.put({
                'type': '_mcp_complete',
                'result': self.to_mcp_result(),
            })

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self._error = message
        if self._streaming:
            await self._output_queue.put({
                'type': 'error',
                'message': message,
            })

    # -- Output ---------------------------------------------------------------

    def to_mcp_result(self, request_id=None) -> dict:
        """Build the final MCP tools/call result."""
        text = ''.join(self._tokens)
        content = [{'type': 'text', 'text': text}]
        if self._sources:
            sources_text = '\n\nSources:\n' + '\n'.join(
                f"- {s.get('title', 'Source')}: {s.get('url', '')}"
                for s in self._sources
            )
            content.append({'type': 'text', 'text': sources_text})

        result = {'content': content, 'isError': bool(self._error)}
        if request_id is not None:
            return {'jsonrpc': '2.0', 'id': request_id, 'result': result}
        return result

    async def events(self):
        """Async generator for streaming mode. Yields event dicts."""
        if not self._streaming:
            raise RuntimeError('events() only available in streaming mode')
        while True:
            event = await self._output_queue.get()
            if event is None:
                return
            yield event

    # -- Lifecycle ------------------------------------------------------------

    async def finalize(self) -> None:
        await self.finalize_persistence()
        if self._streaming:
            await self._output_queue.put(None)

    async def finalize_disconnected(self) -> None:
        await self.finalize_persistence()
        if self._streaming:
            await self._output_queue.put(None)
