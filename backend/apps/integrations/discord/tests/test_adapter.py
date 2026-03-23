"""Tests for DiscordResponseAdapter."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.integrations.discord.adapter import DiscordResponseAdapter


def _make_adapter(**kwargs):
    installation = MagicMock()
    installation.bot_token = "fake-bot-token"
    defaults = {
        "installation": installation,
        "channel_id": "CH123",
        "thread_id": kwargs.pop("thread_id", ""),
        "interaction_token": kwargs.pop("interaction_token", ""),
        "application_id": kwargs.pop("application_id", ""),
    }
    defaults.update(kwargs)
    return DiscordResponseAdapter(**defaults)


class TestDiscordAdapterPersistence:
    def test_passes_base_params_to_super(self):
        adapter = _make_adapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        assert adapter.organization_id == 'org-1'
        assert adapter.product_id == 'prod-1'
        assert adapter.conversation_id == 'conv-1'
        assert adapter.channel == 'discord'

    async def test_finalize_calls_finalize_persistence_before_posting(self):
        adapter = _make_adapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        adapter._full_response = "Hello!"

        call_order = []

        async def mock_finalize_persistence():
            call_order.append('finalize_persistence')

        async def mock_send_message(**kwargs):
            call_order.append('send_message')
            return {}

        adapter.finalize_persistence = mock_finalize_persistence
        adapter._send_message = mock_send_message

        await adapter.finalize()
        assert call_order == ['finalize_persistence', 'send_message']

    async def test_finalize_posts_embed_with_display_tokens(self):
        adapter = _make_adapter()
        adapter._display_tokens = ["final ", "answer"]
        adapter._full_response = ""

        call_order = []

        async def mock_finalize_persistence():
            call_order.append('finalize_persistence')

        async def mock_send_message(**kwargs):
            call_order.append('send_message')
            return {}

        adapter.finalize_persistence = mock_finalize_persistence
        adapter._send_message = mock_send_message

        await adapter.finalize()
        assert 'send_message' in call_order

    async def test_on_token_appends_to_display_tokens(self):
        adapter = _make_adapter()
        await adapter.on_event({"type": "token", "text": "hello"})
        await adapter.on_event({"type": "token", "text": " world"})
        assert adapter._display_tokens == ["hello", " world"]
        assert adapter._persistence_tokens == ["hello", " world"]


class TestTokenAccumulation:
    @pytest.mark.asyncio
    async def test_tokens_accumulate(self):
        adapter = _make_adapter()
        await adapter.on_token("Hello ")
        await adapter.on_token("world")
        assert adapter._display_tokens == ["Hello ", "world"]


class TestOnProgress:
    @pytest.mark.asyncio
    async def test_clears_tokens_on_tool_call_active(self):
        adapter = _make_adapter()
        await adapter.on_token("some reasoning")
        await adapter.on_progress({"kind": "tool_call", "status": "active"})
        assert adapter._display_tokens == []

    @pytest.mark.asyncio
    async def test_clears_tokens_on_search_active(self):
        adapter = _make_adapter()
        await adapter.on_token("thinking...")
        await adapter.on_progress({"kind": "search", "status": "active"})
        assert adapter._display_tokens == []

    @pytest.mark.asyncio
    async def test_no_clear_on_tool_call_complete(self):
        adapter = _make_adapter()
        await adapter.on_token("text")
        await adapter.on_progress({"kind": "tool_call", "status": "complete"})
        assert adapter._display_tokens == ["text"]

    @pytest.mark.asyncio
    async def test_no_clear_on_other_kinds(self):
        adapter = _make_adapter()
        await adapter.on_token("text")
        await adapter.on_progress({"kind": "thinking", "status": "active"})
        assert adapter._display_tokens == ["text"]


class TestOnConfirmationRequest:
    @pytest.mark.asyncio
    async def test_appends_to_pending(self):
        adapter = _make_adapter()
        await adapter.on_confirmation_request(
            tool_name="create_plan",
            call_id="c1",
            title="Create Plan",
            message="Are you sure?",
            details=None,
            confirm_payload={"plan": "test"},
            conversation_id="conv-1",
        )
        assert len(adapter._pending_confirmations) == 1
        assert adapter._pending_confirmations[0]["tool_name"] == "create_plan"

    @pytest.mark.asyncio
    async def test_multiple_confirmations(self):
        adapter = _make_adapter()
        await adapter.on_confirmation_request("t1", "c1", "T1", "M1", None, {})
        await adapter.on_confirmation_request("t2", "c2", "T2", "M2", None, {})
        assert len(adapter._pending_confirmations) == 2


class TestOnComplete:
    @pytest.mark.asyncio
    async def test_stores_full_response(self):
        adapter = _make_adapter()
        await adapter.on_complete({"message": "Final answer"})
        assert adapter._full_response == "Final answer"

    @pytest.mark.asyncio
    async def test_falls_back_to_tokens(self):
        adapter = _make_adapter()
        await adapter.on_token("Hello ")
        await adapter.on_token("world")
        await adapter.on_complete({})
        assert adapter._full_response == "Hello world"


class TestFinalize:
    @pytest.mark.asyncio
    async def test_empty_no_send(self):
        adapter = _make_adapter()
        adapter._send_message = AsyncMock()
        adapter.finalize_persistence = AsyncMock()
        await adapter.finalize()
        adapter._send_message.assert_not_called()

    @pytest.mark.asyncio
    async def test_sends_embed_for_text(self):
        adapter = _make_adapter()
        adapter._send_message = AsyncMock()
        adapter.finalize_persistence = AsyncMock()
        await adapter.on_token("Hello world")
        await adapter.finalize()

        adapter._send_message.assert_called_once()
        call_kwargs = adapter._send_message.call_args
        embeds = call_kwargs.kwargs.get("embeds") or call_kwargs[1].get("embeds")
        assert embeds is not None
        assert "Hello world" in embeds[0]["description"]

    @pytest.mark.asyncio
    @patch("apps.integrations.discord.adapter.build_confirmation_embed")
    async def test_sends_confirmations(self, mock_build_conf):
        mock_build_conf.return_value = (
            {"description": "Confirm?", "color": 0xFEE75C},
            [{"type": 1, "components": []}],
        )
        adapter = _make_adapter()
        adapter._send_message = AsyncMock()
        adapter.finalize_persistence = AsyncMock()
        await adapter.on_confirmation_request(
            "tool", "c1", "Title", "Msg", None, {"key": "val"}
        )
        await adapter.finalize()

        assert adapter._send_message.call_count == 1
        call_kwargs = adapter._send_message.call_args
        assert call_kwargs.kwargs.get("components") is not None


class TestSendMessage:
    @pytest.mark.asyncio
    @patch("apps.integrations.discord.adapter.httpx.AsyncClient")
    async def test_posts_to_channel(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "msg123"}
        mock_resp.raise_for_status = MagicMock()
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        adapter = _make_adapter()
        result = await adapter._send_message(embeds=[{"description": "Hi"}])

        mock_client.post.assert_called_once()
        url = mock_client.post.call_args[0][0]
        assert "/channels/CH123/messages" in url

    @pytest.mark.asyncio
    @patch("apps.integrations.discord.adapter.httpx.AsyncClient")
    async def test_uses_interaction_webhook(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "msg123"}
        mock_resp.raise_for_status = MagicMock()
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        adapter = _make_adapter(
            interaction_token="int-token-123",
            application_id="app-id-456",
        )
        result = await adapter._send_message(embeds=[{"description": "Hi"}])

        url = mock_client.post.call_args[0][0]
        assert "/webhooks/app-id-456/int-token-123" in url

    @pytest.mark.asyncio
    @patch("apps.integrations.discord.adapter.httpx.AsyncClient")
    async def test_components_included(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "msg123"}
        mock_resp.raise_for_status = MagicMock()
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        adapter = _make_adapter()
        components = [{"type": 1, "components": []}]
        await adapter._send_message(
            embeds=[{"description": "Hi"}],
            components=components,
        )

        payload = mock_client.post.call_args.kwargs.get("json") or mock_client.post.call_args[1].get("json")
        assert payload["components"] == components


class TestPostChannelId:
    def test_uses_thread_id_when_set(self):
        adapter = _make_adapter(thread_id="TH456")
        assert adapter._post_channel_id == "TH456"

    def test_uses_channel_id_when_no_thread(self):
        adapter = _make_adapter()
        assert adapter._post_channel_id == "CH123"
