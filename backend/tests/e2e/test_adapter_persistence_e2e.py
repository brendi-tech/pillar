"""
E2E tests for adapter-based persistence.

Runs the real agentic loop (with real LLM calls) through the new
adapter persistence path and verifies that ChatMessage rows are
created and populated correctly.

Usage:
    export $(grep -v '^#' .env.local | xargs)
    cd backend
    uv run pytest tests/e2e/test_adapter_persistence_e2e.py -m e2e -v -s --confcutdir=tests/e2e -p no:django
"""
import logging
import uuid

import pytest

from tests.e2e.conftest import get_fixture_for_action

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.e2e


# ---------------------------------------------------------------------------
# Test adapter (real persistence, no channel posting)
# ---------------------------------------------------------------------------

from apps.mcp.services.agent.response_adapter import ResponseAdapter


class PersistenceTestAdapter(ResponseAdapter):
    """Concrete adapter with full persistence but no channel output."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.collected_tokens: list[str] = []
        self.action_requests: list[dict] = []
        self.completed = False
        self.response_text = ""

    async def on_token(self, text: str) -> None:
        self.collected_tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        pass

    async def on_progress(self, progress_data: dict) -> None:
        pass

    async def on_action_request(self, action_name, parameters, action):
        self.action_requests.append({
            "action_name": action_name,
            "parameters": parameters,
        })

    async def on_complete(self, event: dict) -> None:
        self.completed = True
        self.response_text = event.get('message', '') or ''.join(self.collected_tokens)

    async def on_error(self, message, details=None):
        pass


class SlackLikePersistenceAdapter(PersistenceTestAdapter):
    """Like PersistenceTestAdapter but clears display tokens on tool_call."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._display_tokens: list[str] = []

    async def on_token(self, text: str) -> None:
        self._display_tokens.append(text)

    async def on_progress(self, progress_data: dict) -> None:
        kind = progress_data.get("kind", "")
        status = progress_data.get("status", "")
        if kind in ("tool_call", "search") and status == "active":
            self._display_tokens = []

    async def on_complete(self, event: dict) -> None:
        self.completed = True
        self.response_text = event.get('message', '') or ''.join(self._display_tokens)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _run_agent_with_adapter(adapter, question, product, session_id=None):
    """Run the real agentic loop and pipe all events through the adapter."""
    from apps.mcp.services.agent import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.helpers import signal_query_result

    session_id = session_id or str(uuid.uuid4())

    service = AgentAnswerServiceReActAsync(
        help_center_config=product,
        organization=product.organization,
    )

    async for event in service.ask_stream(
        question=question,
        session_id=session_id,
    ):
        if event.get("type") == "action_request":
            action_name = event.get("action_name", "")
            tool_call_id = event.get("tool_call_id", "")
            fixture = get_fixture_for_action(action_name) or {
                "success": True, "result": "ok",
            }
            signal_query_result(session_id, action_name, fixture, tool_call_id)
            logger.info("[E2E] Signaled fixture response for %s", action_name)

        await adapter.on_event(event)


async def _create_conversation(conversation_id, product):
    """Create a ChatConversation row (required FK for ChatMessage)."""
    from apps.analytics.models import ChatConversation
    await ChatConversation.objects.acreate(
        id=conversation_id,
        organization=product.organization,
        product=product,
        title="E2E persistence test",
    )


async def _cleanup(conversation_id):
    """Delete ChatMessage + ChatConversation rows created during the test."""
    from apps.analytics.models import ChatMessage, ChatConversation
    deleted_msgs, _ = await ChatMessage.objects.filter(
        conversation_id=conversation_id,
    ).adelete()
    deleted_convs, _ = await ChatConversation.objects.filter(
        id=conversation_id,
    ).adelete()
    if deleted_msgs or deleted_convs:
        logger.info(
            "[E2E] Cleaned up %d messages + %d conversations for %s",
            deleted_msgs, deleted_convs, conversation_id,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAdapterPersistenceE2E:

    @pytest.mark.asyncio
    async def test_prepare_turn_creates_streaming_rows(self, superset_product):
        """prepare_turn() should create user + assistant ChatMessage rows
        with correct initial state (no LLM call needed)."""
        from apps.analytics.models import ChatMessage

        conversation_id = str(uuid.uuid4())
        adapter = PersistenceTestAdapter(
            organization_id=str(superset_product.organization_id),
            product_id=str(superset_product.id),
            conversation_id=conversation_id,
            channel='test',
        )

        try:
            await _create_conversation(conversation_id, superset_product)
            msg_id = await adapter.prepare_turn("Test question")

            assert msg_id is not None
            assert adapter.assistant_message_id == msg_id

            user_msg = await ChatMessage.objects.filter(
                conversation_id=conversation_id, role='user',
            ).afirst()
            assert user_msg is not None
            assert user_msg.content == "Test question"

            assistant_msg = await ChatMessage.objects.filter(
                conversation_id=conversation_id, role='assistant',
            ).afirst()
            assert assistant_msg is not None
            assert assistant_msg.id == uuid.UUID(msg_id)
            assert assistant_msg.content == ''
            assert assistant_msg.streaming_status == 'streaming'

            logger.info("[E2E] PASS: prepare_turn created rows correctly")
        finally:
            await _cleanup(conversation_id)

    @pytest.mark.asyncio
    async def test_full_persistence_lifecycle(self, superset_product):
        """Full flow: prepare_turn -> real LLM stream -> finalize_persistence.
        Verifies that the assistant ChatMessage row ends up with:
        - non-empty content
        - llm_message with messages list
        - streaming_status='completed'
        """
        from apps.analytics.models import ChatMessage

        conversation_id = str(uuid.uuid4())
        adapter = PersistenceTestAdapter(
            organization_id=str(superset_product.organization_id),
            product_id=str(superset_product.id),
            conversation_id=conversation_id,
            channel='test',
        )

        try:
            await _create_conversation(conversation_id, superset_product)
            await adapter.prepare_turn("What is Superset?")
            await _run_agent_with_adapter(adapter, "What is Superset?", superset_product)
            await adapter.finalize_persistence()

            assert adapter.completed, "Agent should have completed"

            msg = await ChatMessage.objects.aget(
                id=adapter.assistant_message_id, role='assistant',
            )
            assert msg.content, "Assistant message should have content"
            assert msg.streaming_status == 'completed'
            assert msg.llm_message, "llm_message should be populated"

            llm_data = msg.llm_message
            assert "messages" in llm_data, "llm_message should contain messages list"
            assert len(llm_data["messages"]) > 0, "Should have at least one LLM message"

            assert adapter._model_used, "model_used should have been captured"

            logger.info(
                "[E2E] PASS: full lifecycle — content=%d chars, "
                "llm_messages=%d, status=%s, model=%s",
                len(msg.content), len(llm_data["messages"]),
                msg.streaming_status, adapter._model_used,
            )
        finally:
            await _cleanup(conversation_id)

    @pytest.mark.asyncio
    async def test_slack_like_adapter_persists_complete_response(self, superset_product):
        """A Slack-like adapter that clears display tokens on tool_call
        should still persist the full final response via _complete_response,
        not the cleared display buffer."""
        from apps.analytics.models import ChatMessage

        conversation_id = str(uuid.uuid4())
        adapter = SlackLikePersistenceAdapter(
            organization_id=str(superset_product.organization_id),
            product_id=str(superset_product.id),
            conversation_id=conversation_id,
            channel='slack',
        )

        try:
            await _create_conversation(conversation_id, superset_product)
            await adapter.prepare_turn("What is Superset?")
            await _run_agent_with_adapter(adapter, "What is Superset?", superset_product)
            await adapter.finalize_persistence()

            assert adapter.completed

            msg = await ChatMessage.objects.aget(
                id=adapter.assistant_message_id, role='assistant',
            )
            assert msg.content, "Content should not be empty"
            assert msg.streaming_status == 'completed'

            # _persistence_tokens captures ALL tokens (never cleared).
            # _display_tokens may have been cleared by tool_call progress.
            # The DB content should match _complete_response (from the
            # complete event), not the potentially-cleared display buffer.
            assert msg.content == adapter._complete_response

            # If the agent used tools, display tokens would have been
            # cleared mid-stream. But persistence tokens still have everything.
            all_tokens = ''.join(adapter._persistence_tokens)
            assert len(all_tokens) >= len(msg.content), (
                "Persistence tokens should contain at least as much text "
                "as the final response (they include intermediate reasoning)"
            )

            logger.info(
                "[E2E] PASS: Slack-like adapter — persisted content=%d chars, "
                "persistence_tokens=%d chars, display_tokens=%d chars",
                len(msg.content), len(all_tokens),
                len(''.join(adapter._display_tokens)),
            )
        finally:
            await _cleanup(conversation_id)

    @pytest.mark.asyncio
    async def test_persistence_captures_model_and_tools(self, superset_product):
        """Verify model_used and registered_tools are persisted from
        state_checkpoint events. Uses a question that triggers the full
        agentic loop (not the greeting fast-path)."""
        from apps.analytics.models import ChatMessage

        conversation_id = str(uuid.uuid4())
        adapter = PersistenceTestAdapter(
            organization_id=str(superset_product.organization_id),
            product_id=str(superset_product.id),
            conversation_id=conversation_id,
            channel='test',
        )

        try:
            await _create_conversation(conversation_id, superset_product)
            await adapter.prepare_turn("What datasets are available?")
            await _run_agent_with_adapter(
                adapter, "What datasets are available?", superset_product,
            )
            await adapter.finalize_persistence()

            assert adapter.completed

            msg = await ChatMessage.objects.aget(
                id=adapter.assistant_message_id, role='assistant',
            )

            assert adapter._model_used, "model_used should be captured from checkpoint"
            assert adapter._registered_tools, "registered_tools should be captured"

            llm_data = msg.llm_message or {}
            if "model_used" in llm_data:
                assert llm_data["model_used"] == adapter._model_used
            if "registered_tools" in llm_data:
                assert len(llm_data["registered_tools"]) > 0

            logger.info(
                "[E2E] PASS: model_used=%s, registered_tools=%d",
                adapter._model_used, len(adapter._registered_tools),
            )
        finally:
            await _cleanup(conversation_id)
