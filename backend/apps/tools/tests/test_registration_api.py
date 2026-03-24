"""
Tests for the tool registration API (SDK-facing).
"""
import pytest
from unittest.mock import patch

from apps.products.models import Action
from apps.tools.models import RegisteredSkill, ToolEndpoint


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

    def test_register_tools_with_skills(self, sync_secret):
        """Skills included in registration payload are persisted."""
        from rest_framework.test import APIClient

        secret_obj, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True), \
             patch("common.services.embedding_service.get_embedding_service") as mock_emb:
            mock_emb.return_value.embed_document.return_value = [0.1] * 1536

            resp = client.post(REGISTER_URL, {
                "endpoint_url": "https://api.customer.test/pillar",
                "tools": [
                    {"name": "my_tool", "description": "Does a thing"},
                ],
                "skills": [
                    {
                        "name": "onboarding-guide",
                        "description": "How to onboard new users",
                        "content": "# Onboarding\n\nStep 1: ...",
                    },
                    {
                        "name": "billing-faq",
                        "description": "Common billing questions",
                        "content": "# Billing FAQ\n\nQ: How do I upgrade?",
                    },
                ],
                "sdk_version": "pillar-python/0.2.0",
            }, format="json")

        assert resp.status_code == 200
        assert set(resp.data["registered_skills"]) == {"onboarding-guide", "billing-faq"}

        skills = RegisteredSkill.objects.filter(
            product=secret_obj.product, is_active=True,
        )
        assert skills.count() == 2
        assert set(skills.values_list("name", flat=True)) == {
            "onboarding-guide", "billing-faq",
        }
        for s in skills:
            assert s.source_type == RegisteredSkill.SourceType.BACKEND_SDK
            assert s.content != ""
            assert s.description != ""

    def test_register_skills_upserts_on_reregister(self, sync_secret):
        """Re-registration updates existing skills and deactivates removed ones."""
        from rest_framework.test import APIClient

        secret_obj, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True), \
             patch("common.services.embedding_service.get_embedding_service") as mock_emb:
            mock_emb.return_value.embed_document.return_value = [0.1] * 1536

            client.post(REGISTER_URL, {
                "endpoint_url": "https://api.customer.test/pillar",
                "tools": [{"name": "t", "description": "d"}],
                "skills": [
                    {"name": "skill-a", "description": "Skill A", "content": "Content A"},
                    {"name": "skill-b", "description": "Skill B", "content": "Content B"},
                ],
            }, format="json")

            resp = client.post(REGISTER_URL, {
                "endpoint_url": "https://api.customer.test/pillar",
                "tools": [{"name": "t", "description": "d"}],
                "skills": [
                    {"name": "skill-b", "description": "Skill B updated", "content": "Content B v2"},
                ],
            }, format="json")

        assert resp.status_code == 200

        skill_a = RegisteredSkill.objects.get(product=secret_obj.product, name="skill-a")
        assert skill_a.is_active is False

        skill_b = RegisteredSkill.objects.get(product=secret_obj.product, name="skill-b")
        assert skill_b.is_active is True
        assert skill_b.description == "Skill B updated"
        assert skill_b.content == "Content B v2"

    def test_register_skills_validation_rejects_incomplete(self, sync_secret):
        """Skills missing name/description/content are rejected."""
        from rest_framework.test import APIClient

        _, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        resp = client.post(REGISTER_URL, {
            "endpoint_url": "https://example.com/pillar",
            "tools": [],
            "skills": [{"name": "bad-skill", "description": "Missing content"}],
        }, format="json")
        assert resp.status_code == 400

    def test_register_skills_without_tools(self, sync_secret):
        """Skills can be registered even with no tools."""
        from rest_framework.test import APIClient

        secret_obj, raw_token = sync_secret
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        with patch("apps.tools.views.ToolRegistrationView._ping_endpoint", return_value=True), \
             patch("common.services.embedding_service.get_embedding_service") as mock_emb:
            mock_emb.return_value.embed_document.return_value = [0.1] * 1536

            resp = client.post(REGISTER_URL, {
                "endpoint_url": "https://api.customer.test/pillar",
                "tools": [],
                "skills": [
                    {
                        "name": "standalone-skill",
                        "description": "A skill with no tools",
                        "content": "# Standalone\n\nJust a skill.",
                    },
                ],
            }, format="json")

        assert resp.status_code == 200
        assert resp.data["registered"] == []
        assert resp.data["registered_skills"] == ["standalone-skill"]

        assert RegisteredSkill.objects.filter(
            product=secret_obj.product, name="standalone-skill", is_active=True,
        ).exists()
