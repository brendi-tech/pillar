#!/usr/bin/env python
"""
Hatchet Worker for Help Center Backend.

This script starts a Hatchet worker that processes background tasks for
the Help Center automation features.

Usage:
    python worker.py

The worker will register all automation workflows and listen for tasks
from the Hatchet server.

Graceful shutdown:
    On SIGTERM (sent by Cloud Run during deploys), the worker logs the
    signal and converts it to KeyboardInterrupt so the Hatchet SDK can
    finish its internal cleanup. Cloud Run waits up to the configured
    termination grace period before sending SIGKILL.
"""
import os
import signal
import sys
import logging
import django

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
os.environ.setdefault('SERVICE_TYPE', 'hatchet-worker')

# Initialize Django BEFORE importing any Django models or apps
django.setup()

# Now we can import from Django apps
from common.hatchet_client import get_hatchet_client
from worker_config import get_all_workflows

logger = logging.getLogger(__name__)

_shutting_down = False


def _handle_sigterm(signum: int, frame) -> None:
    """
    Handle SIGTERM from Cloud Run during deploys.

    Instead of letting the process die immediately (losing in-flight
    tasks), we log the signal and raise KeyboardInterrupt so the
    Hatchet SDK can run its internal shutdown procedure (drain the
    action listener, let running tasks finish).
    """
    global _shutting_down
    if _shutting_down:
        logger.warning("Received second termination signal — forcing exit")
        sys.exit(1)

    _shutting_down = True
    sig_name = signal.Signals(signum).name
    logger.info(
        f"Received {sig_name} — initiating graceful shutdown "
        f"(finishing in-flight tasks)..."
    )
    raise KeyboardInterrupt


def main():
    """Start the Hatchet worker."""
    # Register signal handlers before starting the worker so SIGTERM
    # during deploys triggers a clean shutdown instead of an abrupt kill.
    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)

    logger.info("=" * 60)
    logger.info("Starting Help Center Hatchet Worker")
    logger.info("=" * 60)
    
    # Get the Hatchet client
    hatchet = get_hatchet_client()
    
    # Create the worker
    worker = hatchet.worker("help-center-worker", slots=10)
    
    # Get all workflows from shared config
    all_workflows = get_all_workflows()
    
    # Register each workflow with the worker
    # This is required for Hatchet SDK v1 - workflows must be explicitly registered
    logger.info(f"Registering {len(all_workflows)} workflows...")
    for workflow in all_workflows:
        workflow_name = getattr(workflow, '__name__', str(workflow))
        try:
            worker.register_workflow(workflow)
            logger.info(f"  ✓ {workflow_name}")
        except Exception as e:
            logger.error(f"  ✗ Failed to register {workflow_name}: {e}")
    
    logger.info("-" * 60)
    logger.info("Worker is ready to process tasks...")
    logger.info("-" * 60)
    
    # Start the worker - this blocks and processes tasks
    try:
        worker.start()
    except KeyboardInterrupt:
        logger.info("Worker shutting down gracefully...")
    except Exception as e:
        logger.error(f"Worker error: {e}", exc_info=True)
        sys.exit(1)

    logger.info("Worker stopped")


if __name__ == "__main__":
    main()
