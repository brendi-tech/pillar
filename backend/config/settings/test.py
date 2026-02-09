"""
Test settings for Help Center Backend.

PostgreSQL with pgvector is REQUIRED for tests - SQLite is not supported
due to VectorField usage for embeddings.
"""
from .base import *
import os

DEBUG = True

# Allow testserver host (Django's test client default)
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']

# PostgreSQL is REQUIRED for tests (pgvector extension needed for VectorField)
# Defaults work with local docker-compose setup, can be overridden via env vars for CI
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('HC_POSTGRES_DB', 'help_center_test'),
        'USER': os.environ.get('HC_POSTGRES_USER', 'postgres'),
        'PASSWORD': os.environ.get('HC_POSTGRES_PASSWORD', 'postgres'),
        'HOST': os.environ.get('HC_POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('HC_POSTGRES_PORT', '5432'),
        'CONN_MAX_AGE': 0,  # No connection pooling for tests
        'CONN_HEALTH_CHECKS': False,
    }
}

# Use simple password hasher for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Use local memory cache for tests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Email backend
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Local storage for tests
STORAGE_BACKEND = 'local'

# Disable external API calls in tests
OPENAI_API_KEY = 'sk-test-key-do-not-use'
ANTHROPIC_API_KEY = 'sk-ant-test-key-do-not-use'
GOOGLE_API_KEY = 'test-google-key-do-not-use'

# Disable PostHog in tests
POSTHOG_ENABLED = False
POSTHOG_API_KEY = None

# Disable Hatchet in tests
HATCHET_ENABLED = False
