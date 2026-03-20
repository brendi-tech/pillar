"""
Lightweight Discord Gateway WebSocket client.

Connects to the Discord Gateway (v10), handles heartbeat, IDENTIFY,
RESUME, and dispatches MESSAGE_CREATE events to Hatchet for processing.

Does not use discord.py -- keeps full control over connection pooling,
reconnection, and shard management.
"""
import asyncio
import json
import logging
import random
import sys
from typing import Any

import aiohttp

from common.task_router import TaskRouter

logger = logging.getLogger(__name__)

GATEWAY_VERSION = 10
GATEWAY_ENCODING = "json"


class DiscordGatewayClient:
    """
    Manages a single WebSocket connection to the Discord Gateway.

    Lifecycle:
    1. Fetch gateway URL from GET /gateway/bot
    2. Connect via WebSocket
    3. Receive HELLO → start heartbeat
    4. Send IDENTIFY → receive READY
    5. Event loop: dispatch events, maintain heartbeat
    6. On disconnect: RESUME or re-IDENTIFY
    """

    def __init__(self, bot_token: str, intents: int) -> None:
        self.bot_token = bot_token
        self.intents = intents
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._session: aiohttp.ClientSession | None = None
        self._heartbeat_interval: float = 41.25
        self._sequence: int | None = None
        self._session_id: str | None = None
        self._resume_gateway_url: str | None = None
        self._heartbeat_task: asyncio.Task | None = None
        self._bot_user_id: str = ""
        self._running = True

    async def start(self) -> None:
        """Connect and run the event loop. Reconnects on failure."""
        self._session = aiohttp.ClientSession()
        try:
            gateway_url = await self._get_gateway_url()
            while self._running:
                try:
                    await self._connect(gateway_url)
                    await self._event_loop()
                except (aiohttp.WSServerHandshakeError, aiohttp.ClientError, ConnectionError) as e:
                    logger.warning("[DISCORD-GW] Connection error: %s — reconnecting in 5s", e)
                    await asyncio.sleep(5)
                except asyncio.CancelledError:
                    break
                except Exception:
                    logger.exception("[DISCORD-GW] Unexpected error — reconnecting in 5s")
                    await asyncio.sleep(5)
                finally:
                    await self._cleanup_heartbeat()

                if self._session_id and self._resume_gateway_url:
                    gateway_url = self._resume_gateway_url
                    logger.info("[DISCORD-GW] Will attempt RESUME to %s", gateway_url)
        finally:
            if self._session and not self._session.closed:
                await self._session.close()

    async def stop(self) -> None:
        self._running = False
        if self._ws and not self._ws.closed:
            await self._ws.close(code=1000)

    async def _get_gateway_url(self) -> str:
        async with self._session.get(
            "https://discord.com/api/v10/gateway/bot",
            headers={"Authorization": f"Bot {self.bot_token}"},
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            url = data["url"]
            logger.info(
                "[DISCORD-GW] Gateway URL: %s (shards: %s)",
                url, data.get("shards", 1),
            )
            return url

    async def _connect(self, gateway_url: str) -> None:
        url = f"{gateway_url}?v={GATEWAY_VERSION}&encoding={GATEWAY_ENCODING}"
        self._ws = await self._session.ws_connect(url, heartbeat=None)
        logger.info("[DISCORD-GW] WebSocket connected")

    async def _event_loop(self) -> None:
        async for msg in self._ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await self._handle_message(json.loads(msg.data))
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                logger.warning("[DISCORD-GW] WebSocket closed/error: %s", msg.type)
                break

    async def _handle_message(self, payload: dict[str, Any]) -> None:
        op = payload.get("op")
        data = payload.get("d")
        seq = payload.get("s")
        event_name = payload.get("t")

        if seq is not None:
            self._sequence = seq

        if op == 10:  # HELLO
            self._heartbeat_interval = data["heartbeat_interval"] / 1000
            await self._start_heartbeat()
            if self._session_id:
                await self._send_resume()
            else:
                await self._send_identify()

        elif op == 11:  # HEARTBEAT_ACK
            pass

        elif op == 1:  # HEARTBEAT request
            await self._send_heartbeat()

        elif op == 7:  # RECONNECT
            logger.info("[DISCORD-GW] Server requested reconnect")
            await self._ws.close(code=4000)

        elif op == 9:  # INVALID_SESSION
            resumable = data if isinstance(data, bool) else False
            if not resumable:
                self._session_id = None
                self._sequence = None
            wait = random.uniform(1, 5)
            logger.info("[DISCORD-GW] Invalid session (resumable=%s), waiting %.1fs", resumable, wait)
            await asyncio.sleep(wait)
            await self._ws.close(code=4000)

        elif op == 0:  # DISPATCH
            await self._handle_dispatch(event_name, data)

    async def _handle_dispatch(self, event_name: str, data: dict) -> None:
        if event_name == "READY":
            self._session_id = data["session_id"]
            self._resume_gateway_url = data.get("resume_gateway_url")
            self._bot_user_id = data.get("user", {}).get("id", "")
            logger.info(
                "[DISCORD-GW] READY: session=%s user=%s guilds=%d",
                self._session_id,
                self._bot_user_id,
                len(data.get("guilds", [])),
            )

        elif event_name == "RESUMED":
            logger.info("[DISCORD-GW] Session resumed successfully")

        elif event_name == "MESSAGE_CREATE":
            await self._on_message_create(data)

    async def _on_message_create(self, data: dict) -> None:
        author = data.get("author", {})
        if author.get("bot"):
            return

        content = data.get("content", "")
        guild_id = data.get("guild_id", "")
        channel_id = data.get("channel_id", "")
        message_id = data.get("id", "")

        is_dm = not guild_id
        is_mention = f"<@{self._bot_user_id}>" in content if self._bot_user_id else False

        thread_id = ""
        msg_ref = data.get("message_reference")
        if data.get("thread") or (msg_ref and msg_ref.get("channel_id") != channel_id):
            thread_id = channel_id

        if not is_dm and not is_mention and not thread_id:
            return

        logger.info(
            "[DISCORD-GW] Message from %s in guild=%s channel=%s: %s",
            author.get("username", "?"),
            guild_id or "DM",
            channel_id,
            content[:80],
        )

        TaskRouter.execute(
            'discord-handle-message',
            guild_id=guild_id,
            channel_id=channel_id,
            author_id=author.get("id", ""),
            author_username=author.get("username", ""),
            content=content,
            message_id=message_id,
            thread_id=thread_id,
        )

    async def _send_identify(self) -> None:
        await self._ws.send_json({
            "op": 2,
            "d": {
                "token": self.bot_token,
                "intents": self.intents,
                "properties": {
                    "os": sys.platform,
                    "browser": "pillar",
                    "device": "pillar",
                },
            },
        })
        logger.info("[DISCORD-GW] Sent IDENTIFY")

    async def _send_resume(self) -> None:
        await self._ws.send_json({
            "op": 6,
            "d": {
                "token": self.bot_token,
                "session_id": self._session_id,
                "seq": self._sequence,
            },
        })
        logger.info("[DISCORD-GW] Sent RESUME (session=%s, seq=%s)", self._session_id, self._sequence)

    async def _send_heartbeat(self) -> None:
        if self._ws and not self._ws.closed:
            await self._ws.send_json({"op": 1, "d": self._sequence})

    async def _start_heartbeat(self) -> None:
        await self._cleanup_heartbeat()
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self) -> None:
        jitter = random.random() * self._heartbeat_interval
        await asyncio.sleep(jitter)
        while self._running:
            await self._send_heartbeat()
            await asyncio.sleep(self._heartbeat_interval)

    async def _cleanup_heartbeat(self) -> None:
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None


# Gateway intent flags
INTENT_GUILDS = 1 << 0
INTENT_GUILD_MESSAGES = 1 << 9
INTENT_GUILD_MESSAGE_REACTIONS = 1 << 10
INTENT_DIRECT_MESSAGES = 1 << 12
INTENT_MESSAGE_CONTENT = 1 << 15

DEFAULT_INTENTS = (
    INTENT_GUILDS
    | INTENT_GUILD_MESSAGES
    | INTENT_GUILD_MESSAGE_REACTIONS
    | INTENT_DIRECT_MESSAGES
    | INTENT_MESSAGE_CONTENT
)
