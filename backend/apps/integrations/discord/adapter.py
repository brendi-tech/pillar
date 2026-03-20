"""
DiscordResponseAdapter — translates agentic loop events into Discord messages.

Posts responses as embeds via the Discord REST API. Adds a thinking reaction
while processing, similar to the Slack adapter.
"""
import logging

import httpx

from apps.mcp.services.agent.response_adapter import ResponseAdapter

from .formatting import build_error_embed, build_response_embed, split_long_response
from .models import DiscordInstallation

logger = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"


class DiscordResponseAdapter(ResponseAdapter):
    """
    Translates agentic loop events into Discord embeds.

    Accumulates tokens during streaming, then posts the complete response
    as an embed in finalize(). Discord doesn't have a streaming chat API
    like Slack, so we batch the response.

    ``_display_tokens`` is the presentation buffer. ``_persistence_tokens``
    (in the base class) is append-only for DB persistence.
    """

    def __init__(
        self,
        installation: DiscordInstallation,
        channel_id: str,
        thread_id: str = '',
        organization_id: str = '',
        product_id: str = '',
        conversation_id: str = '',
    ) -> None:
        super().__init__(
            organization_id=organization_id,
            product_id=product_id,
            conversation_id=conversation_id,
            channel='discord',
        )
        self.installation = installation
        self.channel_id = channel_id
        self.thread_id = thread_id

        self._display_tokens: list[str] = []
        self._sources: list[dict] = []
        self._full_response = ""

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bot {self.installation.bot_token}",
            "Content-Type": "application/json",
        }

    @property
    def _post_channel_id(self) -> str:
        return self.thread_id or self.channel_id

    # ── ResponseAdapter interface ──────────────────────────────────────

    async def on_token(self, text: str) -> None:
        self._display_tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        pass

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        pass

    async def on_complete(self, event: dict) -> None:
        self._full_response = event.get('message', '') or ''.join(self._display_tokens)

    async def on_error(self, message: str, details: dict | None = None) -> None:
        await self.send_error(message)

    # ── Discord-specific methods ───────────────────────────────────────

    async def finalize(self) -> None:
        """Persist state, then post the complete response as a Discord embed."""
        await self.finalize_persistence()

        response_text = self._full_response or ''.join(self._display_tokens)
        if not response_text:
            return

        embed = build_response_embed(response_text, self._sources)
        await self._send_message(embeds=[embed])

    async def add_thinking_reaction(self, message_id: str) -> None:
        """Add a thinking reaction to the user's message."""
        try:
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/reactions/%F0%9F%A4%94/@me",
                    headers=self._headers,
                )
        except Exception:
            pass

    async def remove_thinking_reaction(self, message_id: str) -> None:
        """Remove the thinking reaction from the user's message."""
        try:
            async with httpx.AsyncClient() as client:
                await client.delete(
                    f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/reactions/%F0%9F%A4%94/@me",
                    headers=self._headers,
                )
        except Exception:
            pass

    async def send_error(self, error_message: str) -> None:
        """Post an error embed."""
        try:
            embed = build_error_embed(
                f"Something went wrong. Please try again.\n\n*{error_message[:200]}*"
            )
            await self._send_message(embeds=[embed])
        except Exception:
            logger.exception("[DISCORD] Failed to send error message")

    async def create_thread(self, message_id: str, name: str) -> dict | None:
        """Create a thread from a message and return the thread data."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/threads",
                    headers=self._headers,
                    json={"name": name[:100]},
                )
                resp.raise_for_status()
                thread_data = resp.json()
                self.thread_id = thread_data["id"]
                return thread_data
        except Exception:
            logger.exception("[DISCORD] Failed to create thread")
            return None

    async def _send_message(
        self,
        content: str = "",
        embeds: list[dict] | None = None,
    ) -> dict | None:
        """Post a message to the channel/thread."""
        payload: dict = {}
        if content:
            chunks = split_long_response(content)
            payload["content"] = chunks[0]
        if embeds:
            payload["embeds"] = embeds

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{DISCORD_API}/channels/{self._post_channel_id}/messages",
                    headers=self._headers,
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(
                "[DISCORD] Failed to send message: %s %s",
                e.response.status_code, e.response.text[:200],
            )
            return None
        except Exception:
            logger.exception("[DISCORD] Failed to send message")
            return None
