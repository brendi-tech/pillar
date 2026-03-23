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
        assert agent.tool_scope == "all"
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

    TOOLS = [
        {"id": "1", "name": "navigate", "tool_type": "client_side", "channel_compatibility": ["web"]},
        {"id": "2", "name": "search_kb", "tool_type": "server_side", "channel_compatibility": ["web", "slack"]},
        {"id": "3", "name": "create_ticket", "tool_type": "server_side", "channel_compatibility": ["web", "slack", "email"]},
        {"id": "4", "name": "open_modal", "tool_type": "client_side", "channel_compatibility": ["web"]},
        {"id": "5", "name": "lookup_order", "tool_type": "server_side", "channel_compatibility": ["*"]},
    ]

    def test_channel_compatibility_filter(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "slack")
        names = [t["name"] for t in result]
        assert "navigate" not in names
        assert "open_modal" not in names
        assert "search_kb" in names
        assert "create_ticket" in names
        assert "lookup_order" in names

    def test_scope_all_returns_all_compatible(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="all")
        assert len(result) == 5

    def test_scope_all_server_side(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="all_server_side")
        names = [t["name"] for t in result]
        assert set(names) == {"search_kb", "create_ticket", "lookup_order"}

    def test_scope_all_client_side(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="all_client_side")
        names = [t["name"] for t in result]
        assert set(names) == {"navigate", "open_modal"}

    def test_scope_restricted_excludes_specified_tools(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(
            self.TOOLS, "web", tool_scope="restricted", restriction_ids=["2", "4"],
        )
        names = [t["name"] for t in result]
        assert "search_kb" not in names
        assert "open_modal" not in names
        assert "navigate" in names
        assert "create_ticket" in names
        assert "lookup_order" in names

    def test_scope_restricted_empty_restrictions_returns_all(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="restricted")
        assert len(result) == 5

    def test_scope_allowed_includes_only_specified_tools(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(
            self.TOOLS, "web", tool_scope="allowed", allowance_ids=["1", "3"],
        )
        names = [t["name"] for t in result]
        assert set(names) == {"navigate", "create_ticket"}

    def test_scope_allowed_empty_allowances_returns_none(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="allowed")
        assert len(result) == 0

    def test_scope_none_returns_empty(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(self.TOOLS, "web", tool_scope="none")
        assert len(result) == 0

    def test_wildcard_compatible_with_all_channels(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "10", "name": "server_tool", "tool_type": "server_side", "channel_compatibility": ["*"]},
            {"id": "11", "name": "web_only", "tool_type": "client_side", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(tools, "slack")
        names = [t["name"] for t in result]
        assert "server_tool" in names
        assert "web_only" not in names

    def test_scope_restricted_respects_channel_compat(self):
        """Restricted mode should still filter by channel compatibility first."""
        from apps.products.services.agent_resolver import filter_tools_for_agent

        result = filter_tools_for_agent(
            self.TOOLS, "slack", tool_scope="restricted", restriction_ids=["3"],
        )
        names = [t["name"] for t in result]
        assert "navigate" not in names
        assert "create_ticket" not in names
        assert "search_kb" in names
        assert "lookup_order" in names

    def test_client_side_tools_excluded_for_non_browser_channels(self):
        """Client-side tools are excluded for slack/discord/email even with wildcard compat."""
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "10", "name": "server_tool", "tool_type": "server_side", "channel_compatibility": ["*"]},
            {"id": "11", "name": "client_wildcard", "tool_type": "client_side", "channel_compatibility": ["*"]},
            {"id": "12", "name": "client_web", "tool_type": "client_side", "channel_compatibility": ["web"]},
        ]
        for channel in ("slack", "discord", "email"):
            result = filter_tools_for_agent(tools, channel)
            names = [t["name"] for t in result]
            assert "server_tool" in names, f"server_tool missing for {channel}"
            assert "client_wildcard" not in names, f"client_wildcard should be excluded for {channel}"
            assert "client_web" not in names, f"client_web should be excluded for {channel}"

        for channel in ("web", "api"):
            result = filter_tools_for_agent(tools, channel)
            names = [t["name"] for t in result]
            assert "server_tool" in names, f"server_tool missing for {channel}"
            assert "client_wildcard" in names, f"client_wildcard should be included for {channel}"

    def test_context_restrictions_private_only(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "create_plan", "tool_type": "server_side", "channel_compatibility": ["discord"]},
            {"id": "2", "name": "list_plans", "tool_type": "server_side", "channel_compatibility": ["discord"]},
        ]
        restrictions = {"create_plan": ["private"]}
        result = filter_tools_for_agent(
            tools, "discord",
            message_context="public", context_restrictions=restrictions,
        )
        names = [t["name"] for t in result]
        assert "create_plan" not in names
        assert "list_plans" in names

    def test_context_restrictions_public_only(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "create_poll", "tool_type": "server_side", "channel_compatibility": ["discord"]},
            {"id": "2", "name": "list_plans", "tool_type": "server_side", "channel_compatibility": ["discord"]},
        ]
        restrictions = {"create_poll": ["public"]}
        result = filter_tools_for_agent(
            tools, "discord",
            message_context="private", context_restrictions=restrictions,
        )
        names = [t["name"] for t in result]
        assert "create_poll" not in names
        assert "list_plans" in names

    def test_context_restrictions_allows_matching_context(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "create_plan", "tool_type": "server_side", "channel_compatibility": ["discord"]},
        ]
        restrictions = {"create_plan": ["private"]}
        result = filter_tools_for_agent(
            tools, "discord",
            message_context="private", context_restrictions=restrictions,
        )
        assert len(result) == 1
        assert result[0]["name"] == "create_plan"

    def test_context_restrictions_empty_dict_no_filtering(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "a", "tool_type": "server_side", "channel_compatibility": ["web"]},
            {"id": "2", "name": "b", "tool_type": "server_side", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(
            tools, "web",
            message_context="public", context_restrictions={},
        )
        assert len(result) == 2

    def test_context_restrictions_none_no_filtering(self):
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "a", "tool_type": "server_side", "channel_compatibility": ["web"]},
        ]
        result = filter_tools_for_agent(
            tools, "web",
            message_context="public", context_restrictions=None,
        )
        assert len(result) == 1

    def test_context_restrictions_with_scope_allowed(self):
        """Context restrictions applied after scope-based filtering."""
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "a", "tool_type": "server_side", "channel_compatibility": ["discord"]},
            {"id": "2", "name": "b", "tool_type": "server_side", "channel_compatibility": ["discord"]},
            {"id": "3", "name": "c", "tool_type": "server_side", "channel_compatibility": ["discord"]},
        ]
        restrictions = {"a": ["private"]}
        result = filter_tools_for_agent(
            tools, "discord",
            tool_scope="allowed", allowance_ids=["1", "2"],
            message_context="public", context_restrictions=restrictions,
        )
        names = [t["name"] for t in result]
        assert names == ["b"]

    def test_context_restrictions_multi_context_array(self):
        """Tool allowed in multiple specific contexts."""
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "tool_x", "tool_type": "server_side", "channel_compatibility": ["slack"]},
        ]
        restrictions = {"tool_x": ["private", "team"]}
        result_private = filter_tools_for_agent(
            tools, "slack",
            message_context="private", context_restrictions=restrictions,
        )
        result_public = filter_tools_for_agent(
            tools, "slack",
            message_context="public", context_restrictions=restrictions,
        )
        assert len(result_private) == 1
        assert len(result_public) == 0

    def test_default_message_context_is_private(self):
        """Default message_context should be 'private'."""
        from apps.products.services.agent_resolver import filter_tools_for_agent

        tools = [
            {"id": "1", "name": "a", "tool_type": "server_side", "channel_compatibility": ["web"]},
        ]
        restrictions = {"a": ["private"]}
        result = filter_tools_for_agent(
            tools, "web",
            context_restrictions=restrictions,
        )
        assert len(result) == 1
