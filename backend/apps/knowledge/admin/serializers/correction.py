"""
Correction serializers.
"""
from rest_framework import serializers
from apps.knowledge.models import Correction


class CorrectionSerializer(serializers.ModelSerializer):
    """Serializer for Correction model."""
    
    created_by_name = serializers.SerializerMethodField()
    knowledge_item_title = serializers.SerializerMethodField()
    
    class Meta:
        model = Correction
        fields = [
            'id',
            'status',
            'correction_type',
            'original_question',
            'original_response',
            'user_correction_notes',
            'processed_title',
            'processed_content',
            'knowledge_item',
            'knowledge_item_title',
            'source_conversation',
            'source_message',
            'processing_error',
            # Reasoning fields
            'reasoning_step_index',
            'reasoning_step_type',
            'full_reasoning_trace',
            'original_reasoning_step',
            # Type-specific correction data
            'correct_reasoning',
            'correct_search_query',
            'correct_sources',
            # Audit
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'processed_title',
            'processed_content',
            'knowledge_item',
            'processing_error',
            'full_reasoning_trace',
            'original_reasoning_step',
            'created_at',
            'updated_at',
        ]
    
    def get_created_by_name(self, obj) -> str | None:
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.email
        return None
    
    def get_knowledge_item_title(self, obj) -> str | None:
        if obj.knowledge_item:
            return obj.knowledge_item.title
        return None


class CorrectSourceSerializer(serializers.Serializer):
    """Serializer for source correction items."""
    
    title = serializers.CharField(
        max_length=500,
        help_text="Title of the source"
    )
    should_rank = serializers.IntegerField(
        min_value=1,
        help_text="What rank this source should have (1 = highest priority)"
    )


class ContextQuoteSerializer(serializers.Serializer):
    """Serializer for context quotes from the conversation/reasoning."""
    
    text = serializers.CharField(
        max_length=2000,
        help_text="The quoted text"
    )
    source = serializers.ChoiceField(
        choices=['message', 'reasoning'],
        help_text="Where the quote came from"
    )
    step_index = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        help_text="Index of the reasoning step (if from reasoning)"
    )
    step_type = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50,
        help_text="Type of reasoning step (decision, search, source_eval, answer)"
    )


class CreateCorrectionSerializer(serializers.Serializer):
    """
    Serializer for creating a correction.
    
    Supports two modes:
    1. New mode: context_quotes + correction_notes (type is inferred)
    2. Legacy mode: correction_type + specific fields
    """
    
    message_id = serializers.UUIDField(
        help_text="ID of the assistant message being corrected"
    )
    correction_notes = serializers.CharField(
        min_length=10,
        max_length=5000,
        help_text="What should happen instead"
    )
    
    # New mode: context quotes from text selection
    context_quotes = ContextQuoteSerializer(
        many=True,
        required=False,
        default=list,
        help_text="Quoted context from conversation/reasoning timeline"
    )
    
    # Legacy mode fields (still supported)
    correction_type = serializers.ChoiceField(
        choices=['response', 'reasoning', 'source', 'search'],
        default='response',
        required=False,
        help_text="What aspect of the response is being corrected"
    )
    # For reasoning corrections
    reasoning_step_index = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        help_text="Index of the reasoning step being corrected (0-based)"
    )
    correct_reasoning = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=5000,
        help_text="What the agent SHOULD have thought/done at this step"
    )
    # For search corrections
    correct_search_query = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text="For search corrections: what query should have been used"
    )
    # For source corrections
    correct_sources = CorrectSourceSerializer(
        many=True,
        required=False,
        help_text="For source corrections: which sources should have been prioritized"
    )
    
    def validate(self, data):
        """Infer correction_type from context_quotes if not explicitly set."""
        context_quotes = data.get('context_quotes', [])
        
        # If we have context quotes and no explicit type, infer it
        if context_quotes and data.get('correction_type') == 'response':
            # Check if any quotes are from reasoning
            reasoning_quotes = [q for q in context_quotes if q.get('source') == 'reasoning']
            
            if reasoning_quotes:
                # Infer type from the step_type of reasoning quotes
                step_types = [q.get('step_type', '') for q in reasoning_quotes]
                
                if 'search' in step_types:
                    data['correction_type'] = 'search'
                elif 'source_eval' in step_types:
                    data['correction_type'] = 'source'
                elif any(st in step_types for st in ['decision', 'answer']):
                    data['correction_type'] = 'reasoning'
                    
                # Also set reasoning_step_index from the first reasoning quote
                first_reasoning = reasoning_quotes[0]
                if first_reasoning.get('step_index') is not None:
                    data['reasoning_step_index'] = first_reasoning['step_index']
        
        return data
