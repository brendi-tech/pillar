"""
Serializers for the analytics app.
"""
from rest_framework import serializers
from apps.analytics.models import (
    Search, WidgetSession,
    ChatConversation, ChatMessage
)
from apps.knowledge.models import KnowledgeItem, KnowledgeChunk


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


class ChatConversationListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing conversations.
    Includes aggregated fields for the table view.
    """
    message_count = serializers.IntegerField(read_only=True)
    first_user_message = serializers.SerializerMethodField()
    last_assistant_message = serializers.SerializerMethodField()
    has_negative_feedback = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'status', 'page_url', 'started_at', 'last_message_at',
            'message_count', 'first_user_message', 'last_assistant_message',
            'has_negative_feedback', 'escalation_reason', 'escalated_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
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


class ChatMessageDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for ChatMessage with resolved chunk information.
    Used in conversation detail view.
    """
    chunks_details = serializers.SerializerMethodField()
    
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


class ChatConversationDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for conversation detail view.
    Includes detailed message information with resolved chunks.
    """
    messages = ChatMessageDetailSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()
    has_negative_feedback = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id', 'session', 'status', 'page_url', 'product_context',
            'escalation_reason', 'escalated_to', 'started_at', 'last_message_at',
            'messages', 'message_count', 'has_negative_feedback',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_message_count(self, obj) -> int:
        return obj.messages.count()
    
    def get_has_negative_feedback(self, obj) -> bool:
        return obj.messages.filter(
            role=ChatMessage.Role.ASSISTANT,
            feedback=ChatMessage.Feedback.DOWN
        ).exists()