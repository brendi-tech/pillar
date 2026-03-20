"""
Tests for webhook signature generation/verification and SDK authentication.
"""
import time

import pytest

from apps.tools.services.auth import (
    authenticate_sdk_request,
    generate_webhook_signature,
    get_signing_secret_for_product,
    verify_webhook_signature,
)


class TestWebhookSignature:
    def test_sign_and_verify_roundtrip(self):
        body = '{"action": "tool_call", "tool_name": "lookup"}'
        secret = "sk_live_test_secret_value_1234"

        sig = generate_webhook_signature(body, secret)
        assert sig.startswith("t=")
        assert ",v1=" in sig

        assert verify_webhook_signature(sig, body, secret) is True

    def test_wrong_key_fails(self):
        body = '{"action": "tool_call"}'
        sig = generate_webhook_signature(body, "correct-key")
        assert verify_webhook_signature(sig, body, "wrong-key") is False

    def test_tampered_body_fails(self):
        body = '{"action": "tool_call"}'
        sig = generate_webhook_signature(body, "my-key")
        assert verify_webhook_signature(sig, '{"action": "hacked"}', "my-key") is False

    def test_expired_timestamp_fails(self):
        body = '{"test": true}'
        secret = "my-secret"

        old_ts = str(int(time.time()) - 600)
        sig = generate_webhook_signature(body, secret)
        parts = dict(s.split("=", 1) for s in sig.split(","))

        forged = f"t={old_ts},v1={parts['v1']}"
        assert verify_webhook_signature(forged, body, secret, tolerance_seconds=300) is False

    def test_malformed_header_fails(self):
        assert verify_webhook_signature("garbage", '{}', "key") is False
        assert verify_webhook_signature("t=abc,v1=def", '{}', "key") is False
        assert verify_webhook_signature("", '{}', "key") is False

    def test_bytes_body(self):
        body_str = '{"test": true}'
        body_bytes = body_str.encode()
        secret = "my-secret"

        sig = generate_webhook_signature(body_bytes, secret)
        assert verify_webhook_signature(sig, body_str, secret) is True
        assert verify_webhook_signature(sig, body_bytes, secret) is True


@pytest.mark.django_db(transaction=True)
class TestAuthenticateSDKRequest:
    async def test_valid_token_returns_product(self, sync_secret):
        secret_obj, raw_token = sync_secret

        class FakeRequest:
            META = {"HTTP_AUTHORIZATION": f"Bearer {raw_token}"}

        product = await authenticate_sdk_request(FakeRequest())
        assert product is not None
        assert product.id == secret_obj.product.id

    async def test_invalid_token_returns_none(self, sync_secret):
        class FakeRequest:
            META = {"HTTP_AUTHORIZATION": "Bearer wrong-token"}

        assert await authenticate_sdk_request(FakeRequest()) is None

    async def test_missing_header_returns_none(self, sync_secret):
        class FakeRequest:
            META = {}

        assert await authenticate_sdk_request(FakeRequest()) is None

    async def test_revoked_secret_returns_none(self, sync_secret):
        from asgiref.sync import sync_to_async

        secret_obj, raw_token = sync_secret
        await sync_to_async(secret_obj.revoke)()

        class FakeRequest:
            META = {"HTTP_AUTHORIZATION": f"Bearer {raw_token}"}

        assert await authenticate_sdk_request(FakeRequest()) is None

    async def test_updates_last_used_at(self, sync_secret):
        secret_obj, raw_token = sync_secret
        assert secret_obj.last_used_at is None

        class FakeRequest:
            META = {"HTTP_AUTHORIZATION": f"Bearer {raw_token}"}

        await authenticate_sdk_request(FakeRequest())

        await secret_obj.arefresh_from_db()
        assert secret_obj.last_used_at is not None


@pytest.mark.django_db
class TestGetSigningSecret:
    def test_returns_most_recent_active_secret(self, product):
        from apps.products.models import SyncSecret

        s1 = SyncSecret.objects.create(
            product=product, organization=product.organization,
            name="old", secret_hash="old-secret-value", is_active=True,
        )
        s2 = SyncSecret.objects.create(
            product=product, organization=product.organization,
            name="new", secret_hash="new-secret-value", is_active=True,
        )

        result = get_signing_secret_for_product(product)
        assert result == "new-secret-value"

    def test_returns_none_when_no_active_secrets(self, product):
        assert get_signing_secret_for_product(product) is None

    def test_skips_revoked_secrets(self, product):
        from apps.products.models import SyncSecret

        s = SyncSecret.objects.create(
            product=product, organization=product.organization,
            name="revoked", secret_hash="revoked-value", is_active=False,
        )

        assert get_signing_secret_for_product(product) is None
