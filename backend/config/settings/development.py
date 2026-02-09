"""
Development settings for Help Center Backend.
"""
from .base import *
import os

DEBUG = True

ALLOWED_HOSTS = ['localhost', '.localhost', '127.0.0.1', '[::1]', 'testserver', '.ngrok-free.dev', '.ngrok.io']

# CORS - Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True

# Allow custom headers for SDK and MCP
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    # Custom SDK headers (from packages/sdk/src/api/client.ts)
    'x-pillar-key',
    'x-pillar-platform',
    'x-pillar-action-version',
    'x-pillar-secret',
    'x-help-center',
    'x-customer-id',
    'x-visitor-id',
    'x-session-id',
    'x-external-user-id',  # For user identification
    'x-page-url',
    # MCP headers
    'mcp-session-id',
    'x-help-center-id',
]

# CSRF - Trust localhost origins in development
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:8002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8002',
    'https://*.ngrok-free.dev',
    'https://*.ngrok.io',
]

# Django REST Framework - Add browsable API renderer
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
    'rest_framework.renderers.JSONRenderer',
    'rest_framework.renderers.BrowsableAPIRenderer',
]

# Disable some security features for local development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Email backend (console for development by default)
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

# Logging - more verbose for development
LOGGING['root']['level'] = 'INFO'
LOGGING['loggers']['apps']['level'] = 'DEBUG'
LOGGING['loggers']['django']['level'] = 'INFO'

# Add file logging for local development
from datetime import datetime
import time

LOGS_DIR = BASE_DIR / 'logs'
os.makedirs(LOGS_DIR, exist_ok=True)

# Generate timestamp for this process instance
LOG_TIMESTAMP = datetime.now().strftime('%Y%m%d_%H%M%S')
LOG_PID = os.getpid()
# Descending sort prefix: ensures newest files sort first alphabetically
LOG_SORT_PREFIX = 10_000_000_000 - int(time.time())

# Determine process type and log subfolder
import sys
_argv_str = ' '.join(sys.argv)
if os.environ.get('SERVICE_TYPE') == 'hatchet-worker' or 'worker.py' in _argv_str:
    PROCESS_TYPE = 'hatchet-worker'
    LOG_SUBDIR = 'hatchet'
elif 'runserver' in _argv_str:
    PROCESS_TYPE = 'django-server'
    LOG_SUBDIR = 'django'
else:
    PROCESS_TYPE = 'django'
    LOG_SUBDIR = 'django'

# Create log subdirectory with month folder (e.g., logs/django/2026-02/)
LOG_MONTH = datetime.now().strftime('%Y-%m')
PROCESS_LOGS_DIR = LOGS_DIR / LOG_SUBDIR / LOG_MONTH
os.makedirs(PROCESS_LOGS_DIR, exist_ok=True)

# Create timestamped log filename with sort prefix for newest-first ordering
LOG_FILENAME = PROCESS_LOGS_DIR / f'{LOG_SORT_PREFIX}_{PROCESS_TYPE}_{LOG_TIMESTAMP}_pid{LOG_PID}.log'

# Main application log file
LOGGING['handlers']['app_file'] = {
    'class': 'logging.FileHandler',
    'filename': LOG_FILENAME,
    'formatter': 'verbose',
}

# Configure logging for development
if os.environ.get('SERVICE_TYPE') == 'hatchet-worker':
    LOGGING['root']['handlers'] = ['console', 'app_file']
    print(f"🔧 Hatchet worker mode: Logging to console + file ({LOG_FILENAME.name})")
else:
    LOGGING['root']['handlers'] = ['console', 'app_file']
    LOGGING['loggers']['django']['handlers'] = ['console', 'app_file']
    LOGGING['loggers']['apps']['handlers'] = ['console', 'app_file']

    # Silence noisy loggers
    LOGGING['loggers']['django.utils.autoreload'] = {
        'handlers': ['console', 'app_file'],
        'level': 'INFO',
        'propagate': False,
    }
    LOGGING['loggers']['django.db.backends'] = {
        'handlers': ['console', 'app_file'],
        'level': 'WARNING',
        'propagate': False,
    }

    print(f"📝 Logging to: {LOG_FILENAME}")

# Agent session logging for debugging
# Creates detailed session dumps in logs/agent-sessions/
AGENT_SESSION_LOGGING = {
    "enabled": True,
    "log_dir": BASE_DIR / "logs" / "agent-sessions",
    "max_files": 100,
    "include_full_responses": True,
    "include_tool_results": True,
}

# Use GCS for storage in development when STORAGE_BACKEND=gcs
# This allows signed URLs to work properly for image uploads
if STORAGE_BACKEND == 'gcs':
    import base64
    import json
    from google.oauth2 import service_account

    storage_options = {
        "bucket_name": GS_BUCKET_NAME,
        "project_id": GS_PROJECT_ID,
        "querystring_auth": True,  # Generate signed URLs
        "expiration": 172800,  # 48 hours
    }

    # For local development: Use service account key if provided
    # For Cloud Run: Will use ADC automatically if no key is provided
    gcs_key_b64 = os.environ.get('GCS_SERVICE_ACCOUNT_KEY_JSON_B64')
    if gcs_key_b64:
        try:
            gcs_key_json = base64.b64decode(gcs_key_b64).decode('utf-8')
            gcs_key_dict = json.loads(gcs_key_json)
            gcs_credentials = service_account.Credentials.from_service_account_info(gcs_key_dict)
            storage_options["credentials"] = gcs_credentials
            print(f"☁️  Using GCS storage: {GS_BUCKET_NAME} (service account key)")
        except Exception as e:
            print(f"⚠️  Failed to decode GCS_SERVICE_ACCOUNT_KEY_JSON_B64: {e}")
            print(f"☁️  Using GCS storage: {GS_BUCKET_NAME} (ADC - may require gcloud auth)")
    else:
        print(f"☁️  Using GCS storage: {GS_BUCKET_NAME} (ADC - may require gcloud auth)")

    STORAGES["default"] = {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        "OPTIONS": storage_options,
    }
