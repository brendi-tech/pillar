"""
Correction processing service.

Processes user corrections through LLM to generate standardized correction snippets.
"""
import logging
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.utils import timezone

from apps.knowledge.models import KnowledgeItem, KnowledgeSource, Correction
from common.utils.llm_client import get_llm_client
from common.utils.llm_config import LLMConfigService
from common.utils.json_parser import parse_json_from_llm


logger = logging.getLogger(__name__)


# =============================================================================
# Service
# =============================================================================


@dataclass
class CorrectionResult:
    """Result of processing a correction."""
    success: bool
    title: Optional[str] = None
    content: Optional[str] = None
    knowledge_item_id: Optional[str] = None
    error: Optional[str] = None


class CorrectionProcessingService:
    """
    Service for processing user corrections through LLM.
    
    Takes user feedback about incorrect AI responses and:
    1. Processes through LLM to generate standardized content
    2. Creates a KnowledgeItem (correction) with the correction
    3. Triggers the indexing workflow
    
    Supports different correction types:
    - response: Correct the final answer text
    - reasoning: Correct a specific reasoning step
    - source: Correct source selection/ranking
    - search: Correct search strategy/queries
    """
    
    def __init__(self):
        model_ref = getattr(settings, 'CORRECTION_LLM_MODEL', 'openai/budget')
        self.model = LLMConfigService.get_openrouter_model(model_ref)
        self.llm = get_llm_client()
    
    def process_correction(self, correction: Correction) -> CorrectionResult:
        """
        Process a Correction through LLM and create a knowledge item.
        
        Uses a unified processor for all correction types.
        
        Args:
            correction: Correction model with user notes and context
            
        Returns:
            CorrectionResult with success status and created item
        """
        logger.info(
            f"Processing correction {correction.id} "
            f"(type: {correction.correction_type})"
        )
        
        try:
            # Mark as processing
            correction.status = Correction.Status.PROCESSING
            correction.save(update_fields=['status'])
            
            # Process through unified LLM handler
            title, content = self._process_correction_llm(correction)
            
            if not title or not content:
                raise ValueError("LLM did not return valid title or content")
            
            # Update correction with processed content
            correction.processed_title = title[:500]  # Enforce max length
            correction.processed_content = content
            correction.status = Correction.Status.PROCESSED
            correction.save(update_fields=[
                'processed_title', 'processed_content', 'status'
            ])
            
            # Create the KnowledgeItem (correction type)
            knowledge_item = self._create_snippet(correction, title, content)
            
            # Link to correction
            correction.knowledge_item = knowledge_item
            correction.save(update_fields=['knowledge_item'])
            
            # Trigger indexing
            self._trigger_indexing(knowledge_item)
            
            logger.info(
                f"Created correction item {knowledge_item.id} from correction {correction.id}"
            )
            
            return CorrectionResult(
                success=True,
                title=title,
                content=content,
                knowledge_item_id=str(knowledge_item.id),
            )
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to process correction {correction.id}: {e}")
            
            correction.status = Correction.Status.FAILED
            correction.processing_error = error_msg
            correction.save(update_fields=['status', 'processing_error'])
            
            return CorrectionResult(
                success=False,
                error=error_msg,
            )
    
    def _process_correction_llm(self, correction: Correction) -> tuple[str, str]:
        """
        Process any correction type through LLM to generate title and content.
        
        Uses a single prompt that adapts based on correction_type and available context.
        """
        # Build context based on correction type
        context_parts = []
        
        # Always include question and response
        context_parts.append(f"User question: {correction.original_question or 'Unknown question'}")
        context_parts.append(f"AI response: {correction.original_response or 'Unknown response'}")
        context_parts.append(f"Correction type: {correction.get_correction_type_display()}")
        context_parts.append(f"Reviewer notes: {correction.user_correction_notes}")
        
        # Add type-specific context
        if correction.correction_type == Correction.CorrectionType.REASONING:
            original_step = correction.original_reasoning_step or {}
            context_parts.append(f"Original thought: {original_step.get('thought', 'No thought recorded')}")
            context_parts.append(f"Original decision: {original_step.get('decision', original_step.get('step_type', 'Unknown'))}")
            if correction.correct_reasoning:
                context_parts.append(f"Correct reasoning: {correction.correct_reasoning}")
                
        elif correction.correction_type == Correction.CorrectionType.SOURCE_SELECTION:
            # Extract sources from reasoning trace
            sources_info = self._extract_sources_info(correction)
            context_parts.append(f"Sources shown: {sources_info['shown']}")
            context_parts.append(f"Sources used: {sources_info['used']}")
            if correction.correct_sources:
                correct_sources_str = ', '.join(
                    f"{s.get('title', 'Unknown')} (rank: {s.get('should_rank', 'N/A')})"
                    for s in correction.correct_sources
                )
                context_parts.append(f"Correct sources: {correct_sources_str}")
                
        elif correction.correction_type == Correction.CorrectionType.SEARCH_STRATEGY:
            # Extract search queries from reasoning trace
            search_queries = self._extract_search_queries(correction)
            context_parts.append(f"Search queries used: {search_queries}")
            if correction.correct_search_query:
                context_parts.append(f"Better search query: {correction.correct_search_query}")
        
        context = '\n'.join(f"- {part}" for part in context_parts)
        
        prompt = f"""You are processing a correction submitted by a human reviewer.

## Context
{context}

## Task
Create a knowledge snippet that captures the correct information so the AI gets this right in future similar conversations.

## Output Format (JSON)
{{
  "title": "Short descriptive title (max 100 chars)",
  "content": "Markdown content covering: what was wrong, what is correct, when this applies"
}}

The content should be structured with clear sections:
- What was incorrect or missing
- The correct information or approach
- When this guidance applies (query patterns, situations)

Return ONLY the JSON object, no other text."""

        response = self.llm.complete(
            prompt=prompt,
            model=self.model,
            temperature=0.1,
            max_tokens=2000,
        )
        
        result = parse_json_from_llm(response, expected_type="object")
        
        title = result.get('title', 'Untitled Correction')
        content = result.get('content', '')
        
        if not content:
            raise ValueError("LLM did not return valid content")
        
        return title, content
    
    def _extract_sources_info(self, correction: Correction) -> dict:
        """Extract source information from reasoning trace."""
        sources_shown = []
        sources_used = []
        
        for step in (correction.full_reasoning_trace or []):
            if step.get('step_type') == 'source_eval':
                for source in step.get('sources_evaluated', []):
                    sources_shown.append(
                        f"{source.get('title', 'Unknown')}: score {source.get('score', 0):.2f}"
                    )
                    if source.get('was_used'):
                        sources_used.append(source.get('title', 'Unknown'))
        
        return {
            'shown': ', '.join(sources_shown) if sources_shown else 'No sources recorded',
            'used': ', '.join(sources_used) if sources_used else 'None',
        }
    
    def _extract_search_queries(self, correction: Correction) -> str:
        """Extract search queries from reasoning trace."""
        queries = []
        
        for step in (correction.full_reasoning_trace or []):
            if step.get('step_type') == 'search':
                query = step.get('search_query', '')
                if query:
                    queries.append(query)
        
        return ', '.join(queries) if queries else 'No searches recorded'
    
    def _create_snippet(
        self,
        correction: Correction,
        title: str,
        content: str,
    ) -> KnowledgeItem:
        """
        Create a KnowledgeItem (correction) from processed correction.
        
        Args:
            correction: The source correction
            title: Generated title
            content: Processed content
            
        Returns:
            Created KnowledgeItem
        """
        organization = correction.organization
        
        # Get the default product for this organization
        from apps.products.models import Product
        default_product = Product.objects.filter(
            organization=organization,
            is_default=True
        ).first()
        
        # Get or create the Snippets source for this organization and product
        snippets_source, _ = KnowledgeSource.objects.get_or_create(
            organization=organization,
            product=default_product,
            source_type=KnowledgeSource.SourceType.SNIPPETS,
            defaults={
                'name': 'Custom Snippets',
                'status': KnowledgeSource.Status.ACTIVE,
            }
        )
        
        # Map correction type to excerpt and metadata
        correction_type_labels = {
            Correction.CorrectionType.RESPONSE: 'Response correction',
            Correction.CorrectionType.REASONING: 'Reasoning guidance',
            Correction.CorrectionType.SOURCE_SELECTION: 'Source ranking guidance',
            Correction.CorrectionType.SEARCH_STRATEGY: 'Search strategy guidance',
        }
        excerpt_label = correction_type_labels.get(
            correction.correction_type,
            'Correction'
        )
        
        # Create the correction item
        snippet = KnowledgeItem.objects.create(
            organization=organization,
            product=snippets_source.product,  # Denormalized from source
            source=snippets_source,
            item_type=KnowledgeItem.ItemType.CORRECTION,
            title=title,
            raw_content=content,
            optimized_content=content,  # Already optimized by LLM
            excerpt=f"{excerpt_label} from conversation feedback",
            is_active=True,  # Auto-activate corrections
            status=KnowledgeItem.Status.PENDING,
            metadata={
                'correction_id': str(correction.id),
                'correction_type': correction.correction_type,
                'correction_subtype': correction.correction_type,  # For retrieval boosting
                'source_conversation_id': str(correction.source_conversation_id) if correction.source_conversation_id else None,
                'source_message_id': str(correction.source_message_id) if correction.source_message_id else None,
                'reasoning_step_index': correction.reasoning_step_index,
                'reasoning_step_type': correction.reasoning_step_type,
            }
        )
        
        return snippet
    
    def _trigger_indexing(self, item: KnowledgeItem):
        """Trigger the indexing workflow for the created correction."""
        try:
            from common.task_router import TaskRouter
            
            TaskRouter.execute(
                'knowledge-process-item',
                item_id=str(item.id),
                organization_id=str(item.organization_id),
            )
        except Exception as e:
            logger.error(f"Failed to trigger indexing for item {item.id}: {e}")
            # Don't fail the whole correction - the item can be indexed later


def get_correction_service() -> CorrectionProcessingService:
    """Factory function to get the correction processing service."""
    return CorrectionProcessingService()
