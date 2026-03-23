#!/usr/bin/env python3
"""
Health check server for Discord Gateway WebSocket client.

Runs a simple HTTP server on port 8001 (configurable via PORT env var)
that responds to Cloud Run health probes while Discord Gateway clients
run in the main thread via asyncio.

The health endpoint reflects actual gateway connectivity:
- During startup (before gateway connects): returns 200
  so the startup probe passes.
- After gateway READY received: returns 200 (connected).
- If gateway fails to connect: retries with exponential backoff.
  While retrying the liveness probe still passes (grace period)
  but if all retries are exhausted the process exits so Cloud Run
  restarts it.
"""
import asyncio
import json as json_mod
import logging
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s %(asctime)s %(name)s %(process)d %(thread)d %(message)s',
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)


_worker_state = {
    "phase": "starting",       # starting | connected | retrying | dead
    "error": None,
    "retry_count": 0,
    "connections": 0,
    "started_at": time.time(),
}
_state_lock = threading.Lock()

_STARTUP_GRACE_SECONDS = int(os.environ.get("GATEWAY_STARTUP_GRACE_SECONDS", "120"))
_MAX_RETRIES = int(os.environ.get("GATEWAY_MAX_RETRIES", "5"))
_RETRY_BASE_SECONDS = int(os.environ.get("GATEWAY_RETRY_BASE_SECONDS", "15"))


def _set_state(phase: str, error: str | None = None, connections: int | None = None) -> None:
    with _state_lock:
        _worker_state["phase"] = phase
        if error is not None:
            _worker_state["error"] = error
        if connections is not None:
            _worker_state["connections"] = connections


def _get_state() -> dict:
    with _state_lock:
        return dict(_worker_state)


class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ["/", "/health"]:
            self.send_response(404)
            self.end_headers()
            return

        state = _get_state()
        phase = state["phase"]
        uptime = time.time() - state["started_at"]

        if phase == "starting" or (phase == "retrying" and uptime < _STARTUP_GRACE_SECONDS):
            self._respond(200, {
                "status": "starting",
                "service": "discord-gateway",
                "phase": phase,
                "uptime_seconds": int(uptime),
                "retry_count": state["retry_count"],
            })
            return

        if phase == "connected":
            self._respond(200, {
                "status": "healthy",
                "service": "discord-gateway",
                "phase": "connected",
                "connections": state["connections"],
            })
            return

        self._respond(503, {
            "status": "unhealthy",
            "service": "discord-gateway",
            "phase": phase,
            "error": state.get("error", ""),
            "retry_count": state["retry_count"],
        })

    def _respond(self, code: int, body: dict) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json_mod.dumps(body).encode() + b"\n")

    def log_message(self, format, *args):
        if not args[1].startswith("200"):
            logger.info("%s - %s" % (self.address_string(), format % args))


def run_health_server(port: int) -> None:
    logger.info("Health check server starting on port %d", port)
    try:
        server = HTTPServer(("", port), HealthCheckHandler)
        logger.info("Health check server listening on port %d", port)
        server.serve_forever()
    except Exception as e:
        logger.error("Health check server failed: %s", e)
        sys.exit(1)


def run_gateway() -> None:
    """Query active BYOB installations and run gateway clients."""
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
    django.setup()

    from apps.integrations.discord.gateway import DEFAULT_INTENTS, DiscordGatewayClient
    from apps.integrations.discord.models import DiscordInstallation

    logger.info("=" * 80)
    logger.info("Starting Discord Gateway")
    logger.info("=" * 80)

    attempt = 0
    while attempt <= _MAX_RETRIES:
        try:
            installations = list(
                DiscordInstallation.objects.filter(is_active=True, is_byob=True)
            )

            if not installations:
                logger.warning("No active BYOB Discord installations found. Waiting for installations...")
                _set_state("connected", connections=0)
                _poll_for_installations()
                return

            seen_tokens: set[str] = set()
            unique_entries = []
            for inst in installations:
                if inst.bot_token not in seen_tokens:
                    seen_tokens.add(inst.bot_token)
                    unique_entries.append(inst)

            logger.info(
                "Found %d unique bot token(s) across %d installation(s)",
                len(unique_entries), len(installations),
            )
            for inst in unique_entries:
                logger.info("  - %s (%s)", inst.guild_name, inst.guild_id)

            clients = [
                DiscordGatewayClient(bot_token=inst.bot_token, intents=DEFAULT_INTENTS)
                for inst in unique_entries
            ]

            _set_state("connected", connections=len(clients))
            logger.info("-" * 80)
            logger.info("Gateway ready with %d connection(s). Starting...", len(clients))
            logger.info("-" * 80)

            asyncio.run(_run_clients(clients))
            logger.info("Gateway exited normally")
            return

        except KeyboardInterrupt:
            logger.info("Gateway stopped by user")
            return

        except Exception as e:
            error_str = str(e)
            is_transient = "UNAVAILABLE" in error_str or "ConnectionError" in error_str

            if is_transient and attempt < _MAX_RETRIES:
                attempt += 1
                backoff = _RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                with _state_lock:
                    _worker_state["retry_count"] = attempt
                _set_state("retrying", error_str)
                logger.warning(
                    "Gateway connection failed (attempt %d/%d): %s. Retrying in %ds...",
                    attempt, _MAX_RETRIES, error_str, backoff,
                )
                time.sleep(backoff)
                continue

            logger.error(
                "Gateway failed permanently after %d attempts: %s",
                attempt + 1, e, exc_info=True,
            )
            _set_state("dead", error_str)
            time.sleep(30)
            sys.exit(1)


async def _run_clients(clients: list) -> None:
    await asyncio.gather(*(c.start() for c in clients))


def _poll_for_installations() -> None:
    """Block until installations appear, then restart the gateway loop."""
    from apps.integrations.discord.models import DiscordInstallation

    poll_interval = 30
    while True:
        time.sleep(poll_interval)
        count = DiscordInstallation.objects.filter(is_active=True, is_byob=True).count()
        if count > 0:
            logger.info("Found %d BYOB installation(s), restarting gateway...", count)
            run_gateway()
            return
        logger.debug("Still no BYOB installations, checking again in %ds", poll_interval)


def main():
    port = int(os.environ.get("PORT", 8001))

    health_thread = threading.Thread(
        target=run_health_server,
        args=(port,),
        daemon=True,
        name="HealthCheckServer",
    )
    health_thread.start()
    logger.info("Health check server thread started")

    time.sleep(1)

    run_gateway()


if __name__ == "__main__":
    main()
