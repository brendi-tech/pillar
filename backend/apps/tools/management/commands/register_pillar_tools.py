"""Register backend tools with Pillar Cloud.

Usage:
    uv run python manage.py register_pillar_tools
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Register all backend Pillar tools with Pillar Cloud"

    def handle(self, *args, **options):
        from apps.tools.pillar_tools import pillar

        if not pillar._endpoint_url:
            self.stderr.write(self.style.ERROR(
                "PILLAR_SDK_ENDPOINT_URL is not set. "
                "Skipping tool registration."
            ))
            return

        if not pillar._api_key:
            self.stderr.write(self.style.ERROR(
                "PILLAR_SDK_SECRET is not set. "
                "Skipping tool registration."
            ))
            return

        tool_count = len(pillar._tools)
        self.stdout.write(f"Registering {tool_count} tools with Pillar Cloud...")

        result = pillar.register()

        self.stdout.write(self.style.SUCCESS(
            f"Registered {tool_count} tools: {result}"
        ))
