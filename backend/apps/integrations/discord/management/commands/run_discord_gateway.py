"""
Management command to run the Discord Gateway WebSocket client.

Usage:
    python manage.py run_discord_gateway

Connects to the Discord Gateway using the bot token from settings
and dispatches message events to Hatchet for processing.
"""
import asyncio
import logging

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.integrations.discord.gateway import DEFAULT_INTENTS, DiscordGatewayClient

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run the Discord Gateway WebSocket client"

    def handle(self, *args, **options):
        bot_token = settings.DISCORD_BOT_TOKEN
        if not bot_token:
            self.stderr.write(
                self.style.ERROR(
                    "DISCORD_BOT_TOKEN is not set. "
                    "Add it to your environment or .env file."
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("Starting Discord Gateway client..."))

        client = DiscordGatewayClient(
            bot_token=bot_token,
            intents=DEFAULT_INTENTS,
        )

        try:
            asyncio.run(client.start())
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Shutting down Discord Gateway..."))
            asyncio.run(client.stop())
