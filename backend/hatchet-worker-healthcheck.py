#!/usr/bin/env python3
"""
Health check server for Help Center Hatchet Worker.

Runs a simple HTTP server on port 8001 (configurable via PORT env var)
that responds to Cloud Run health probes while the Hatchet worker runs in the background.

Uses threading to run both health server and Hatchet worker in the same process.
"""
import os
import sys
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s %(asctime)s %(name)s %(process)d %(thread)d %(message)s',
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)


class HealthCheckHandler(BaseHTTPRequestHandler):
    """HTTP handler for health check requests."""

    def do_GET(self):
        """Handle GET requests - return 200 OK for health checks."""
        if self.path in ["/", "/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"healthy","service":"help-center-worker"}\n')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        """Override to reduce log noise - only log errors."""
        # Only log non-200 responses
        if not args[1].startswith("200"):
            logger.info("%s - %s" % (self.address_string(), format % args))


def run_health_server(port):
    """Run health check HTTP server in a separate thread."""
    logger.info(f"Health check server starting on port {port}")
    try:
        server = HTTPServer(("", port), HealthCheckHandler)
        logger.info(f"Health check server listening on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.error(f"Health check server failed: {e}")
        sys.exit(1)


def run_hatchet_worker():
    """Run Hatchet worker for Help Center."""
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
    django.setup()

    from common.hatchet_client import get_hatchet_client
    from worker_config import get_all_workflows

    logger.info("=" * 80)
    logger.info("Starting Help Center Hatchet Worker")
    logger.info("=" * 80)

    # Get the Hatchet client
    hatchet = get_hatchet_client()

    # Get all workflows from shared config
    workflows = get_all_workflows()

    logger.info(f"Found {len(workflows)} workflows to register")

    # Create worker and register workflows
    try:
        worker = hatchet.worker("help-center-worker", slots=100)

        # Register each workflow with the worker
        for workflow in workflows:
            worker.register_workflow(workflow)
            logger.info(f"  - Registered: {getattr(workflow, '__name__', str(workflow))}")

        logger.info("-" * 80)
        logger.info(f"Worker ready with {len(workflows)} workflows. Starting...")
        logger.info("-" * 80)

        worker.start()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker failed: {e}", exc_info=True)
        sys.exit(1)


def main():
    """Main entry point."""
    port = int(os.environ.get("PORT", 8001))

    # Start health check server in a daemon thread
    health_thread = threading.Thread(
        target=run_health_server,
        args=(port,),
        daemon=True,
        name="HealthCheckServer"
    )
    health_thread.start()

    logger.info(f"Health check server thread started")

    # Small delay to ensure health server is up
    import time
    time.sleep(1)

    # Run Hatchet worker in the main thread (blocking)
    run_hatchet_worker()


if __name__ == "__main__":
    main()
