"""
Tests for headless API adapter persistence.

Verifies JSONResponseAdapter and SSEResponseAdapter get persistence,
response shapes are unchanged, and on_confirmation_request signature
accepts conversation_id.
"""
import asyncio

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.views_api import JSONResponseAdapter, SSEResponseAdapter


# ---------------------------------------------------------------------------
# JSONResponseAdapter
# ---------------------------------------------------------------------------

class TestJSONAdapterPersistence:
    def test_passes_base_params(self):
        adapter = JSONResponseAdapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        assert adapter.organization_id == 'org-1'
        assert adapter.product_id == 'prod-1'
        assert adapter.conversation_id == 'conv-1'
        assert adapter.channel == 'api'

    @patch('apps.mcp.services.session_resumption.create_turn_messages', new_callable=AsyncMock)
    async def test_prepare_turn_creates_messages(self, mock_create):
        mock_create.return_value = 'msg-1'
        adapter = JSONResponseAdapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        await adapter.prepare_turn('Hello')
        mock_create.assert_called_once()

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_finalize_persistence_writes_to_db(self, mock_finalize):
        adapter = JSONResponseAdapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._complete_response = 'response text'
        await adapter.finalize_persistence()
        mock_finalize.assert_called_once()

    async def test_json_response_shape_unchanged(self):
        adapter = JSONResponseAdapter()
        await adapter.on_event({"type": "token", "text": "Hello "})
        await adapter.on_event({"type": "token", "text": "world"})
        await adapter.on_event({
            "type": "sources",
            "sources": [{"title": "Doc", "url": "https://x.com"}],
        })
        await adapter.on_event({"type": "complete", "message": ""})

        result = adapter.to_dict()
        assert result["response"] == "Hello world"
        assert len(result["sources"]) == 1
        assert "error" not in result

    async def test_confirmation_request_signature_accepts_conversation_id(self):
        adapter = JSONResponseAdapter()
        await adapter.on_event({
            "type": "confirmation_request",
            "tool_name": "delete_user",
            "call_id": "call-1",
            "title": "Confirm delete",
            "message": "Are you sure?",
            "details": None,
            "confirm_payload": {"user_id": "u1"},
            "conversation_id": "conv-1",
        })
        assert len(adapter._confirmations) == 1


# ---------------------------------------------------------------------------
# SSEResponseAdapter
# ---------------------------------------------------------------------------

class TestSSEAdapterPersistence:
    def test_passes_base_params(self):
        queue = asyncio.Queue()
        adapter = SSEResponseAdapter(
            queue,
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        assert adapter.organization_id == 'org-1'
        assert adapter.channel == 'api'

    async def test_events_still_pushed_to_queue(self):
        queue = asyncio.Queue()
        adapter = SSEResponseAdapter(queue)
        await adapter.on_event({"type": "token", "text": "hi"})
        item = queue.get_nowait()
        assert "token" in item
        assert '"hi"' in item

    @patch('apps.mcp.services.session_resumption.finalize_turn', new_callable=AsyncMock)
    async def test_finalize_persistence_called(self, mock_finalize):
        queue = asyncio.Queue()
        adapter = SSEResponseAdapter(queue)
        adapter.assistant_message_id = 'msg-1'
        adapter._complete_response = 'done'
        await adapter.finalize_persistence()
        mock_finalize.assert_called_once()

    async def test_confirmation_request_signature_accepts_conversation_id(self):
        queue = asyncio.Queue()
        adapter = SSEResponseAdapter(queue)
        await adapter.on_event({
            "type": "confirmation_request",
            "tool_name": "delete_user",
            "call_id": "call-1",
            "title": "Confirm",
            "message": "Sure?",
            "details": None,
            "confirm_payload": {},
            "conversation_id": "conv-1",
        })
        item = queue.get_nowait()
        assert "confirmation_request" in item
