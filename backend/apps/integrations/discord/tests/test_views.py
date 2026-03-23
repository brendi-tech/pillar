"""Tests for Discord integration views."""
import json

import pytest
from django.test import RequestFactory, TestCase, override_settings
from unittest.mock import MagicMock, patch

from apps.integrations.discord.views import (
    DiscordInteractionsView,
    _verify_discord_signature,
)


class TestVerifyDiscordSignature:
    """Test Ed25519 signature verification with per-installation lookup."""

    @override_settings(DISCORD_PUBLIC_KEY="")
    @patch("apps.integrations.discord.views.DiscordInstallation.objects")
    def test_no_key_anywhere_passes_with_warning(self, mock_qs):
        """When no public key exists (env or DB), verification passes (dev mode)."""
        from apps.integrations.discord.models import DiscordInstallation
        mock_qs.get.side_effect = DiscordInstallation.DoesNotExist

        request = MagicMock()
        request.body = b'{"type": 1, "application_id": "unknown-app"}'
        verified, installation = _verify_discord_signature(request)
        assert verified is True
        assert installation is None

    @override_settings(DISCORD_PUBLIC_KEY="aabbccdd")
    def test_invalid_signature_rejected_with_global_key(self):
        request = MagicMock()
        request.headers = {
            "X-Signature-Ed25519": "0" * 128,
            "X-Signature-Timestamp": "1234567890",
        }
        request.body = b'{"type": 1}'
        verified, installation = _verify_discord_signature(request)
        assert verified is False
        assert installation is None

    @override_settings(DISCORD_PUBLIC_KEY="aabbccdd")
    def test_missing_headers_rejected(self):
        request = MagicMock()
        request.headers = {}
        request.body = b'{"type": 1}'
        verified, installation = _verify_discord_signature(request)
        assert verified is False
        assert installation is None

    @override_settings(DISCORD_PUBLIC_KEY="")
    @patch("apps.integrations.discord.views.DiscordInstallation.objects")
    def test_lookup_by_application_id(self, mock_qs):
        """When application_id is in payload, looks up installation for public key."""
        mock_inst = MagicMock()
        mock_inst.app_public_key = "deadbeef"
        mock_qs.get.return_value = mock_inst

        request = MagicMock()
        request.headers = {
            "X-Signature-Ed25519": "0" * 128,
            "X-Signature-Timestamp": "1234567890",
        }
        request.body = b'{"type": 1, "application_id": "123456"}'

        verified, installation = _verify_discord_signature(request)
        mock_qs.get.assert_called_once_with(application_id="123456", is_active=True)
        assert installation is mock_inst
        assert verified is False  # signature is invalid, but key was found

    @override_settings(DISCORD_PUBLIC_KEY="")
    @patch("apps.integrations.discord.views.DiscordInstallation.objects")
    def test_installation_not_found_falls_through(self, mock_qs):
        """When no installation matches application_id, falls through to global key."""
        from apps.integrations.discord.models import DiscordInstallation
        mock_qs.get.side_effect = DiscordInstallation.DoesNotExist

        request = MagicMock()
        request.body = b'{"type": 1, "application_id": "unknown"}'

        verified, installation = _verify_discord_signature(request)
        assert verified is True  # no key anywhere -> passes in dev mode
        assert installation is None


class TestDiscordInteractionsView(TestCase):
    """Test the interactions endpoint for pings, commands, and components."""

    def setUp(self):
        self.factory = RequestFactory()
        self.view = DiscordInteractionsView.as_view()

    def _make_request(self, payload: dict):
        request = self.factory.post(
            "/api/integrations/discord/interactions/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        return request

    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_ping_returns_type_1(self, _mock_verify):
        request = self._make_request({"type": 1})
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 1

    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(False, None),
    )
    def test_invalid_signature_returns_401(self, _mock_verify):
        request = self._make_request({"type": 1})
        response = self.view(request)
        assert response.status_code == 401

    @patch("apps.integrations.discord.views.TaskRouter")
    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_slash_ask_returns_type_5_deferred(self, _mock_verify, mock_router):
        payload = {
            "type": 2,
            "data": {
                "name": "pillar",
                "options": [{
                    "name": "ask",
                    "options": [{"name": "question", "value": "What is billing?"}],
                }],
            },
            "guild_id": "G123",
            "channel_id": "CH123",
            "member": {"user": {"id": "U123", "username": "testuser"}},
            "token": "int-token",
            "application_id": "app-id",
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 5
        mock_router.execute.assert_called_once()

    @patch("apps.integrations.discord.views.TaskRouter")
    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_slash_connect_dispatches_account_link(self, _mock_verify, mock_router):
        payload = {
            "type": 2,
            "data": {
                "name": "pillar",
                "options": [{"name": "connect"}],
            },
            "guild_id": "G123",
            "member": {"user": {"id": "U123", "username": "testuser"}},
            "token": "int-token",
            "application_id": "app-id",
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 5
        mock_router.execute.assert_called_once_with(
            "discord-account-link",
            guild_id="G123",
            user_id="U123",
            interaction_token="int-token",
            application_id="app-id",
        )

    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_unknown_command_shows_help(self, _mock_verify):
        payload = {
            "type": 2,
            "data": {"name": "pillar", "options": [{"name": "help"}]},
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 4
        assert "/pillar ask" in data["data"]["content"]

    @patch("apps.integrations.discord.views.cache")
    @patch("apps.integrations.discord.views.TaskRouter")
    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_component_confirm_dispatches_hatchet(self, _mock_verify, mock_router, mock_cache):
        confirm_data = {"tool_name": "create_plan", "call_id": "c1", "confirm_payload": {}}
        mock_cache.get.return_value = confirm_data

        payload = {
            "type": 3,
            "data": {"custom_id": "pillar_confirm:ref123"},
            "guild_id": "G123",
            "channel_id": "CH123",
            "member": {"user": {"id": "U123", "username": "testuser"}},
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 5
        mock_router.execute.assert_called_once()
        mock_cache.delete.assert_called_once_with("ref123")

    @patch("apps.integrations.discord.views.cache")
    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_component_cancel_returns_cancelled(self, _mock_verify, mock_cache):
        mock_cache.get.return_value = {"some": "data"}

        payload = {
            "type": 3,
            "data": {"custom_id": "pillar_cancel:ref123"},
            "guild_id": "G123",
            "channel_id": "CH123",
            "member": {"user": {"id": "U123", "username": "testuser"}},
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 4
        assert "cancelled" in data["data"]["content"].lower()

    @patch("apps.integrations.discord.views.cache")
    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_component_expired_confirmation(self, _mock_verify, mock_cache):
        mock_cache.get.return_value = None

        payload = {
            "type": 3,
            "data": {"custom_id": "pillar_confirm:expired_ref"},
            "guild_id": "G123",
            "channel_id": "CH123",
            "member": {"user": {"id": "U123"}},
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert data["type"] == 4
        assert "expired" in data["data"]["content"].lower()

    @patch(
        "apps.integrations.discord.views._verify_discord_signature",
        return_value=(True, None),
    )
    def test_unknown_component_returns_unknown(self, _mock_verify):
        payload = {
            "type": 3,
            "data": {"custom_id": "some_other_action"},
            "guild_id": "G123",
            "channel_id": "CH123",
            "member": {"user": {"id": "U123"}},
        }
        request = self._make_request(payload)
        response = self.view(request)
        data = json.loads(response.content)
        assert "Unknown" in data["data"]["content"]
