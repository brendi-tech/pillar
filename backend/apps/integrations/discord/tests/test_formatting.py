"""Tests for Discord formatting utilities."""
import pytest
from unittest.mock import patch

from apps.integrations.discord.formatting import (
    build_confirmation_embed,
    build_error_embed,
    build_response_embed,
    split_long_response,
    EMBED_DESCRIPTION_LIMIT,
    EMBED_FIELDS_LIMIT,
    PILLAR_BLURPLE,
)


class TestBuildResponseEmbed:
    def test_basic_embed(self):
        embed = build_response_embed("Hello world")
        assert embed["description"] == "Hello world"
        assert embed["color"] == PILLAR_BLURPLE
        assert embed["footer"]["text"] == "Powered by Pillar"
        assert "fields" not in embed

    def test_with_sources(self):
        sources = [
            {"title": "Doc A", "url": "https://example.com/a"},
            {"title": "Doc B", "url": "https://example.com/b"},
        ]
        embed = build_response_embed("Answer", sources)
        assert "fields" in embed
        assert len(embed["fields"]) == 1
        assert embed["fields"][0]["name"] == "Sources"
        assert "[Doc A]" in embed["fields"][0]["value"]
        assert "[Doc B]" in embed["fields"][0]["value"]

    def test_sources_without_url(self):
        sources = [{"title": "Plain Source"}]
        embed = build_response_embed("Answer", sources)
        assert "Plain Source" in embed["fields"][0]["value"]

    def test_description_truncated_at_limit(self):
        long_text = "A" * (EMBED_DESCRIPTION_LIMIT + 500)
        embed = build_response_embed(long_text)
        assert len(embed["description"]) == EMBED_DESCRIPTION_LIMIT

    def test_custom_color(self):
        embed = build_response_embed("Hello", color=0xFF0000)
        assert embed["color"] == 0xFF0000

    def test_empty_sources_no_fields(self):
        embed = build_response_embed("Hello", sources=[])
        assert "fields" not in embed


class TestBuildErrorEmbed:
    def test_error_embed(self):
        embed = build_error_embed("Something broke")
        assert "Something broke" in embed["description"]
        assert embed["color"] == 0xED4245
        assert embed["footer"]["text"] == "Powered by Pillar"


class TestSplitLongResponse:
    def test_short_message_single_chunk(self):
        chunks = split_long_response("Hello world")
        assert chunks == ["Hello world"]

    def test_exact_limit_single_chunk(self):
        text = "A" * 2000
        chunks = split_long_response(text, limit=2000)
        assert len(chunks) == 1

    def test_long_message_split(self):
        text = "A" * 2500
        chunks = split_long_response(text, limit=2000)
        assert len(chunks) == 2
        assert len(chunks[0]) <= 2000

    def test_split_on_newline(self):
        text = "Line one\n" * 300
        chunks = split_long_response(text, limit=2000)
        assert all(len(c) <= 2000 for c in chunks)

    def test_split_on_space(self):
        text = "word " * 500
        chunks = split_long_response(text, limit=2000)
        assert all(len(c) <= 2000 for c in chunks)


class TestBuildConfirmationEmbed:
    @patch("apps.integrations.discord.formatting.cache")
    def test_basic_confirmation(self, mock_cache):
        embed, components = build_confirmation_embed(
            tool_name="create_plan",
            call_id="call_123",
            title="Create Plan",
            message="Are you sure you want to create this plan?",
            details=None,
            confirm_payload={"plan_name": "Test"},
        )

        assert "Create Plan" in embed["description"]
        assert "Are you sure" in embed["description"]
        assert embed["color"] == 0xFEE75C

        assert len(components) == 1
        action_row = components[0]
        assert action_row["type"] == 1
        buttons = action_row["components"]
        assert len(buttons) == 2

        confirm_btn = buttons[0]
        assert confirm_btn["type"] == 2
        assert confirm_btn["style"] == 3
        assert confirm_btn["label"] == "Confirm"
        assert confirm_btn["custom_id"].startswith("pillar_confirm:")

        cancel_btn = buttons[1]
        assert cancel_btn["type"] == 2
        assert cancel_btn["style"] == 4
        assert cancel_btn["label"] == "Cancel"
        assert cancel_btn["custom_id"].startswith("pillar_cancel:")

    @patch("apps.integrations.discord.formatting.cache")
    def test_with_details(self, mock_cache):
        details = {"Plan Name": "Enterprise", "Price": "$99/mo"}
        embed, _ = build_confirmation_embed(
            tool_name="create_plan",
            call_id="call_123",
            title="Create Plan",
            message="",
            details=details,
            confirm_payload={},
        )

        assert "fields" in embed
        field_names = [f["name"] for f in embed["fields"]]
        assert "Plan Name" in field_names
        assert "Price" in field_names

    @patch("apps.integrations.discord.formatting.cache")
    def test_payload_stored_in_redis(self, mock_cache):
        payload = {"key": "value"}
        build_confirmation_embed(
            tool_name="test",
            call_id="c1",
            title="Title",
            message="Msg",
            details=None,
            confirm_payload=payload,
        )

        mock_cache.set.assert_called_once()
        call_args = mock_cache.set.call_args
        key = call_args[0][0]
        stored_data = call_args[0][1]
        assert key.startswith("discord_confirm:")
        assert stored_data["tool_name"] == "test"
        assert stored_data["confirm_payload"] == payload
        assert call_args[1]["timeout"] == 3600

    @patch("apps.integrations.discord.formatting.cache")
    def test_custom_id_within_100_chars(self, mock_cache):
        _, components = build_confirmation_embed(
            tool_name="very_long_tool_name_that_should_not_matter",
            call_id="a" * 50,
            title="T",
            message="M",
            details=None,
            confirm_payload={},
        )
        for btn in components[0]["components"]:
            assert len(btn["custom_id"]) <= 100

    @patch("apps.integrations.discord.formatting.cache")
    def test_conversation_id_stored(self, mock_cache):
        build_confirmation_embed(
            tool_name="t",
            call_id="c",
            title="T",
            message="M",
            details=None,
            confirm_payload={},
            conversation_id="conv-123",
        )

        stored_data = mock_cache.set.call_args[0][1]
        assert stored_data["conversation_id"] == "conv-123"

    @patch("apps.integrations.discord.formatting.cache")
    def test_details_field_values_truncated(self, mock_cache):
        details = {"key": "V" * 2000}
        embed, _ = build_confirmation_embed(
            tool_name="t",
            call_id="c",
            title="T",
            message="M",
            details=details,
            confirm_payload={},
        )
        assert len(embed["fields"][0]["value"]) <= 1024
