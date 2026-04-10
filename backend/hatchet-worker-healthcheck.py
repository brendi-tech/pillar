#!/usr/bin/env python3
"""
Health check server for Help Center Hatchet Worker.

Runs a simple HTTP server on port 8001 (configurable via PORT env var)
that responds to Cloud Run health probes while the Hatchet worker runs
in the background.

The health endpoint reflects actual Hatchet connectivity:
- During startup (before worker.start() is called): returns 200
  so the startup probe passes.
- After worker.start() succeeds: returns 200 (worker_healthy=True).
- If worker.start() fails (e.g. RESOURCE_EXHAUSTED): retries with
  exponential backoff.  While retrying the liveness probe still passes
  (grace period) but if all retries are exhausted the process exits
  so Cloud Run restarts it.
"""
import json as json_mod
import os
import sys
import logging
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s %(asctime)s %(name)s %(process)d %(thread)d %(message)s',
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared worker health state (written by worker thread, read by health server)
# ---------------------------------------------------------------------------
_worker_state = {
    "phase": "starting",       # starting | connected | retrying | dead
    "error": None,             # last error message if any
    "retry_count": 0,          # number of retries attempted
    "started_at": time.time(),
}
_state_lock = threading.Lock()

# How long after startup we keep returning 200 even if not connected yet.
# Must be shorter than liveness initialDelaySeconds (300s) so the liveness
# probe doesn't start until the grace period is over.
_STARTUP_GRACE_SECONDS = int(os.environ.get("WORKER_STARTUP_GRACE_SECONDS", "240"))

# Retry settings for RESOURCE_EXHAUSTED and transient errors.
_MAX_RETRIES = int(os.environ.get("WORKER_MAX_RETRIES", "5"))
_RETRY_BASE_SECONDS = int(os.environ.get("WORKER_RETRY_BASE_SECONDS", "15"))


def _set_worker_state(phase: str, error: str | None = None) -> None:
    with _state_lock:
        _worker_state["phase"] = phase
        if error is not None:
            _worker_state["error"] = error


def _get_worker_state() -> dict:
    with _state_lock:
        return dict(_worker_state)


class HealthCheckHandler(BaseHTTPRequestHandler):
    """HTTP handler that reflects actual Hatchet worker health."""

    def do_GET(self):
        if self.path not in ["/", "/health"]:
            self.send_response(404)
            self.end_headers()
            return

        state = _get_worker_state()
        phase = state["phase"]
        uptime = time.time() - state["started_at"]

        # During startup grace period, always return 200 so the startup
        # probe passes and we have time to connect to Hatchet.
        if phase == "starting" or (phase == "retrying" and uptime < _STARTUP_GRACE_SECONDS):
            self._respond(200, {
                "status": "starting",
                "service": "help-center-worker",
                "phase": phase,
                "uptime_seconds": int(uptime),
                "retry_count": state["retry_count"],
            })
            return

        if phase == "connected":
            self._respond(200, {
                "status": "healthy",
                "service": "help-center-worker",
                "phase": "connected",
            })
            return

        # phase is "retrying" past grace period, or "dead"
        self._respond(503, {
            "status": "unhealthy",
            "service": "help-center-worker",
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
    """Run health check HTTP server in a separate thread."""
    logger.info("Health check server starting on port %d", port)
    try:
        server = HTTPServer(("", port), HealthCheckHandler)
        logger.info("Health check server listening on port %d", port)
        server.serve_forever()
    except Exception as e:
        logger.error("Health check server failed: %s", e)
        sys.exit(1)


def run_hatchet_worker() -> None:
    """Run Hatchet worker with retry logic for transient registration failures."""
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
    os.environ['PILLAR_SKIP_HEAVY_INIT'] = '1'
    print("[WORKER] Starting django.setup()...", flush=True)
    try:
        django.setup()
        print("[WORKER] django.setup() completed", flush=True)
    except Exception as e:
        print(f"[WORKER] django.setup() FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    from common.hatchet_client import get_hatchet_client
    from worker_config import get_all_workflows

    logger.info("=" * 80)
    logger.info("Starting Help Center Hatchet Worker")
    logger.info("=" * 80)

    hatchet = get_hatchet_client()
    workflows = get_all_workflows()
    logger.info("Found %d workflows to register", len(workflows))

    attempt = 0
    while attempt <= _MAX_RETRIES:
        try:
            worker = hatchet.worker("help-center-worker", slots=100)

            for workflow in workflows:
                worker.register_workflow(workflow)
                logger.info("  - Registered: %s", getattr(workflow, '__name__', str(workflow)))

            logger.info("-" * 80)
            logger.info("Worker ready with %d workflows. Starting...", len(workflows))
            logger.info("-" * 80)

            _set_worker_state("connected")
            worker.start()

            # worker.start() blocks until shutdown; if we get here it exited
            # cleanly (e.g. SIGTERM).
            logger.info("Worker exited normally")
            return

        except KeyboardInterrupt:
            logger.info("Worker stopped by user")
            return

        except Exception as e:
            error_str = str(e)
            is_resource_exhausted = "RESOURCE_EXHAUSTED" in error_str
            is_transient = is_resource_exhausted or "UNAVAILABLE" in error_str

            if is_transient and attempt < _MAX_RETRIES:
                attempt += 1
                backoff = _RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                with _state_lock:
                    _worker_state["retry_count"] = attempt
                _set_worker_state("retrying", error_str)
                logger.warning(
                    "Worker registration failed (attempt %d/%d): %s. "
                    "Retrying in %ds...",
                    attempt, _MAX_RETRIES, error_str, backoff,
                )
                time.sleep(backoff)
                continue

            # Non-transient error or retries exhausted
            logger.error(
                "Worker failed permanently after %d attempts: %s",
                attempt + 1, e, exc_info=True,
            )
            _set_worker_state("dead", error_str)

            # Give Cloud Run liveness probe time to detect the 503 and
            # restart us, rather than exiting immediately (which would
            # burn through crash-loop backoff faster).
            time.sleep(30)
            sys.exit(1)


def main():
    """Main entry point."""
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

    run_hatchet_worker()


if __name__ == "__main__":
    main()
