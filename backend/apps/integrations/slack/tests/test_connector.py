"""Tests for SlackChannelConnector."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.integrations.slack.connector import SlackChannelConnector


class TestStripBotMention:
    def setup_method(self):
        installation = MagicMock()
        installation.bot_user_id = "U_BOT_123"
        installation.team_id = "T123"
        installation.product_id = "prod-1"
        installation.organization_id = "org-1"
        self.connector = SlackChannelConnector(installation)

    def test_removes_bot_mention(self):
        result = self.connector._strip_bot_mention("<@U_BOT_123> hello world")
        assert result == "hello world"

    def test_removes_bot_mention_in_middle(self):
        result = self.connector._strip_bot_mention("hey <@U_BOT_123> what's up")
        assert result == "hey  what's up"

    def test_no_mention_returns_original(self):
        result = self.connector._strip_bot_mention("hello world")
        assert result == "hello world"

    def test_only_mention_returns_original(self):
        result = self.connector._strip_bot_mention("<@U_BOT_123>")
        assert result == "<@U_BOT_123>"

    def test_other_user_mention_preserved(self):
        result = self.connector._strip_bot_mention("<@U_OTHER> hello")
        assert "<@U_OTHER>" in result
