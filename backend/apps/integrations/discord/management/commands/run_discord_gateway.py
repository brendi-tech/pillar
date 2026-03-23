"""
Management command to run the Discord Gateway WebSocket client.

Usage:
    python manage.py run_discord_gateway
    python manage.py run_discord_gateway --installation-id <uuid>

Queries active BYOB DiscordInstallation records for bot tokens and
runs a gateway client per unique token. One gateway connection covers
all guilds that share the same bot.
"""
import asyncio
import logging

from django.core.management.base import BaseCommand

from apps.integrations.discord.gateway import DEFAULT_INTENTS, DiscordGatewayClient
from apps.integrations.discord.models import DiscordInstallation

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run Discord Gateway clients for active BYOB installations"

    def add_arguments(self, parser):
        parser.add_argument(
            '--installation-id',
            type=str,
            default=None,
            help="Run gateway for a specific installation UUID only.",
        )

    def handle(self, *args, **options):
        installation_id = options.get('installation_id')

        if installation_id:
            installations = list(
                DiscordInstallation.objects.filter(id=installation_id, is_active=True)
            )
        else:
            installations = list(
                DiscordInstallation.objects.filter(is_active=True, is_byob=True)
            )

        if not installations:
            self.stderr.write(self.style.ERROR(
                "No active BYOB Discord installations found."
            ))
            return

        seen_tokens = set()
        unique_entries = []
        for inst in installations:
            if inst.bot_token not in seen_tokens:
                seen_tokens.add(inst.bot_token)
                unique_entries.append(inst)

        self.stdout.write(self.style.SUCCESS(
            f"Starting {len(unique_entries)} Discord Gateway client(s) "
            f"for {len(installations)} installation(s)..."
        ))
        for inst in unique_entries:
            self.stdout.write(f"  - {inst.guild_name} ({inst.guild_id})")

        clients = [
            DiscordGatewayClient(
                bot_token=inst.bot_token,
                intents=DEFAULT_INTENTS,
                installation_id=str(inst.id),
            )
            for inst in unique_entries
        ]

        async def run_all():
            await asyncio.gather(*(c.start() for c in clients))

        try:
            asyncio.run(run_all())
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Shutting down Discord Gateway(s)..."))
            asyncio.run(asyncio.gather(*(c.stop() for c in clients)))
