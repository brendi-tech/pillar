"""
Hatchet task: slack-tool-oauth

Handles /connect command: lists OAuth-requiring OpenAPI sources and
sends authorization links to the Slack user via response_url.
"""
import json
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class SlackToolOAuthInput(BaseModel):
    team_id: str
    app_id: str = ''
    user_id: str
    response_url: str
    source_query: str = ''
    source_id: str = ''


@hatchet.task(
    name="slack-tool-oauth",
    retries=1,
    execution_timeout=timedelta(minutes=2),
    input_validator=SlackToolOAuthInput,
)
async def handle_tool_oauth(workflow_input: SlackToolOAuthInput, context: Context):
    from apps.integrations.slack.models import SlackInstallation
    from apps.tools.models import OpenAPIToolSource, UserToolCredential

    lookup: dict = {'team_id': workflow_input.team_id, 'is_active': True}
    if workflow_input.app_id:
        lookup['app_id'] = workflow_input.app_id

    try:
        installation = await (
            SlackInstallation.objects
            .select_related('product', 'agent')
            .aget(**lookup)
        )
    except SlackInstallation.DoesNotExist:
        logger.error("[SLACK] No active installation for team %s", workflow_input.team_id)
        return {'error': 'No active installation'}

    agent = installation.agent
    if not agent:
        await _send_ephemeral(
            workflow_input.response_url,
            "No agent is configured for this workspace.",
        )
        return {'error': 'no_agent'}

    agent_source_ids = await sync_to_async(
        lambda: list(agent.openapi_sources.values_list('id', flat=True))
    )()

    oauth_sources = await sync_to_async(list)(
        OpenAPIToolSource.objects.filter(
            id__in=agent_source_ids,
            auth_type=OpenAPIToolSource.AuthType.OAUTH2_AUTHORIZATION_CODE,
            is_active=True,
        )
    )

    if not oauth_sources:
        await _send_ephemeral(
            workflow_input.response_url,
            "There are no tools that require account connection.",
        )
        return {'status': 'no_oauth_sources'}

    existing_creds = await sync_to_async(list)(
        UserToolCredential.objects.filter(
            openapi_source__in=[s.id for s in oauth_sources],
            channel='slack',
            channel_user_id=workflow_input.user_id,
            is_active=True,
        ).values_list('openapi_source_id', flat=True)
    )
    connected_source_ids = set(existing_creds)

    if workflow_input.source_id:
        source = next((s for s in oauth_sources if str(s.id) == workflow_input.source_id), None)
        if not source:
            await _send_ephemeral(
                workflow_input.response_url,
                "That tool was not found or doesn't require connection.",
            )
            return {'error': 'source_not_found'}
        return await _send_oauth_link(
            source, installation.product, workflow_input, connected_source_ids,
        )

    if workflow_input.source_query:
        query = workflow_input.source_query.lower()
        matches = [
            s for s in oauth_sources
            if query in s.name.lower() or query in (s.slug or '').lower()
        ]
        if len(matches) == 1:
            return await _send_oauth_link(
                matches[0], installation.product, workflow_input, connected_source_ids,
            )
        if not matches:
            matches = oauth_sources

        return await _send_source_picker(
            workflow_input.response_url, matches, connected_source_ids,
        )

    if len(oauth_sources) == 1:
        return await _send_oauth_link(
            oauth_sources[0], installation.product, workflow_input, connected_source_ids,
        )

    return await _send_source_picker(
        workflow_input.response_url, oauth_sources, connected_source_ids,
    )


async def _send_oauth_link(
    source,
    product,
    workflow_input: SlackToolOAuthInput,
    connected_source_ids: set,
) -> dict:
    from apps.mcp.services.agent.tool_handlers import _generate_oauth_link

    environments = source.oauth_environments or []
    reconnecting = source.id in connected_source_ids
    if environments:
        links = []
        for env in environments:
            link = await _generate_oauth_link(
                source=source,
                channel='slack',
                channel_user_id=workflow_input.user_id,
                product=product,
                oauth_environment=env["name"].lower(),
            )
            links.append(f"• <{link}|Connect {env['name']}>")
        text = f"*Connect your {source.name} account:*\n" + "\n".join(links)
    else:
        link = await _generate_oauth_link(
            source=source,
            channel='slack',
            channel_user_id=workflow_input.user_id,
            product=product,
        )
        prefix = "Reconnect" if reconnecting else "Connect"
        text = f"<{link}|{prefix} your {source.name} account>\n\nThis link expires in 10 minutes."

    await _send_ephemeral(workflow_input.response_url, text)
    return {'status': 'link_sent', 'source': source.name}


async def _send_source_picker(
    response_url: str,
    sources: list,
    connected_source_ids: set,
) -> dict:
    blocks: list[dict] = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Connect an account:*\nChoose a tool to connect your account.",
            },
        },
    ]

    for source in sources:
        is_connected = source.id in connected_source_ids
        status = " _(connected)_" if is_connected else ""
        btn_text = "Reconnect" if is_connected else "Connect"

        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*{source.name}*{status}"},
            "accessory": {
                "type": "button",
                "text": {"type": "plain_text", "text": btn_text, "emoji": True},
                "action_id": f"connect_tool:{source.id}",
                "value": json.dumps({"source_id": str(source.id)}),
            },
        })

    from slack_sdk.webhook import WebhookClient
    webhook = WebhookClient(response_url)
    await sync_to_async(webhook.send)(
        blocks=blocks,
        text="Connect an account",
        response_type="ephemeral",
    )
    return {'status': 'picker_sent', 'source_count': len(sources)}


async def _send_ephemeral(response_url: str, text: str) -> None:
    from slack_sdk.webhook import WebhookClient
    webhook = WebhookClient(response_url)
    await sync_to_async(webhook.send)(text=text, response_type="ephemeral")
