"""
Tests for the tool registration API (SDK-facing).
"""
import pytest
from unittest.mock import patch

from apps.products.models import Action
from apps.tools.models import ToolEndpoint


REGISTER_URL = "/api/tools/register/"


@pytest.mark.django_db(transaction=True)
class TestToolRegistration:
    def test_register_tools_creates_endpoint_and_actions(self, sync_secret):
        from rest_framework.test import APIClient

        secret_obj, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True):
            resp = client.post(REGISTER_URL, {
                "endpoint_url": "https://api.customer.test/pillar",
                "tools": [
                    {
                        "name": "lookup_customer",
                        "description": "Look up a customer by email",
                        "parameters": {
                            "type": "object",
                            "properties": {"email": {"type": "string"}},
                            "required": ["email"],
                        },
                    },
                    {
                        "name": "create_ticket",
                        "description": "Create a support ticket",
                    },
                ],
                "sdk_version": "pillar-python/0.1.0",
            }, format="json")

        assert resp.status_code == 200
        assert resp.data["registered"] == ["lookup_customer", "create_ticket"]
        assert resp.data["endpoint_verified"] is True

        endpoint = ToolEndpoint.objects.get(product=secret_obj.product)
        assert endpoint.endpoint_url == "https://api.customer.test/pillar"
        assert endpoint.sdk_version == "pillar-python/0.1.0"

        actions = Action.objects.filter(
            product=secret_obj.product,
            tool_type=Action.ToolType.SERVER_SIDE,
        )
        assert actions.count() == 2
        assert set(actions.values_list("name", flat=True)) == {
            "lookup_customer", "create_ticket",
        }
        for a in actions:
            assert a.source_type == Action.SourceType.BACKEND_SDK
            assert a.status == Action.Status.PUBLISHED

    def test_register_without_auth_returns_401(self):
        from rest_framework.test import APIClient

        client = APIClient()
        resp = client.post(REGISTER_URL, {
            "endpoint_url": "https://example.com/pillar",
            "tools": [],
        }, format="json")
        assert resp.status_code == 401

    def test_register_with_wrong_token_returns_401(self, sync_secret):
        from rest_framework.test import APIClient

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer wrong-token")
        resp = client.post(REGISTER_URL, {
            "endpoint_url": "https://example.com/pillar",
            "tools": [],
        }, format="json")
        assert resp.status_code == 401

    def test_register_missing_tool_name_returns_400(self, sync_secret):
        from rest_framework.test import APIClient

        _, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        resp = client.post(REGISTER_URL, {
            "endpoint_url": "https://example.com/pillar",
            "tools": [{"description": "Missing name"}],
        }, format="json")
        assert resp.status_code == 400

    def test_idempotent_re_registration(self, sync_secret):
        from rest_framework.test import APIClient

        _, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        payload = {
            "endpoint_url": "https://api.customer.test/v1",
            "tools": [{"name": "my_tool", "description": "Does a thing"}],
        }

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True):
            resp1 = client.post(REGISTER_URL, payload, format="json")
            resp2 = client.post(REGISTER_URL, payload, format="json")

        assert resp1.status_code == 200
        assert resp2.status_code == 200

        assert ToolEndpoint.objects.filter(
            product=sync_secret[0].product, is_active=True,
        ).count() == 1

    def test_updates_endpoint_url_on_reregister(self, sync_secret):
        from rest_framework.test import APIClient

        _, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True):
            client.post(REGISTER_URL, {
                "endpoint_url": "https://old.example.com/pillar",
                "tools": [{"name": "t", "description": "d"}],
            }, format="json")

            client.post(REGISTER_URL, {
                "endpoint_url": "https://new.example.com/pillar",
                "tools": [{"name": "t", "description": "d"}],
            }, format="json")

        endpoint = ToolEndpoint.objects.get(product=sync_secret[0].product)
        assert endpoint.endpoint_url == "https://new.example.com/pillar"
