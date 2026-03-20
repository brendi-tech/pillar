"""
Serializers for the analytics app.
"""
from rest_framework import serializers
from apps.analytics.models import (
    Search, WidgetSession,
    ChatConversation, ChatMessage, Visitor
)
from apps.knowledge.models import KnowledgeItem, KnowledgeChunk, Correction


class SearchSerializer(serializers.ModelSerializer):
    """Serializer for Search model."""
    
    class Meta:
        model = Search
        fields = [
            'id', 'query', 'results_count', 'clicked_article',
            'session_id', 'searched_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WidgetSessionSerializer(serializers.ModelSerializer):
    """Serializer for WidgetSession model."""
    
    class Meta:
        model = WidgetSession
        fields = [
            'id', 'visitor_id', 'session_id', 'first_page_url', 'last_page_url',
            'user_agent', 'started_at', 'last_seen_at', 'page_count', 'chat_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage model."""
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'conversation', 'role', 'content', 'chunks_retrieved',
            'model_used', 'latency_ms', 'feedback', 'feedback_comment',
            'feedback_timestamp', 'timestamp', 'created_at', 'updated_at',
            # Enhanced fields
            'query_type', 'query_hash', 'intent_category', 'intent_confidence',
            'was_stopped', 'tokens_generated', 'display_trace', 'images',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatConversationSerializer(serializers.ModelSerializer):
    """Serializer for ChatConversation model with full message details."""
    messages = ChatMessageSerializer(many=True, read_only=True)
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'session', 'status', 'page_url', 'product_context',
            'escalation_reason', 'escalated_to', 'started_at', 'last_message_at',
            'messages', 'created_at', 'updated_at',
            # Enhanced fields
            'title', 'user_agent', 'ip_address', 'referer', 'external_session_id',
            'logging_enabled', 'metadata',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class VisitorSummarySerializer(serializers.ModelSerializer):
    """Minimal visitor info for embedding in conversation responses."""
    
    class Meta:
        model = Visitor
        fields = ['id', 'visitor_id', 'external_user_id', 'name', 'email']
        read_only_fields = fields


class ChatConversationListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing conversations.
    Includes aggregated fields for the table view.
    """
    message_count = serializers.IntegerField(read_only=True)
    first_user_message = serializers.SerializerMethodField()
    last_assistant_message = serializers.SerializerMethodField()
    has_negative_feedback = serializers.SerializerMethodField()
    visitor = VisitorSummarySerializer(read_only=True)
    channel = serializers.CharField(read_only=True)
    agent_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'status', 'page_url', 'started_at', 'last_message_at',
            'message_count', 'first_user_message', 'last_assistant_message',
            'has_negative_feedback', 'escalation_reason', 'escalated_to',
            'channel', 'agent_name',
            'created_at', 'updated_at', 'visitor'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_agent_name(self, obj) -> str | None:
        return obj.agent.name if obj.agent else None
    
    def get_first_user_message(self, obj) -> str | None:
        """Get the first user message content."""
        if hasattr(obj, '_first_user_message'):
            return obj._first_user_message
        first_msg = obj.messages.filter(role=ChatMessage.Role.USER).first()
        if first_msg:
            return first_msg.content
        return None
    
    def get_last_assistant_message(self, obj) -> str | None:
        """Get the last assistant message content."""
        if hasattr(obj, '_last_assistant_message'):
            return obj._last_assistant_message
        last_msg = obj.messages.filter(role=ChatMessage.Role.ASSISTANT).last()
        if last_msg:
            return last_msg.content
        return None
    
    def get_has_negative_feedback(self, obj) -> bool:
        """Check if any assistant message has negative feedback."""
        if hasattr(obj, '_has_negative_feedback'):
            return obj._has_negative_feedback
        return obj.messages.filter(
            role=ChatMessage.Role.ASSISTANT,
            feedback=ChatMessage.Feedback.DOWN
        ).exists()


class ChunkRetrievedSerializer(serializers.Serializer):
    """Serializer for chunk information in RAG responses."""
    chunk_id = serializers.UUIDField()
    score = serializers.FloatField()
    source_article_id = serializers.UUIDField(required=False)
    title = serializers.CharField(required=False)
    content_preview = serializers.CharField(required=False)


class MessageCorrectionSerializer(serializers.ModelSerializer):
    """Lightweight serializer for correction info embedded in messages."""
    
    knowledge_item_source_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Correction
        fields = [
            'id', 'status', 'correction_type', 'processed_title',
            'processed_content', 'user_correction_notes', 'created_at',
            'knowledge_item', 'knowledge_item_source_id',
        ]
        read_only_fields = fields
    
    def get_knowledge_item_source_id(self, obj) -> str | None:
        """Get the source ID for the knowledge item to construct the link."""
        if obj.knowledge_item and obj.knowledge_item.source_id:
            return str(obj.knowledge_item.source_id)
        return None


class ChatMessageDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for ChatMessage with resolved chunk information.
    Used in conversation detail view.
    """
    chunks_details = serializers.SerializerMethodField()
    correction = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'conversation', 'role', 'content', 'chunks_retrieved',
            'chunks_details', 'model_used', 'latency_ms', 'feedback',
            'feedback_comment', 'feedback_timestamp', 'timestamp', 
            'created_at', 'updated_at',
            # Enhanced fields for analytics
            'query_type', 'intent_category', 'was_stopped',
            'display_trace',  # ReAct agent display trace (thinking + tool steps)
            'images',  # Images attached to user messages
            'correction',  # Existing correction for this message
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_chunks_details(self, obj) -> list[dict]:
        """
        Resolve chunk IDs to actual chunk content for display.
        Returns enriched chunk information.
        """
        if not obj.chunks_retrieved:
            return []
        
        chunk_details = []
        chunk_ids = [c.get('chunk_id') for c in obj.chunks_retrieved if c.get('chunk_id')]
        
        if not chunk_ids:
            return obj.chunks_retrieved
        
        # Fetch chunks in one query
        chunks_map = {
            str(c.id): c for c in KnowledgeChunk.objects.filter(
                id__in=chunk_ids
            ).select_related('knowledge_item')
        }
        
        for chunk_info in obj.chunks_retrieved:
            chunk_id = chunk_info.get('chunk_id')
            chunk = chunks_map.get(str(chunk_id)) if chunk_id else None
            
            detail = {
                'chunk_id': chunk_id,
                'score': chunk_info.get('score', 0),
            }
            
            if chunk:
                detail['title'] = chunk.title
                detail['content'] = chunk.content
                detail['source_article_id'] = str(chunk.knowledge_item_id)
                detail['source_title'] = chunk.knowledge_item.title if chunk.knowledge_item else None
            
            chunk_details.append(detail)
        
        return chunk_details
    
    def get_correction(self, obj) -> dict | None:
        """
        Get the most recent correction for this message, if any.
        Uses prefetched data if available.
        """
        # Check for prefetched corrections (from viewset Prefetch with to_attr)
        if hasattr(obj, '_corrections_list'):
            corrections = obj._corrections_list
            if corrections:
                return MessageCorrectionSerializer(corrections[0]).data
            return None
        
        # Fallback to query if not prefetched
        correction = Correction.objects.filter(source_message=obj).order_by('-created_at').first()
        if correction:
            return MessageCorrectionSerializer(correction).data
        return None


class ChatConversationDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for conversation detail view.
    Includes detailed message information with resolved chunks.
    """
    messages = ChatMessageDetailSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()
    has_negative_feedback = serializers.SerializerMethodField()
    visitor = VisitorSummarySerializer(read_only=True)
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'session', 'status', 'page_url', 'product_context',
            'escalation_reason', 'escalated_to', 'started_at', 'last_message_at',
            'messages', 'message_count', 'has_negative_feedback',
            'created_at', 'updated_at', 'visitor'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_message_count(self, obj) -> int:
        return obj.messages.count()
    
    def get_has_negative_feedback(self, obj) -> bool:
        return obj.messages.filter(
            role=ChatMessage.Role.ASSISTANT,
            feedback=ChatMessage.Feedback.DOWN
        ).exists()


class VisitorConversationSerializer(serializers.ModelSerializer):
    """Lightweight serializer for visitor's recent conversations."""
    message_count = serializers.SerializerMethodField()
    first_user_message = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'title', 'status', 'started_at', 'last_message_at',
            'message_count', 'first_user_message'
        ]
    
    def get_message_count(self, obj) -> int:
        if hasattr(obj, '_message_count'):
            return obj._message_count
        return obj.messages.count()
    
    def get_first_user_message(self, obj) -> str | None:
        first_msg = obj.messages.filter(role=ChatMessage.Role.USER).first()
        return first_msg.content if first_msg else None


class VisitorSerializer(serializers.ModelSerializer):
    """Serializer for Visitor model (SDK identified users)."""
    conversation_count = serializers.IntegerField(read_only=True)
    recent_conversations = serializers.SerializerMethodField()
    
    class Meta:
        model = Visitor
        fields = [
            'id', 'visitor_id', 'external_user_id',
            'name', 'email', 'metadata',
            'first_seen_at', 'last_seen_at',
            'conversation_count', 'recent_conversations'
        ]
        read_only_fields = ['id', 'first_seen_at', 'last_seen_at']
    
    def get_recent_conversations(self, obj) -> list[dict]:
        conversations = obj.conversations.order_by('-started_at')[:5]
        return VisitorConversationSerializer(conversations, many=True).data