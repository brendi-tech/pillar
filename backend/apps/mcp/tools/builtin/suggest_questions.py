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
            # Supports both legacy string[] format and new {text, pathPattern}[] format
            manual_questions = []
            if saved_questions and isinstance(saved_questions, list):
                for i, q in enumerate(saved_questions):
                    if isinstance(q, str) and q.strip():
                        # Legacy format: plain string
                        manual_questions.append({
                            'id': f'manual_{i+1}',
                            'text': q,
                            'manual': True
                        })
                    elif isinstance(q, dict) and q.get('text', '').strip():
                        # New format: {text, pathPattern?}
                        question = {
                            'id': f'manual_{i+1}',
                            'text': q['text'],
                            'manual': True
                        }
                        if q.get('pathPattern'):
                            question['pathPattern'] = q['pathPattern']
                        manual_questions.append(question)
                
                if manual_questions:
                    logger.debug(f"[SuggestQuestions] Found {len(manual_questions)} admin-configured questions for site {site_id}")
            
            # Check cache for generated questions (unless force_refresh)
            generated_questions = []
            lang_suffix = f":{language}" if language and language != 'en' else ''
            cache_key = CacheKeys.suggested_questions(site_id) + lang_suffix
            
            if not force_refresh:
                cached = cache.get(cache_key)
                if cached:
                    logger.debug(f"[SuggestQuestions] Cache hit for site {site_id}")
                    generated_questions = cached

            # Generate new questions if cache miss
            if not generated_questions:
                generated_questions = await self._generate_questions(help_center_config, language=language)
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
        language: str = None,
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

        has_actions = not actions_context.startswith("No specific actions")
        has_articles = not articles_context.startswith("No documentation")

        # Nothing to work with -- skip the LLM call entirely
        if not has_actions and not has_articles:
            logger.info("[SuggestQuestions] No actions or articles available, skipping generation")
            return []

        # Resolve language name for prompts
        effective_lang = language or 'en'
        from apps.mcp.services.prompts.system_prompts import LANGUAGE_NAMES
        lang_name = LANGUAGE_NAMES.get(effective_lang, effective_lang.upper()) if effective_lang != 'en' else None

        # Build prompt
        prompt = self._build_prompt(
            product_name=help_center_config.name,
            actions_context=actions_context,
            articles_context=articles_context,
            has_actions=has_actions,
            lang_name=lang_name,
        )

        # Generate with LLM (use budget model for question generation)
        llm_client, model_name, _, _ = LLMConfigService.create_llm_client_for_task(
            site=help_center_config,
            task_type=LLMConfigService.TASK_QUESTION_SUGGESTIONS,
            temperature=0.7,  # Some creativity for varied questions
            max_tokens=1000,
        )

        logger.info(f"[SuggestQuestions] Generating {MAX_POOL_SIZE} questions with model: {model_name}")

        lang_instruction = f" IMPORTANT: All prompts MUST be written entirely in {lang_name}." if lang_name else ""

        if has_actions:
            system_prompt = (
                "You are an assistant that generates action-oriented starter prompts for a product's AI copilot. "
                "The copilot can perform actions, not just answer questions. Generate exactly 3 focused prompts "
                "that invite the user to ask the copilot to DO something. Use imperative phrasing like "
                "'Create...', 'Set up...', 'Show me...' instead of 'How do I...'. Return only valid JSON array."
                f"{lang_instruction}"
            )
        else:
            system_prompt = (
                "You are an assistant that generates helpful starter prompts for a product's AI copilot. "
                "Generate exactly 3 focused prompts that invite the user to engage with the copilot. "
                "Use guiding phrasing like 'Walk me through...', 'Help me understand...', 'Show me how to...' "
                "instead of passive 'How do I...' or 'What is...'. Return only valid JSON array."
                f"{lang_instruction}"
            )

        response = await llm_client.complete_async(
            prompt=prompt,
            system_prompt=system_prompt,
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
        """Fetch available actions with metadata annotations for LLM ranking.

        Each action is annotated with its type and key properties so the LLM
        can reason about which are the most impressive capabilities to suggest.
        """
        from apps.products.models import Action

        try:
            actions = []
            async for action in Action.objects.filter(
                product=help_center_config,
                status=Action.Status.PUBLISHED,
            ).values('name', 'description', 'action_type', 'required_context', 'returns_data'):
                name = action['name'].replace('_', ' ').title()
                desc = action['description'] or ''

                # Build metadata tags for LLM ranking
                tags = [action['action_type'] or 'trigger_action']
                if action.get('returns_data'):
                    tags.append('returns data')
                if action.get('required_context'):
                    tags.append('requires context')

                tag_str = ', '.join(tags)
                if desc:
                    actions.append(f"- {name} [{tag_str}]: {desc}")
                else:
                    actions.append(f"- {name} [{tag_str}]")

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
        has_actions: bool = False,
        lang_name: str = None,
    ) -> str:
        """Build the LLM prompt for generating starter prompts.

        The tone adapts to what's available:
        - With actions: imperative ("Create...", "Set up...", "Show me...")
        - Without actions: guiding ("Walk me through...", "Help me understand...")
        """
        if has_actions:
            tone_requirements = """- Be ACTION-ORIENTED: the assistant can DO things, not just answer questions. Prefer imperative/request phrasing that invites the assistant to act.
  - Good: "Create a monitoring dashboard", "Set up a silence for alerts", "Show me my datasources"
  - Bad: "How do I create a dashboard?", "What is the process to silence alerts?"
- Mix styles: "Create...", "Set up...", "Show me...", "Help me..." -- but avoid "How do I..." or "What is the process..."
- PRIORITIZE actions marked "trigger_action" or "query" without "requires context" -- these are the most powerful capabilities users can invoke from any page.
- DEPRIORITIZE simple "navigate" actions and actions that "require context" (they only work on specific pages). Only suggest these if nothing better is available.
"""
        else:
            tone_requirements = """- Be GUIDING: the assistant can walk users through topics and explain things. Use active phrasing that invites the assistant to help.
  - Good: "Walk me through setting up SSO", "Help me understand billing", "Show me how to configure alerts"
  - Bad: "How do I set up SSO?", "What is billing?", "Explain alerts"
- Mix styles: "Walk me through...", "Help me understand...", "Show me how to..." -- but avoid "How do I..." or "What is..."
"""

        return f"""Generate {MAX_POOL_SIZE} diverse starter prompts for {product_name}'s assistant.

{actions_context}

{articles_context}

Requirements:
- Pick the 3 most useful and representative topics from the lists above
- Prompts MUST be answerable using ONLY the actions and articles listed above
- Keep each prompt under 10 words
{tone_requirements}- Make prompts specific and actionable, not generic
- DO NOT invent capabilities not listed above
{f'- ALL prompts MUST be written entirely in {lang_name}. Do not use English.' if lang_name else ''}

Return ONLY a JSON array with {MAX_POOL_SIZE} prompts:
[
  {{"id": "q1", "text": "your prompt here"}},
  {{"id": "q2", "text": "your prompt here"}},
  ...
]"""
