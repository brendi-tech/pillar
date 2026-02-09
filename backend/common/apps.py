"""
Django app configuration for the common module.
Provides shared utilities, base models, and infrastructure components.
"""
import sys
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CommonConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'common'
    verbose_name = "Common Infrastructure"
    
    def ready(self):
        """Initialize critical components when app is ready."""
        # Set TOKENIZERS_PARALLELISM to avoid fork warnings
        # Must be set BEFORE loading any HuggingFace models
        import os
        if 'TOKENIZERS_PARALLELISM' not in os.environ:
            os.environ['TOKENIZERS_PARALLELISM'] = 'false'
            logger.info("[CommonConfig] Set TOKENIZERS_PARALLELISM=false to avoid fork warnings")
        
        # Pre-initialize Hatchet client during startup (except for certain management commands)
        # This avoids 16+ second delays on the first request that needs to trigger a workflow
        if not self._should_skip_initialization():
            try:
                from common.hatchet_client import get_hatchet_client
                logger.info("[CommonConfig] Pre-initializing Hatchet client during startup...")
                get_hatchet_client()
                logger.info("[CommonConfig] ✅ Hatchet client ready for immediate use")
            except Exception as e:
                # Don't crash Django startup if Hatchet initialization fails
                # The client will retry on first use
                logger.warning(
                    f"[CommonConfig] ⚠️  Failed to pre-initialize Hatchet client: {e}. "
                    "Client will initialize on first use instead."
                )
        
        # Pre-warm embedding model cache during startup
        # This initializes the embedding API client to avoid delays on first RAG operation
        if not self._should_skip_initialization():
            try:
                from common.utils.embedding_cache import prewarm_embedding_cache
                logger.info("[CommonConfig] Pre-warming embedding model cache...")
                prewarm_embedding_cache()
            except Exception as e:
                # Don't crash Django startup if prewarm fails
                logger.warning(
                    f"[CommonConfig] ⚠️  Failed to prewarm embedding cache: {e}. "
                    "Client will initialize on first use instead."
                )
    
    def _should_skip_initialization(self) -> bool:
        """
        Check if we should skip initialization of heavy components.
        
        Skip during:
        - Management commands that don't need heavy resources (migrate, makemigrations, etc.)
        - Testing
        - Hatchet worker process (it has its own initialization)
        
        Returns:
            bool: True if we should skip initialization
        """
        # Check if we're running a management command
        if len(sys.argv) > 1 and sys.argv[0].endswith('manage.py'):
            command = sys.argv[1]
            # Skip for these commands
            skip_commands = {
                'migrate', 'makemigrations', 'showmigrations', 
                'sqlmigrate', 'squashmigrations',
                'test', 'check', 'shell', 'dbshell',
                'collectstatic', 'compilemessages', 'makemessages',
                'hatchet_worker',  # Worker has its own initialization
            }
            if command in skip_commands:
                logger.info(f"[CommonConfig] Skipping heavy initialization for '{command}' command")
                return True
        
        # Skip during tests
        if 'test' in sys.argv or 'pytest' in sys.argv[0]:
            logger.info("[CommonConfig] Skipping heavy initialization during tests")
            return True
        
        return False
