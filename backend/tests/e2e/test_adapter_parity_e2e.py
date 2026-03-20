"""
E2E parity tests: adapter path vs legacy path.

Runs the same questions through both AskTool._execute_stream_adapter
and AskTool._execute_stream_legacy, then checks structural parity:
completion, event types, response text, and persistence.

Each test runs both paths once and verifies everything in a single
method to avoid redundant LLM calls.

Usage:
    cd backend
    export $(grep -v '^#' .env.local | xargs)
    uv run pytest tests/e2e/test_adapter_parity_e2e.py -m e2e -v -s --confcutdir=tests/e2e -p no:django
"""
import asyncio
import copy
import logging
import time
import uuid
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest

from tests.e2e.conftest import get_fixture_for_action

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.e2e


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@dataclass
class PathResult:
    """Collected output from one AskTool path."""

    events: list[dict] = field(default_factory=list)
    event_types: list[str] = field(default_factory=list)
    response_text: str = ""
    action_requests: list[dict] = field(default_factory=list)
    conversation_id: str = ""
    assistant_message_id: str = ""
    completed: bool = False
    error: str | None = None
    elapsed_s: float = 0.0


def _make_mock_metadata(session_id: str | None = None) -> SimpleNamespace:
    """Build a metadata namespace matching extract_request_metadata shape."""
    return SimpleNamespace(
        ip_address="127.0.0.1",
        user_agent="parity-test/1.0",
        visitor_id=str(uuid.uuid4()),
        external_user_id="",
        session_id=session_id or str(uuid.uuid4()),
        referer="",
    )


async def _run_path(
    path_name: str,
    ask_tool,
    method_name: str,
    product,
    question: str,
    session_id: str,
) -> PathResult:
    """Run one AskTool path and collect the results.

    Handles action_request events by signaling fixture responses.
    """
    from apps.mcp.services.agent.helpers import signal_query_result

    result = PathResult()
    metadata = _make_mock_metadata(session_id)
    conv_id = str(uuid.uuid4())

    kwargs: dict[str, Any] = {
        "organization": product.organization,
        "help_center_config": product,
        "conversation_id": conv_id,
        "query": question,
        "validated_images": None,
        "conversation_history": [],
        "client_registered_tools": [],
        "metadata": metadata,
        "page_url": "",
        "skip_analytics": True,
        "resume": False,
        "cancel_event": None,
        "top_k": 10,
        "user_context": [],
        "context": {},
        "user_profile": None,
        "language": "en",
        "request": None,
    }

    method = getattr(ask_tool, method_name)
    start = time.time()

    try:
        async for event in method(**kwargs):
            event_type = event.get("type", "")
            result.events.append(event)
            result.event_types.append(event_type)

            if event_type == "token":
                result.response_text += event.get("text", "")
            elif event_type == "conversation_started":
                result.conversation_id = event.get("conversation_id", "")
                result.assistant_message_id = event.get("assistant_message_id", "")
            elif event_type == "action_request":
                action_name = event.get("action_name", "")
                tool_call_id = event.get("tool_call_id", "")
                params = event.get("parameters", {})
                result.action_requests.append({
                    "action_name": action_name,
                    "parameters": params,
                    "tool_call_id": tool_call_id,
                })
                fixture_data = get_fixture_for_action(action_name, "superset")
                if fixture_data:
                    fixture_data = copy.deepcopy(fixture_data)
                    signal_query_result(session_id, action_name, fixture_data, tool_call_id)
                else:
                    signal_query_result(session_id, action_name, {
                        "success": False, "error": f"No fixture for {action_name}",
                    }, tool_call_id)
            elif event_type == "complete":
                result.completed = True
            elif event_type == "error":
                result.error = event.get("message", "")
                result.completed = True

        result.completed = True
    except Exception as e:
        result.error = str(e)
        logger.error("[%s] Exception: %s", path_name, e, exc_info=True)

    result.elapsed_s = time.time() - start
    actions = [r["action_name"] for r in result.action_requests]
    logger.info(
        "[%s] DONE in %.1fs | %d events | %d chars | actions: %s",
        path_name, result.elapsed_s, len(result.events),
        len(result.response_text), actions or "none",
    )
    return result


async def _cleanup_messages(*conversation_ids: str):
    """Delete ChatMessage rows created during the test."""
    from apps.analytics.models import ChatMessage

    for cid in conversation_ids:
        if not cid:
            continue
        deleted, _ = await ChatMessage.objects.filter(conversation_id=cid).adelete()
        if deleted:
            logger.info("[E2E] Cleaned up %d rows for %s", deleted, cid[:8])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAdapterParityE2E:
    """Compare legacy and adapter paths end-to-end.

    Each test runs both paths once for a given question, then checks
    all parity assertions in a single method. This avoids redundant
    LLM calls and ensures assertions apply to the same run.
    """

    @pytest.mark.asyncio
    async def test_greeting_parity(self, superset_product):
        """Simple greeting: both paths complete, produce text, no actions.
        Also verifies the adapter path persists correctly to the DB."""
        from apps.analytics.models import ChatMessage
        from apps.mcp.tools.builtin.ask import AskTool

        ask_tool = AskTool()
        question = "Hello"

        legacy = await _run_path(
            "LEGACY", ask_tool, "_execute_stream_legacy",
            superset_product, question, str(uuid.uuid4()),
        )
        adapter = await _run_path(
            "ADAPTER", ask_tool, "_execute_stream_adapter",
            superset_product, question, str(uuid.uuid4()),
        )

        try:
            # Both complete without error
            assert legacy.completed, f"Legacy did not complete: {legacy.error}"
            assert adapter.completed, f"Adapter did not complete: {adapter.error}"
            assert legacy.error is None, f"Legacy error: {legacy.error}"
            assert adapter.error is None, f"Adapter error: {adapter.error}"

            # conversation_started is the first event
            assert legacy.event_types[0] == "conversation_started"
            assert adapter.event_types[0] == "conversation_started"

            # Both produce response text
            assert len(legacy.response_text) > 0, "Legacy produced empty response"
            assert len(adapter.response_text) > 0, "Adapter produced empty response"

            # No actions on a greeting
            assert len(legacy.action_requests) == 0, (
                f"Legacy called actions on greeting: {legacy.action_requests}"
            )
            assert len(adapter.action_requests) == 0, (
                f"Adapter called actions on greeting: {adapter.action_requests}"
            )

            # Same set of client-visible event types (state_checkpoint is
            # internal -- the adapter absorbs it in on_state_checkpoint)
            internal_types = {"state_checkpoint"}
            legacy_types = set(legacy.event_types) - internal_types
            adapter_types = set(adapter.event_types) - internal_types
            assert legacy_types == adapter_types, (
                f"Event type mismatch:\n"
                f"  Legacy only:  {legacy_types - adapter_types}\n"
                f"  Adapter only: {adapter_types - legacy_types}"
            )

            # Adapter persists correctly to DB
            assert adapter.assistant_message_id, "No assistant_message_id emitted"

            user_msg = await ChatMessage.objects.filter(
                conversation_id=adapter.conversation_id, role='user',
            ).afirst()
            assert user_msg is not None, "User message row should exist"
            assert user_msg.content == question

            assistant_msg = await ChatMessage.objects.filter(
                id=adapter.assistant_message_id, role='assistant',
            ).afirst()
            assert assistant_msg is not None, "Assistant message row should exist"
            assert assistant_msg.content, "Assistant message content should not be empty"
            assert assistant_msg.streaming_status == 'completed', (
                f"Expected 'completed', got '{assistant_msg.streaming_status}'"
            )

            logger.info(
                "[greeting] PASS — legacy: %d chars in %.1fs, "
                "adapter: %d chars in %.1fs, db_status=%s",
                len(legacy.response_text), legacy.elapsed_s,
                len(adapter.response_text), adapter.elapsed_s,
                assistant_msg.streaming_status,
            )
        finally:
            await _cleanup_messages(
                legacy.conversation_id, adapter.conversation_id,
            )

    @pytest.mark.asyncio
    async def test_action_question_parity(self, superset_product):
        """Question that triggers actions: both paths complete, produce text,
        emit the same event type set, and call actions."""
        from apps.mcp.tools.builtin.ask import AskTool

        ask_tool = AskTool()
        question = "How do I create a chart?"

        legacy = await _run_path(
            "LEGACY", ask_tool, "_execute_stream_legacy",
            superset_product, question, str(uuid.uuid4()),
        )
        adapter = await _run_path(
            "ADAPTER", ask_tool, "_execute_stream_adapter",
            superset_product, question, str(uuid.uuid4()),
        )

        try:
            # Both complete without error
            assert legacy.completed, f"Legacy did not complete: {legacy.error}"
            assert adapter.completed, f"Adapter did not complete: {adapter.error}"
            assert legacy.error is None, f"Legacy error: {legacy.error}"
            assert adapter.error is None, f"Adapter error: {adapter.error}"

            # conversation_started is the first event
            assert legacy.event_types[0] == "conversation_started"
            assert adapter.event_types[0] == "conversation_started"

            # Both produce response text
            assert len(legacy.response_text) > 0, "Legacy produced empty response"
            assert len(adapter.response_text) > 0, "Adapter produced empty response"

            # Same set of client-visible event types (state_checkpoint is
            # internal -- the adapter absorbs it in on_state_checkpoint)
            internal_types = {"state_checkpoint"}
            legacy_types = set(legacy.event_types) - internal_types
            adapter_types = set(adapter.event_types) - internal_types
            assert legacy_types == adapter_types, (
                f"Event type mismatch:\n"
                f"  Legacy only:  {legacy_types - adapter_types}\n"
                f"  Adapter only: {adapter_types - legacy_types}"
            )

            # Every action_request must include tool_call_id (missing
            # tool_call_id causes 60s timeouts in production)
            for result, label in [(legacy, "Legacy"), (adapter, "Adapter")]:
                for req in result.action_requests:
                    assert req.get("tool_call_id"), (
                        f"{label} action_request for '{req['action_name']}' "
                        f"is missing tool_call_id"
                    )

            logger.info(
                "[action_question] Legacy actions: %s",
                [r["action_name"] for r in legacy.action_requests],
            )
            logger.info(
                "[action_question] Adapter actions: %s",
                [r["action_name"] for r in adapter.action_requests],
            )
            logger.info(
                "[action_question] PASS — legacy: %d chars in %.1fs, "
                "adapter: %d chars in %.1fs",
                len(legacy.response_text), legacy.elapsed_s,
                len(adapter.response_text), adapter.elapsed_s,
            )
        finally:
            await _cleanup_messages(
                legacy.conversation_id, adapter.conversation_id,
            )

    @pytest.mark.asyncio
    async def test_action_request_has_tool_call_id(self, superset_product):
        """The adapter path must emit tool_call_id on every action_request.

        Without tool_call_id, the client can't signal results back and
        the agent hangs for 60s waiting on Redis.

        This test uses a directive prompt to force the LLM to call at
        least one client-side action, then asserts tool_call_id is present.
        """
        from apps.mcp.tools.builtin.ask import AskTool

        ask_tool = AskTool()
        question = "List all available datasets using the list_datasets action now."

        adapter = await _run_path(
            "ADAPTER", ask_tool, "_execute_stream_adapter",
            superset_product, question, str(uuid.uuid4()),
        )

        try:
            assert adapter.completed, f"Adapter did not complete: {adapter.error}"
            assert adapter.error is None, f"Adapter error: {adapter.error}"

            assert len(adapter.action_requests) > 0, (
                "LLM did not call any actions -- this test requires at least "
                "one action_request to verify tool_call_id is present"
            )

            for req in adapter.action_requests:
                assert req.get("tool_call_id"), (
                    f"action_request for '{req['action_name']}' is missing "
                    f"tool_call_id -- this causes 60s timeouts in production"
                )

            logger.info(
                "[tool_call_id] PASS — %d actions, all have tool_call_id: %s",
                len(adapter.action_requests),
                [r["action_name"] for r in adapter.action_requests],
            )
        finally:
            await _cleanup_messages(adapter.conversation_id)

    @pytest.mark.asyncio
    async def test_cancel_marks_disconnected(self, superset_product):
        """Adapter cancel path should emit conversation_started and
        mark the session as disconnected (not completed)."""
        from apps.analytics.models import ChatMessage
        from apps.mcp.tools.builtin.ask import AskTool

        ask_tool = AskTool()
        cancel_event = asyncio.Event()
        cancel_event.set()

        session_id = str(uuid.uuid4())
        metadata = _make_mock_metadata(session_id)
        conv_id = str(uuid.uuid4())

        events: list[dict] = []

        try:
            async for event in ask_tool._execute_stream_adapter(
                organization=superset_product.organization,
                help_center_config=superset_product,
                conversation_id=conv_id,
                query="How do I create a chart?",
                validated_images=None,
                conversation_history=[],
                client_registered_tools=[],
                metadata=metadata,
                page_url="",
                skip_analytics=True,
                resume=False,
                cancel_event=cancel_event,
                top_k=5,
                user_context=[],
                context={},
                user_profile=None,
                language="en",
                request=None,
            ):
                events.append(event)

            event_types = [e.get("type", "") for e in events]
            assert "conversation_started" in event_types, (
                f"Expected conversation_started, got: {event_types}"
            )

            # Find the assistant message and verify it's disconnected
            conv_started = next(e for e in events if e.get("type") == "conversation_started")
            msg_id = conv_started.get("assistant_message_id")
            if msg_id:
                msg = await ChatMessage.objects.filter(
                    id=msg_id, role='assistant',
                ).afirst()
                if msg:
                    assert msg.streaming_status == 'disconnected', (
                        f"Expected 'disconnected', got '{msg.streaming_status}'"
                    )
                    logger.info("[cancel] PASS — status=%s", msg.streaming_status)

        finally:
            await _cleanup_messages(conv_id)
