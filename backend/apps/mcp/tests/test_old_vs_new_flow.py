"""
End-to-end comparison: old (manual) flow vs new (adapter) flow.

Replays realistic event streams through both code paths and asserts
that create_turn_messages and finalize_turn receive identical arguments,
producing the same DB state.

The old flow is what the Slack/Discord workflows did before this refactor:
  1. call create_turn_messages() directly
  2. loop events, manually track last_checkpoint
  3. extract response_text from adapter._full_response or adapter._tokens
  4. call finalize_turn() directly

The new flow is adapter-based:
  1. adapter.prepare_turn()
  2. loop events via adapter.on_event()
  3. adapter.finalize() (which calls finalize_persistence internally)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from apps.mcp.services.agent.response_adapter import ResponseAdapter


# ---------------------------------------------------------------------------
# A realistic event stream that mimics what the agentic loop emits
# ---------------------------------------------------------------------------

REALISTIC_EVENT_STREAM = [
    {"type": "progress", "data": {"kind": "thinking", "status": "active"}},
    {"type": "token", "text": "Let me "},
    {"type": "token", "text": "look "},
    {"type": "token", "text": "into that."},
    {"type": "progress", "data": {"kind": "tool_call", "status": "active",
                                   "tool_name": "search_knowledge"}},
    {"type": "state_checkpoint",
     "llm_messages": [
         {"role": "user", "content": "How do I reset my password?"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc1", "function": {"name": "search_knowledge",
                          "arguments": '{"query":"reset password"}'}}]},
     ],
     "registered_tools": [{"name": "search_knowledge", "type": "function"}],
     "model_used": "gpt-4o",
     "display_trace": [
         {"kind": "thinking", "status": "complete"},
         {"kind": "tool_call", "status": "active", "tool_name": "search_knowledge"},
     ]},
    {"type": "progress", "data": {"kind": "tool_call", "status": "complete",
                                   "tool_name": "search_knowledge"}},
    {"type": "token", "text": "Based on "},
    {"type": "token", "text": "the documentation, "},
    {"type": "token", "text": "here's how to reset your password:\n\n"},
    {"type": "token", "text": "1. Go to Settings\n2. Click 'Reset Password'"},
    {"type": "sources", "sources": [
        {"title": "Password Reset Guide", "url": "https://help.example.com/password"},
    ]},
    {"type": "state_checkpoint",
     "llm_messages": [
         {"role": "user", "content": "How do I reset my password?"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc1", "function": {"name": "search_knowledge",
                          "arguments": '{"query":"reset password"}'}}]},
         {"role": "tool", "tool_call_id": "tc1",
          "content": "Go to Settings > Reset Password..."},
         {"role": "assistant",
          "content": "Based on the documentation, here's how to reset your password:\n\n1. Go to Settings\n2. Click 'Reset Password'"},
     ],
     "registered_tools": [{"name": "search_knowledge", "type": "function"}],
     "model_used": "gpt-4o",
     "display_trace": [
         {"kind": "thinking", "status": "complete"},
         {"kind": "tool_call", "status": "complete", "tool_name": "search_knowledge"},
     ]},
    {"type": "complete",
     "message": "Based on the documentation, here's how to reset your password:\n\n1. Go to Settings\n2. Click 'Reset Password'"},
]

MULTI_TOOL_EVENT_STREAM = [
    {"type": "token", "text": "Reasoning "},
    {"type": "token", "text": "step 1"},
    {"type": "progress", "data": {"kind": "tool_call", "status": "active",
                                   "tool_name": "search_actions"}},
    {"type": "state_checkpoint",
     "llm_messages": [{"role": "user", "content": "create a chart"}],
     "registered_tools": [{"name": "search_actions", "type": "function"}],
     "model_used": "claude-3.5-sonnet",
     "display_trace": [{"kind": "tool_call", "status": "active"}]},
    {"type": "progress", "data": {"kind": "tool_call", "status": "complete"}},
    {"type": "token", "text": "Found "},
    {"type": "token", "text": "the action. "},
    {"type": "progress", "data": {"kind": "tool_call", "status": "active",
                                   "tool_name": "execute_action"}},
    {"type": "state_checkpoint",
     "llm_messages": [
         {"role": "user", "content": "create a chart"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc1", "function": {"name": "search_actions"}}]},
         {"role": "tool", "tool_call_id": "tc1", "content": "create_chart action found"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc2", "function": {"name": "execute_action"}}]},
     ],
     "registered_tools": [
         {"name": "search_actions", "type": "function"},
         {"name": "execute_action", "type": "function"},
     ],
     "model_used": "claude-3.5-sonnet",
     "display_trace": [
         {"kind": "tool_call", "status": "complete"},
         {"kind": "tool_call", "status": "active"},
     ]},
    {"type": "progress", "data": {"kind": "tool_call", "status": "complete"}},
    {"type": "token", "text": "I've created the chart for you."},
    {"type": "state_checkpoint",
     "llm_messages": [
         {"role": "user", "content": "create a chart"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc1"}]},
         {"role": "tool", "tool_call_id": "tc1", "content": "create_chart action found"},
         {"role": "assistant", "content": None,
          "tool_calls": [{"id": "tc2"}]},
         {"role": "tool", "tool_call_id": "tc2", "content": "chart created"},
         {"role": "assistant", "content": "I've created the chart for you."},
     ],
     "registered_tools": [
         {"name": "search_actions", "type": "function"},
         {"name": "execute_action", "type": "function"},
     ],
     "model_used": "claude-3.5-sonnet",
     "display_trace": [
         {"kind": "tool_call", "status": "complete"},
         {"kind": "tool_call", "status": "complete"},
     ]},
    {"type": "complete", "message": "I've created the chart for you."},
]

EMPTY_COMPLETE_MESSAGE_STREAM = [
    {"type": "token", "text": "The answer is 42."},
    {"type": "state_checkpoint",
     "llm_messages": [{"role": "assistant", "content": "The answer is 42."}],
     "registered_tools": [],
     "model_used": "gpt-4o-mini",
     "display_trace": []},
    {"type": "complete", "message": ""},
]


# ---------------------------------------------------------------------------
# Slack-like adapter with display token clearing (old behavior)
# ---------------------------------------------------------------------------

class SlackLikeAdapter(ResponseAdapter):
    """Mimics the Slack adapter's display-token-clearing behavior."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._display_tokens: list[str] = []
        self._sources: list[dict] = []
        self._full_response = ""

    async def on_token(self, text: str) -> None:
        self._display_tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        kind = progress_data.get("kind", "")
        status = progress_data.get("status", "")
        if kind in ("tool_call", "search") and status == "active":
            self._display_tokens = []

    async def on_action_request(self, action_name, parameters, action):
        pass

    async def on_complete(self, event: dict) -> None:
        self._full_response = event.get('message', '') or ''.join(self._display_tokens)

    async def on_error(self, message, details=None):
        pass


# ---------------------------------------------------------------------------
# Simulate the OLD flow (what Slack/Discord workflows did before)
# ---------------------------------------------------------------------------

async def run_old_flow(
    events: list[dict],
    org_id: str,
    product_id: str,
    conversation_id: str,
    user_text: str,
    channel: str,
    mock_create_turn: AsyncMock,
    mock_finalize_turn: AsyncMock,
):
    """Replicates the old manual persistence pattern from handle_message.py."""
    # 1. create_turn_messages directly
    assistant_msg_id = await mock_create_turn(
        conversation_id=conversation_id,
        organization_id=org_id,
        product_id=product_id,
        user_text=user_text,
        channel=channel,
    )

    # 2. old-style adapter (no persistence params, no super().__init__)
    class OldSlackAdapter(ResponseAdapter):
        def __init__(self):
            self._tokens: list[str] = []
            self._sources: list[dict] = []
            self._full_response = ""

        async def on_token(self, text):
            self._tokens.append(text)

        async def on_sources(self, sources):
            self._sources = sources

        async def on_progress(self, data):
            kind = data.get("kind", "")
            status = data.get("status", "")
            if kind in ("tool_call", "search") and status == "active":
                self._tokens = []

        async def on_action_request(self, *a):
            pass

        async def on_complete(self, event):
            self._full_response = event.get('message', '') or ''.join(self._tokens)

        async def on_error(self, msg, details=None):
            pass

    adapter = OldSlackAdapter()

    # 3. loop with manual checkpoint tracking
    last_checkpoint = {}
    for event in events:
        if event.get('type') == 'state_checkpoint':
            last_checkpoint = event
        await adapter.on_event(event)

    # 4. extract response_text exactly as old workflows did
    response_text = adapter._full_response or ''.join(adapter._tokens)

    # 5. finalize_turn directly
    await mock_finalize_turn(
        assistant_message_id=assistant_msg_id,
        response_text=response_text,
        llm_messages=last_checkpoint.get('llm_messages', []),
        registered_tools=last_checkpoint.get('registered_tools', []),
        model_used=last_checkpoint.get('model_used', ''),
    )


# ---------------------------------------------------------------------------
# Simulate the NEW flow (adapter-based persistence)
# ---------------------------------------------------------------------------

async def run_new_flow(
    events: list[dict],
    org_id: str,
    product_id: str,
    conversation_id: str,
    user_text: str,
    channel: str,
    mock_create_turn: AsyncMock,
    mock_finalize_turn: AsyncMock,
):
    """Replicates the new adapter-based persistence pattern."""
    adapter = SlackLikeAdapter(
        organization_id=org_id,
        product_id=product_id,
        conversation_id=conversation_id,
        channel=channel,
    )

    with patch(
        'apps.mcp.services.session_resumption.create_turn_messages',
        mock_create_turn,
    ):
        await adapter.prepare_turn(user_text)

    for event in events:
        await adapter.on_event(event)

    with patch(
        'apps.mcp.services.session_resumption.finalize_turn',
        mock_finalize_turn,
    ):
        await adapter.finalize_persistence()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestOldVsNewFlow:
    """Replay the same event stream through old and new flows, compare calls."""

    async def _run_comparison(self, events: list[dict], user_text: str = "Hello"):
        """Run both flows and return (old_create_args, old_finalize_args,
        new_create_args, new_finalize_args)."""
        params = dict(
            org_id='org-1',
            product_id='prod-1',
            conversation_id='conv-1',
            user_text=user_text,
            channel='slack',
        )

        # Old flow mocks
        old_create = AsyncMock(return_value='msg-old')
        old_finalize = AsyncMock()
        await run_old_flow(events, mock_create_turn=old_create,
                           mock_finalize_turn=old_finalize, **params)

        # New flow mocks
        new_create = AsyncMock(return_value='msg-new')
        new_finalize = AsyncMock()
        await run_new_flow(events, mock_create_turn=new_create,
                           mock_finalize_turn=new_finalize, **params)

        return (
            old_create.call_args,
            old_finalize.call_args,
            new_create.call_args,
            new_finalize.call_args,
        )

    async def test_create_turn_messages_args_match(self):
        """Both flows call create_turn_messages with identical kwargs."""
        old_create, _, new_create, _ = await self._run_comparison(
            REALISTIC_EVENT_STREAM, user_text="How do I reset my password?"
        )
        assert old_create.kwargs == new_create.kwargs

    async def test_finalize_turn_response_text_matches(self):
        """Both flows pass the same response_text to finalize_turn."""
        _, old_fin, _, new_fin = await self._run_comparison(REALISTIC_EVENT_STREAM)
        assert old_fin.kwargs['response_text'] == new_fin.kwargs['response_text']

    async def test_finalize_turn_llm_messages_match(self):
        """Both flows pass the same llm_messages to finalize_turn."""
        _, old_fin, _, new_fin = await self._run_comparison(REALISTIC_EVENT_STREAM)
        assert old_fin.kwargs['llm_messages'] == new_fin.kwargs['llm_messages']

    async def test_finalize_turn_registered_tools_match(self):
        """Both flows pass the same registered_tools to finalize_turn."""
        _, old_fin, _, new_fin = await self._run_comparison(REALISTIC_EVENT_STREAM)
        assert old_fin.kwargs['registered_tools'] == new_fin.kwargs['registered_tools']

    async def test_finalize_turn_model_used_matches(self):
        """Both flows pass the same model_used to finalize_turn."""
        _, old_fin, _, new_fin = await self._run_comparison(REALISTIC_EVENT_STREAM)
        assert old_fin.kwargs['model_used'] == new_fin.kwargs['model_used']

    async def test_multi_tool_flow_matches(self):
        """Multiple tool calls: final persistence state is identical."""
        _, old_fin, _, new_fin = await self._run_comparison(
            MULTI_TOOL_EVENT_STREAM, user_text="create a chart"
        )
        assert old_fin.kwargs['response_text'] == new_fin.kwargs['response_text']
        assert old_fin.kwargs['llm_messages'] == new_fin.kwargs['llm_messages']
        assert old_fin.kwargs['registered_tools'] == new_fin.kwargs['registered_tools']
        assert old_fin.kwargs['model_used'] == new_fin.kwargs['model_used']

    async def test_empty_complete_message_falls_back_to_tokens(self):
        """When complete.message is empty, both flows fall back to tokens."""
        _, old_fin, _, new_fin = await self._run_comparison(
            EMPTY_COMPLETE_MESSAGE_STREAM, user_text="What is the answer?"
        )
        assert old_fin.kwargs['response_text'] == "The answer is 42."
        assert new_fin.kwargs['response_text'] == "The answer is 42."

    async def test_display_tokens_cleared_but_persistence_identical(self):
        """Intermediate reasoning tokens are cleared from display in both
        flows, but the final response_text and llm_messages are identical."""
        _, old_fin, _, new_fin = await self._run_comparison(REALISTIC_EVENT_STREAM)
        expected_response = (
            "Based on the documentation, here's how to reset your password:"
            "\n\n1. Go to Settings\n2. Click 'Reset Password'"
        )
        assert old_fin.kwargs['response_text'] == expected_response
        assert new_fin.kwargs['response_text'] == expected_response


class TestOldVsNewFlowSlackSpecific:
    """Test Slack-specific behavior: display tokens get cleared on tool_call
    but the persistence outcome matches the old flow."""

    async def test_slack_tool_call_clears_display_not_persistence(self):
        """In the new flow, _display_tokens is cleared on tool_call progress
        but _persistence_tokens keeps everything. The old flow clears _tokens
        the same way. Both produce the same final response_text."""
        events = [
            {"type": "token", "text": "thinking..."},
            {"type": "progress", "data": {"kind": "tool_call", "status": "active"}},
            {"type": "state_checkpoint",
             "llm_messages": [{"role": "user", "content": "q"}],
             "registered_tools": [], "model_used": "gpt-4o", "display_trace": []},
            {"type": "token", "text": "Final answer."},
            {"type": "state_checkpoint",
             "llm_messages": [{"role": "user", "content": "q"},
                              {"role": "assistant", "content": "Final answer."}],
             "registered_tools": [], "model_used": "gpt-4o", "display_trace": []},
            {"type": "complete", "message": "Final answer."},
        ]

        old_create = AsyncMock(return_value='msg-old')
        old_finalize = AsyncMock()
        new_create = AsyncMock(return_value='msg-new')
        new_finalize = AsyncMock()

        params = dict(
            org_id='org-1', product_id='prod-1', conversation_id='conv-1',
            user_text='test', channel='slack',
        )

        await run_old_flow(events, mock_create_turn=old_create,
                           mock_finalize_turn=old_finalize, **params)
        await run_new_flow(events, mock_create_turn=new_create,
                           mock_finalize_turn=new_finalize, **params)

        assert old_finalize.call_args.kwargs['response_text'] == "Final answer."
        assert new_finalize.call_args.kwargs['response_text'] == "Final answer."
        assert (old_finalize.call_args.kwargs['llm_messages']
                == new_finalize.call_args.kwargs['llm_messages'])

    async def test_no_checkpoint_events_produces_empty_llm_state(self):
        """If no state_checkpoint events are emitted, both flows pass empty
        llm_messages/registered_tools -- neither crashes."""
        events = [
            {"type": "token", "text": "Simple response."},
            {"type": "complete", "message": "Simple response."},
        ]

        old_create = AsyncMock(return_value='msg-old')
        old_finalize = AsyncMock()
        new_create = AsyncMock(return_value='msg-new')
        new_finalize = AsyncMock()

        params = dict(
            org_id='org-1', product_id='prod-1', conversation_id='conv-1',
            user_text='hi', channel='slack',
        )

        await run_old_flow(events, mock_create_turn=old_create,
                           mock_finalize_turn=old_finalize, **params)
        await run_new_flow(events, mock_create_turn=new_create,
                           mock_finalize_turn=new_finalize, **params)

        assert old_finalize.call_args.kwargs['response_text'] == "Simple response."
        assert new_finalize.call_args.kwargs['response_text'] == "Simple response."
        assert old_finalize.call_args.kwargs['llm_messages'] == []
        assert new_finalize.call_args.kwargs['llm_messages'] == []
        assert old_finalize.call_args.kwargs['registered_tools'] == []
        assert new_finalize.call_args.kwargs['registered_tools'] == []
        assert old_finalize.call_args.kwargs['model_used'] == ''
        assert new_finalize.call_args.kwargs['model_used'] == ''


class TestOldVsNewFlowDiscordSpecific:
    """Discord doesn't clear tokens on tool_call progress, but otherwise
    the persistence path is identical."""

    async def test_discord_persistence_matches(self):
        """Discord adapter doesn't clear display tokens on progress, but
        the final persistence outcome should still match the old flow
        since both use the complete event's message field."""

        class OldDiscordAdapter(ResponseAdapter):
            def __init__(self):
                self._tokens: list[str] = []
                self._full_response = ""

            async def on_token(self, text):
                self._tokens.append(text)

            async def on_sources(self, sources):
                pass

            async def on_progress(self, data):
                pass

            async def on_action_request(self, *a):
                pass

            async def on_complete(self, event):
                self._full_response = event.get('message', '') or ''.join(self._tokens)

            async def on_error(self, msg, details=None):
                pass

        class NewDiscordAdapter(ResponseAdapter):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                self._display_tokens: list[str] = []
                self._full_response = ""

            async def on_token(self, text):
                self._display_tokens.append(text)

            async def on_sources(self, sources):
                pass

            async def on_progress(self, data):
                pass

            async def on_action_request(self, *a):
                pass

            async def on_complete(self, event):
                self._full_response = event.get('message', '') or ''.join(self._display_tokens)

            async def on_error(self, msg, details=None):
                pass

        events = REALISTIC_EVENT_STREAM

        # Old flow
        old_adapter = OldDiscordAdapter()
        last_checkpoint = {}
        for event in events:
            if event.get('type') == 'state_checkpoint':
                last_checkpoint = event
            await old_adapter.on_event(event)
        old_response = old_adapter._full_response or ''.join(old_adapter._tokens)

        # New flow
        new_adapter = NewDiscordAdapter(
            organization_id='org-1', product_id='prod-1',
            conversation_id='conv-1', channel='discord',
        )
        for event in events:
            await new_adapter.on_event(event)

        assert old_response == new_adapter._complete_response
        assert last_checkpoint.get('llm_messages', []) == new_adapter._llm_messages
        assert last_checkpoint.get('registered_tools', []) == new_adapter._registered_tools
        assert last_checkpoint.get('model_used', '') == new_adapter._model_used


class TestOldVsNewFlowHeadless:
    """The headless API (JSON/SSE) previously had NO persistence.
    The new flow adds it. Verify the response shape is unchanged."""

    async def test_json_adapter_response_shape_preserved(self):
        """JSONResponseAdapter accumulates ALL tokens (no clearing on
        tool_call like Slack). Verify the shape is unchanged."""
        from apps.mcp.views_api import JSONResponseAdapter

        # Old adapter (no super call, no persistence)
        old_adapter = JSONResponseAdapter.__new__(JSONResponseAdapter)
        old_adapter._tokens = []
        old_adapter._sources = []
        old_adapter._actions = []
        old_adapter._confirmations = []
        old_adapter._progress_events = []
        old_adapter._token_usage = None
        old_adapter._error = None
        for event in REALISTIC_EVENT_STREAM:
            await old_adapter.on_event(event)
        old_result = old_adapter.to_dict()

        # New adapter (with super call, persistence)
        new_adapter = JSONResponseAdapter(
            organization_id='org-1', product_id='prod-1', conversation_id='conv-1',
        )
        for event in REALISTIC_EVENT_STREAM:
            await new_adapter.on_event(event)
        new_result = new_adapter.to_dict()

        assert old_result == new_result
        assert "response" in new_result
        assert "sources" in new_result
        assert len(new_result["sources"]) == 1

    async def test_sse_adapter_events_preserved(self):
        import asyncio
        from apps.mcp.views_api import SSEResponseAdapter

        queue = asyncio.Queue()
        adapter = SSEResponseAdapter(queue)
        for event in REALISTIC_EVENT_STREAM:
            await adapter.on_event(event)

        collected = []
        while not queue.empty():
            collected.append(queue.get_nowait())

        token_events = [e for e in collected if 'event: token' in e]
        assert len(token_events) >= 5

        source_events = [e for e in collected if 'event: sources' in e]
        assert len(source_events) == 1

        complete_events = [e for e in collected if 'event: complete' in e]
        assert len(complete_events) == 1
