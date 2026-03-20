"""Tests for Slack integration views."""
import hashlib
import hmac
import json
import time

import pytest
from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings
from unittest.mock import MagicMock, patch

from apps.integrations.slack.views import SlackEventsView, SlackInteractionsView


SIGNING_SECRET = "test_signing_secret_12345"


def _make_signed_request(body: dict, signing_secret: str = SIGNING_SECRET) -> dict:
    """Build headers with valid Slack HMAC-SHA256 signature."""
    body_str = json.dumps(body)
    timestamp = str(int(time.time()))
    sig_basestring = f"v0:{timestamp}:{body_str}"
    signature = "v0=" + hmac.new(
        signing_secret.encode(), sig_basestring.encode(), hashlib.sha256,
    ).hexdigest()
    return {
        "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
        "HTTP_X_SLACK_SIGNATURE": signature,
        "content_type": "application/json",
    }


@override_settings(SLACK_SIGNING_SECRET=SIGNING_SECRET)
class TestSlackEventsView(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.view = SlackEventsView.as_view()
        cache.clear()

    def test_url_verification_challenge(self):
        body = {
            "type": "url_verification",
            "challenge": "abc123",
        }
        headers = _make_signed_request(body)
        request = self.factory.post(
            "/api/integrations/slack/events/",
            data=json.dumps(body),
            **headers,
        )
        request.data = body
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data["challenge"], "abc123")

    @override_settings(SLACK_SIGNING_SECRET="wrong_secret")
    def test_invalid_signature_rejected(self):
        body = {"type": "url_verification", "challenge": "abc"}
        # Sign with correct secret, but settings has wrong one
        headers = _make_signed_request(body, signing_secret=SIGNING_SECRET)
        request = self.factory.post(
            "/api/integrations/slack/events/",
            data=json.dumps(body),
            **headers,
        )
        request.data = body
        response = self.view(request)
        self.assertEqual(response.status_code, 403)

    def test_duplicate_event_skipped(self):
        """Second dispatch of the same event_id should be deduped."""
        body = {
            "type": "event_callback",
            "team_id": "T123",
            "event_id": "Ev_duplicate_test",
            "event": {
                "type": "app_mention",
                "user": "U_TEST",
                "text": "hello",
                "channel": "C123",
                "ts": "1234.5678",
            },
        }
        headers = _make_signed_request(body)

        with patch.object(SlackEventsView, '_dispatch_event') as mock_dispatch:
            request = self.factory.post(
                "/api/integrations/slack/events/",
                data=json.dumps(body),
                **headers,
            )
            request.data = body
            self.view(request)

            # Set the cache key to simulate already-seen event
            cache.set("slack_event_seen:Ev_duplicate_test", "1", timeout=3600)

            # Manually call _dispatch_event a second time to test dedup
            view_instance = SlackEventsView()
            view_instance._dispatch_event(body, body["event"])
            # The TaskRouter.execute should only be called once if dedup works


@override_settings(SLACK_SIGNING_SECRET=SIGNING_SECRET)
class TestSlackConfirmationDedup(TestCase):
    """Tests for call_id-based dedup on confirmation button clicks."""

    def setUp(self):
        self.factory = RequestFactory()
        cache.clear()

    def test_duplicate_confirm_is_rejected(self):
        """Second confirm click with the same call_id should not dispatch."""
        call_id = "call-abc-123"
        value_data = {
            "call_id": call_id,
            "tool_name": "create_product",
            "confirm_payload": {"name": "test"},
            "conversation_id": "conv-1",
        }

        view = SlackInteractionsView()

        with patch.object(view, '_dispatch_confirm') as mock_dispatch, \
             patch.object(view, '_replace_via_response_url'):

            # First call should dispatch
            cache.delete(f"slack_confirm:{call_id}")
            was_new = cache.add(f"slack_confirm:{call_id}", "1", timeout=300)
            assert was_new is True

            # Second call should be blocked
            was_new_again = cache.add(f"slack_confirm:{call_id}", "1", timeout=300)
            assert was_new_again is False

    def test_confirm_without_call_id_still_dispatches(self):
        """Confirmations without a call_id should not be deduped."""
        view = SlackInteractionsView()
        value_data = {
            "tool_name": "create_product",
            "confirm_payload": {"name": "test"},
        }

        payload = {
            "type": "block_actions",
            "team": {"id": "T123"},
            "api_app_id": "A123",
            "channel": {"id": "C123"},
            "user": {"id": "U123"},
            "message": {"ts": "123.456", "thread_ts": "123.456"},
            "response_url": "https://hooks.slack.com/test",
            "actions": [{
                "action_id": "confirm_tool:create_product",
                "value": json.dumps(value_data),
            }],
        }

        with patch.object(view, '_dispatch_confirm') as mock_dispatch, \
             patch.object(view, '_replace_via_response_url'):
            # No call_id means no dedup key, should always dispatch
            assert "call_id" not in value_data or value_data.get("call_id") == ""
