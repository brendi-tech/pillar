"""
Tests for Phase 2: Channel Abstraction Layer.

Covers:
- Channel constants
- AgentMessage and CallerContext dataclasses
- ResponseAdapter ABC and default event dispatcher
- WebSSEAdapter reference implementation
- AgentToolExecutor channel filtering
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage, CallerContext
from apps.mcp.services.agent.response_adapter import ResponseAdapter
from apps.mcp.services.agent.adapters.web_sse import WebSSEAdapter


# ---------------------------------------------------------------------------
# Channel constants
# ---------------------------------------------------------------------------

class TestChannel:
    def test_web_constant(self):
        assert Channel.WEB == "web"

    def test_all_channels_present(self):
        expected = ["web", "slack", "discord", "email", "api",
                     "mcp", "whatsapp", "teams", "telegram", "sms"]
        assert Channel.ALL == expected

    def test_channel_choices_format(self):
        for value, label in Channel.CHANNEL_CHOICES:
            assert isinstance(value, str)
            assert isinstance(label, str)
            assert value in Channel.ALL

    def test_channel_choices_labels_are_title_case(self):
        for value, label in Channel.CHANNEL_CHOICES:
            assert label == value.title()


# ---------------------------------------------------------------------------
# CallerContext
# ---------------------------------------------------------------------------

class TestCallerContext:
    def test_default_construction(self):
        ctx = CallerContext()
        assert ctx.channel == "web"
        assert ctx.channel_user_id is None
        assert ctx.external_user_id is None
        assert ctx.email is None
        assert ctx.display_name is None
        assert ctx.user_profile == {}

    def test_full_construction(self):
        ctx = CallerContext(
            channel_user_id="U12345",
            external_user_id="user-42",
            email="test@example.com",
            display_name="Alice",
            user_profile={"role": "admin"},
        )
        assert ctx.channel_user_id == "U12345"
        assert ctx.external_user_id == "user-42"
        assert ctx.email == "test@example.com"
        assert ctx.display_name == "Alice"
        assert ctx.user_profile == {"role": "admin"}

    def test_is_frozen(self):
        ctx = CallerContext(email="a@b.com")
        with pytest.raises(AttributeError):
            ctx.email = "c@d.com"


# ---------------------------------------------------------------------------
# AgentMessage
# ---------------------------------------------------------------------------

class TestAgentMessage:
    def test_minimal_construction(self):
        msg = AgentMessage(
            text="Hello",
            channel="web",
            conversation_id="conv-1",
            product_id="prod-1",
            organization_id="org-1",
        )
        assert msg.text == "Hello"
        assert msg.channel == "web"
        assert msg.conversation_id == "conv-1"
        assert msg.language == "en"
        assert msg.top_k == 10
        assert msg.images == []
        assert msg.registered_tools == []
        assert msg.conversation_history == []
        assert msg.channel_context == {}
        assert msg.cancel_event is None

    def test_full_construction(self):
        caller = CallerContext(email="x@y.com", user_profile={"role": "admin"})
        msg = AgentMessage(
            text="How do I upgrade?",
            channel="slack",
            conversation_id="c-1",
            product_id="p-1",
            organization_id="o-1",
            caller=caller,
            conversation_history=[{"role": "user", "content": "hi"}],
            registered_tools=[{"name": "navigate", "type": "navigate"}],
            images=[{"url": "https://img.test/a.png", "detail": "auto"}],
            language="es",
            channel_context={
                "thread_ts": "1234567890.123456",
                "channel_id": "C01ABCDEF",
            },
            assistant_message_id="msg-1",
            session_id="sess-1",
            top_k=5,
            platform="ios",
            version="2.0",
        )
        assert msg.caller.email == "x@y.com"
        assert msg.language == "es"
        assert msg.platform == "ios"
        assert msg.channel == "slack"

    def test_page_url_property(self):
        msg = AgentMessage(
            text="test",
            channel="web",
            conversation_id="c",
            product_id="p",
            organization_id="o",
            channel_context={"page_url": "https://example.com/docs"},
        )
        assert msg.page_url == "https://example.com/docs"

    def test_page_url_default(self):
        msg = AgentMessage(
            text="test", channel="web",
            conversation_id="c", product_id="p", organization_id="o",
        )
        assert msg.page_url == ""

    def test_user_context_property(self):
        dom = [{"type": "dom_snapshot", "content": "<html>...</html>"}]
        msg = AgentMessage(
            text="test", channel="web",
            conversation_id="c", product_id="p", organization_id="o",
            channel_context={"user_context": dom},
        )
        assert msg.user_context == dom

    def test_sdk_context_property(self):
        ctx = {"currentPage": "/settings", "userRole": "admin"}
        msg = AgentMessage(
            text="test", channel="web",
            conversation_id="c", product_id="p", organization_id="o",
            channel_context={"sdk_context": ctx},
        )
        assert msg.sdk_context == ctx

    def test_is_mutable(self):
        msg = AgentMessage(
            text="test", channel="web",
            conversation_id="c", product_id="p", organization_id="o",
        )
        msg.session_id = "new-session"
        assert msg.session_id == "new-session"

    def test_default_factory_isolation(self):
        """Each instance should get independent default lists/dicts."""
        msg1 = AgentMessage(
            text="a", channel="web",
            conversation_id="c1", product_id="p", organization_id="o",
        )
        msg2 = AgentMessage(
            text="b", channel="web",
            conversation_id="c2", product_id="p", organization_id="o",
        )
        msg1.images.append({"url": "test"})
        assert msg2.images == []


# ---------------------------------------------------------------------------
# ResponseAdapter ABC
# ---------------------------------------------------------------------------

class ConcreteAdapter(ResponseAdapter):
    """Minimal concrete adapter for testing the ABC dispatch."""

    def __init__(self):
        self.events: list = []

    async def on_token(self, text: str) -> None:
        self.events.append(("token", text))

    async def on_sources(self, sources: list[dict]) -> None:
        self.events.append(("sources", sources))

    async def on_progress(self, progress_data: dict) -> None:
        self.events.append(("progress", progress_data))

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict,
        tool_call_id: str = '',
    ) -> None:
        self.events.append(("action_request", action_name, parameters))

    async def on_complete(self, event: dict) -> None:
        self.events.append(("complete", event))

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self.events.append(("error", message))


class TestResponseAdapter:
    @pytest.fixture
    def adapter(self):
        return ConcreteAdapter()

    async def test_dispatch_token(self, adapter):
        await adapter.on_event({"type": "token", "text": "Hello"})
        assert adapter.events == [("token", "Hello")]

    async def test_dispatch_sources(self, adapter):
        sources = [{"title": "Doc", "url": "https://x.com"}]
        await adapter.on_event({"type": "sources", "sources": sources})
        assert adapter.events == [("sources", sources)]

    async def test_dispatch_progress(self, adapter):
        data = {"kind": "thinking", "status": "active"}
        await adapter.on_event({"type": "progress", "data": data})
        assert adapter.events == [("progress", data)]

    async def test_dispatch_action_request(self, adapter):
        await adapter.on_event({
            "type": "action_request",
            "action_name": "navigate",
            "parameters": {"url": "/settings"},
            "action": {"type": "navigate"},
        })
        assert adapter.events[0][0] == "action_request"
        assert adapter.events[0][1] == "navigate"

    async def test_dispatch_complete(self, adapter):
        event = {"type": "complete", "registered_tools": []}
        await adapter.on_event(event)
        assert adapter.events == [("complete", event)]

    async def test_dispatch_error(self, adapter):
        await adapter.on_event({"type": "error", "message": "something broke"})
        assert adapter.events == [("error", "something broke")]

    async def test_dispatch_state_checkpoint_captures_data(self, adapter):
        await adapter.on_event({
            "type": "state_checkpoint",
            "llm_messages": [{"role": "user", "content": "hi"}],
            "registered_tools": [{"name": "search"}],
            "model_used": "gpt-4",
            "display_trace": [{"kind": "search"}],
        })
        assert adapter.events == []
        assert adapter._llm_messages == [{"role": "user", "content": "hi"}]
        assert adapter._registered_tools == [{"name": "search"}]
        assert adapter._model_used == "gpt-4"
        assert adapter._display_trace == [{"kind": "search"}]

    async def test_dispatch_unknown_type_is_noop(self, adapter):
        await adapter.on_event({"type": "some_future_event"})
        assert adapter.events == []

    async def test_optional_hooks_are_noops(self, adapter):
        await adapter.on_debug({"type": "debug"})
        await adapter.on_conversation_started({"type": "conversation_started"})
        await adapter.on_token_usage({"type": "token_usage"})
        await adapter.on_plan({"type": "plan.created"})
        assert adapter.events == []

    async def test_dispatch_debug(self, adapter):
        await adapter.on_event({"type": "debug", "data": {}})
        assert adapter.events == []

    async def test_dispatch_conversation_started(self, adapter):
        await adapter.on_event({"type": "conversation_started", "conversation_id": "c1"})
        assert adapter.events == []

    async def test_dispatch_plan_created(self, adapter):
        await adapter.on_event({"type": "plan.created", "plan": {}})
        assert adapter.events == []


# ---------------------------------------------------------------------------
# WebSSEAdapter
# ---------------------------------------------------------------------------

class TestWebSSEAdapter:
    @pytest.fixture
    def queue(self):
        return asyncio.Queue()

    @pytest.fixture
    def adapter(self, queue):
        return WebSSEAdapter(queue)

    async def test_on_token_enqueues_jsonrpc(self, adapter, queue):
        await adapter.on_token("Hi")
        item = queue.get_nowait()
        assert item["jsonrpc"] == "2.0"
        assert item["method"] == "notifications/progress"
        assert item["params"]["progress"]["kind"] == "token"
        assert item["params"]["progress"]["token"] == "Hi"

    async def test_on_token_collects_text(self, adapter, queue):
        await adapter.on_token("Hello ")
        await adapter.on_token("world")
        assert adapter._collected_text == ["Hello ", "world"]

    async def test_on_sources_enqueues_internal(self, adapter, queue):
        sources = [{"title": "A"}]
        await adapter.on_sources(sources)
        item = queue.get_nowait()
        assert item["_internal"] == "sources"
        assert item["sources"] == sources

    async def test_on_progress_enqueues_jsonrpc(self, adapter, queue):
        data = {"kind": "search", "status": "active"}
        await adapter.on_progress(data)
        item = queue.get_nowait()
        assert item["params"]["progress"] == data

    async def test_on_action_request_enqueues_jsonrpc(self, adapter, queue):
        await adapter.on_action_request("nav", {"url": "/"}, {"type": "navigate"})
        item = queue.get_nowait()
        progress = item["params"]["progress"]
        assert progress["kind"] == "action_request"
        assert progress["action_name"] == "nav"
        assert progress["parameters"] == {"url": "/"}

    async def test_on_complete_enqueues_internal(self, adapter, queue):
        event = {"type": "complete"}
        await adapter.on_complete(event)
        item = queue.get_nowait()
        assert item["_internal"] == "complete"

    async def test_on_error_enqueues_internal(self, adapter, queue):
        await adapter.on_error("bad request")
        item = queue.get_nowait()
        assert item["_internal"] == "error"
        assert item["message"] == "bad request"


# ---------------------------------------------------------------------------
# AgentToolExecutor channel filtering
# ---------------------------------------------------------------------------

class TestAgentToolExecutorChannelFiltering:
    @pytest.fixture
    def mock_product(self):
        product = MagicMock()
        product.id = "prod-1"
        return product

    @pytest.fixture
    def mock_org(self):
        org = MagicMock()
        org.id = "org-1"
        return org

    async def test_filters_actions_by_channel(self, mock_product, mock_org):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        executor = AgentToolExecutor(
            product=mock_product,
            organization=mock_org,
            channel="slack",
        )

        mock_result = MagicMock()
        mock_result.actions = [
            {"name": "web_only", "channel_compatibility": ["web"]},
            {"name": "everywhere", "channel_compatibility": ["web", "slack", "discord"]},
            {"name": "slack_only", "channel_compatibility": ["slack"]},
        ]

        with patch(
            "apps.products.services.action_search_service.action_search_service.search_with_metadata",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            actions = await executor.execute_search_actions("test query")

        names = [a["name"] for a in actions]
        assert "web_only" not in names
        assert "everywhere" in names
        assert "slack_only" in names

    async def test_web_channel_includes_web_tools(self, mock_product, mock_org):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        executor = AgentToolExecutor(
            product=mock_product,
            organization=mock_org,
            channel="web",
        )

        mock_result = MagicMock()
        mock_result.actions = [
            {"name": "web_tool", "channel_compatibility": ["web"]},
            {"name": "slack_tool", "channel_compatibility": ["slack"]},
        ]

        with patch(
            "apps.products.services.action_search_service.action_search_service.search_with_metadata",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            actions = await executor.execute_search_actions("test")

        names = [a["name"] for a in actions]
        assert "web_tool" in names
        assert "slack_tool" not in names

    async def test_web_channel_excludes_tools_without_channel_compatibility(
        self, mock_product, mock_org
    ):
        """Missing channel_compatibility is treated as unavailable unless '*' or channel is listed."""
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        executor = AgentToolExecutor(
            product=mock_product,
            organization=mock_org,
            channel="web",
        )

        mock_result = MagicMock()
        mock_result.actions = [
            {"name": "legacy_tool"},
        ]

        with patch(
            "apps.products.services.action_search_service.action_search_service.search_with_metadata",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            actions = await executor.execute_search_actions("test")

        assert len(actions) == 0

    async def test_non_web_channel_excludes_tools_without_compatibility(self, mock_product, mock_org):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        executor = AgentToolExecutor(
            product=mock_product,
            organization=mock_org,
            channel="telegram",
        )

        mock_result = MagicMock()
        mock_result.actions = [
            {"name": "legacy_tool"},
        ]

        with patch(
            "apps.products.services.action_search_service.action_search_service.search_with_metadata",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            actions = await executor.execute_search_actions("test")

        assert len(actions) == 0


# ---------------------------------------------------------------------------
# ChatConversation.channel field
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestChatConversationChannel:
    def test_channel_field_exists(self):
        from apps.analytics.models import ChatConversation
        field = ChatConversation._meta.get_field("channel")
        assert field is not None
        assert field.max_length == 20
        assert field.default == "web"

    def test_channel_default_is_web(self, test_organization):
        from apps.analytics.models import ChatConversation
        conv = ChatConversation.objects.create(
            organization=test_organization,
            title="Test",
        )
        assert conv.channel == "web"

    def test_channel_can_be_set(self, test_organization):
        from apps.analytics.models import ChatConversation
        conv = ChatConversation.objects.create(
            organization=test_organization,
            title="Slack convo",
            channel="slack",
        )
        conv.refresh_from_db()
        assert conv.channel == "slack"

    def test_channel_choices_include_all_channels(self):
        from apps.analytics.models import ChatConversation
        field = ChatConversation._meta.get_field("channel")
        choice_values = [c[0] for c in field.choices]
        for ch in Channel.ALL:
            assert ch in choice_values


# ---------------------------------------------------------------------------
# ConversationLoggingService channel parameter
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestConversationLoggingChannel:
    async def test_create_conversation_with_default_channel(self, test_organization, test_help_center_config):
        from apps.analytics.services import ConversationLoggingService
        from apps.analytics.models import ChatConversation
        import uuid

        svc = ConversationLoggingService()
        conv_id = str(uuid.uuid4())
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())

        await svc.create_conversation_and_user_message(
            conversation_id=conv_id,
            user_message_id=user_msg_id,
            assistant_message_id=assistant_msg_id,
            organization_id=str(test_organization.id),
            product_id=str(test_help_center_config.id),
            question="Hello",
        )

        conv = await ChatConversation.objects.aget(id=conv_id)
        assert conv.channel == "web"

    async def test_create_conversation_with_explicit_channel(self, test_organization, test_help_center_config):
        from apps.analytics.services import ConversationLoggingService
        from apps.analytics.models import ChatConversation
        import uuid

        svc = ConversationLoggingService()
        conv_id = str(uuid.uuid4())
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())

        await svc.create_conversation_and_user_message(
            conversation_id=conv_id,
            user_message_id=user_msg_id,
            assistant_message_id=assistant_msg_id,
            organization_id=str(test_organization.id),
            product_id=str(test_help_center_config.id),
            question="Hello from Slack",
            channel="slack",
        )

        conv = await ChatConversation.objects.aget(id=conv_id)
        assert conv.channel == "slack"
