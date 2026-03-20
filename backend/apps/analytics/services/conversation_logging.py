"""
Conversation logging service for persisting chat interactions.

Ported from the old backend's `_log_to_analytics()` method in
`answer_service_react_async.py`, adapted for the HC backend's
ChatConversation/ChatMessage models.
"""
import hashlib
import logging
from typing import Optional
from django.utils import timezone
from asgiref.sync import sync_to_async

from apps.analytics.models import ChatConversation, ChatMessage, Visitor
from .visitor_service import get_visitor_service

logger = logging.getLogger(__name__)


class ConversationLoggingService:
    """
    Service for logging chat conversations and messages.
    
    Creates ChatConversation and ChatMessage records for analytics,
    capturing all relevant metadata for query analysis.
    """

    async def log_message(
        self,
        organization_id: str,
        question: str,
        response: str,
        response_time_ms: int,
        chunks_retrieved: list[dict],
        model_used: str,
        *,
        conversation_id: Optional[str] = None,
        query_type: str = 'ask',
        help_center_id: Optional[str] = None,
        page_url: str = '',
        user_agent: str = '',
        ip_address: Optional[str] = None,
        referer: str = '',
        external_session_id: str = '',
        display_trace: Optional[list] = None,
        skip_analytics: bool = False,
        intent_category: str = '',
        intent_confidence: Optional[float] = None,
        was_stopped: bool = False,
        tokens_generated: Optional[int] = None,
        product_context: Optional[dict] = None,
        images: Optional[list[dict]] = None,
        visitor_id: str = '',
        external_user_id: str = '',
        channel: str = 'web',
    ) -> tuple[str, str, str]:
        """
        Log a Q&A exchange to the database.
        
        Creates or retrieves a conversation, then creates user and assistant
        message records with all relevant metadata.
        
        Returns:
            Tuple of (conversation_id, user_message_id, assistant_message_id)
        """
        try:
            # Resolve visitor for conversation linking
            visitor = None
            if visitor_id:
                visitor = await self._resolve_visitor(
                    organization_id=organization_id,
                    visitor_id=visitor_id,
                    external_user_id=external_user_id or None,
                )
            
            # Get or create conversation
            conversation = await self._get_or_create_conversation(
                organization_id=organization_id,
                conversation_id=conversation_id,
                title=question[:200] if question else 'Untitled',
                page_url=page_url,
                user_agent=user_agent,
                ip_address=ip_address,
                referer=referer,
                external_session_id=external_session_id,
                skip_analytics=skip_analytics,
                product_context=product_context or {},
                product_id=help_center_id,
                visitor=visitor,
                channel=channel,
            )
            
            # Generate query hash for clustering
            query_hash = hashlib.md5(question.lower().encode()).hexdigest() if question else ''
            
            # Create user message
            user_message = await ChatMessage.objects.acreate(
                organization_id=organization_id,
                product_id=help_center_id,
                conversation=conversation,
                role=ChatMessage.Role.USER,
                content=question,
                images=images or [],
                query_type=query_type,
                query_hash=query_hash,
                intent_category=intent_category,
                intent_confidence=intent_confidence,
            )
            
            # Create assistant message
            assistant_message = await ChatMessage.objects.acreate(
                organization_id=organization_id,
                product_id=help_center_id,
                conversation=conversation,
                role=ChatMessage.Role.ASSISTANT,
                content=response,
                chunks_retrieved=chunks_retrieved,
                model_used=model_used,
                latency_ms=response_time_ms,
                display_trace=display_trace or [],
                was_stopped=was_stopped,
                tokens_generated=tokens_generated,
            )
            
            logger.debug(
                f"[ConversationLogging] Logged message pair: "
                f"conv={conversation.id}, user={user_message.id}, assistant={assistant_message.id}"
            )
            
            # Fire post-message pipeline (non-blocking)
            from apps.analytics.services.post_message_pipeline import (
                PostMessagePipeline, PostMessageContext
            )
            await PostMessagePipeline.execute(PostMessageContext(
                conversation_id=str(conversation.id),
                message_id=str(assistant_message.id),
                organization_id=str(organization_id),
                is_assistant_message=True,
                logging_enabled=conversation.logging_enabled,
            ))
            
            return str(conversation.id), str(user_message.id), str(assistant_message.id)
            
        except Exception as e:
            logger.error(f"[ConversationLogging] Failed to log message: {e}", exc_info=True)
            raise

    async def _resolve_visitor(
        self,
        organization_id: str,
        visitor_id: str,
        external_user_id: Optional[str] = None,
    ) -> Optional[Visitor]:
        """
        Resolve or create a visitor for conversation linking.
        
        Uses the VisitorService to handle visitor resolution, including
        the upgrade from anonymous to authenticated visitors.
        
        Args:
            organization_id: Organization UUID
            visitor_id: Persistent browser ID from SDK localStorage
            external_user_id: Client's authenticated user ID (optional)
            
        Returns:
            Visitor instance or None if visitor_id is empty
        """
        if not visitor_id:
            return None
            
        try:
            visitor = await get_visitor_service().get_or_create_visitor(
                organization_id=organization_id,
                visitor_id=visitor_id,
                external_user_id=external_user_id,
            )
            return visitor
        except Exception as e:
            logger.warning(f"[ConversationLogging] Failed to resolve visitor: {e}")
            return None

    async def _get_or_create_conversation(
        self,
        organization_id: str,
        conversation_id: Optional[str],
        title: str,
        page_url: str = '',
        user_agent: str = '',
        ip_address: Optional[str] = None,
        referer: str = '',
        external_session_id: str = '',
        skip_analytics: bool = False,
        product_context: Optional[dict] = None,
        product_id: Optional[str] = None,
        visitor: Optional[Visitor] = None,
        channel: str = 'web',
    ) -> ChatConversation:
        """
        Get existing conversation or create with provided ID.
        
        Uses aget_or_create to handle race conditions where a follow-up
        message arrives before the first message's DB write completes.
        
        Args:
            organization_id: Organization UUID
            conversation_id: Pre-generated conversation UUID (optional)
            title: Conversation title (usually first question)
            page_url: Page URL where conversation started
            user_agent: Client user agent string
            ip_address: Client IP address
            referer: Referer URL
            external_session_id: Widget session ID string
            skip_analytics: If True, marks logging_enabled=False
            product_context: SDK ProductContext snapshot
            product_id: Product UUID
            visitor: Visitor instance to link to conversation
        """
        if conversation_id:
            # Use get_or_create with the provided ID to handle race conditions
            conversation, created = await ChatConversation.objects.aget_or_create(
                id=conversation_id,
                organization_id=organization_id,
                defaults={
                    'product_id': product_id,
                    'visitor': visitor,
                    'title': title,
                    'page_url': page_url[:2000] if page_url else '',
                    'user_agent': user_agent[:500] if user_agent else '',
                    'ip_address': ip_address,
                    'referer': referer[:500] if referer else '',
                    'external_session_id': external_session_id[:100] if external_session_id else '',
                    'logging_enabled': not skip_analytics,
                    'product_context': product_context or {},
                    'channel': channel,
                }
            )
            if created:
                logger.info(f"[ConversationLogging] Created conversation {conversation_id}")
            else:
                # Update visitor if not set and we have one now
                if visitor and not conversation.visitor_id:
                    conversation.visitor = visitor
                    await conversation.asave(update_fields=['visitor'])
                logger.debug(f"[ConversationLogging] Using existing conversation {conversation_id}")
            return conversation
        
        # Create new conversation without a pre-generated ID
        conversation = await ChatConversation.objects.acreate(
            organization_id=organization_id,
            product_id=product_id,
            visitor=visitor,
            title=title,
            page_url=page_url[:2000] if page_url else '',
            user_agent=user_agent[:500] if user_agent else '',
            ip_address=ip_address,
            referer=referer[:500] if referer else '',
            external_session_id=external_session_id[:100] if external_session_id else '',
            logging_enabled=not skip_analytics,
            product_context=product_context or {},
            channel=channel,
        )
        
        logger.info(f"[ConversationLogging] Created conversation {conversation.id}")
        return conversation

    async def create_conversation_and_user_message(
        self,
        conversation_id: str,
        user_message_id: str,
        assistant_message_id: str,
        organization_id: str,
        product_id: str,
        question: str,
        *,
        images: Optional[list[dict]] = None,
        query_type: str = 'ask',
        page_url: str = '',
        user_agent: str = '',
        ip_address: Optional[str] = None,
        referer: str = '',
        external_session_id: str = '',
        skip_analytics: bool = False,
        product_context: Optional[dict] = None,
        visitor_id: str = '',
        external_user_id: str = '',
        channel: str = 'web',
    ) -> None:
        """
        Create conversation + user message + empty assistant message with pre-generated IDs.
        
        Called as a background task - IDs are already yielded to client.
        This method is designed for the parallel write + stream pattern.
        
        The assistant message is created early with streaming_status='streaming' and
        empty content. It will be progressively flushed with content as tokens stream,
        then finalized with metadata when streaming completes.
        
        Args:
            conversation_id: Pre-generated conversation UUID (from client SDK)
            user_message_id: Pre-generated user message UUID
            assistant_message_id: Pre-generated assistant message UUID
            organization_id: Organization UUID
            product_id: Product UUID
            question: User's question text
            images: List of images attached to user message [{url, detail}]
            query_type: 'ask' or 'search'
            page_url: Page URL where query was submitted
            user_agent: Client user agent string
            ip_address: Client IP address
            referer: Referer URL
            external_session_id: Widget session ID string
            skip_analytics: If True, marks logging_enabled=False
            product_context: SDK ProductContext snapshot
            visitor_id: Persistent browser ID from SDK localStorage
            external_user_id: Client's authenticated user ID (for cross-device history)
        """
        try:
            # Resolve visitor for conversation linking
            visitor = None
            if visitor_id:
                visitor = await self._resolve_visitor(
                    organization_id=organization_id,
                    visitor_id=visitor_id,
                    external_user_id=external_user_id or None,
                )
            
            # Get or create conversation with pre-generated ID
            conversation = await self._get_or_create_conversation(
                organization_id=organization_id,
                conversation_id=conversation_id,
                title=question[:200] if question else 'Untitled',
                page_url=page_url,
                user_agent=user_agent,
                ip_address=ip_address,
                referer=referer,
                external_session_id=external_session_id,
                skip_analytics=skip_analytics,
                product_context=product_context or {},
                product_id=product_id,
                visitor=visitor,
                channel=channel,
            )
            
            # Generate query hash for clustering
            query_hash = hashlib.md5(question.lower().encode()).hexdigest() if question else ''
            
            # Create user message with pre-generated ID (already completed)
            await ChatMessage.objects.acreate(
                id=user_message_id,
                organization_id=organization_id,
                product_id=product_id,
                conversation=conversation,
                role=ChatMessage.Role.USER,
                content=question,
                images=images or [],
                query_type=query_type,
                query_hash=query_hash,
                streaming_status=ChatMessage.StreamingStatus.COMPLETED,
            )
            
            # Create empty assistant message (will be flushed progressively)
            await ChatMessage.objects.acreate(
                id=assistant_message_id,
                organization_id=organization_id,
                product_id=product_id,
                conversation=conversation,
                role=ChatMessage.Role.ASSISTANT,
                content='',
                streaming_status=ChatMessage.StreamingStatus.STREAMING,
            )
            
            logger.debug(
                f"[ConversationLogging] Created conversation + user + assistant messages: "
                f"conv={conversation_id}, user_msg={user_message_id}, "
                f"assistant_msg={assistant_message_id}"
            )
            
        except Exception as e:
            logger.error(f"[ConversationLogging] Failed to create conversation/messages: {e}", exc_info=True)
            raise

    async def update_feedback(
        self,
        message_id: str,
        feedback: str,
        comment: str = '',
    ) -> bool:
        """
        Update feedback on an assistant message.
        
        Args:
            message_id: ChatMessage UUID
            feedback: 'up', 'down', or 'none'
            comment: Optional feedback comment
        
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            message = await ChatMessage.objects.aget(id=message_id)
            message.feedback = feedback
            message.feedback_comment = comment
            message.feedback_timestamp = timezone.now()
            await message.asave(update_fields=['feedback', 'feedback_comment', 'feedback_timestamp'])
            
            logger.debug(f"[ConversationLogging] Updated feedback on message {message_id}: {feedback}")
            return True
            
        except ChatMessage.DoesNotExist:
            logger.warning(f"[ConversationLogging] Message {message_id} not found for feedback update")
            return False
        except Exception as e:
            logger.error(f"[ConversationLogging] Failed to update feedback: {e}", exc_info=True)
            return False

    async def mark_streaming_stopped(
        self,
        message_id: str,
        tokens_generated: int,
    ) -> bool:
        """
        Mark that user stopped streaming early.
        
        Args:
            message_id: ChatMessage UUID
            tokens_generated: Approximate tokens generated before stop
        
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            message = await ChatMessage.objects.aget(id=message_id)
            message.was_stopped = True
            message.tokens_generated = tokens_generated
            await message.asave(update_fields=['was_stopped', 'tokens_generated'])
            
            logger.debug(f"[ConversationLogging] Marked streaming stopped on message {message_id}")
            return True
            
        except ChatMessage.DoesNotExist:
            logger.warning(f"[ConversationLogging] Message {message_id} not found for stop update")
            return False
        except Exception as e:
            logger.error(f"[ConversationLogging] Failed to mark streaming stopped: {e}", exc_info=True)
            return False

    async def update_conversation_status(
        self,
        conversation_id: str,
        status: str,
        escalation_reason: str = '',
        escalated_to: str = '',
    ) -> bool:
        """
        Update conversation status (e.g., resolved, escalated).
        
        Args:
            conversation_id: ChatConversation UUID
            status: New status ('active', 'resolved', 'escalated', 'abandoned')
            escalation_reason: Reason for escalation (if escalated)
            escalated_to: Destination of escalation (if escalated)
        
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            conversation = await ChatConversation.objects.aget(id=conversation_id)
            old_status = conversation.status
            conversation.status = status
            
            if status == ChatConversation.Status.ESCALATED:
                conversation.escalation_reason = escalation_reason
                conversation.escalated_to = escalated_to
            
            await conversation.asave(update_fields=[
                'status', 'escalation_reason', 'escalated_to'
            ])
            
            logger.debug(f"[ConversationLogging] Updated conversation {conversation_id} status: {status}")
            
            return True
            
        except ChatConversation.DoesNotExist:
            logger.warning(f"[ConversationLogging] Conversation {conversation_id} not found")
            return False
        except Exception as e:
            logger.error(f"[ConversationLogging] Failed to update status: {e}", exc_info=True)
            return False


# Singleton instance for easy access
_service_instance: Optional[ConversationLoggingService] = None


def get_conversation_logging_service() -> ConversationLoggingService:
    """Get the singleton ConversationLoggingService instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ConversationLoggingService()
    return _service_instance
