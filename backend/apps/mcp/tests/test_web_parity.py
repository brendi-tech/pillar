"""
Parity tests: AskTool._execute_stream_legacy vs _execute_stream_adapter.

Both paths share the same AgentAnswerServiceReActAsync.ask_stream input;
these tests assert equivalent client-visible event streams when dependencies
are mocked.
"""
from __future__ import annotations

import asyncio
from contextlib import ExitStack, contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.mcp.tools.builtin.ask import AskTool, _USE_WEB_ADAPTER
from apps.products.models.agent import KnowledgeScope
from apps.products.services.agent_resolver import AgentConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def collect_events(gen):
    events = []
    async for event in gen:
        events.append(event)
    return events


def make_mock_organization(org_id: str = "org-parity-1"):
    org = MagicMock()
    org.id = org_id
    return org


def make_mock_help_center_config(product_id: str = "product-parity-1", org_id: str = "org-parity-1"):
    hc = MagicMock()
    hc.id = product_id
    hc.organization_id = org_id
    hc.name = "Parity Help Center"
    return hc


def make_mock_metadata():
    return SimpleNamespace(
        ip_address="203.0.113.1",
        user_agent="parity-test-agent/1.0",
        visitor_id="visitor-parity-1",
        external_user_id="ext-user-1",
        session_id="session-parity-1",
        referer="https://example.com/docs",
    )


def make_mock_request():
    req = MagicMock()
    req.GET = {}
    req.headers = {}
    req.META = {}
    req.agent = None
    return req


def minimal_agent_config() -> AgentConfig:
    return AgentConfig(
        agent_id=None,
        agent_name="default",
        channel="web",
        guidance="",
        tone="neutral",
        llm_model="",
        temperature=0.7,
        max_response_tokens=None,
        include_sources=True,
        include_suggested_followups=True,
        tool_allowlist=[],
        tool_denylist=[],
        language="en",
        channel_config={},
        knowledge_scope=KnowledgeScope.ALL,
        knowledge_source_ids=[],
    )


def default_stream_kwargs(
    *,
    organization=None,
    help_center_config=None,
    metadata=None,
    request=None,
    conversation_id: str = "conv-parity-fixed",
    cancel_event=None,
    resume: bool = False,
):
    organization = organization or make_mock_organization()
    help_center_config = help_center_config or make_mock_help_center_config()
    metadata = metadata or make_mock_metadata()
    request = request or make_mock_request()
    return {
        "organization": organization,
        "help_center_config": help_center_config,
        "conversation_id": conversation_id,
        "query": "Hello parity",
        "validated_images": None,
        "conversation_history": [],
        "client_registered_tools": [],
        "metadata": metadata,
        "page_url": "https://example.com/page",
        "skip_analytics": False,
        "resume": resume,
        "cancel_event": cancel_event,
        "top_k": 5,
        "user_context": [],
        "context": {},
        "user_profile": None,
        "language": "en",
        "request": request,
    }


def deterministic_ask_stream():
    sources = [{"title": "Parity Doc", "url": "https://example.com/d", "excerpt": "ex"}]

    async def _gen(**kwargs):
        yield {"type": "token", "text": "Hello"}
        yield {"type": "token", "text": " world"}
        yield {"type": "sources", "sources": sources}
        yield {"type": "complete", "message": "Hello world"}

    return _gen


def many_token_ask_stream(n: int = 50):
    async def _gen(**kwargs):
        for i in range(n):
            yield {"type": "token", "text": f"t{i}"}
        yield {"type": "complete", "message": "done"}

    return _gen


@contextmanager
def parity_dependency_patches(ask_stream_fn):
    """Mocks shared by legacy and adapter paths.

    Yields a dict including ``mark_completed`` and ``mark_disconnected`` AsyncMocks
    so tests can assert lifecycle calls without double-patching.
    """
    mock_agent_cls = MagicMock()
    mock_agent_instance = MagicMock()
    mock_agent_instance.ask_stream = ask_stream_fn
    mock_agent_cls.return_value = mock_agent_instance

    mock_logging_cls = MagicMock()
    mock_logging_cls.return_value.create_conversation_and_user_message = AsyncMock()

    filter_qs = MagicMock()
    filter_qs.aupdate = AsyncMock()

    mock_mark_completed = AsyncMock()
    mock_mark_disconnected = AsyncMock()

    with ExitStack() as stack:
        stack.enter_context(
            patch(
                "apps.mcp.services.agent.AgentAnswerServiceReActAsync",
                mock_agent_cls,
            )
        )
        stack.enter_context(
            patch(
                "apps.analytics.services.ConversationLoggingService",
                mock_logging_cls,
            )
        )
        stack.enter_context(
            patch(
                "apps.analytics.models.ChatMessage.objects.acreate",
                new_callable=AsyncMock,
            )
        )
        stack.enter_context(
            patch(
                "apps.products.services.agent_resolver.resolve_agent_config",
                new_callable=AsyncMock,
                return_value=minimal_agent_config(),
            )
        )
        stack.enter_context(
            patch(
                "apps.mcp.services.session_resumption.finalize_turn",
                new_callable=AsyncMock,
            )
        )
        stack.enter_context(
            patch(
                "apps.mcp.services.session_resumption.mark_completed",
                mock_mark_completed,
            )
        )
        stack.enter_context(
            patch(
                "apps.mcp.services.session_resumption.mark_disconnected",
                mock_mark_disconnected,
            )
        )
        stack.enter_context(
            patch(
                "apps.mcp.services.image_summary_service.get_cached_summary",
                return_value=None,
            )
        )
        stack.enter_context(
            patch(
                "apps.mcp.services.session_resumption.load_conversation_history",
                new_callable=AsyncMock,
                return_value={"messages": [], "registered_tools": []},
            )
        )
        stack.enter_context(
            patch(
                "apps.analytics.models.ChatMessage.objects.filter",
                return_value=filter_qs,
            )
        )
        yield {
            "agent_cls": mock_agent_cls,
            "mark_completed": mock_mark_completed,
            "mark_disconnected": mock_mark_disconnected,
        }


async def run_legacy_events(tool: AskTool, ask_stream_fn, **kwargs):
    with parity_dependency_patches(ask_stream_fn):
        gen = tool._execute_stream_legacy(**default_stream_kwargs(**kwargs))
        return await collect_events(gen)


async def run_adapter_events(tool: AskTool, ask_stream_fn, **kwargs):
    with parity_dependency_patches(ask_stream_fn):
        gen = tool._execute_stream_adapter(**default_stream_kwargs(**kwargs))
        return await collect_events(gen)


def event_types(events):
    return [e.get("type") for e in events]


def token_texts(events):
    return [e.get("text", "") for e in events if e.get("type") == "token"]


# ---------------------------------------------------------------------------
# _USE_WEB_ADAPTER: patch toggles module attribute (used by execute_stream)
# ---------------------------------------------------------------------------


def test_patch_toggles_use_web_adapter():
    assert isinstance(_USE_WEB_ADAPTER, bool)
    with patch("apps.mcp.tools.builtin.ask._USE_WEB_ADAPTER", False):
        import apps.mcp.tools.builtin.ask as ask_mod

        assert ask_mod._USE_WEB_ADAPTER is False


# ---------------------------------------------------------------------------
# Event sequence parity
# ---------------------------------------------------------------------------


class TestEventSequenceParity:
    @pytest.mark.asyncio
    async def test_event_types_match(self):
        tool = AskTool()
        ask_fn = deterministic_ask_stream()
        legacy = await run_legacy_events(tool, ask_fn)
        adapter = await run_adapter_events(tool, ask_fn)

        assert event_types(legacy) == event_types(adapter)
        expected = [
            "conversation_started",
            "token",
            "token",
            "sources",
            "complete",
        ]
        assert event_types(legacy) == expected

    @pytest.mark.asyncio
    async def test_conversation_started_is_first_event(self):
        tool = AskTool()
        ask_fn = deterministic_ask_stream()
        legacy = await run_legacy_events(tool, ask_fn)
        adapter = await run_adapter_events(tool, ask_fn)

        assert legacy[0]["type"] == "conversation_started"
        assert adapter[0]["type"] == "conversation_started"

    @pytest.mark.asyncio
    async def test_token_events_carry_same_text(self):
        tool = AskTool()
        ask_fn = deterministic_ask_stream()
        legacy = await run_legacy_events(tool, ask_fn)
        adapter = await run_adapter_events(tool, ask_fn)

        assert token_texts(legacy) == token_texts(adapter)
        assert token_texts(legacy) == ["Hello", " world"]


# ---------------------------------------------------------------------------
# Cancel behavior
# ---------------------------------------------------------------------------


class TestCancelBehavior:
    @pytest.mark.asyncio
    async def test_cancel_stops_event_stream(self):
        tool = AskTool()
        cancel = asyncio.Event()
        cancel.set()
        ask_fn = many_token_ask_stream(50)

        legacy = await run_legacy_events(tool, ask_fn, cancel_event=cancel)
        adapter = await run_adapter_events(tool, ask_fn, cancel_event=cancel)

        # Pre-cancel: first ask_stream event is consumed but not forwarded; only handshake.
        assert event_types(legacy) == ["conversation_started"]
        assert event_types(adapter) == ["conversation_started"]

        tok_legacy = [e for e in legacy if e.get("type") == "token"]
        tok_adapter = [e for e in adapter if e.get("type") == "token"]
        assert len(tok_legacy) == 0
        assert len(tok_adapter) == 0

    @pytest.mark.asyncio
    async def test_cancel_marks_disconnected_not_completed(self):
        tool = AskTool()
        cancel = asyncio.Event()
        cancel.set()
        ask_fn = deterministic_ask_stream()

        with parity_dependency_patches(ask_fn) as mocks:
            await collect_events(
                tool._execute_stream_adapter(**default_stream_kwargs(cancel_event=cancel))
            )

        mocks["mark_disconnected"].assert_awaited_once()
        mocks["mark_completed"].assert_not_awaited()

