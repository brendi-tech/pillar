"""
EmailChannelConnector — normalizes inbound emails into AgentMessage.

Parses email data from the webhook payload, resolves threading via
Message-ID / In-Reply-To / References headers, and produces a
channel-agnostic AgentMessage.
"""
import logging

from apps.identity.services import resolve_identity
from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage

from .models import EmailChannelConfiguration, EmailMessageMapping

logger = logging.getLogger(__name__)


class EmailChannelConnector:
    """
    Converts inbound email webhook data into an AgentMessage.

    Responsibilities:
    - Parse From, Subject, TextBody, Message-ID, In-Reply-To, References
    - Resolve email threading → ChatConversation
    - Resolve sender identity via email address
    """

    def __init__(self, config: EmailChannelConfiguration) -> None:
        self.config = config

    async def build_agent_message(
        self,
        sender_email: str,
        sender_name: str,
        subject: str,
        text_body: str,
        message_id: str,
        in_reply_to: str = '',
        references: str = '',
    ) -> AgentMessage:
        caller = await self._resolve_caller(sender_email, sender_name)

        conversation = await self._resolve_conversation(
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
            sender_email=sender_email,
            subject=subject,
        )

        return AgentMessage(
            text=text_body,
            channel=Channel.EMAIL,
            conversation_id=str(conversation.id),
            product_id=str(self.config.product_id),
            organization_id=str(self.config.organization_id),
            caller=caller,
            channel_context={
                "message_id": message_id,
                "subject": subject,
                "sender_email": sender_email,
                "in_reply_to": in_reply_to,
            },
        )

    async def _resolve_caller(self, sender_email: str, sender_name: str):
        """Email identity is simple: the sender email is always available."""
        return await resolve_identity(
            product=self.config.product,
            channel=Channel.EMAIL,
            channel_user_id=sender_email,
            email=sender_email,
            display_name=sender_name,
            auto_link_by_email=True,
        )

    async def _resolve_conversation(
        self,
        message_id: str,
        in_reply_to: str,
        references: str,
        sender_email: str,
        subject: str,
    ):
        """
        Resolve email threading to a ChatConversation.

        1. Check In-Reply-To header for a known Message-ID
        2. Fall back to References header
        3. If no match, create a new conversation
        """
        from apps.analytics.models import ChatConversation

        # Try In-Reply-To first
        if in_reply_to:
            mapping = await self._find_mapping(in_reply_to)
            if mapping:
                await self._store_mapping(message_id, mapping.conversation, sender_email, subject, 'inbound')
                return mapping.conversation

        # Try References (space-separated list, check newest first)
        if references:
            ref_ids = references.strip().split()
            for ref_id in reversed(ref_ids):
                mapping = await self._find_mapping(ref_id.strip())
                if mapping:
                    await self._store_mapping(message_id, mapping.conversation, sender_email, subject, 'inbound')
                    return mapping.conversation

        # No threading match — new conversation
        conversation = await ChatConversation.objects.acreate(
            organization=self.config.organization,
            product=self.config.product,
            channel=Channel.EMAIL,
            title=subject[:255] if subject else "Email conversation",
        )
        await self._store_mapping(message_id, conversation, sender_email, subject, 'inbound')
        return conversation

    async def _find_mapping(self, message_id: str):
        try:
            return await EmailMessageMapping.objects.select_related(
                'conversation'
            ).aget(message_id=message_id)
        except EmailMessageMapping.DoesNotExist:
            return None

    async def _store_mapping(
        self,
        message_id: str,
        conversation,
        sender_email: str,
        subject: str,
        direction: str,
    ) -> None:
        if not message_id:
            return
        try:
            await EmailMessageMapping.objects.acreate(
                config=self.config,
                message_id=message_id,
                conversation=conversation,
                sender_email=sender_email,
                subject=subject[:500],
                direction=direction,
            )
        except Exception:
            logger.debug("[EMAIL] Message-ID already stored: %s", message_id[:40])
