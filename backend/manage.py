#!/usr/bin/env python
"""
Django's command-line utility for administrative tasks.

Copyright (C) 2025 Pillar Team
Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
"""
import os
import sys
from pathlib import Path


def main():
    """Run administrative tasks."""
    # Load environment variables from root .env.local (parent directory)
    env_file = Path(__file__).resolve().parent.parent / '.env.local'
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
