"""Tests for SlackResponseAdapter."""
import pytest
from unittest.mock import AsyncMock, MagicMock, call, patch

from apps.integrations.slack.adapter import SlackResponseAdapter


def _make_adapter(**kwargs):
    installation = MagicMock()
    installation.team_id = "T123"
    installation.get_client.return_value = MagicMock()
    defaults = {
        "installation": installation,
        "channel_id": "C123",
        "thread_ts": "1234.5678",
    }
    defaults.update(kwargs)
    return SlackResponseAdapter(**defaults)


# ---------------------------------------------------------------------------
# Existing tests: _build_response_blocks
# ---------------------------------------------------------------------------

class TestBuildResponseBlocks:
    def setup_method(self):
        self.adapter = _make_adapter()

    def test_simple_text_produces_section_block(self):
        blocks = self.adapter._build_response_blocks("Hello world", [])
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"
        assert blocks[0]["text"]["text"] == "Hello world"

    def test_with_sources_adds_divider_and_context(self):
        sources = [{"title": "Doc", "url": "https://example.com/doc"}]
        blocks = self.adapter._build_response_blocks("Answer", sources)
        types = [b["type"] for b in blocks]
        assert "divider" in types
        assert "context" in types

    def test_long_text_splits_into_multiple_blocks(self):
        long_text = "A" * 6000
        blocks = self.adapter._build_response_blocks(long_text, [])
        section_blocks = [b for b in blocks if b["type"] == "section"]
        assert len(section_blocks) >= 2

    def test_markdown_converted_to_mrkdwn(self):
        blocks = self.adapter._build_response_blocks("**bold text**", [])
        assert blocks[0]["text"]["text"] == "*bold text*"

    def test_empty_sources_no_divider(self):
        blocks = self.adapter._build_response_blocks("Hello", [])
        types = [b["type"] for b in blocks]
        assert "divider" not in types


# ---------------------------------------------------------------------------
# Persistence integration
# ---------------------------------------------------------------------------

class TestSlackAdapterPersistence:
    def test_passes_base_params_to_super(self):
        adapter = _make_adapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        assert adapter.organization_id == 'org-1'
        assert adapter.product_id == 'prod-1'
        assert adapter.conversation_id == 'conv-1'
        assert adapter.channel == 'slack'

    async def test_finalize_calls_finalize_persistence_before_posting(self):
        adapter = _make_adapter(
            organization_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
        )
        adapter._full_response = "Hello!"

        call_order = []

        original_finalize = adapter.finalize_persistence

        async def mock_finalize_persistence():
            call_order.append('finalize_persistence')

        async def mock_post_message(blocks, fallback_text=""):
            call_order.append('post_message')

        adapter.finalize_persistence = mock_finalize_persistence
        adapter._post_message = mock_post_message

        await adapter.finalize()
        assert call_order == ['finalize_persistence', 'post_message']

    async def test_display_tokens_cleared_on_progress_tool_call(self):
        adapter = _make_adapter()
        await adapter.on_event({"type": "token", "text": "thinking..."})
        await adapter.on_event({"type": "token", "text": " maybe"})

        await adapter.on_event({
            "type": "progress",
            "data": {"kind": "tool_call", "status": "active"},
        })

        assert adapter._display_tokens == []
        assert adapter._persistence_tokens == ["thinking...", " maybe"]

    async def test_finalize_posts_using_display_tokens(self):
        adapter = _make_adapter()

        await adapter.on_event({"type": "token", "text": "intermediate "})
        await adapter.on_event({
            "type": "progress",
            "data": {"kind": "tool_call", "status": "active"},
        })
        await adapter.on_event({"type": "token", "text": "final answer"})
        await adapter.on_event({"type": "complete", "message": ""})

        assert adapter._full_response == "final answer"
        assert "intermediate " in ''.join(adapter._persistence_tokens)

    async def test_on_complete_uses_display_tokens(self):
        adapter = _make_adapter()
        adapter._display_tokens = ["display ", "text"]
        await adapter.on_complete({"type": "complete", "message": ""})
        assert adapter._full_response == "display text"
