"""
Tests for the resume-through-ask flow.

The resume flow routes through AskTool.execute_stream with resume=True,
instead of the old dedicated /resume/ endpoint.

Covers:
- resume=True without conversation_id → error
- resume=True with non-resumable session → error
- resume=True happy path → loads session state, skips history load, skips
  create_conversation_and_user_message, creates assistant message only,
  yields conversation_started, streams tokens, yields complete
- resume=True uses session's registered_actions (not arguments')
- resume=True clears disconnected status
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.tools.builtin.ask import AskTool


# =============================================================================
# Helpers
# =============================================================================

def _mock_help_center():
    hc = MagicMock()
    hc.id = "product-123"
    hc.name = "Test Help Center"
    hc.organization_id = "org-456"
    return hc


def _mock_organization():
    org = MagicMock()
    org.id = "org-456"
    return org


def _mock_request():
    req = MagicMock()
    req.GET = {}
    req.headers = {}
    req.META = {}
    return req


async def _collect_events(gen):
    """Collect all events from an async generator."""
    events = []
    async for event in gen:
        events.append(event)
    return events


# =============================================================================
# Tests: resume error paths
# =============================================================================

class TestAskResumeErrors:
    """Early-exit error cases for resume=True."""

    @pytest.mark.asyncio
    async def test_resume_without_conversation_id(self):
        """resume=True with no conversation_id yields error and returns."""
        tool = AskTool()
        events = await _collect_events(
            tool.execute_stream(
                help_center_config=_mock_help_center(),
                organization=_mock_organization(),
                request=_mock_request(),
                arguments={"query": "", "resume": True},
            )
        )
        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "conversation_id is required" in events[0]["message"]

    @pytest.mark.asyncio
    async def test_resume_not_resumable(self):
        """resume=True when session is not resumable yields error."""
        tool = AskTool()
        with patch(
            "apps.mcp.services.session_resumption.get_resumable_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            events = await _collect_events(
                tool.execute_stream(
                    help_center_config=_mock_help_center(),
                    organization=_mock_organization(),
                    request=_mock_request(),
                    arguments={
                        "query": "",
                        "resume": True,
                        "conversation_id": "conv-abc",
                    },
                )
            )
        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "not resumable" in events[0]["message"]

    @pytest.mark.asyncio
    async def test_resume_session_returns_resumable_false(self):
        """resume=True when session has resumable=False yields error."""
        tool = AskTool()
        with patch(
            "apps.mcp.services.session_resumption.get_resumable_session",
            new_callable=AsyncMock,
            return_value={"resumable": False},
        ):
            events = await _collect_events(
                tool.execute_stream(
                    help_center_config=_mock_help_center(),
                    organization=_mock_organization(),
                    request=_mock_request(),
                    arguments={
                        "query": "",
                        "resume": True,
                        "conversation_id": "conv-abc",
                    },
                )
            )
        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "not resumable" in events[0]["message"]


# =============================================================================
# Tests: resume happy path
# =============================================================================

class TestAskResumeHappyPath:
    """End-to-end test of the resume flow through execute_stream."""

    FAKE_SESSION = {
        "resumable": True,
        "message_id": "msg-old-assistant",
        "conversation_id": "conv-abc",
        "user_message": "Help me with billing",
        "llm_messages": [
            {"role": "user", "content": "Help me with billing"},
            {"role": "assistant", "content": "Let me search for billing info."},
        ],
        "registered_actions": [{"name": "open_billing"}],
        "partial_response": "Let me search for billing info.",
        "display_trace": [],
    }

    def _build_patches(self):
        """Build the set of patches needed for the happy path."""
        patches = {}

        # 1. get_resumable_session returns our fake session
        patches["get_session"] = patch(
            "apps.mcp.services.session_resumption.get_resumable_session",
            new_callable=AsyncMock,
            return_value=dict(self.FAKE_SESSION),
        )

        # 2. clear_disconnected_status is a no-op
        patches["clear_status"] = patch(
            "apps.mcp.services.session_resumption.clear_disconnected_status",
            new_callable=AsyncMock,
        )

        # 3. extract_request_metadata returns a mock
        mock_metadata = MagicMock()
        mock_metadata.user_agent = "test"
        mock_metadata.ip_address = "127.0.0.1"
        mock_metadata.referer = ""
        mock_metadata.session_id = "sess-123"
        mock_metadata.visitor_id = "vis-456"
        mock_metadata.external_user_id = ""
        patches["metadata"] = patch(
            "apps.mcp.tools.builtin.ask.extract_request_metadata",
            return_value=mock_metadata,
        )

        # 4. get_cached_summary returns None (no images)
        patches["cache"] = patch(
            "apps.mcp.services.image_summary_service.get_cached_summary",
            return_value=None,
        )

        # 5. ChatMessage.objects.acreate for the assistant message (resume path)
        patches["acreate"] = patch(
            "apps.analytics.models.ChatMessage.objects.acreate",
            new_callable=AsyncMock,
        )

        # 6. AgentAnswerServiceReActAsync — mock ask_stream to yield a few tokens + complete
        async def fake_ask_stream(**kwargs):
            yield {"type": "token", "text": "Resuming "}
            yield {"type": "token", "text": "your request."}
            yield {"type": "complete", "registered_actions": [{"name": "open_billing"}]}

        mock_agent_cls = MagicMock()
        mock_agent_instance = MagicMock()
        mock_agent_instance.ask_stream = fake_ask_stream
        mock_agent_cls.return_value = mock_agent_instance
        patches["agent"] = patch(
            "apps.mcp.services.agent.AgentAnswerServiceReActAsync",
            mock_agent_cls,
        )

        return patches

    @pytest.mark.asyncio
    async def test_resume_streams_tokens_and_completes(self):
        """Full resume: yields conversation_started, tokens, then complete."""
        tool = AskTool()
        patches = self._build_patches()

        with (
            patches["get_session"],
            patches["clear_status"] as mock_clear,
            patches["metadata"],
            patches["cache"],
            patches["acreate"] as mock_acreate,
            patches["agent"] as mock_agent_cls,
        ):
            events = await _collect_events(
                tool.execute_stream(
                    help_center_config=_mock_help_center(),
                    organization=_mock_organization(),
                    request=_mock_request(),
                    arguments={
                        "query": "",
                        "resume": True,
                        "conversation_id": "conv-abc",
                    },
                )
            )

        # 1. First event is conversation_started
        assert events[0]["type"] == "conversation_started"
        assert events[0]["conversation_id"] == "conv-abc"

        # 2. Tokens streamed
        token_events = [e for e in events if e.get("type") == "token"]
        assert len(token_events) == 2
        assert token_events[0]["text"] == "Resuming "
        assert token_events[1]["text"] == "your request."

        # 3. Complete event at the end
        complete_events = [e for e in events if e.get("type") == "complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["conversation_id"] == "conv-abc"

        # 4. clear_disconnected_status was called with the old message ID
        mock_clear.assert_awaited_once_with("msg-old-assistant")

        # 5. Only assistant message created (not full conversation)
        mock_acreate.assert_awaited_once()
        create_kwargs = mock_acreate.call_args[1]
        assert create_kwargs["conversation_id"] == "conv-abc"
        assert create_kwargs["content"] == ""
        # Role should be ASSISTANT
        assert "ASSISTANT" in str(create_kwargs["role"]) or create_kwargs["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_resume_uses_session_registered_actions(self):
        """Resume should use registered_actions from session, not from arguments."""
        tool = AskTool()
        patches = self._build_patches()

        with (
            patches["get_session"],
            patches["clear_status"],
            patches["metadata"],
            patches["cache"],
            patches["acreate"],
            patches["agent"] as mock_agent_cls,
        ):
            events = await _collect_events(
                tool.execute_stream(
                    help_center_config=_mock_help_center(),
                    organization=_mock_organization(),
                    request=_mock_request(),
                    arguments={
                        "query": "",
                        "resume": True,
                        "conversation_id": "conv-abc",
                        # SDK might send stale registered_actions — should be ignored
                        "registered_actions": [{"name": "stale_action"}],
                    },
                )
            )

        # The agent service should have been created with session's registered_actions
        agent_init_kwargs = mock_agent_cls.call_args[1]
        assert agent_init_kwargs["registered_actions"] == [{"name": "open_billing"}]

    @pytest.mark.asyncio
    async def test_resume_skips_history_load(self):
        """Resume should NOT call _load_conversation_history."""
        tool = AskTool()
        patches = self._build_patches()

        with (
            patches["get_session"],
            patches["clear_status"],
            patches["metadata"],
            patches["cache"],
            patches["acreate"],
            patches["agent"] as mock_agent_cls,
        ):
            with patch.object(
                tool, "_load_conversation_history", new_callable=AsyncMock
            ) as mock_load:
                events = await _collect_events(
                    tool.execute_stream(
                        help_center_config=_mock_help_center(),
                        organization=_mock_organization(),
                        request=_mock_request(),
                        arguments={
                            "query": "",
                            "resume": True,
                            "conversation_id": "conv-abc",
                        },
                    )
                )

            # _load_conversation_history should NOT have been called
            mock_load.assert_not_awaited()

        # Agent should have received the session's llm_messages as conversation_history
        agent_init_kwargs = mock_agent_cls.call_args[1]
        assert agent_init_kwargs["conversation_history"] == self.FAKE_SESSION["llm_messages"]

    @pytest.mark.asyncio
    async def test_resume_builds_continuation_prompt(self):
        """Resume should build a continuation prompt containing the original user message."""
        tool = AskTool()

        # Capture the question kwarg passed to ask_stream
        captured_question = {}

        async def capturing_ask_stream(**kwargs):
            captured_question["question"] = kwargs.get("question", "")
            yield {"type": "token", "text": "OK"}
            yield {"type": "complete"}

        patches = self._build_patches()

        # Override the agent's ask_stream with our capturing version
        mock_agent_cls = MagicMock()
        mock_agent_instance = MagicMock()
        mock_agent_instance.ask_stream = capturing_ask_stream
        mock_agent_cls.return_value = mock_agent_instance
        patches["agent"] = patch(
            "apps.mcp.services.agent.AgentAnswerServiceReActAsync",
            mock_agent_cls,
        )

        with (
            patches["get_session"],
            patches["clear_status"],
            patches["metadata"],
            patches["cache"],
            patches["acreate"],
            patches["agent"],
        ):
            events = await _collect_events(
                tool.execute_stream(
                    help_center_config=_mock_help_center(),
                    organization=_mock_organization(),
                    request=_mock_request(),
                    arguments={
                        "query": "",
                        "resume": True,
                        "conversation_id": "conv-abc",
                    },
                )
            )

        # The question should contain the original user message + continuation instruction
        question = captured_question["question"]
        assert "Help me with billing" in question
        assert "Continue completing" in question
        assert "Don't repeat work" in question
