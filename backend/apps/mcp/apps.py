"""
Django app configuration for MCP server.

Copyright (C) 2025 Pillar Team
"""
import sys
import logging
import time
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class McpConfig(AppConfig):
    """MCP server app configuration."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.mcp'
    verbose_name = 'MCP Server'

    def ready(self):
        """
        Pre-import heavy modules during server startup to avoid delays on first request.
        
        These imports can take several seconds on first load due to:
        - Django model loading
        - ML library initialization (embeddings)
        - Transitive dependencies
        
        By importing here, the delay happens during server startup instead of the first user request.
        """
        if self._should_skip_initialization():
            return
        
        start_time = time.time()
        logger.info("[McpConfig] Pre-importing heavy modules at startup...")
        
        try:
            # Pre-import knowledge RAG service
            import apps.knowledge.services  # noqa: F401
            
            # Pre-import action search service
            import apps.products.services.action_search_service  # noqa: F401
            
            # Pre-import LLM config
            import common.utils.llm_config  # noqa: F401
            
            # Pre-import embedding service
            import common.services.embedding_service  # noqa: F401
            
            # Pre-import async utilities
            import asgiref.sync  # noqa: F401
            
            elapsed = time.time() - start_time
            logger.info(f"[McpConfig] ✅ Pre-import completed in {elapsed:.1f}s - first request will be instant")
            
        except Exception as e:
            logger.error(f"[McpConfig] ⚠️  Error pre-importing modules: {e}", exc_info=True)
            # Don't fail startup if pre-import fails
    
    def _should_skip_initialization(self) -> bool:
        """
        Check if we should skip pre-importing heavy modules.
        
        Skip during:
        - Management commands that don't need heavy resources
        - Testing
        
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
            }
            if command in skip_commands:
                logger.info(f"[McpConfig] Skipping pre-import for '{command}' command")
                return True
        
        # Skip during tests
        if 'test' in sys.argv or 'pytest' in sys.argv[0]:
            logger.info("[McpConfig] Skipping pre-import during tests")
            return True
        
        return False
