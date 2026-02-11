"""
Gunicorn configuration for production deployment.

Uses uvicorn workers for ASGI support (async views, SSE streaming, WebSockets).
Development uses bare uvicorn with --reload instead.
"""

import os

# --- Worker ---

# UvicornWorker gives each gunicorn worker its own async event loop,
# so we get process-level isolation with async I/O within each worker.
worker_class = "uvicorn.workers.UvicornWorker"

# Default 2 workers for 1-CPU Cloud Run instances. I/O-bound workloads
# (LLM calls, DB, Redis) benefit from >1 worker even on a single core.
# Override via WEB_CONCURRENCY env var.
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))

# --- Networking ---

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Longer than Cloud Run's load balancer idle timeout (60s) to prevent
# the LB from closing connections that gunicorn still considers alive.
keepalive = 65

# --- Timeouts ---

# Must accommodate long-running SSE streams (MCP agent sessions).
# Matches Cloud Run's timeout setting (300s).
timeout = 300

# Time workers get to finish in-flight requests during graceful shutdown.
graceful_timeout = 30

# --- Worker Recycling ---

# Restart workers after N requests to guard against memory leaks.
# Jitter prevents all workers from restarting simultaneously.
max_requests = 1000
max_requests_jitter = 50

# --- Logging ---

# "-" sends to stdout/stderr, which Cloud Run captures automatically.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
