"""
SlackChannelConnector — normalizes Slack events into AgentMessage.

This is the input side of the Slack integration: it takes raw event data
(user ID, text, thread_ts) and produces a channel-agnostic AgentMessage
that the agentic loop can process identically to a web request.
"""
import logging
import re

from asgiref.sync import sync_to_async
from django.core.cache import cache

from apps.identity.services import resolve_identity
from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage

from .models import SlackConversationMapping, SlackInstallation

logger = logging.getLogger(__name__)


class SlackChannelConnector:
    """
    Converts Slack event data into a channel-agnostic AgentMessage.

    Responsibilities:
    - Strip bot mention from message text
    - Resolve Slack user → CallerContext (email, display name)
    - Map thread_ts → ChatConversation
    - Attach Slack-specific metadata in channel_context
    """

    def __init__(self, installation: SlackInstallation):
        self.installation = installation
        self.client = installation.get_client()

    async def build_agent_message(
        self,
        text: str,
        user_id: str,
        channel_id: str,
        ts: str,
        thread_ts: str | None,
        event_type: str,
    ) -> AgentMessage:
        clean_text = self._strip_bot_mention(text)

        caller = await self._resolve_caller(user_id)

        effective_thread_ts = thread_ts or ts
        conversation = await self._get_or_create_conversation(
            channel_id=channel_id,
            thread_ts=effective_thread_ts,
        )

        from apps.mcp.services.session_resumption import load_conversation_history

        history = await load_conversation_history(str(conversation.id))

        return AgentMessage(
            text=clean_text,
            channel=Channel.SLACK,
            conversation_id=str(conversation.id),
            product_id=str(self.installation.product_id),
            organization_id=str(self.installation.organization_id),
            caller=caller,
            conversation_history=history["messages"],
            registered_tools=history["registered_tools"],
            channel_context={
                "team_id": self.installation.team_id,
                "channel_id": channel_id,
                "thread_ts": effective_thread_ts,
                "ts": ts,
                "event_type": event_type,
                "is_private": event_type == "message",
            },
        )

    def _strip_bot_mention(self, text: str) -> str:
        """Remove <@BOT_USER_ID> from the message text."""
        pattern = rf'<@{re.escape(self.installation.bot_user_id)}>'
        cleaned = re.sub(pattern, '', text).strip()
        return cleaned or text

    async def _resolve_caller(self, slack_user_id: str):
        """
        Look up Slack user profile and resolve identity.
        Caches user info in Redis for 1 hour to avoid rate limiting.
        """
        cache_key = f"slack_user:{self.installation.team_id}:{slack_user_id}"
        cached = cache.get(cache_key)

        if cached:
            email = cached.get('email')
            display_name = cached.get('display_name')
        else:
            email = None
            display_name = None
            try:
                response = await sync_to_async(self.client.users_info)(user=slack_user_id)
                user_profile = response['user']['profile']
                email = user_profile.get('email')
                display_name = (
                    user_profile.get('display_name')
                    or user_profile.get('real_name')
                    or response['user'].get('name')
                )
                cache.set(cache_key, {
                    'email': email,
                    'display_name': display_name,
                }, timeout=3600)
            except Exception:
                logger.warning(
                    "[SLACK] Failed to fetch user info for %s in %s",
                    slack_user_id, self.installation.team_id,
                    exc_info=True,
                )

        auto_link = self.installation.config.get('auto_link_by_email', False)

        return await resolve_identity(
            product=self.installation.product,
            channel=Channel.SLACK,
            channel_user_id=slack_user_id,
            email=email,
            display_name=display_name,
            auto_link_by_email=auto_link,
        )

    async def _get_or_create_conversation(
        self,
        channel_id: str,
        thread_ts: str,
    ):
        """Map Slack thread → ChatConversation, creating if needed."""
        from apps.analytics.models import ChatConversation

        try:
            mapping = await SlackConversationMapping.objects.select_related(
                'conversation'
            ).aget(
                installation=self.installation,
                channel_id=channel_id,
                thread_ts=thread_ts,
            )
            return mapping.conversation
        except SlackConversationMapping.DoesNotExist:
            conversation = await ChatConversation.objects.acreate(
                organization=self.installation.organization,
                product=self.installation.product,
                channel=Channel.SLACK,
            )
            await SlackConversationMapping.objects.acreate(
                installation=self.installation,
                channel_id=channel_id,
                thread_ts=thread_ts,
                conversation=conversation,
            )
            return conversation
