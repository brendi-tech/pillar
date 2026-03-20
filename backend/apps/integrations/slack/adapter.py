"""
SlackResponseAdapter — translates agentic loop events into Slack messages.

Implements the ResponseAdapter interface. Buffers the full response and
posts a single threaded reply via chat.postMessage once the agentic loop
completes. Intermediate reasoning tokens (emitted before tool calls) are
discarded so only the final answer reaches Slack.
"""
import logging

from asgiref.sync import sync_to_async

from apps.mcp.services.agent.response_adapter import ResponseAdapter

from .formatting import (
    build_confirmation_blocks,
    build_sources_block,
    markdown_to_mrkdwn,
    split_text_into_blocks,
)
from .models import SlackInstallation

logger = logging.getLogger(__name__)


class SlackResponseAdapter(ResponseAdapter):
    """
    Translates agentic loop events into Slack messages.

    Buffers tokens across the agentic loop, clearing intermediate reasoning
    whenever a tool call or search begins. On finalize, posts a single
    chat.postMessage reply in the thread with only the final answer.

    ``_display_tokens`` is the presentation buffer (cleared on tool_call
    progress). ``_persistence_tokens`` (in the base class) is append-only
    and accumulates ALL tokens for DB persistence.
    """

    def __init__(
        self,
        installation: SlackInstallation,
        channel_id: str,
        thread_ts: str,
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
    ):
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel='slack',
        )
        self.installation = installation
        self.client = installation.get_client()
        self.channel_id = channel_id
        self.thread_ts = thread_ts

        logger.info(
            "[SLACK] Adapter init: channel=%s, thread_ts=%s",
            channel_id, thread_ts,
        )

        self._display_tokens: list[str] = []
        self._sources: list[dict] = []
        self._pending_confirmations: list[dict] = []
        self._full_response = ""

    # ── ResponseAdapter interface ──────────────────────────────────────

    async def on_token(self, text: str) -> None:
        self._display_tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        kind = progress_data.get("kind", "")
        status = progress_data.get("status", "")
        if kind in ("tool_call", "search") and status == "active":
            self._display_tokens = []

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict,
        tool_call_id: str = '',
    ) -> None:
        pass

    async def on_confirmation_request(
        self, tool_name: str, call_id: str, title: str, message: str,
        details: dict | None, confirm_payload: dict,
        conversation_id: str | None = None,
    ) -> None:
        self._pending_confirmations.append({
            "tool_name": tool_name,
            "call_id": call_id,
            "title": title,
            "message": message,
            "details": details,
            "confirm_payload": confirm_payload,
            "conversation_id": conversation_id,
        })

    async def on_complete(self, event: dict) -> None:
        self._full_response = event.get('message', '') or ''.join(self._display_tokens)

    async def on_error(self, message: str, details: dict | None = None) -> None:
        await self.send_error(message)

    # ── Slack-specific methods ─────────────────────────────────────────

    async def finalize(self) -> None:
        """Persist state, then post the final answer as a single threaded reply."""
        await self.finalize_persistence()

        response_text = self._full_response or ''.join(self._display_tokens)

        if not response_text and not self._pending_confirmations:
            return

        blocks = self._build_response_blocks(response_text, self._sources) if response_text else []
        for conf in self._pending_confirmations:
            blocks.extend(build_confirmation_blocks(
                tool_name=conf["tool_name"],
                call_id=conf["call_id"],
                title=conf["title"],
                message=conf["message"],
                details=conf.get("details"),
                confirm_payload=conf["confirm_payload"],
                conversation_id=conf.get("conversation_id"),
            ))

        fallback = response_text or "Please confirm the action below."
        await self._post_message(blocks, fallback)

    async def _post_message(self, blocks: list[dict], fallback_text: str = "") -> None:
        """Post a message to the thread using chat.postMessage."""
        logger.info(
            "[SLACK] Posting message: channel=%s, thread_ts=%s, blocks=%d, text_len=%d",
            self.channel_id, self.thread_ts, len(blocks), len(fallback_text),
        )
        response = await sync_to_async(self.client.chat_postMessage)(
            channel=self.channel_id,
            thread_ts=self.thread_ts,
            blocks=blocks,
            text=fallback_text[:200] or "Here's what I found.",
        )
        logger.info(
            "[SLACK] Post response: ok=%s, ts=%s, channel=%s",
            response.get('ok'), response.get('ts'), response.get('channel'),
        )

    async def add_thinking_reaction(self, message_ts: str) -> None:
        """Add :thinking_face: reaction to the user's message."""
        try:
            await sync_to_async(self.client.reactions_add)(
                channel=self.channel_id,
                name="thinking_face",
                timestamp=message_ts,
            )
        except Exception:
            pass

    async def remove_thinking_reaction(self, message_ts: str) -> None:
        """Remove :thinking_face: reaction from the user's message."""
        try:
            await sync_to_async(self.client.reactions_remove)(
                channel=self.channel_id,
                name="thinking_face",
                timestamp=message_ts,
            )
        except Exception:
            pass

    async def send_error(self, error_message: str) -> None:
        """Post an error message to the thread."""
        try:
            await sync_to_async(self.client.chat_postMessage)(
                channel=self.channel_id,
                thread_ts=self.thread_ts,
                text=f":warning: Something went wrong. Please try again.\n\n_{error_message[:200]}_",
            )
        except Exception:
            logger.exception("[SLACK] Failed to send error message")

    def _build_response_blocks(
        self,
        text: str,
        sources: list[dict],
    ) -> list[dict]:
        """Build Block Kit blocks for the response."""
        mrkdwn_text = markdown_to_mrkdwn(text)
        blocks = split_text_into_blocks(mrkdwn_text)

        if sources:
            source_block = build_sources_block(sources)
            blocks.append({"type": "divider"})
            blocks.append(source_block)

        return blocks
