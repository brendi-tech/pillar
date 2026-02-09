"""
SuggestQuestionsTool - Generates action-oriented suggested questions for the assistant.

This tool generates 3 concise suggested questions that users can
click to start a conversation. Questions are designed to be action-oriented,
covering the most relevant available actions and key documentation topics.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Any, Dict, List

from django.core.cache import cache

from apps.mcp.tools.base import Tool
from common.cache_keys import CacheKeys

logger = logging.getLogger(__name__)

# Cache TTL for suggested questions (4 hours - suggestions don't change often)
CACHE_TTL_SECONDS = 14400

# Pool size - keep it focused and concise
MAX_POOL_SIZE = 3


class SuggestQuestionsTool(Tool):
    """
    Generate suggested questions for the assistant.

    Uses the help center's content and available actions to generate
    3 relevant starter questions. The SDK sorts these client-side
    based on the current page context.
    
    Questions are designed to:
    - Highlight the most useful actions for the product
    - Start with action verbs (Set up, Configure, Import, View, Create)
    - Be specific to the product's capabilities
    """

    name = "suggest_questions"
    public = True
    supports_streaming = False

    description = (
        "Get suggested starter questions for the assistant panel. "
        "Returns 3 focused questions covering the most relevant actions and topics."
    )

    input_schema = {
        "type": "object",
        "properties": {
            "force_refresh": {
                "type": "boolean",
                "description": "Force regeneration of questions, bypassing cache.",
                "default": False
            }
        },
        "required": []
    }

    annotations = {
        "readOnlyHint": True,
        "categories": ["ui", "suggestions"],
        "tags": ["questions", "starter", "suggestions"],
    }

    async def execute(
        self,
        help_center_config,
        arguments: Dict[str, Any],
        request=None,
        language: str = None
    ) -> Dict[str, Any]:
        """
        Execute the suggest_questions tool.

        Returns cached questions if available, otherwise generates new ones
        using LLM based on available actions and top articles.
        """
        if not help_center_config:
            return {
                'success': False,
                'error': 'Help center context not available',
                'content': [{'type': 'text', 'text': 'Error: Help center context not available'}],
                'isError': True
            }

        force_refresh = arguments.get('force_refresh', False)
        site_id = str(help_center_config.id)

        try:
            # Get admin-configured questions (these get priority in sorting)
            config = getattr(help_center_config, 'config', {}) or {}
            ai_config = config.get('ai', {})
            saved_questions = ai_config.get('suggestedQuestions', [])
            
            # Format manual questions with 'manual' flag for SDK prioritization
            manual_questions = []
            if saved_questions and isinstance(saved_questions, list):
                manual_questions = [
                    {'id': f'manual_{i+1}', 'text': q, 'manual': True}
                    for i, q in enumerate(saved_questions)
                    if isinstance(q, str) and q.strip()
                ]
                if manual_questions:
                    logger.debug(f"[SuggestQuestions] Found {len(manual_questions)} admin-configured questions for site {site_id}")
            
            # Check cache for generated questions (unless force_refresh)
            generated_questions = []
            cache_key = CacheKeys.suggested_questions(site_id)
            
            if not force_refresh:
                cached = cache.get(cache_key)
                if cached:
                    logger.debug(f"[SuggestQuestions] Cache hit for site {site_id}")
                    generated_questions = cached

            # Generate new questions if cache miss
            if not generated_questions:
                generated_questions = await self._generate_questions(help_center_config)
                # Cache the generated results (not including manual)
                cache.set(cache_key, generated_questions, CACHE_TTL_SECONDS)
                logger.info(f"[SuggestQuestions] Generated and cached {len(generated_questions)} questions for site {site_id}")

            # Merge: manual questions first, then generated to fill remaining slots
            # Manual questions are marked with 'manual': True for SDK prioritization
            merged_questions = manual_questions + generated_questions
            
            logger.debug(f"[SuggestQuestions] Returning {len(manual_questions)} manual + {len(generated_questions)} generated questions")

            return {
                'success': True,
                'content': [{'type': 'text', 'text': f'Suggested questions ({len(manual_questions)} manual, {len(generated_questions)} generated)'}],
                'isError': False,
                'structuredContent': {
                    'questions': merged_questions
                }
            }

        except Exception as e:
            logger.error(f"[SuggestQuestions] Error generating questions: {e}", exc_info=True)
            return {
                'success': True,
                'content': [{'type': 'text', 'text': 'No suggested questions available'}],
                'isError': False,
                'structuredContent': {
                    'questions': []
                }
            }

    async def _generate_questions(
        self,
        help_center_config,
    ) -> List[Dict[str, str]]:
        """
        Generate action-oriented questions using LLM.

        Fetches available actions and top articles to provide context,
        then asks LLM to generate relevant starter questions.
        """
        from apps.products.models import Action
        from apps.knowledge.services import KnowledgeRAGServiceAsync
        from common.utils.llm_config import LLMConfigService
        from common.utils.json_parser import parse_json_from_llm

        # Fetch available actions
        actions_context = await self._get_actions_context(help_center_config)

        # Fetch top articles via RAG search
        articles_context = await self._get_articles_context(help_center_config)

        # Build prompt
        prompt = self._build_prompt(
            product_name=help_center_config.name,
            actions_context=actions_context,
            articles_context=articles_context,
        )

        # Generate with LLM (use budget model for question generation)
        llm_client, model_name, _, _ = LLMConfigService.create_llm_client_for_task(
            site=help_center_config,
            task_type=LLMConfigService.TASK_QUESTION_SUGGESTIONS,
            temperature=0.7,  # Some creativity for varied questions
            max_tokens=1000,
        )

        logger.info(f"[SuggestQuestions] Generating {MAX_POOL_SIZE} questions with model: {model_name}")

        response = await llm_client.complete_async(
            prompt=prompt,
            system_prompt=(
                "You are an assistant that generates helpful starter questions for a product's help center. "
                "Generate exactly 3 focused questions covering the most important capabilities. Return only valid JSON array."
            ),
            max_tokens=1000,
            temperature=0.7,
        )

        # Parse JSON response
        questions = parse_json_from_llm(response, expected_type="array")

        if not isinstance(questions, list) or len(questions) == 0:
            logger.warning(f"[SuggestQuestions] Invalid response format, returning empty")
            return []

        # Validate and normalize format
        validated = []
        for i, q in enumerate(questions[:MAX_POOL_SIZE]):
            if isinstance(q, dict) and 'text' in q:
                validated.append({
                    'id': q.get('id', f'q{i+1}'),
                    'text': q['text']
                })
            elif isinstance(q, str):
                validated.append({
                    'id': f'q{i+1}',
                    'text': q
                })

        if not validated:
            return []

        return validated

    async def _get_actions_context(self, help_center_config) -> str:
        """Fetch available actions and format as concise context for LLM.
        
        Optimized for speed: includes all action names but truncates descriptions
        to keep the prompt size manageable while ensuring comprehensive coverage.
        """
        from apps.products.models import Action

        try:
            actions = []
            # Fetch all published actions - names are most important for diversity
            async for action in Action.objects.filter(
                product=help_center_config,
                status=Action.Status.PUBLISHED,
            ).values('name', 'description'):
                name = action['name'].replace('_', ' ').title()
                desc = (action['description'] or '')
                if desc:
                    actions.append(f"- {name}: {desc}")
                else:
                    actions.append(f"- {name}")

            if actions:
                logger.debug(f"[SuggestQuestions] Found {len(actions)} published actions")
                return f"Available actions ({len(actions)}):\n" + "\n".join(actions)
            return "No specific actions available."

        except Exception as e:
            logger.warning(f"[SuggestQuestions] Failed to fetch actions: {e}")
            return "No specific actions available."

    async def _get_articles_context(self, help_center_config) -> str:
        """Fetch top articles with substantial content for context."""
        from apps.knowledge.services import KnowledgeRAGServiceAsync

        try:
            rag_service = KnowledgeRAGServiceAsync(
                organization_id=str(help_center_config.organization_id),
                product_id=str(help_center_config.id)
            )
            
            # Search for popular/important content
            results = await rag_service.hybrid_search(
                query="",  # Empty query to get top articles by relevance
                top_k=8
            )

            if results:
                articles = []
                for r in results[:8]:
                    title = r.title
                    content = getattr(r, 'content', '') or ''
                    snippet = content
                    articles.append(f"### {title}\n{snippet}")
                return "Documentation content:\n\n" + "\n\n".join(articles)
            return "No documentation available."

        except Exception as e:
            logger.warning(f"[SuggestQuestions] Failed to fetch articles: {e}")
            return "No documentation available."

    def _build_prompt(
        self,
        product_name: str,
        actions_context: str,
        articles_context: str,
    ) -> str:
        """Build the LLM prompt for generating starter questions."""
        return f"""Generate {MAX_POOL_SIZE} diverse starter questions for {product_name}'s assistant.

{actions_context}

{articles_context}

Requirements:
- Pick the 3 most useful and representative actions/topics from the lists above
- Questions MUST be answerable using ONLY the actions and articles listed above
- Keep each question under 10 words
- Mix question styles: "How do I...", "Show me...", "What is..."
- Make questions specific and actionable, not generic
- DO NOT invent capabilities not listed above

Return ONLY a JSON array with {MAX_POOL_SIZE} questions:
[
  {{"id": "q1", "text": "your question here"}},
  {{"id": "q2", "text": "your question here"}},
  ...
]"""
