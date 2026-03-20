"""
Backward compatibility smoke tests.

Proves that existing adapters (ConcreteAdapter, WebSSEAdapter, Slack,
Discord) still work without passing persistence params to the base class.
"""
import asyncio

import pytest
from unittest.mock import MagicMock

from apps.mcp.services.agent.response_adapter import ResponseAdapter
from apps.mcp.services.agent.adapters.web_sse import WebSSEAdapter


class ConcreteAdapter(ResponseAdapter):
    """Replica of the test ConcreteAdapter from test_channel_abstraction.py.
    Does NOT call super().__init__().
    """

    def __init__(self):
        self.events: list = []

    async def on_token(self, text: str) -> None:
        self.events.append(("token", text))

    async def on_sources(self, sources: list[dict]) -> None:
        self.events.append(("sources", sources))

    async def on_progress(self, progress_data: dict) -> None:
        self.events.append(("progress", progress_data))

    async def on_action_request(self, action_name: str, parameters: dict, action: dict) -> None:
        self.events.append(("action_request", action_name, parameters))

    async def on_complete(self, event: dict) -> None:
        self.events.append(("complete", event))

    async def on_error(self, message: str, details: dict | None = None) -> None:
        self.events.append(("error", message))


class TestExistingConcreteAdapterNoSuperCall:
    async def test_on_event_dispatches_to_on_token(self):
        adapter = ConcreteAdapter()
        await adapter.on_event({"type": "token", "text": "Hi"})
        assert adapter.events == [("token", "Hi")]

    async def test_persistence_state_lazily_initialized(self):
        adapter = ConcreteAdapter()
        await adapter.on_event({"type": "token", "text": "a"})
        assert adapter._persistence_tokens == ["a"]


class TestExistingWebSSEAdapterStillWorks:
    async def test_on_event_enqueues_token(self):
        queue = asyncio.Queue()
        adapter = WebSSEAdapter(queue)
        await adapter.on_event({"type": "token", "text": "Hi"})
        item = queue.get_nowait()
        assert item["jsonrpc"] == "2.0"
        assert item["params"]["progress"]["token"] == "Hi"

    async def test_persistence_tokens_accumulated(self):
        queue = asyncio.Queue()
        adapter = WebSSEAdapter(queue)
        await adapter.on_event({"type": "token", "text": "a"})
        await adapter.on_event({"type": "token", "text": "b"})
        assert adapter._persistence_tokens == ["a", "b"]


class TestSlackAdapterConstructedWithoutBaseParams:
    async def test_works_without_persistence_params(self):
        installation = MagicMock()
        installation.get_client.return_value = MagicMock()

        from apps.integrations.slack.adapter import SlackResponseAdapter
        adapter = SlackResponseAdapter(
            installation=installation,
            channel_id="C123",
            thread_ts="1234.5678",
        )
        await adapter.on_event({"type": "token", "text": "hi"})
        assert adapter._display_tokens == ["hi"]
        assert adapter._persistence_tokens == ["hi"]


class TestDiscordAdapterConstructedWithoutBaseParams:
    async def test_works_without_persistence_params(self):
        installation = MagicMock()
        installation.bot_token = "fake-token"

        from apps.integrations.discord.adapter import DiscordResponseAdapter
        adapter = DiscordResponseAdapter(
            installation=installation,
            channel_id="123456",
        )
        await adapter.on_event({"type": "token", "text": "hi"})
        assert adapter._display_tokens == ["hi"]
        assert adapter._persistence_tokens == ["hi"]


class TestFinalizePersistenceNoopWithoutPrepareTurn:
    async def test_no_crash_no_db_call(self):
        adapter = ConcreteAdapter()
        await adapter.finalize_persistence()

    async def test_slack_adapter_finalize_persistence_noop(self):
        installation = MagicMock()
        installation.get_client.return_value = MagicMock()

        from apps.integrations.slack.adapter import SlackResponseAdapter
        adapter = SlackResponseAdapter(
            installation=installation,
            channel_id="C123",
            thread_ts="1234.5678",
        )
        await adapter.finalize_persistence()
