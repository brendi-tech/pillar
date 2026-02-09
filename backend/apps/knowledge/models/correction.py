"""
Correction model - tracks corrections created from conversation reviews.
"""
from django.db import models
from common.models.base import TenantAwareModel


class Correction(TenantAwareModel):
    """
    Tracks corrections created from conversation reviews.
    
    Links a ChatMessage to a KnowledgeItem (snippet) with processing metadata.
    Used to improve AI responses over time based on user feedback.
    
    Supports different correction types:
    - response: Correct the final answer text
    - reasoning: Correct a specific reasoning step
    - source: Correct source selection/ranking
    - search: Correct search strategy/queries
    """
    
    # Correction type - what aspect of the response is being corrected
    class CorrectionType(models.TextChoices):
        RESPONSE = 'response', 'Final Response'
        REASONING = 'reasoning', 'Reasoning Step'
        SOURCE_SELECTION = 'source', 'Source Selection'
        SEARCH_STRATEGY = 'search', 'Search Strategy'
    
    # Override TenantAwareModel's organization field with explicit related_name
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='corrections',
        help_text="Organization this correction belongs to"
    )
    
    # Source - the conversation and message being corrected
    source_message = models.ForeignKey(
        'analytics.ChatMessage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='corrections',
        help_text="The assistant message being corrected"
    )
    source_conversation = models.ForeignKey(
        'analytics.ChatConversation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='corrections',
        help_text="The conversation this correction came from"
    )
    
    # Correction type
    correction_type = models.CharField(
        max_length=20,
        choices=CorrectionType.choices,
        default=CorrectionType.RESPONSE,
        db_index=True,
        help_text="What aspect of the response is being corrected"
    )
    
    # Context - captured at time of correction creation
    original_question = models.TextField(
        blank=True,
        help_text="The user's question that led to the incorrect response"
    )
    original_response = models.TextField(
        blank=True,
        help_text="The AI's original (incorrect) response"
    )
    
    # Reasoning context - for reasoning/source/search corrections
    reasoning_step_index = models.IntegerField(
        null=True,
        blank=True,
        help_text="Index of the reasoning step being corrected (0-based)"
    )
    reasoning_step_type = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Type of reasoning step: decision, search, source_eval, etc."
    )
    full_reasoning_trace = models.JSONField(
        default=list,
        blank=True,
        help_text="Full reasoning trace at time of correction"
    )
    original_reasoning_step = models.JSONField(
        default=dict,
        blank=True,
        help_text="The specific reasoning step being corrected"
    )
    
    # Type-specific correction data
    correct_reasoning = models.TextField(
        blank=True,
        help_text="What the agent SHOULD have thought/done at this step"
    )
    correct_search_query = models.CharField(
        max_length=500,
        blank=True,
        help_text="For search corrections: what query should have been used"
    )
    correct_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="For source corrections: which sources should have been prioritized"
    )
    
    # User input
    user_correction_notes = models.TextField(
        help_text="What the user said was wrong and what's correct"
    )
    
    # AI-processed output
    processed_title = models.CharField(
        max_length=500,
        blank=True,
        help_text="AI-generated title for the correction snippet"
    )
    processed_content = models.TextField(
        blank=True,
        help_text="AI-generated standardized correction content"
    )
    
    # Result - the created knowledge item
    knowledge_item = models.OneToOneField(
        'knowledge.KnowledgeItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='correction',
        help_text="The snippet created from this correction"
    )
    
    # Status
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Processing'
        PROCESSING = 'processing', 'Processing'
        PROCESSED = 'processed', 'Processed'
        INDEXED = 'indexed', 'Indexed in Knowledge Base'
        FAILED = 'failed', 'Processing Failed'
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        help_text="Processing status of this correction"
    )
    
    processing_error = models.TextField(
        blank=True,
        default='',
        help_text="Error message if processing failed"
    )
    
    # Audit
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_corrections',
        help_text="User who created this correction"
    )
    
    class Meta:
        db_table = 'knowledge_correction'
        verbose_name = 'Correction'
        verbose_name_plural = 'Corrections'
        indexes = [
            # Explicit names matching Django's migration state (from 0008)
            models.Index(fields=['organization', 'status'], name='knowledge_c_organiz_1cc176_idx'),
            models.Index(fields=['organization', '-created_at'], name='knowledge_c_organiz_9d9ea1_idx'),
            models.Index(fields=['source_conversation'], name='knowledge_c_source__39f8be_idx'),
            models.Index(fields=['organization', 'correction_type'], name='knowledge_c_organiz_type_idx'),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        if self.processed_title:
            return f"Correction: {self.processed_title}"
        return f"Correction ({self.get_status_display()})"
