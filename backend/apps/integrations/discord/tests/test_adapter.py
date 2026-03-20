"""Tests for DiscordResponseAdapter persistence integration."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.integrations.discord.adapter import DiscordResponseAdapter


def _make_adapter(**kwargs):
    installation = MagicMock()
    installation.bot_token = "fake-bot-token"
    defaults = {
        "installation": installation,
        "channel_id": "123456789",
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
