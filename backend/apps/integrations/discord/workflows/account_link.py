"""
Hatchet task: discord-account-link

Generates a one-time identity linking code and sends it to the user
via an interaction follow-up webhook (ephemeral message).
"""
import logging
from datetime import timedelta

import httpx
from django.conf import settings
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()

DISCORD_API = "https://discord.com/api/v10"


class DiscordAccountLinkInput(BaseModel):
    guild_id: str
    user_id: str
    interaction_token: str
    application_id: str


@hatchet.task(
    name="discord-account-link",
    retries=1,
    execution_timeout=timedelta(minutes=2),
    input_validator=DiscordAccountLinkInput,
)
async def handle_account_link(workflow_input: DiscordAccountLinkInput, context: Context):
    from apps.identity.services import generate_link_code
    from apps.integrations.discord.models import DiscordInstallation

    try:
        installation = await DiscordInstallation.objects.select_related('product').aget(
            guild_id=workflow_input.guild_id,
            is_active=True,
        )
    except DiscordInstallation.DoesNotExist:
        logger.error(
            "[DISCORD] No active installation for guild %s", workflow_input.guild_id,
        )
        return {'error': 'No active installation'}

    link_code = await generate_link_code(
        product=installation.product,
        channel='discord',
        channel_user_id=workflow_input.user_id,
        channel_display_name='',
        channel_email='',
    )

    link_base_url = installation.config.get(
        'identity_link_url',
        f"{settings.FRONTEND_URL}/connect",
    )
    link_url = f"{link_base_url}?code={link_code.code}"

    webhook_url = (
        f"{DISCORD_API}/webhooks/{workflow_input.application_id}"
        f"/{workflow_input.interaction_token}"
    )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json={
                "content": (
                    f"Click to link your account: [{link_url}]({link_url})\n\n"
                    f"This link expires in 10 minutes."
                ),
                "flags": 64,
            })
            if resp.status_code >= 400:
                logger.error(
                    "[DISCORD] Webhook follow-up failed: %s %s",
                    resp.status_code, resp.text,
                )
                return {'error': f'Discord returned {resp.status_code}'}
    except Exception:
        logger.exception("[DISCORD] Failed to send account link message")
        return {'error': 'Failed to send link'}

    return {'status': 'link_sent', 'code': link_code.code}
