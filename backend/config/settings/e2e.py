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

# Re-enable Redis cache for e2e tests (overrides test.py's LocMemCache)
# Required for agent action result signaling via signal_query_result/wait_for_query_result.
# Without Redis, the in-memory fallback has a race condition where the result is stored
# before the waiting loop creates its asyncio.Event, causing 60s timeouts on every action.
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
        },
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

# Use Anthropic flagship for E2E tests — Google preview models are unreliable at tool calling.
DEFAULT_LLM_MODEL = 'anthropic/flagship'

