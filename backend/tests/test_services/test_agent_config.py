"""
Tests for the Agent model, AgentConfig resolver, and tool filtering.
"""
import pytest
from asgiref.sync import sync_to_async


@pytest.mark.django_db
class TestAgentModel:
    """Unit tests for the Agent model."""

    def test_create_agent(self, product):
        from apps.products.models import Agent
        agent = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Test Bot",
            channel="web",
        )
        assert agent.name == "Test Bot"
        assert agent.channel == "web"
        assert agent.is_active is True
        assert agent.tone == ""
        assert agent.guidance_override == ""
        assert agent.tool_allowlist == []
        assert agent.tool_denylist == []
        assert agent.include_sources is True
        assert agent.include_suggested_followups is True
        assert str(agent) == "Test Bot (web)"

    def test_multiple_agents_same_product_channel(self, product):
        from apps.products.models import Agent
        a1 = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Slack General",
            channel="slack",
        )
        a2 = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Slack Support",
            channel="slack",
        )
        assert a1.channel == a2.channel == "slack"
        assert a1.id != a2.id

    def test_multiple_channels_same_product(self, product):
        from apps.products.models import Agent
        web = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Web",
            channel="web",
        )
        slack = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Slack",
            channel="slack",
        )
        assert web.channel == "web"
        assert slack.channel == "slack"

    def test_delete_agent_set_null_on_conversation(self, product):
        from apps.products.models import Agent
        from apps.analytics.models.chat import ChatConversation

        agent = Agent.objects.create(
            organization=product.organization,
            product=product,
            name="Agent",
            channel="web",
        )
        conv = ChatConversation.objects.create(
            organization=product.organization,
            product=product,
            agent=agent,
        )
        agent.delete()
        conv.refresh_from_db()
        assert conv.agent is None


@pytest.mark.django_db(transaction=True)
class TestAgentConfigResolver:
    """Tests for resolve_agent_config()."""

    @pytest.mark.asyncio
    async def test_resolve_with_agent(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        product.agent_guidance = "Always be helpful."
        await sync_to_async(product.save)()

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Slack Bot",
            channel="slack",
            tone="concise",
            guidance_override="Keep messages short.",
            llm_model="anthropic/flagship",
            temperature=0.5,
        )

        config = await resolve_agent_config(product, "slack")
        assert config.agent_name == "Slack Bot"
        assert config.channel == "slack"
        assert config.tone == "concise"
        assert "Always be helpful." in config.guidance
        assert "Keep messages short." in config.guidance
        assert "brief and direct" in config.guidance
        assert config.llm_model == "anthropic/flagship"
        assert config.temperature == 0.5

    @pytest.mark.asyncio
    async def test_resolve_without_agent(self, product):
        from apps.products.services.agent_resolver import resolve_agent_config

        product.agent_guidance = "Product guidance"
        product.default_language = "fr"
        await sync_to_async(product.save)()

        config = await resolve_agent_config(product, "email")
        assert config.agent_id is None
        assert config.agent_name == product.name
        assert config.guidance == "Product guidance"
        assert config.language == "fr"
        assert config.temperature == 0.3

    @pytest.mark.asyncio
    async def test_resolve_inactive_agent_falls_back(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(
            Agent.objects.filter(product=product, channel="web").update
        )(is_active=False)

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Inactive",
            channel="web",
            is_active=False,
        )
        config = await resolve_agent_config(product, "web")
        assert config.agent_id is None

    @pytest.mark.asyncio
    async def test_resolve_language_inheritance(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        product.default_language = "es"
        await sync_to_async(product.save)()

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Web",
            channel="web",
            default_language="",
        )
        config = await resolve_agent_config(product, "web")
        assert config.language == "es"


@pytest.mark.django_db(transaction=True)
class TestMultiAgentRouting:
    """Tests for multi-agent channel-context routing."""

    @pytest.mark.asyncio
    async def test_route_by_slack_channel_id(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="General Bot",
            channel="slack",
            channel_config={"slack_channel_ids": ["C_GENERAL"]},
        )
        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Support Bot",
            channel="slack",
            channel_config={"slack_channel_ids": ["C_SUPPORT", "C_HELP"]},
        )

        config = await resolve_agent_config(
            product, "slack", channel_context={"slack_channel_id": "C_SUPPORT"},
        )
        assert config.agent_name == "Support Bot"

        config = await resolve_agent_config(
            product, "slack", channel_context={"slack_channel_id": "C_GENERAL"},
        )
        assert config.agent_name == "General Bot"

    @pytest.mark.asyncio
    async def test_fallback_to_default_agent(self, product):
        """Agent with no slack_channel_ids acts as the default."""
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Default Bot",
            channel="slack",
            channel_config={},
        )
        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Support Bot",
            channel="slack",
            channel_config={"slack_channel_ids": ["C_SUPPORT"]},
        )

        config = await resolve_agent_config(
            product, "slack", channel_context={"slack_channel_id": "C_RANDOM"},
        )
        assert config.agent_name == "Default Bot"

    @pytest.mark.asyncio
    async def test_fallback_to_first_agent_when_no_default(self, product):
        """When no default and no match, fall back to first agent."""
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Alpha",
            channel="slack",
            channel_config={"slack_channel_ids": ["C_ALPHA"]},
        )
        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Beta",
            channel="slack",
            channel_config={"slack_channel_ids": ["C_BETA"]},
        )

        config = await resolve_agent_config(
            product, "slack", channel_context={"slack_channel_id": "C_UNKNOWN"},
        )
        assert config.agent_name == "Alpha"

    @pytest.mark.asyncio
    async def test_no_context_returns_first_agent(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="First",
            channel="slack",
        )
        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Second",
            channel="slack",
        )

        config = await resolve_agent_config(product, "slack")
        assert config.agent_name == "First"

    @pytest.mark.asyncio
    async def test_single_agent_backward_compatible(self, product):
        """Single agent per channel still works without context."""
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Only Bot",
            channel="slack",
            tone="friendly",
        )

        config = await resolve_agent_config(product, "slack")
        assert config.agent_name == "Only Bot"
        assert config.tone == "friendly"

    @pytest.mark.asyncio
    async def test_discord_channel_routing(self, product):
        from apps.products.models import Agent
        from apps.products.services.agent_resolver import resolve_agent_config

        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Discord General",
            channel="discord",
            channel_config={"discord_channel_ids": ["123456"]},
        )
        await sync_to_async(Agent.objects.create)(
            organization=product.organization,
            product=product,
            name="Discord Support",
            channel="discord",
            channel_config={"discord_channel_ids": ["789012"]},
        )

        config = await resolve_agent_config(
            product, "discord", channel_context={"discord_channel_id": "789012"},
        )
        assert config.agent_name == "Discord Support"


class TestFilterToolsForAgent:
    """Tests for filter_tools_for_agent()."""

    def test_channel_compatibility_filter(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"name": "navigate", "channel_compatibility": ["web"]},
            {"name": "search_kb", "channel_compatibility": ["web", "slack"]},
            {"name": "create_ticket", "channel_compatibility": ["web", "slack", "email"]},
        ]
        result = filter_tools_for_agent(tools, "slack", [], [])
        names = [t["name"] for t in result]
        assert "navigate" not in names
        assert "search_kb" in names
        assert "create_ticket" in names

    def test_allowlist(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"name": "a", "channel_compatibility": ["web"]},
            {"name": "b", "channel_compatibility": ["web"]},
            {"name": "c", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(tools, "web", ["a", "b"], [])
        names = [t["name"] for t in result]
        assert names == ["a", "b"]

    def test_denylist(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"name": "a", "channel_compatibility": ["web"]},
            {"name": "b", "channel_compatibility": ["web"]},
            {"name": "c", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(tools, "web", [], ["b"])
        names = [t["name"] for t in result]
        assert "b" not in names
        assert "a" in names
        assert "c" in names

    def test_allowlist_then_denylist(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"name": "a", "channel_compatibility": ["web"]},
            {"name": "b", "channel_compatibility": ["web"]},
            {"name": "c", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(tools, "web", ["a", "b"], ["b"])
        names = [t["name"] for t in result]
        assert names == ["a"]

    def test_empty_lists_returns_all_compatible(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"name": "a", "channel_compatibility": ["web"]},
            {"name": "b", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(tools, "web", [], [])
        assert len(result) == 2
