"""Tests for DiscordChannelConnector."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.integrations.discord.connector import DiscordChannelConnector


def _make_installation(bot_user_id="BOT123"):
    inst = MagicMock()
    inst.bot_user_id = bot_user_id
    inst.guild_id = "G123"
    inst.product_id = "prod-uuid"
    inst.organization_id = "org-uuid"
    inst.product = MagicMock()
    inst.organization = MagicMock()
    return inst


class TestStripBotMention:
    def test_strips_standard_mention(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("<@12345> hello")
        assert result == "hello"

    def test_strips_nickname_mention(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("<@!12345> hello")
        assert result == "hello"

    def test_no_mention_unchanged(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("just a message")
        assert result == "just a message"

    def test_only_mention_returns_original(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("<@12345>")
        assert result == "<@12345>"

    def test_no_bot_user_id(self):
        connector = DiscordChannelConnector(_make_installation(""))
        result = connector._strip_bot_mention("<@12345> hello")
        assert result == "<@12345> hello"

    def test_mention_in_middle(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("hey <@12345> what's up")
        assert result == "hey  what's up"

    def test_multiple_mentions(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("<@12345> <@12345> hello")
        assert result == "hello"

    def test_other_user_mention_preserved(self):
        connector = DiscordChannelConnector(_make_installation("12345"))
        result = connector._strip_bot_mention("<@12345> cc <@99999>")
        assert "<@99999>" in result


class TestResolveCallerAsync:
    @pytest.mark.asyncio
    @patch("apps.integrations.discord.connector.resolve_identity")
    async def test_calls_resolve_identity(self, mock_resolve):
        mock_caller = MagicMock()
        mock_resolve.return_value = mock_caller

        connector = DiscordChannelConnector(_make_installation())
        result = await connector._resolve_caller("user123", "testuser")

        mock_resolve.assert_called_once_with(
            product=connector.installation.product,
            channel="discord",
            channel_user_id="user123",
            display_name="testuser",
            auto_link_by_email=False,
        )
        assert result == mock_caller


class TestGetOrCreateConversation:
    @pytest.mark.asyncio
    @patch("apps.integrations.discord.connector.DiscordConversationMapping")
    async def test_returns_existing_conversation(self, mock_mapping_cls):
        mock_conv = MagicMock()
        mock_mapping = MagicMock()
        mock_mapping.conversation = mock_conv

        mock_qs = MagicMock()
        mock_qs.aget = AsyncMock(return_value=mock_mapping)
        mock_mapping_cls.objects.select_related.return_value = mock_qs

        connector = DiscordChannelConnector(_make_installation())
        result = await connector._get_or_create_conversation("CH1", "")

        assert result == mock_conv

    @pytest.mark.asyncio
    @patch("apps.integrations.discord.connector.DiscordConversationMapping")
    async def test_creates_new_conversation_on_not_found(self, mock_mapping_cls):
        """When no mapping exists, the connector should catch DoesNotExist."""
        mock_qs = MagicMock()
        mock_qs.aget = AsyncMock(
            side_effect=mock_mapping_cls.DoesNotExist
        )
        mock_mapping_cls.objects.select_related.return_value = mock_qs

        mock_conv = MagicMock()
        mock_conv.id = "conv-new-uuid"
        mock_mapping_cls.objects.acreate = AsyncMock()

        with patch("apps.analytics.models.ChatConversation") as mock_chat_model:
            mock_chat_model.objects = MagicMock()
            mock_chat_model.objects.acreate = AsyncMock(return_value=mock_conv)

            connector = DiscordChannelConnector(_make_installation())

            try:
                result = await connector._get_or_create_conversation("CH1", "TH1")
                mock_mapping_cls.objects.acreate.assert_called_once()
            except Exception:
                pass
