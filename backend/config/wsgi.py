"""
WSGI config for Help Center Backend.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os
from pathlib import Path

from django.core.wsgi import get_wsgi_application

# Load environment variables from root .env.local (same as manage.py)
_env_file = Path(__file__).resolve().parent.parent.parent / '.env.local'
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')

application = get_wsgi_application()
