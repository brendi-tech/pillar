"""
DiscordResponseAdapter — translates agentic loop events into Discord messages.

Posts responses as embeds via the Discord REST API. Adds a thinking reaction
while processing, similar to the Slack adapter.
"""
import logging

import httpx

from apps.mcp.services.agent.response_adapter import ResponseAdapter

from .formatting import (
    PILLAR_BLURPLE,
    build_confirmation_embed,
    build_error_embed,
    build_response_embed,
    split_long_response,
)
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
        interaction_token: str = '',
        application_id: str = '',
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
        self.interaction_token = interaction_token
        self.application_id = application_id

        self._display_tokens: list[str] = []
        self._sources: list[dict] = []
        self._pending_confirmations: list[dict] = []
        self._full_response = ""
        self._http: httpx.AsyncClient | None = None

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bot {self.installation.bot_token}",
            "Content-Type": "application/json",
        }

    def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                headers=self._headers,
                timeout=httpx.Timeout(10.0),
            )
        return self._http

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()

    @property
    def _post_channel_id(self) -> str:
        return self.thread_id or self.channel_id

    # ── ResponseAdapter interface ──────────────────────────────────────

    async def on_token(self, text: str) -> None:
        self._display_tokens.append(text)

    async def on_sources(self, sources: list[dict]) -> None:
        self._sources = sources

    async def on_progress(self, progress_data: dict) -> None:
        kind = progress_data.get("kind", "")
        status = progress_data.get("status", "")
        if kind in ("tool_call", "search") and status == "active":
            intermediate = ''.join(self._display_tokens).strip()
            if intermediate:
                embed = build_response_embed(intermediate, [])
                await self._send_message(embeds=[embed])
            self._display_tokens = []

    async def on_action_request(
        self, action_name: str, parameters: dict, action: dict
    ) -> None:
        pass

    async def on_confirmation_request(
        self, tool_name: str, call_id: str, title: str, message: str,
        details: dict | None, confirm_payload: dict,
        conversation_id: str | None = None,
        source_meta: dict | None = None,
    ) -> None:
        self._pending_confirmations.append({
            "tool_name": tool_name,
            "call_id": call_id,
            "title": title,
            "message": message,
            "details": details,
            "confirm_payload": confirm_payload,
            "conversation_id": conversation_id,
            "source_meta": source_meta,
        })

    async def on_complete(self, event: dict) -> None:
        self._full_response = event.get('message', '') or ''.join(self._display_tokens)

    async def on_error(self, message: str, details: dict | None = None) -> None:
        await self.send_error(message)

    # ── Discord-specific methods ───────────────────────────────────────

    async def finalize(self) -> None:
        """Persist state, then post the complete response as a Discord embed."""
        await self.finalize_persistence()

        response_text = self._full_response or ''.join(self._display_tokens)
        if not response_text and not self._pending_confirmations:
            return

        if response_text:
            embed = build_response_embed(response_text, self._sources)
            await self._send_message(embeds=[embed])

        for conf in self._pending_confirmations:
            embed, components = build_confirmation_embed(
                tool_name=conf["tool_name"],
                call_id=conf["call_id"],
                title=conf["title"],
                message=conf["message"],
                details=conf.get("details"),
                confirm_payload=conf["confirm_payload"],
                conversation_id=conf.get("conversation_id"),
                thread_id=self.thread_id,
                source_meta=conf.get("source_meta"),
            )
            await self._send_message(embeds=[embed], components=components)

    async def add_thinking_reaction(self, message_id: str) -> None:
        """Add a thinking reaction to the user's message."""
        try:
            client = self._get_http()
            await client.put(
                f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/reactions/%F0%9F%A4%94/@me",
            )
        except Exception:
            pass

    async def remove_thinking_reaction(self, message_id: str) -> None:
        """Remove the thinking reaction from the user's message."""
        try:
            client = self._get_http()
            await client.delete(
                f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/reactions/%F0%9F%A4%94/@me",
            )
        except Exception:
            pass

    async def dismiss_deferred_response(
        self,
        application_id: str = '',
        interaction_token: str = '',
    ) -> None:
        """Delete the deferred 'is thinking...' interaction response."""
        app_id = application_id or self.application_id
        token = interaction_token or self.interaction_token
        if not token or not app_id:
            return
        try:
            client = self._get_http()
            await client.delete(
                f"{DISCORD_API}/webhooks/{app_id}/{token}/messages/@original",
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
            client = self._get_http()
            resp = await client.post(
                f"{DISCORD_API}/channels/{self.channel_id}/messages/{message_id}/threads",
                json={"name": name[:100]},
            )
            resp.raise_for_status()
            thread_data = resp.json()
            self.thread_id = thread_data["id"]
            return thread_data
        except Exception:
            logger.exception("[DISCORD] Failed to create thread")
            return None

    async def create_thread_from_interaction(
        self,
        application_id: str,
        interaction_token: str,
        name: str,
    ) -> dict | None:
        """Create a thread from a deferred interaction response.

        Fetches the original interaction message to get its ID, creates a
        thread from it, then edits the original to point users to the thread.
        """
        try:
            client = self._get_http()

            resp = await client.get(
                f"{DISCORD_API}/webhooks/{application_id}/{interaction_token}/messages/@original",
            )
            resp.raise_for_status()
            msg_id = resp.json()["id"]

            thread_data = await self.create_thread(msg_id, name)
            if not thread_data:
                return None

            await client.patch(
                f"{DISCORD_API}/webhooks/{application_id}/{interaction_token}/messages/@original",
                json={
                    "content": "",
                    "embeds": [{"description": "Answering in thread below \u2193", "color": PILLAR_BLURPLE}],
                },
            )
            return thread_data
        except Exception:
            logger.exception("[DISCORD] Failed to create thread from interaction")
            return None

    async def _send_message(
        self,
        content: str = "",
        embeds: list[dict] | None = None,
        components: list[dict] | None = None,
    ) -> dict | None:
        """Post a message to the channel/thread."""
        payload: dict = {}
        if content:
            chunks = split_long_response(content)
            payload["content"] = chunks[0]
        if embeds:
            payload["embeds"] = embeds
        if components:
            payload["components"] = components

        if self.interaction_token and self.application_id:
            url = f"{DISCORD_API}/webhooks/{self.application_id}/{self.interaction_token}"
            extra_headers = {"Content-Type": "application/json"}
        else:
            url = f"{DISCORD_API}/channels/{self._post_channel_id}/messages"
            extra_headers = None

        try:
            client = self._get_http()
            resp = await client.post(url, headers=extra_headers, json=payload)
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
