"""
Integration tests for the Agent API endpoints.
"""
import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestAgentAPI:
    """Test the Agent ViewSet API."""

    def test_list_agents_empty(self, authenticated_client, product):
        url = f"/api/admin/products/{product.id}/agents/"
        response = authenticated_client.get(url)
        assert response.status_code == 200

    def test_create_agent(self, authenticated_client, product):
        url = f"/api/admin/products/{product.id}/agents/"
        response = authenticated_client.post(
            url,
            {"name": "Web Bot", "channel": "web"},
            format="json",
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Web Bot"
        assert data["channel"] == "web"
        assert data["is_active"] is True
        assert data["product"] == str(product.id)

    def test_create_duplicate_channel_allowed(self, authenticated_client, product):
        url = f"/api/admin/products/{product.id}/agents/"
        authenticated_client.post(
            url,
            {"name": "Bot 1", "channel": "web"},
            format="json",
        )
        response = authenticated_client.post(
            url,
            {"name": "Bot 2", "channel": "web"},
            format="json",
        )
        assert response.status_code == 201

    def test_get_agent_by_id(self, authenticated_client, product):
        create_url = f"/api/admin/products/{product.id}/agents/"
        create_response = authenticated_client.post(
            create_url,
            {"name": "Slack Bot", "channel": "slack"},
            format="json",
        )
        agent_id = create_response.json()["id"]

        detail_url = f"/api/admin/agents/{agent_id}/"
        response = authenticated_client.get(detail_url)
        assert response.status_code == 200
        assert response.json()["name"] == "Slack Bot"

    def test_update_agent(self, authenticated_client, product):
        create_url = f"/api/admin/products/{product.id}/agents/"
        create_response = authenticated_client.post(
            create_url,
            {"name": "Bot", "channel": "web"},
            format="json",
        )
        agent_id = create_response.json()["id"]

        update_url = f"/api/admin/agents/{agent_id}/"
        response = authenticated_client.patch(
            update_url,
            {"name": "Updated Bot", "tone": "concise"},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Bot"
        assert response.json()["tone"] == "concise"

    def test_delete_agent(self, authenticated_client, product):
        create_url = f"/api/admin/products/{product.id}/agents/"
        create_response = authenticated_client.post(
            create_url,
            {"name": "Temp Bot", "channel": "email"},
            format="json",
        )
        agent_id = create_response.json()["id"]

        delete_url = f"/api/admin/agents/{agent_id}/"
        response = authenticated_client.delete(delete_url)
        assert response.status_code == 204

    def test_cross_org_isolation(
        self, authenticated_client, other_authenticated_client, product
    ):
        create_url = f"/api/admin/products/{product.id}/agents/"
        create_response = authenticated_client.post(
            create_url,
            {"name": "My Bot", "channel": "web"},
            format="json",
        )
        agent_id = create_response.json()["id"]

        detail_url = f"/api/admin/agents/{agent_id}/"
        response = other_authenticated_client.get(detail_url)
        assert response.status_code == 404


@pytest.mark.django_db
class TestEmbedConfigWithAgent:
    """Test that EmbedConfigView reads from web Agent."""

    def test_embed_config_reads_from_agent(self, unauthenticated_client, product):
        from apps.products.models import Agent

        Agent.objects.filter(product=product, channel="web").update(
            channel_config={
                "assistantName": "Agent Name",
                "welcomeMessage": "Hello from agent!",
            },
        )

        url = f"/api/public/products/{product.subdomain}/embed-config/"
        response = unauthenticated_client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data.get("assistantDisplayName") == "Agent Name"
        assert data.get("welcomeMessage") == "Hello from agent!"

    def test_embed_config_falls_back_to_product(
        self, unauthenticated_client, product
    ):
        product.config = {
            "ai": {
                "assistantName": "Product Bot",
                "welcomeMessage": "Hello from product!",
            }
        }
        product.save()

        url = f"/api/public/products/{product.subdomain}/embed-config/"
        response = unauthenticated_client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data.get("assistantDisplayName") == "Product Bot"
