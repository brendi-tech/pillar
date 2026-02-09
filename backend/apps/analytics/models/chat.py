"""
Chat models - tracks widget AI chat conversations and messages.

Used for:
- Persisting chat history for analytics
- Answer feedback collection (thumbs up/down)
- RAG retrieval analytics
- AI usage metrics
- Query clustering and intent classification
"""
import uuid_utils
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from common.models.base import TenantAwareModel


class ChatConversation(TenantAwareModel):
    """
    Groups chat messages into a conversation.

    A conversation is started when a user sends their first message
    and continues until they close the widget or start a new chat.
    
    Enhanced with features from AIQueryLog for comprehensive analytics.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid_utils.uuid7,
        editable=False,
        help_text="Unique conversation ID"
    )

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='analytics_chat_conversations',
        help_text="Organization this conversation belongs to"
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='conversations',
        null=True,
        blank=True,
        help_text="Product this conversation belongs to"
    )

    session = models.ForeignKey(
        'analytics.WidgetSession',
        on_delete=models.CASCADE,
        related_name='conversations',
        null=True,
        blank=True,
        help_text="Widget session this conversation belongs to"
    )

    visitor = models.ForeignKey(
        'analytics.Visitor',
        on_delete=models.SET_NULL,
        related_name='conversations',
        null=True,
        blank=True,
        help_text="Visitor who initiated this conversation (enables cross-device history)"
    )

    # Conversation state
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        RESOLVED = 'resolved', 'Resolved'
        ESCALATED = 'escalated', 'Escalated'
        ABANDONED = 'abandoned', 'Abandoned'

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        help_text="Current status of the conversation"
    )

    # Title (auto-generated from first question)
    title = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Conversation title, auto-generated from first query"
    )

    # Timestamps
    started_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the conversation started"
    )
    last_message_at = models.DateTimeField(
        auto_now=True,
        help_text="When the last message was sent"
    )

    # Context snapshot at conversation start
    page_url = models.URLField(
        max_length=2000,
        blank=True,
        default='',
        help_text="Page URL where conversation was started"
    )
    product_context = models.JSONField(
        default=dict,
        blank=True,
        help_text="SDK ProductContext snapshot at conversation start"
    )

    # Escalation tracking
    escalation_reason = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Reason for escalation if escalated"
    )
    escalated_to = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Destination of escalation (intercom, zendesk, etc.)"
    )

    # Client identification (from AIQueryLog)
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Client user agent string"
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text="Client IP address"
    )
    referer = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="Referer URL where user came from"
    )
    external_session_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        db_index=True,
        help_text="External session identifier string (from widget)"
    )

    # Analytics control
    logging_enabled = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this conversation appears in analytics (False for testing)"
    )

    # Full-text search (from AIQueryLog)
    search_vector = SearchVectorField(
        null=True,
        blank=True,
        help_text="Full-text search vector for conversation content"
    )

    # Extensible metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata for extensibility"
    )

    class Meta:
        # NO db_table - Django creates 'analytics_chatconversation'
        verbose_name = 'Chat Conversation'
        verbose_name_plural = 'Chat Conversations'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['organization', '-started_at']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['product', '-started_at']),
            models.Index(fields=['product', 'status']),
            models.Index(fields=['session', '-started_at']),
            models.Index(fields=['visitor', '-started_at']),
            models.Index(fields=['external_session_id']),
            models.Index(fields=['logging_enabled', '-started_at']),
            GinIndex(fields=['search_vector']),
        ]

    def __str__(self):
        if self.title:
            return f"{self.title[:50]} ({self.status})"
        return f"Conversation {self.id} ({self.status})"


class ChatMessage(TenantAwareModel):
    """
    Individual message in a chat conversation.

    Stores both user questions and assistant responses,
    along with RAG metadata and user feedback.
    
    Enhanced with features from AIQueryLog for comprehensive analytics.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid_utils.uuid7,
        editable=False,
        help_text="Unique message ID"
    )

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='analytics_chat_messages',
        help_text="Organization this message belongs to"
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='chat_messages',
        null=True,
        blank=True,
        help_text="Product this message belongs to (denormalized from conversation)"
    )

    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='messages',
        help_text="Conversation this message belongs to"
    )

    # Message content
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        TOOL = 'tool', 'Tool Result'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        db_index=True,
        help_text="Who sent this message"
    )
    content = models.TextField(
        help_text="Message content (final text for display)",
        blank=True,
        default='',
    )
    
    # === LLM Replay Field ===
    # Complete message in OpenRouter format for conversation replay
    llm_message = models.JSONField(
        default=dict,
        blank=True,
        help_text="Complete LLM message for conversation replay (OpenRouter format: {type, role, id, status, content: [...]})"
    )
    
    # === Display Field ===
    # Human-readable timeline for UI (renamed from reasoning_trace)
    display_trace = models.JSONField(
        default=list,
        blank=True,
        help_text="Human-readable timeline for UI: [{step_type: thinking|tool_decision|tool_result, content, timestamp_ms, ...}]"
    )
    
    # Images attached to this message
    images = models.JSONField(
        default=list,
        blank=True,
        help_text="List of images attached to this message: [{url, detail}]"
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the message was sent"
    )

    # Query type (from AIQueryLog) - for user messages
    class QueryType(models.TextChoices):
        ASK = 'ask', 'Ask (Conversational)'
        SEARCH = 'search', 'Search (Keyword/Semantic)'

    query_type = models.CharField(
        max_length=20,
        choices=QueryType.choices,
        default=QueryType.ASK,
        db_index=True,
        help_text="Type of query: ask (conversational) or search"
    )

    # Query hash for deduplication/clustering (from AIQueryLog)
    query_hash = models.CharField(
        max_length=32,
        blank=True,
        default='',
        db_index=True,
        help_text="MD5 hash of query for deduplication/clustering"
    )

    # Intent classification (from AIQueryLog)
    intent_category = models.CharField(
        max_length=100,
        blank=True,
        default='',
        db_index=True,
        help_text="Classified intent (product, support, documentation, etc.)"
    )
    intent_confidence = models.FloatField(
        blank=True,
        null=True,
        help_text="Confidence score for intent classification (0-1)"
    )

    # RAG metadata (for assistant messages)
    chunks_retrieved = models.JSONField(
        default=list,
        blank=True,
        help_text="List of chunks retrieved for this response: [{chunk_id, score, source_article_id}]"
    )
    model_used = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="LLM model used to generate response (e.g., gpt-4o, claude-3-5-sonnet)"
    )
    latency_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Response generation latency in milliseconds"
    )

    # Streaming metadata (from AIQueryLog)
    was_stopped = models.BooleanField(
        default=False,
        help_text="Whether user stopped streaming early"
    )
    tokens_generated = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Tokens generated before stop (if stopped early)"
    )

    # Session resumption fields
    class StreamingStatus(models.TextChoices):
        STREAMING = 'streaming', 'Still streaming'
        COMPLETED = 'completed', 'Completed'
        INTERRUPTED = 'interrupted', 'Interrupted mid-stream'

    streaming_status = models.CharField(
        max_length=20,
        choices=StreamingStatus.choices,
        default=StreamingStatus.STREAMING,
        db_index=True,
        help_text="Streaming state for session resumption"
    )
    agent_state_snapshot = models.JSONField(
        null=True,
        blank=True,
        help_text="AgentContext snapshot for resumption if interrupted"
    )
    streaming_started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When streaming started (for elapsed time calculation)"
    )

    # Token usage tracking (from agentic loop)
    prompt_tokens = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Total input tokens across all LLM calls in the agentic loop"
    )
    completion_tokens = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Total output tokens across all LLM calls in the agentic loop"
    )
    total_tokens = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="prompt_tokens + completion_tokens"
    )
    peak_context_occupancy = models.FloatField(
        null=True,
        blank=True,
        help_text="Peak context window usage percentage during the agentic loop"
    )

    # User feedback (for assistant messages)
    class Feedback(models.TextChoices):
        NONE = 'none', 'No Feedback'
        UP = 'up', 'Helpful'
        DOWN = 'down', 'Not Helpful'

    feedback = models.CharField(
        max_length=10,
        choices=Feedback.choices,
        default=Feedback.NONE,
        db_index=True,
        help_text="User feedback on this response"
    )
    feedback_comment = models.TextField(
        blank=True,
        default='',
        help_text="Optional comment with feedback"
    )
    feedback_timestamp = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When user provided feedback"
    )

    class Meta:
        # NO db_table - Django creates 'analytics_chatmessage'
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['conversation', 'timestamp']),
            models.Index(fields=['organization', '-timestamp']),
            models.Index(fields=['product', '-timestamp']),
            models.Index(fields=['role', '-timestamp']),
            models.Index(fields=['feedback', '-timestamp']),
            models.Index(fields=['query_type', '-timestamp']),
            models.Index(fields=['query_hash']),
            models.Index(fields=['intent_category', '-timestamp']),
            models.Index(fields=['conversation', 'streaming_status']),
        ]

    def __str__(self):
        preview = self.content[:50] + '...' if len(self.content) > 50 else self.content
        return f"{self.role}: {preview}"

    def save(self, *args, **kwargs):
        """Override save to generate query hash for user messages."""
        if self.role == self.Role.USER and not self.query_hash and self.content:
            import hashlib
            self.query_hash = hashlib.md5(self.content.lower().encode()).hexdigest()
        super().save(*args, **kwargs)
