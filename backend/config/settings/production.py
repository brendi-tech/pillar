"""
Production settings for Help Center Backend.
"""
from .base import *

DEBUG = False

# Security settings
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r'^health/', r'^health/ready/']  # Exempt health checks from SSL redirect
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# Allowed hosts - parse from environment and add Cloud Run patterns
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '').split(',')
_allowed_hosts = [h.strip() for h in _allowed_hosts_env if h.strip()]

# Add Cloud Run patterns
_allowed_hosts.extend([
    '127.0.0.1',
    'localhost',
    '.run.app',
    '.a.run.app',
])

ALLOWED_HOSTS = _allowed_hosts

# CORS - Specific origins only
# Always allow marketing site origins
_marketing_origins = [
    'https://trypillar.com',
    'https://www.trypillar.com',
    'https://pillar.bot',
    'https://www.pillar.bot',
    # Demo sites
    'https://superset.trypillar.com',
    'https://superset-demo-45583431749.us-central1.run.app',
    'https://grafana.trypillar.com',
    'https://grafana-copilot-demo-45583431749.us-central1.run.app',
    # Local development (demos hitting prod API)
    'http://localhost:3000',
    'http://localhost:3002',
]

_cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_origins_env:
    CORS_ALLOWED_ORIGINS = _marketing_origins + [
        origin.strip()
        for origin in _cors_origins_env.split(',')
        if origin.strip()
    ]
else:
    CORS_ALLOWED_ORIGINS = _marketing_origins

# Allow custom headers (same as development)
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
    # Custom SDK headers
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
    # W3C Trace Context
    'traceparent',
    'tracestate',
]

# Email - Override default FROM address for production
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'support@trypillar.com')

# Use GCS for storage in production
if STORAGE_BACKEND == 'gcs':
    storage_options = {
        "bucket_name": GS_BUCKET_NAME,
        "project_id": GS_PROJECT_ID,
        "querystring_auth": True,
        "expiration": 172800,
        "iam_sign_blob": True,
    }

    STORAGES["default"] = {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        "OPTIONS": storage_options,
    }
elif STORAGE_BACKEND == 's3':
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    }

# Logging - Use structured JSON logging for production
# CloudLoggingFormatter outputs JSON with severity, exception_type,
# sourceLocation, and service fields that Cloud Logging auto-parses.
LOGGING['formatters']['json'] = {
    '()': 'common.logging.CloudLoggingFormatter',
    'format': '%(message)s %(levelname)s %(name)s',
}

LOGGING['filters'] = {
    'dedupe_exceptions': {
        '()': 'common.logging.DeduplicateExceptionFilter',
    },
}

# Configure console handler based on service type
use_json_logging = os.environ.get('USE_JSON_LOGGING', 'true').lower() == 'true'

if os.environ.get('SERVICE_TYPE') == 'hatchet-worker':
    LOGGING['handlers']['console'] = {
        'class': 'logging.StreamHandler',
        'formatter': 'verbose',
        'filters': ['dedupe_exceptions'],
    }
    LOGGING['root']['handlers'] = ['console']
elif not use_json_logging:
    LOGGING['handlers']['console'] = {
        'class': 'logging.StreamHandler',
        'formatter': 'verbose',
        'filters': ['dedupe_exceptions'],
    }
else:
    LOGGING['handlers']['console'] = {
        'class': 'logging.StreamHandler',
        'formatter': 'json',
        'filters': ['dedupe_exceptions'],
    }

# Keep root logger at INFO level
LOGGING['root']['level'] = 'INFO'

# Suppress Django's request logger -- the DRF exception handler already logs
# 4xx/5xx errors with structured context; letting django.request also emit
# them doubles every error in the logs.
LOGGING['loggers']['django.request'] = {
    'handlers': ['console'],
    'level': 'CRITICAL',
    'propagate': False,
}

# OpenTelemetry tracing (always on)
from common.observability.tracing import setup_tracing as _setup_tracing  # noqa: E402
_setup_tracing(project_id=os.environ.get("GCP_PROJECT_ID"))

# Sentry error tracking — only active when SENTRY_DSN is set. Internal services
# like metabase-prod, grafana-copilot-demo, and superset-demo intentionally omit
# this env var so their errors don't trigger alerts.
import sentry_sdk  # noqa: E402
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("DEPLOY_ENV", "production"),
        traces_sample_rate=0,
        send_default_pii=False,
    )

# ASGI application (inherited from base, but explicitly set for clarity)
ASGI_APPLICATION = 'config.asgi.application'

# Channel layers for async support (MCP streaming, WebSockets)
# Enhanced configuration for streaming workloads
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [{
                "address": REDIS_URL,
                "socket_keepalive": True,
                "health_check_interval": 30,
            }],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}
