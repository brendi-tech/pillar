"""
Tests for WebResponseAdapter (web SDK queue-based channel).

Mocks analytics logging, ChatMessage ORM, session resumption, and image summary.
"""
import uuid

from unittest.mock import AsyncMock, MagicMock, patch

from apps.analytics.models import ChatMessage
from apps.mcp.services.agent.web_adapter import WebResponseAdapter


def _make_adapter(**kwargs):
    defaults = {
        'organization_id': 'org-1',
        'product_id': 'prod-1',
        'conversation_id': '',
        'channel': 'web',
        'request_metadata': {
            'page_url': 'https://app.example/page',
            'user_agent': 'Mozilla/5.0',
            'ip_address': '203.0.113.1',
            'referer': 'https://ref.example/',
            'external_session_id': 'sess-ext',
            'skip_analytics': False,
            'visitor_id': 'vis-1',
            'external_user_id': 'ext-user-1',
        },
    }
    defaults.update(kwargs)
    return WebResponseAdapter(**defaults)


# ---------------------------------------------------------------------------
# prepare_turn
# ---------------------------------------------------------------------------


class TestWebAdapterPrepareTurn:
    @patch('apps.mcp.services.image_summary_service.get_cached_summary', return_value=None)
    @patch('apps.analytics.services.ConversationLoggingService')
    async def test_calls_conversation_logging_service(self, mock_svc_cls, _mock_summary):
        mock_instance = MagicMock()
        mock_instance.create_conversation_and_user_message = AsyncMock()
        mock_svc_cls.return_value = mock_instance

        adapter = _make_adapter()
        await adapter.prepare_turn('Hello world')

        mock_instance.create_conversation_and_user_message.assert_called_once()
        call_kw = mock_instance.create_conversation_and_user_message.call_args.kwargs
        assert call_kw['organization_id'] == 'org-1'
        assert call_kw['product_id'] == 'prod-1'
        assert call_kw['question'] == 'Hello world'
        assert call_kw['query_type'] == 'ask'
        assert call_kw['page_url'] == 'https://app.example/page'
        assert call_kw['user_agent'] == 'Mozilla/5.0'
        assert call_kw['ip_address'] == '203.0.113.1'
        assert call_kw['referer'] == 'https://ref.example/'
        assert call_kw['external_session_id'] == 'sess-ext'
        assert call_kw['skip_analytics'] is False
        assert call_kw['visitor_id'] == 'vis-1'
        assert call_kw['external_user_id'] == 'ext-user-1'
        assert call_kw['conversation_id'] == adapter.conversation_id
        assert call_kw['user_message_id'] != call_kw['assistant_message_id']
        assert call_kw['images'] is None

    @patch('apps.mcp.services.image_summary_service.get_cached_summary', return_value=None)
    @patch('apps.analytics.services.ConversationLoggingService')
    async def test_pushes_conversation_started_to_queue(self, mock_svc_cls, _mock_summary):
        mock_instance = MagicMock()
        mock_instance.create_conversation_and_user_message = AsyncMock()
        mock_svc_cls.return_value = mock_instance

        adapter = _make_adapter()
        assistant_id = await adapter.prepare_turn('Hi')

        first = adapter._output_queue.get_nowait()
        assert first == {
            'type': 'conversation_started',
            'conversation_id': adapter.conversation_id,
            'assistant_message_id': assistant_id,
        }

    @patch('apps.mcp.services.image_summary_service.get_cached_summary', return_value=None)
    @patch('apps.analytics.services.ConversationLoggingService')
    async def test_sets_assistant_message_id(self, mock_svc_cls, _mock_summary):
        mock_instance = MagicMock()
        mock_instance.create_conversation_and_user_message = AsyncMock()
        mock_svc_cls.return_value = mock_instance

        adapter = _make_adapter()
        returned = await adapter.prepare_turn('Q')
        assert adapter.assistant_message_id == returned
        assert uuid.UUID(adapter.assistant_message_id)  # valid UUID string


# ---------------------------------------------------------------------------
# prepare_resume
# ---------------------------------------------------------------------------


class TestWebAdapterPrepareResume:
    @patch.object(ChatMessage.objects, 'acreate', new_callable=AsyncMock)
    async def test_creates_assistant_message_only(self, mock_acreate):
        adapter = _make_adapter()
        await adapter.prepare_resume('conv-existing', 'asst-resume-1')

        mock_acreate.assert_called_once()
        kwargs = mock_acreate.call_args.kwargs
        assert kwargs['id'] == 'asst-resume-1'
        assert kwargs['organization_id'] == 'org-1'
        assert kwargs['product_id'] == 'prod-1'
        assert kwargs['conversation_id'] == 'conv-existing'
        assert kwargs['role'] == ChatMessage.Role.ASSISTANT
        assert kwargs['content'] == ''
        assert kwargs['streaming_status'] == ChatMessage.StreamingStatus.STREAMING

    @patch.object(ChatMessage.objects, 'acreate', new_callable=AsyncMock)
    async def test_pushes_conversation_started(self, _mock_acreate):
        adapter = _make_adapter()
        await adapter.prepare_resume('conv-2', 'asst-2')

        first = adapter._output_queue.get_nowait()
        assert first == {
            'type': 'conversation_started',
            'conversation_id': 'conv-2',
            'assistant_message_id': 'asst-2',
        }

    @patch.object(ChatMessage.objects, 'acreate', new_callable=AsyncMock)
    async def test_sets_both_ids(self, _mock_acreate):
        adapter = _make_adapter()
        await adapter.prepare_resume('conv-3', 'asst-3')
        assert adapter.conversation_id == 'conv-3'
        assert adapter.assistant_message_id == 'asst-3'


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------


class TestWebAdapterEventHandlers:
    async def test_on_token_pushes_to_queue(self):
        adapter = _make_adapter()
        await adapter.on_token('chunk')
        item = adapter._output_queue.get_nowait()
        assert item == {'type': 'token', 'text': 'chunk'}

    async def test_on_sources_pushes_to_queue(self):
        adapter = _make_adapter()
        src = [{'title': 'Doc', 'url': 'https://x'}]
        await adapter.on_sources(src)
        item = adapter._output_queue.get_nowait()
        assert item == {'type': 'sources', 'sources': src}

    async def test_on_complete_includes_ids(self):
        adapter = _make_adapter()
        adapter.conversation_id = 'c-final'
        adapter.assistant_message_id = 'a-final'
        await adapter.on_complete({'type': 'complete', 'message': 'done'})
        item = adapter._output_queue.get_nowait()
        assert item['type'] == 'complete'
        assert item['message'] == 'done'
        assert item['conversation_id'] == 'c-final'
        assert item['assistant_message_id'] == 'a-final'

    async def test_on_error_pushes_error_event(self):
        adapter = _make_adapter()
        await adapter.on_error('boom', details={'code': 1})
        item = adapter._output_queue.get_nowait()
        assert item == {'type': 'error', 'message': 'boom'}

    async def test_on_progress_pushes_to_queue(self):
        adapter = _make_adapter()
        data = {'phase': 'thinking'}
        await adapter.on_progress(data)
        item = adapter._output_queue.get_nowait()
        assert item == {'type': 'progress', 'data': data}


# ---------------------------------------------------------------------------
# events() generator
# ---------------------------------------------------------------------------


class TestWebAdapterEventsGenerator:
    async def test_yields_all_queued_events(self):
        adapter = _make_adapter()
        await adapter._output_queue.put({'type': 'token', 'text': 'a'})
        await adapter._output_queue.put({'type': 'token', 'text': 'b'})
        await adapter._output_queue.put({'type': 'sources', 'sources': []})
        await adapter._output_queue.put(None)

        out = [e async for e in adapter.events()]
        assert len(out) == 3
        assert out[0]['text'] == 'a'
        assert out[1]['text'] == 'b'
        assert out[2]['type'] == 'sources'

    async def test_stops_on_none_sentinel(self):
        adapter = _make_adapter()
        await adapter._output_queue.put(None)
        out = [e async for e in adapter.events()]
        assert out == []


# ---------------------------------------------------------------------------
# finalize
# ---------------------------------------------------------------------------


class TestWebAdapterFinalize:
    @patch('apps.mcp.services.session_resumption.mark_completed', new_callable=AsyncMock)
    async def test_calls_finalize_persistence(self, _mock_mark):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-1'
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock) as mock_fp:
            with patch('apps.mcp.services.agent.web_adapter.time.time', return_value=1000.0):
                await adapter.finalize()
            mock_fp.assert_called_once()

    @patch('apps.mcp.services.session_resumption.mark_completed', new_callable=AsyncMock)
    async def test_calls_mark_completed(self, mock_mark):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-1'
        adapter._stream_start_time = 100.0
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock):
            with patch('apps.mcp.services.agent.web_adapter.time.time', return_value=100.25):
                await adapter.finalize()
        mock_mark.assert_called_once_with('msg-1', latency_ms=250)

    @patch('apps.mcp.services.session_resumption.mark_completed', new_callable=AsyncMock)
    async def test_pushes_none_sentinel(self, _mock_mark):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-1'
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock):
            with patch('apps.mcp.services.agent.web_adapter.time.time', return_value=0.0):
                await adapter.finalize()
        assert adapter._output_queue.get_nowait() is None


# ---------------------------------------------------------------------------
# finalize_disconnected
# ---------------------------------------------------------------------------


class TestWebAdapterFinalizeDisconnected:
    @patch('apps.mcp.services.session_resumption.mark_disconnected', new_callable=AsyncMock)
    async def test_calls_finalize_persistence(self, _mock_md):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-d'
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock) as mock_fp:
            await adapter.finalize_disconnected()
        mock_fp.assert_called_once()

    @patch('apps.mcp.services.session_resumption.mark_completed', new_callable=AsyncMock)
    @patch('apps.mcp.services.session_resumption.mark_disconnected', new_callable=AsyncMock)
    async def test_calls_mark_disconnected(self, mock_mark_disconnected, mock_mark_completed):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-d2'
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock):
            await adapter.finalize_disconnected()
        mock_mark_disconnected.assert_called_once_with('msg-d2')
        mock_mark_completed.assert_not_called()

    @patch('apps.mcp.services.session_resumption.mark_disconnected', new_callable=AsyncMock)
    async def test_pushes_none_sentinel(self, _mock_md):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'msg-d3'
        with patch.object(adapter, 'finalize_persistence', new_callable=AsyncMock):
            await adapter.finalize_disconnected()
        assert adapter._output_queue.get_nowait() is None


# ---------------------------------------------------------------------------
# _do_flush (incremental)
# ---------------------------------------------------------------------------


class TestWebAdapterFlush:
    async def test_incremental_flush_includes_token_counts(self):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'flush-msg'
        adapter._persistence_tokens = ['hello']
        adapter._llm_messages = []
        adapter._registered_tools = []
        adapter.on_state_checkpoint({
            'llm_messages': [],
            'registered_tools': [],
            'model_used': '',
            'display_trace': [],
            'prompt_tokens': 100,
            'completion_tokens': 50,
        })

        mock_qs = MagicMock()
        mock_qs.aupdate = AsyncMock()
        with patch.object(ChatMessage.objects, 'filter', return_value=mock_qs) as mock_filter:
            await adapter._do_flush()

        mock_filter.assert_called_once_with(id='flush-msg', role='assistant')
        kw = mock_qs.aupdate.call_args.kwargs
        assert kw['prompt_tokens'] == 100
        assert kw['completion_tokens'] == 50
        assert kw['total_tokens'] == 150

    async def test_incremental_flush_includes_peak_context_occupancy(self):
        adapter = _make_adapter()
        adapter.assistant_message_id = 'flush-msg-2'
        adapter._persistence_tokens = []
        adapter._llm_messages = []
        adapter._registered_tools = []
        adapter.on_state_checkpoint({
            'llm_messages': [],
            'registered_tools': [],
            'model_used': '',
            'display_trace': [],
            'peak_context_occupancy': 0.82,
        })

        mock_qs = MagicMock()
        mock_qs.aupdate = AsyncMock()
        with patch.object(ChatMessage.objects, 'filter', return_value=mock_qs):
            await adapter._do_flush()

        kw = mock_qs.aupdate.call_args.kwargs
        assert kw['peak_context_occupancy'] == 0.82
