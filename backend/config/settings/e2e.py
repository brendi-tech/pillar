"""
E2E test settings - uses REAL API keys for end-to-end testing.

This module inherits from test.py (which has performance optimizations like
fast password hasher, local cache, etc.) but re-reads API keys from environment
variables to enable real API calls.

Usage:
    # Local - load env first, then run with e2e settings
    export $(grep -v '^#' .env.local | xargs)
    cd backend
    .venv/bin/python -m pytest tests/test_services/test_knowledge_rag_e2e.py --ds=config.settings.e2e -m e2e -v

Requirements:
    - PostgreSQL with pgvector (not SQLite - embeddings need vector support)
    - GOOGLE_API_KEY for embedding generation
    - Running database (Cloud SQL Proxy or local PostgreSQL)
"""
from .test import *
import os

# Re-read API keys from environment (override test.py dummy values)
# E2E tests require real API calls for embeddings and LLM generation
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
COHERE_API_KEY = os.environ.get('COHERE_API_KEY', '')

# Force PostgreSQL for e2e tests (pgvector required)
# This overrides the conditional in test.py
if os.environ.get('HC_POSTGRES_HOST'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('HC_POSTGRES_DB', 'help_center_dev'),
            'USER': os.environ.get('HC_POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('HC_POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('HC_POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('HC_POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 0,
            'CONN_HEALTH_CHECKS': False,
        }
    }

# Validate required keys for E2E tests
_missing = [k for k in ['GOOGLE_API_KEY'] if not os.environ.get(k)]
if _missing:
    import warnings
    warnings.warn(
        f"E2E tests require real API keys. Missing: {', '.join(_missing)}. "
        f"Run: export $(grep -v '^#' .env.local | xargs)"
    )

# Enable Cohere reranking for e2e tests if key is available
if os.environ.get('COHERE_API_KEY'):
    COHERE_RERANK_ENABLED = True

# Superset widget ID for agent E2E tests
SUPERSET_WIDGET_ID = os.environ.get(
    'SUPERSET_WIDGET_ID',
    '9eb6f7c8-20ec-44f5-a5d2-e5221a1f144a'
)

# Production API URL for E2E tests that call production
PILLAR_PROD_API_URL = os.environ.get(
    'PILLAR_PROD_API_URL',
    'https://api.trypillar.com'
)

# Use budget-tier model for E2E tests (faster, cheaper, still validates agent behavior)
# Resolved via LLMConfigService.resolve_model() -> e.g. 'gemini-3-flash-preview'
DEFAULT_LLM_MODEL = 'google/budget'

# Enable agent session logging for E2E tests
# This captures LLM thinking, tool decisions, and full session traces
# for debugging test failures in CI
AGENT_SESSION_LOGGING = {
    "enabled": True,
    "log_dir": BASE_DIR / "logs" / "agent-sessions",
    "max_files": 50,
    "include_full_responses": True,
    "include_tool_results": True,
}
