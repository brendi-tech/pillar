#!/usr/bin/env python
"""
Hatchet Worker for Help Center Backend.

This script starts a Hatchet worker that processes background tasks for
the Help Center automation features.

Usage:
    python worker.py

The worker will register all automation workflows and listen for tasks
from the Hatchet server.
"""
import os
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


def main():
    """Start the Hatchet worker."""
    logger.info("=" * 60)
    logger.info("Starting Help Center Hatchet Worker")
    logger.info("=" * 60)
    
    # Get the Hatchet client
    hatchet = get_hatchet_client()
    
    # Create the worker
    worker = hatchet.worker("help-center-worker")
    
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
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
