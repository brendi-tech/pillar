"""
Hatchet task: slack-account-link

Generates a one-time linking code and sends it to the user via
Slack's response_url (ephemeral message).
"""
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.conf import settings
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class SlackAccountLinkInput(BaseModel):
    team_id: str
    user_id: str
    response_url: str


@hatchet.task(
    name="slack-account-link",
    retries=1,
    execution_timeout=timedelta(minutes=2),
    input_validator=SlackAccountLinkInput,
)
async def handle_account_link(workflow_input: SlackAccountLinkInput, context: Context):
    from apps.identity.services import generate_link_code
    from apps.integrations.slack.connector import SlackChannelConnector
    from apps.integrations.slack.models import SlackInstallation

    try:
        installation = await SlackInstallation.objects.select_related('product').aget(
            team_id=workflow_input.team_id,
            is_active=True,
        )
    except SlackInstallation.DoesNotExist:
        logger.error(
            "[SLACK] No active installation for team %s", workflow_input.team_id,
        )
        return {'error': 'No active installation'}

    # Resolve display name / email for the linking code
    connector = SlackChannelConnector(installation)
    caller = await connector._resolve_caller(workflow_input.user_id)

    link_code = await generate_link_code(
        product=installation.product,
        channel='slack',
        channel_user_id=workflow_input.user_id,
        channel_display_name=caller.display_name or '',
        channel_email=caller.email or '',
    )

    link_base_url = installation.config.get(
        'identity_link_url',
        f"{settings.FRONTEND_URL}/connect",
    )
    link_url = f"{link_base_url}?code={link_code.code}"

    from slack_sdk.webhook import WebhookClient
    webhook = WebhookClient(workflow_input.response_url)
    await sync_to_async(webhook.send)(
        text=(
            f"Click to link your account: <{link_url}|Connect Account>\n\n"
            f"This link expires in 5 minutes."
        ),
        response_type="ephemeral",
    )

    return {'status': 'link_sent', 'code': link_code.code}
