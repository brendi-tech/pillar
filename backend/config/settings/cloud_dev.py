"""
Cloud DEV settings — production-grade but with relaxed restrictions.

Used by the DEV Cloud Run deployment (help-api.pillar.bot).
Inherits all production settings (security, logging, Sentry, etc.)
but opens up CORS and enables DEBUG for easier development workflows.
"""
from .production import *

DEBUG = True

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = []
