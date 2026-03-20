"""
DiscordChannelConnector — normalizes Discord events into AgentMessage.

Takes raw event data (author ID, content, channel/thread IDs) and produces
a channel-agnostic AgentMessage that the agentic loop can process.
"""
import logging
import re

from apps.identity.services import resolve_identity
from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage

from .models import DiscordConversationMapping, DiscordInstallation

logger = logging.getLogger(__name__)


class DiscordChannelConnector:
    """
    Converts Discord event data into a channel-agnostic AgentMessage.

    Responsibilities:
    - Strip bot mention from message content
    - Resolve Discord user → CallerContext
    - Map channel/thread → ChatConversation
    - Attach Discord-specific metadata in channel_context
    """

    def __init__(self, installation: DiscordInstallation) -> None:
        self.installation = installation

    async def build_agent_message(
        self,
        content: str,
        author_id: str,
        author_username: str,
        channel_id: str,
        message_id: str,
        thread_id: str = '',
    ) -> AgentMessage:
        clean_text = self._strip_bot_mention(content)

        caller = await self._resolve_caller(
            author_id=author_id,
            author_username=author_username,
        )

        conversation = await self._get_or_create_conversation(
            channel_id=channel_id,
            thread_id=thread_id,
        )

        from apps.mcp.services.session_resumption import load_conversation_history

        history = await load_conversation_history(str(conversation.id))

        return AgentMessage(
            text=clean_text,
            channel=Channel.DISCORD,
            conversation_id=str(conversation.id),
            product_id=str(self.installation.product_id),
            organization_id=str(self.installation.organization_id),
            caller=caller,
            conversation_history=history["messages"],
            registered_tools=history["registered_tools"],
            channel_context={
                "guild_id": self.installation.guild_id,
                "channel_id": channel_id,
                "thread_id": thread_id,
                "message_id": message_id,
            },
        )

    def _strip_bot_mention(self, content: str) -> str:
        """Remove <@BOT_USER_ID> from message content."""
        if not self.installation.bot_user_id:
            return content
        pattern = rf'<@!?{re.escape(self.installation.bot_user_id)}>'
        cleaned = re.sub(pattern, '', content).strip()
        return cleaned or content

    async def _resolve_caller(self, author_id: str, author_username: str):
        """
        Resolve Discord user identity.
        Discord gateway events don't include email, so identity linking
        relies on /pillar connect or manual mapping.
        """
        return await resolve_identity(
            product=self.installation.product,
            channel=Channel.DISCORD,
            channel_user_id=author_id,
            display_name=author_username,
            auto_link_by_email=False,
        )

    async def _get_or_create_conversation(
        self,
        channel_id: str,
        thread_id: str,
    ):
        """Map Discord channel/thread → ChatConversation, creating if needed."""
        from apps.analytics.models import ChatConversation

        try:
            mapping = await DiscordConversationMapping.objects.select_related(
                'conversation'
            ).aget(
                installation=self.installation,
                channel_id=channel_id,
                thread_id=thread_id,
            )
            return mapping.conversation
        except DiscordConversationMapping.DoesNotExist:
            conversation = await ChatConversation.objects.acreate(
                organization=self.installation.organization,
                product=self.installation.product,
                channel=Channel.DISCORD,
            )
            await DiscordConversationMapping.objects.acreate(
                installation=self.installation,
                guild_id=self.installation.guild_id,
                channel_id=channel_id,
                thread_id=thread_id,
                conversation=conversation,
            )
            return conversation
