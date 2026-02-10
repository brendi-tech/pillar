"""
AskTool - Unified ask/question-answering tool for Help Center.

Handles question answering using hybrid search and LLM generation.
Also searches for matching Actions to suggest alongside the answer.

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

from django.conf import settings

from apps.mcp.tools.base import Tool
from apps.mcp.services.mcp_server.utils import extract_request_metadata

logger = logging.getLogger(__name__)


def _is_valid_gcs_signed_url(url: str) -> bool:
    """Validate signed GCS URL from our bucket."""
    bucket_name = getattr(settings, 'GS_BUCKET_NAME', 'pillar-storage')
    return (
        url.startswith('https://storage.googleapis.com/') and
        bucket_name in url and
        '/conversations/images/' in url and
        all(p in url for p in ['X-Goog-Algorithm', 'X-Goog-Credential', 'X-Goog-Signature'])
    )


class AskTool(Tool):
    """
    Unified ask tool for question answering.

    Uses hybrid search to find relevant articles, then generates
    an answer using an LLM with the context.
    """

    name = "ask"
    public = True
    supports_streaming = True

    description = (
        "Ask a question about the help center content. "
        "Uses intelligent search to find relevant articles and generates a helpful answer. "
        "Best for: questions about products, features, pricing, how-to guides, and documentation."
    )

    input_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "The question or query to ask. Use natural language and be specific. "
                    "Examples: 'How do I get started?', 'What are your pricing plans?', 'How do I reset my password?'"
                ),
                "minLength": 3,
                "maxLength": 1000
            },
            "top_k": {
                "type": "integer",
                "description": "Number of relevant articles to search. Default: 5, Range: 1-20.",
                "default": 5,
                "minimum": 1,
                "maximum": 20
            },
            "conversation_id": {
                "type": "string",
                "description": "Optional conversation ID to load history for context-aware answers.",
            },
            "registered_actions": {
                "type": "array",
                "items": {"type": "object"},
                "description": "Actions from previous turns (persisted by SDK for multi-turn conversations).",
                "default": []
            },
            "user_context": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "text_content": {"type": "string"},
                        "url_origin": {"type": "string"}
                    }
                },
                "description": "Additional context items (highlighted text, etc.) to inform the answer",
                "default": []
            },
            "images": {
                "type": "array",
                "description": (
                    "Optional images to analyze with the question (max 4). "
                    "Use the upload-image endpoint to get signed URLs."
                ),
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "Signed GCS URL from upload-image endpoint"
                        },
                        "detail": {
                            "type": "string",
                            "enum": ["low", "high"],
                            "default": "low",
                            "description": "Detail level for image analysis. 'low' is faster and cheaper."
                        }
                    },
                    "required": ["url"]
                }
            },
            "context": {
                "type": "object",
                "description": "User's current context for personalized responses and action filtering",
                "properties": {
                    "currentPage": {
                        "type": "string",
                        "description": "Current page path (e.g., '/settings/billing')"
                    },
                    "currentFeature": {
                        "type": "string",
                        "description": "Human-readable feature name (e.g., 'Billing Settings')"
                    },
                    "userRole": {
                        "type": "string",
                        "description": "User's role for action filtering (e.g., 'admin', 'member')"
                    },
                    "userState": {
                        "type": "string",
                        "description": "User's current state (e.g., 'onboarding', 'trial', 'active')"
                    },
                    "errorState": {
                        "type": "object",
                        "description": "Error state for troubleshooting",
                        "properties": {
                            "code": {"type": "string"},
                            "message": {"type": "string"}
                        }
                    }
                }
            }
        },
        "required": ["query"]
    }

    annotations = {
        "readOnlyHint": True,
        "categories": ["question-answering", "search", "help-center"],
        "tags": ["intelligent", "search", "qa", "articles"],
        "useCases": [
            "Answer questions about help center content",
            "Simple factual lookups",
            "How-to guides and documentation"
        ],
        "capabilities": {
            "semantic_search": True,
            "keyword_search": True,
            "hybrid_search": True,
            "source_citations": True
        }
    }

    async def execute(
        self, help_center_config, arguments: Dict[str, Any], request=None, language: str = 'en'
    ) -> Dict[str, Any]:
        """
        Execute the ask tool (non-streaming).

        Always searches both articles and actions, then lets the LLM
        decide how to best respond based on all available context.
        """
        query = arguments.get('query', '')
        images = arguments.get('images', [])
        if not query and not images:
            return {
                'success': False,
                'error': 'A message or image is required',
                'content': [{'type': 'text', 'text': 'Error: A message or image is required'}],
                'isError': True
            }

        if not help_center_config:
            return {
                'success': False,
                'error': 'Help center context not available',
                'content': [{'type': 'text', 'text': 'Error: Help center context not available'}],
                'isError': True
            }

        top_k = arguments.get('top_k', 5)

        try:
            # Search using KnowledgeRAGService hybrid search
            from apps.knowledge.services import KnowledgeRAGServiceAsync

            rag_service = KnowledgeRAGServiceAsync(
                organization_id=str(help_center_config.organization_id),
                product_id=str(help_center_config.id)
            )
            search_results = await rag_service.hybrid_search(
                query=query,
                top_k=top_k
            )

            # Convert SearchResult objects to dicts
            results = [
                {
                    'id': r.item_id,
                    'title': r.title,
                    'excerpt': r.content or '',
                    'content': r.content,
                    'url': r.url,
                    'source_name': r.source_name,
                    'item_type': r.item_type,
                    'score': r.score,
                }
                for r in search_results
            ]

            # No longer need separate knowledge search - hybrid search covers everything
            knowledge_results = []

            # Get platform/version from request headers for action filtering
            platform, version = self._get_platform_version(request)
            actions = await self._search_actions(
                query, product=help_center_config, platform=platform, version=version
            )

            # Check action types (changes how LLM should respond)
            has_auto_run = any(a.get('auto_run', False) for a in actions)
            has_inline_ui = any(a.get('action_type') == 'inline_ui' for a in actions)

            # Build context for LLM (articles + knowledge + actions)
            context = self._build_full_context(results, actions, knowledge_results)

            # Generate answer with LLM - let it decide what's most relevant
            from common.utils.llm_config import LLMConfigService

            llm_client, model_name, temperature, max_tokens = LLMConfigService.create_llm_client_for_task(
                site=help_center_config,
                task_type='help_center_public_ai',
                temperature=0.5,
                max_tokens=1500,
            )
            system_prompt = self._get_system_prompt(
                help_center_config,
                has_actions=bool(actions),
                has_auto_run_actions=has_auto_run,
                has_inline_ui_actions=has_inline_ui,
            )

            answer_text = await llm_client.complete_async(
                prompt=f"Question: {query}\n\n{context}",
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            # Extract data for actions that have schemas
            if actions:
                actions = await self._extract_action_data(query, actions, help_center_config)

            # Check if top action is missing required data
            top_action_incomplete = (
                actions and
                actions[0].get('data_incomplete') and
                actions[0].get('score', 0) > 0.6  # High confidence match
            )

            if top_action_incomplete:
                # Generate follow-up question for missing required fields
                missing_descs = actions[0].get('missing_field_descriptions', [])
                action_name = actions[0].get('name', '').replace('_', ' ')
                follow_up = self._generate_followup_question(action_name, missing_descs)
                
                # Return follow-up without action buttons - user needs to provide more info
                return {
                    'success': True,
                    'content': [{'type': 'text', 'text': follow_up}],
                    'isError': False,
                    'structuredContent': {
                        'sources': self._build_sources(results) if results else [],
                        'awaiting_data_for_action': actions[0].get('name'),
                    }
                }

            # Build response
            response = {
                'success': True,
                'content': [{'type': 'text', 'text': answer_text}],
                'isError': False
            }

            # Add sources and actions to structuredContent (for widget rendering)
            # Filter out incomplete actions from the response
            complete_actions = [a for a in actions if not a.get('data_incomplete')]
            sources = self._build_sources(results) if results else []
            structured_content = {}
            if sources:
                structured_content['sources'] = sources
            if complete_actions:
                structured_content['actions'] = complete_actions
            if structured_content:
                response['structuredContent'] = structured_content

            return response

        except Exception as e:
            logger.error(f"Error executing ask tool: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
                'isError': True
            }

    async def execute_stream(
        self,
        help_center_config,
        organization,
        request,
        arguments: Dict[str, Any],
        cancel_event=None,
        language: str = 'en'
    ):
        """
        Execute the ask tool with streaming response.

        Delegates entirely to AgentAnswerServiceReActAsync which handles:
        - Tool-based agentic reasoning loop
        - Dynamic tool selection (search_actions, search_knowledge, create_plan)
        - Multi-step plans with action and guidance steps
        - Direct answers for greetings/off-topic
        
        This tool handles data extraction for actions with schemas.
        Also logs all conversations to the database for analytics.
        """
        import time
        start_time = time.time()
        
        query = arguments.get('query', '')
        images = arguments.get('images', [])
        if not query and not images:
            yield {'type': 'error', 'message': 'A message or image is required'}
            return

        if not help_center_config:
            yield {'type': 'error', 'message': 'Help center context not available'}
            return

        top_k = arguments.get('top_k', 5)
        conversation_id = arguments.get('conversation_id')
        user_context = arguments.get('user_context', [])
        context = arguments.get('context', {})
        # Registered actions from previous turns (for dynamic action tools)
        client_registered_actions = arguments.get('registered_actions', [])
        
        # Extract user_profile from nested context structure
        # SDK sends: { product: Context, user_profile: UserProfile }
        user_profile = None
        if isinstance(context, dict):
            if 'product' in context:
                user_profile = context.get('user_profile', {})
                context = context.get('product', {})
                logger.debug(f"[AskTool] Extracted nested context: product={context}, user_profile={user_profile}")
        
        if user_context:
            logger.info(f"[AskTool] Received user_context with {len(user_context)} item(s)")
        if context:
            logger.info(f"[AskTool] Received context: {context}")
        if user_profile:
            logger.info(f"[AskTool] Received user_profile: {user_profile}")
        
        # Default query for image-only messages
        if not query and images:
            query = "[Image provided]"
        
        logger.info(f"[AskTool] execute_stream called with query='{query[:50]}...', images={len(images) if images else 0}")
        logger.debug(f"[AskTool] Full arguments: {arguments}")

        # Validate images if provided
        logger.debug("[AskTool] Starting image validation")
        validated_images: Optional[List[Dict[str, str]]] = None
        if images:
            if len(images) > 4:
                yield {'type': 'error', 'message': 'Maximum 4 images allowed'}
                return

            validated_images = []
            for idx, img in enumerate(images):
                url = img.get('url', '')
                # In local dev, allow localhost URLs; in production, require GCS signed URLs
                storage_backend = getattr(settings, 'STORAGE_BACKEND', 'local')
                is_localhost_url = url.startswith('http://localhost') or url.startswith('http://127.0.0.1')
                logger.debug(f"[AskTool] Image {idx}: storage_backend={storage_backend}, is_localhost={is_localhost_url}, url={url[:50]}...")
                if storage_backend != 'local' and not is_localhost_url and not _is_valid_gcs_signed_url(url):
                    yield {'type': 'error', 'message': f'Invalid image URL at index {idx}'}
                    return
                validated_images.append({
                    'url': url,
                    'detail': img.get('detail', 'low')
                })
            logger.info(f"[AskTool] Processing {len(validated_images)} image(s)")
        logger.debug("[AskTool] Image validation complete")

        # Extract request metadata for logging
        logger.debug("[AskTool] Extracting request metadata")
        metadata = extract_request_metadata(request) if request else None
        skip_analytics = False
        page_url = ''
        if request:
            # Check for skip_tracking header or query param
            skip_analytics = bool(request.GET.get('skip_tracking') or request.headers.get('X-Skip-Tracking'))
            page_url = request.headers.get('X-Page-Url', '')
        logger.debug(f"[AskTool] Metadata extracted: skip_analytics={skip_analytics}")

        # PRE-GENERATE UUIDs - available at 0ms!
        # conversation_id comes from client (SDK generates for new conversations)
        # Server fallback only for direct API callers without SDK
        conv_id = conversation_id if conversation_id else str(uuid.uuid4())
        user_msg_id = str(uuid.uuid4())
        assistant_msg_id = str(uuid.uuid4())
        
        # Yield conversation_started IMMEDIATELY (before any DB or LLM work)
        yield {
            'type': 'conversation_started',
            'conversation_id': conv_id,
            'assistant_message_id': assistant_msg_id,
        }
        logger.debug(f"[AskTool] Yielded conversation_started: conv={conv_id}, assistant_msg={assistant_msg_id}")

        # Collect response data for logging
        response_tokens: List[str] = []
        sources_retrieved: List[dict] = []
        display_trace: List[dict] = []
        model_used = ''
        
        # DB task reference for parallel write
        db_task: Optional[asyncio.Task] = None

        try:
            # Enrich images with cached summaries before persisting
            from apps.mcp.services.image_summary_service import get_cached_summary
            enriched_images = None
            if validated_images:
                enriched_images = []
                for img in validated_images:
                    enriched = {**img}
                    summary = get_cached_summary(img.get('url', ''))
                    if summary:
                        enriched['summary'] = summary
                    enriched_images.append(enriched)
            
            # Start DB write as BACKGROUND TASK (non-blocking)
            # Creates conversation + user message with pre-generated IDs
            from apps.analytics.services import ConversationLoggingService
            
            db_task = asyncio.create_task(
                ConversationLoggingService().create_conversation_and_user_message(
                    conversation_id=conv_id,
                    user_message_id=user_msg_id,
                    assistant_message_id=assistant_msg_id,
                    organization_id=str(organization.id),
                    product_id=str(help_center_config.id),
                    question=query,
                    images=enriched_images,
                    query_type='ask',
                    page_url=page_url,
                    user_agent=metadata.user_agent if metadata else '',
                    ip_address=metadata.ip_address if metadata else None,
                    referer=metadata.referer if metadata else '',
                    external_session_id=metadata.session_id if metadata else '',
                    skip_analytics=skip_analytics,
                    visitor_id=metadata.visitor_id if metadata else '',
                    external_user_id=metadata.external_user_id if metadata else '',
                )
            )
            logger.debug("[AskTool] Started background DB task for conversation/user/assistant messages")
            
            # Load conversation history from DB (full-fidelity ChatMessage rows)
            logger.debug(f"[AskTool] Loading conversation history from DB for {conv_id}")
            conversation_history = await self._load_conversation_history(conversation_id)
            logger.debug(f"[AskTool] Loaded {len(conversation_history) if conversation_history else 0} history messages from DB")
            
            # Get platform/version for action filtering
            platform, version = self._get_platform_version(request)
            logger.debug(f"[AskTool] Platform={platform}, version={version}")

            # Create agent service - it handles routing internally
            from apps.mcp.services.agent import AgentAnswerServiceReActAsync
            logger.debug("[AskTool] Creating AgentAnswerServiceReActAsync")

            agent_service = AgentAnswerServiceReActAsync(
                help_center_config=help_center_config,
                organization=organization,
                conversation_history=conversation_history,
                registered_actions=client_registered_actions,
                conversation_id=conv_id,
                assistant_message_id=assistant_msg_id,
            )
            logger.debug("[AskTool] Agent service created, starting agent_service.ask_stream")

            # Stream from agent service with all routing handled internally
            # Pass session_id for query action result correlation
            session_id = metadata.session_id if metadata else None
            logger.info(f"[AskTool] session_id for query actions: {session_id[:8] if session_id else 'NONE'}...")
            async for event in agent_service.ask_stream(
                question=query,
                top_k=top_k,
                cancel_event=cancel_event,
                platform=platform,
                version=version,
                user_context=user_context,
                images=validated_images,
                context=context,
                user_profile=user_profile,
                page_url=page_url,
                session_id=session_id,
                language=language,
            ):
                if cancel_event and cancel_event.is_set():
                    break

                event_type = event.get('type', '')

                if event_type == 'token':
                    # Collect tokens for logging
                    response_tokens.append(event.get('text', ''))
                    yield event
                elif event_type == 'sources':
                    # Collect sources for logging
                    sources_retrieved = event.get('sources', [])
                    yield event
                elif event_type == 'actions':
                    # Extract data for actions with schemas before sending
                    actions = event.get('actions', [])
                    if actions:
                        actions = await self._extract_action_data(
                            query, actions, help_center_config
                        )
                        
                        # Check if top action is missing required data
                        top_action = actions[0] if actions else None
                        if top_action and top_action.get('data_incomplete'):
                            missing_descs = top_action.get('missing_field_descriptions', [])
                            action_name = top_action.get('name', '').replace('_', ' ')
                            follow_up = self._generate_followup_question(
                                action_name, missing_descs
                            )
                            yield {'type': 'token', 'text': f"\n\n{follow_up}"}
                            response_tokens.append(f"\n\n{follow_up}")
                            yield {'type': 'awaiting_data', 'action_name': top_action.get('name')}
                        else:
                            # Filter out incomplete actions
                            complete_actions = [
                                a for a in actions if not a.get('data_incomplete')
                            ]
                            if complete_actions:
                                yield {'type': 'actions', 'actions': complete_actions}
                elif event_type == 'plan.created':
                    # Multi-step plan created - pass through to frontend
                    yield event
                elif event_type == 'display_trace':
                    # Legacy: capture display trace for logging (not sent to client)
                    display_trace = event.get('trace', [])
                elif event_type == 'error':
                    yield event
                    return
                elif event_type == 'complete':
                    # Ensure DB task completed so assistant message row exists
                    if db_task:
                        try:
                            await db_task
                            logger.debug("[AskTool] DB task completed successfully")
                        except Exception as e:
                            logger.error(f"[AskTool] Failed to create conversation: {e}")
                    
                    # Yield complete with conversation IDs
                    complete_event = dict(event)
                    complete_event['conversation_id'] = conv_id
                    complete_event['assistant_message_id'] = assistant_msg_id
                    yield complete_event
                else:
                    # Pass through all other events (progress, query_request, etc.)
                    # This ensures new event types from agentic_loop reach the client
                    yield event

        except Exception as e:
            logger.error(f"Error executing ask tool stream: {e}", exc_info=True)
            yield {'type': 'error', 'message': f'Error: {str(e)}'}

    async def _log_conversation(
        self,
        organization_id: str,
        question: str,
        response: str,
        response_time_ms: int,
        chunks_retrieved: list,
        model_used: str,
        conversation_id: str | None = None,
        help_center_id: str | None = None,
        page_url: str = '',
        user_agent: str = '',
        ip_address: str | None = None,
        referer: str = '',
        external_session_id: str = '',
        skip_analytics: bool = False,
        images: List[Dict[str, str]] | None = None,
        display_trace: List[dict] | None = None,
    ) -> tuple[str, str, str]:
        """
        Log conversation to the database using ConversationLoggingService.

        Enriches images with cached summaries before persisting for follow-up questions.

        Returns tuple of (conversation_id, user_message_id, assistant_message_id).
        Returns empty strings if logging fails.
        """
        try:
            from apps.analytics.services import ConversationLoggingService
            from apps.mcp.services.image_summary_service import get_cached_summary

            # Enrich images with cached summaries before persisting
            enriched_images = None
            if images:
                enriched_images = []
                for img in images:
                    enriched = {**img}
                    summary = get_cached_summary(img.get('url', ''))
                    if summary:
                        enriched['summary'] = summary
                    enriched_images.append(enriched)

            service = ConversationLoggingService()
            return await service.log_message(
                organization_id=organization_id,
                question=question,
                response=response,
                response_time_ms=response_time_ms,
                chunks_retrieved=chunks_retrieved,
                model_used=model_used,
                conversation_id=conversation_id,
                query_type='ask',
                help_center_id=help_center_id,
                page_url=page_url,
                user_agent=user_agent,
                ip_address=ip_address,
                referer=referer,
                external_session_id=external_session_id,
                skip_analytics=skip_analytics,
                images=enriched_images,  # Pass enriched images with summaries
                display_trace=display_trace or [],  # Pass display trace
            )
        except Exception as e:
            logger.error(f"[AskTool] Failed to log conversation: {e}", exc_info=True)
            return '', '', ''

    async def _load_conversation_history(
        self,
        conversation_id: str | None,
    ) -> List[Dict[str, Any]]:
        """
        Load conversation history for a follow-up turn.

        Each ChatMessage stores its portion of the LLM conversation in
        llm_message, in standard chat completions format:
        - User messages: single {role: "user", content: "..."} dict
        - Assistant messages: list of message dicts covering the full turn
          (assistant tool_calls + tool results + final assistant response)

        On load, user messages are appended directly, and assistant turn
        message lists are extended into the conversation.

        Args:
            conversation_id: UUID of the conversation

        Returns:
            List of standard chat API message dicts, or [] for new conversations.
        """
        if not conversation_id:
            return []

        try:
            from apps.analytics.models import ChatMessage
            
            messages = []
            
            async for msg in ChatMessage.objects.filter(
                conversation_id=conversation_id
            ).order_by('timestamp'):
                if msg.role == ChatMessage.Role.USER:
                    messages.append({
                        'role': 'user',
                        'content': msg.content,
                    })
                    logger.info(
                        f"[AskTool._load_history] User msg {msg.id}: "
                        f"content_length={len(msg.content)}"
                    )
                elif msg.role == ChatMessage.Role.ASSISTANT:
                    llm_data = msg.llm_message or {}
                    if isinstance(llm_data, dict) and "messages" in llm_data:
                        # New format: dict with messages + registered_actions
                        messages.extend(llm_data["messages"])
                        logger.info(
                            f"[AskTool._load_history] Assistant msg {msg.id}: "
                            f"extended {len(llm_data['messages'])} turn messages"
                        )
                    elif isinstance(llm_data, list) and llm_data:
                        # Legacy list format
                        messages.extend(llm_data)
                        logger.info(
                            f"[AskTool._load_history] Assistant msg {msg.id}: "
                            f"extended {len(llm_data)} turn messages (legacy list)"
                        )
                    else:
                        # Fallback: just use the text content
                        messages.append({
                            'role': 'assistant',
                            'content': msg.content,
                        })
                        logger.info(
                            f"[AskTool._load_history] Assistant msg {msg.id}: "
                            f"fallback to plain content ({len(msg.content)} chars)"
                        )
                # Skip tool-role ChatMessage rows - tool results are stored
                # inside the assistant's llm_message turn list
            
            if messages:
                logger.info(
                    f"[AskTool._load_history] Loaded {len(messages)} messages "
                    f"from conversation {conversation_id}"
                )
                return messages

            return []

        except Exception as e:
            logger.warning(f"[AskTool] Failed to load conversation history: {e}")
            return []

    def _build_context(self, results) -> str:
        """Build context string from article search results."""
        parts = []
        for i, r in enumerate(results, 1):
            title = r.get('title', 'Untitled')
            excerpt = r.get('excerpt', '')
            parts.append(f"## Article {i}: {title}")
            parts.append(excerpt)
            parts.append("")
        return "\n".join(parts)

    def _build_actions_context(self, actions: List[Dict[str, Any]]) -> str:
        """Build context string describing available actions."""
        if not actions:
            return ""

        parts = ["## Available Actions"]
        parts.append("The following actions can be suggested to help the user:")
        parts.append("")

        for action in actions:
            name = action.get('name', '')
            description = action.get('description', '')
            action_type = action.get('action_type', '')
            auto_run = action.get('auto_run', False)
            data_schema = action.get('data_schema', {})
            
            # Make name more readable (open_settings -> Open Settings)
            display_name = name.replace('_', ' ').title()
            auto_run_label = " [AUTO-RUN]" if auto_run else ""
            parts.append(f"- **{display_name}** ({action_type}){auto_run_label}: {description}")
            
            # If action has a data schema, include extraction hints
            if data_schema and data_schema.get('properties'):
                props = data_schema.get('properties', {})
                hints = []
                for prop_name, prop_def in props.items():
                    prop_desc = prop_def.get('description', '')
                    if prop_desc:
                        hints.append(f"  - {prop_name}: {prop_desc}")
                if hints:
                    parts.append("  Data to extract from user message:")
                    parts.extend(hints)

        parts.append("")
        return "\n".join(parts)

    def _build_full_context(
        self,
        results,
        actions: List[Dict[str, Any]],
        knowledge_results: List[Dict[str, Any]] = None,
    ) -> str:
        """Build combined context from articles, knowledge, and actions."""
        parts = []

        # Add article context
        if results:
            parts.append("## Relevant Articles")
            parts.append(self._build_context(results))

        # Add knowledge context (from new Knowledge app)
        if knowledge_results:
            parts.append(self._build_knowledge_context(knowledge_results))

        # Add actions context
        if actions:
            parts.append(self._build_actions_context(actions))

        if not parts:
            parts.append("No relevant articles or actions were found for this query.")

        return "\n".join(parts)

    def _build_knowledge_context(self, knowledge_results: List[Dict[str, Any]]) -> str:
        """Build context string from knowledge search results."""
        if not knowledge_results:
            return ""

        parts = ["## Additional Knowledge"]
        for i, r in enumerate(knowledge_results, 1):
            title = r.get('title', 'Untitled')
            content = r.get('content', '')
            source = r.get('source_name', '')
            url = r.get('url', '')

            source_info = f"[{source}]" if source else ""
            if url:
                source_info += f" ({url})"

            parts.append(f"### {title} {source_info}")
            parts.append(content)
            parts.append("")
        return "\n".join(parts)

    def _build_sources(self, results):
        """Build sources list from search results."""
        return [
            {
                'title': r.get('title', ''),
                'url': r.get('url', ''),
                'excerpt': r.get('excerpt', '')
            }
            for r in results
        ]

    def _get_system_prompt(
        self,
        help_center_config,
        has_actions: bool = False,
        has_auto_run_actions: bool = False,
        has_inline_ui_actions: bool = False,
    ):
        """Build system prompt that guides LLM to use both articles and actions."""
        base_prompt = f"""You are a helpful assistant for {help_center_config.name} Help Center.
Your goal is to help users with their questions in the most useful way possible.

IMPORTANT: Your response is displayed DIRECTLY to the end user in a chat interface.
Write naturally as if speaking to a human. The system handles all technical details separately.

Guidelines:
- Be concise, accurate, and helpful
- If relevant articles are provided, use them to answer the question
- Cite which article(s) you're drawing from when using article content
- NEVER output JSON, code blocks, structured data, or technical metadata - the user cannot use these"""

        if has_inline_ui_actions:
            # For inline_ui actions, a self-explanatory card UI will render
            # The LLM should be very brief - the card explains everything
            base_prompt += """
- An interactive card will appear below your message that lets the user complete their request
- Keep your response to ONE brief sentence (e.g., "I'll help you invite them." or "Here you go:")
- The system automatically handles actions - do NOT output any action data, JSON, or code
- Do NOT repeat emails, names, or other details - they will be shown in the card UI"""
        elif has_auto_run_actions:
            # For auto-run actions, the action executes immediately - no button needed
            base_prompt += """
- An action that matches the user's intent will execute automatically
- For auto-run actions, keep your response very brief or acknowledge what's happening (e.g., "Opening settings now..." or "Done!")
- Don't tell the user to click anything - the action runs automatically"""
        elif has_actions:
            # For manual actions, there will be a button to click
            base_prompt += """
- Actions are provided based on potential relevance to the query
- If an action directly helps the user (like navigating to settings, opening a modal, etc.), mention it naturally
- Actions will appear as clickable buttons below your response - only reference them if they're actually helpful
- If none of the available actions directly address what the user asked for, don't force a suggestion - instead, explain what you CAN help with or acknowledge the limitation
- Don't suggest actions just because they're available - only mention them if they genuinely help"""

        base_prompt += """
- If neither articles nor actions are particularly relevant, acknowledge that and suggest how the user might find what they need
- Don't make up information - only use what's provided in the context"""

        return base_prompt

    def _generate_followup_question(
        self,
        action_name: str,
        missing_descriptions: List[str],
    ) -> str:
        """
        Generate a natural follow-up question for missing required fields.
        
        Args:
            action_name: Human-readable action name (e.g., "invite team member")
            missing_descriptions: List of human-readable field descriptions
        
        Returns:
            Natural language follow-up question
        """
        if not missing_descriptions:
            return "I need a bit more information to proceed. Could you provide more details?"
        
        if len(missing_descriptions) == 1:
            return f"I can help with that! To proceed, could you please provide: {missing_descriptions[0]}?"
        elif len(missing_descriptions) == 2:
            return f"I can help with that! To proceed, I need: {missing_descriptions[0]} and {missing_descriptions[1]}."
        else:
            items = ", ".join(missing_descriptions[:-1])
            last = missing_descriptions[-1]
            return f"I can help with that! To proceed, I need a few things: {items}, and {last}."

    def _get_action_acknowledgment(self, action_name: str) -> str:
        """
        Generate a brief acknowledgment for auto-run actions.
        
        Instead of saying "I can't do that" then doing it, we give a short
        confirmation that we're handling the action request.
        
        Args:
            action_name: Human-readable action name (e.g., "open settings")
        
        Returns:
            Brief acknowledgment string
        """
        # Capitalize first letter for display
        display_name = action_name.lower()
        
        # Generate natural acknowledgment based on action type
        if display_name.startswith('open '):
            target = display_name[5:]  # Remove "open "
            return f"Opening {target}..."
        elif display_name.startswith('go to '):
            target = display_name[6:]  # Remove "go to "
            return f"Taking you to {target}..."
        elif display_name.startswith('navigate to '):
            target = display_name[12:]  # Remove "navigate to "
            return f"Navigating to {target}..."
        elif display_name.startswith('show '):
            target = display_name[5:]  # Remove "show "
            return f"Showing {target}..."
        elif display_name.startswith('view '):
            target = display_name[5:]  # Remove "view "
            return f"Opening {target}..."
        else:
            # Generic acknowledgment
            return f"Got it! Running {display_name}..."

    def _get_platform_version(self, request) -> tuple[str | None, str | None]:
        """
        Extract platform and version from request headers.

        Args:
            request: HTTP request object

        Returns:
            Tuple of (platform, version) - both may be None
        """
        if request is None:
            return None, None

        # Try to get from HTTP headers (Django converts to META format)
        platform = request.META.get('HTTP_X_PILLAR_PLATFORM')
        version = request.META.get('HTTP_X_PILLAR_ACTION_VERSION')

        if platform:
            logger.debug(f"[AskTool] Platform/version from headers: {platform}@{version}")

        return platform, version

    async def _search_knowledge(
        self,
        query: str,
        organization_id: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search the Knowledge app for relevant content.

        Uses the new KnowledgeRAGService to search KnowledgeChunks.

        Args:
            query: User query string
            organization_id: Organization UUID
            top_k: Maximum number of results

        Returns:
            List of result dictionaries with title, content, url, source_name
        """
        try:
            from apps.knowledge.services import KnowledgeRAGService

            rag_service = KnowledgeRAGService(organization_id=organization_id)
            results = rag_service.search(query=query, top_k=top_k)

            return [
                {
                    'title': r.title,
                    'content': r.content,
                    'url': r.url,
                    'source_name': r.source_name,
                    'score': r.score,
                }
                for r in results
            ]

        except Exception as e:
            logger.warning(f"[AskTool] Knowledge search failed: {e}")
            return []

    async def _search_actions(
        self,
        query: str,
        product,
        max_results: int = 5,
        platform: str | None = None,
        version: str | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for matching Actions using smart selection + optional reranking.

        Uses top-k + percentage-of-top strategy instead of hard thresholds.
        Always returns at least min_results actions to give LLM context.

        Args:
            query: User query string
            product: Product instance (from request.help_center_config)
            max_results: Maximum number of actions to return
            platform: Optional platform filter from X-Pillar-Platform header
            version: Optional version filter from X-Pillar-Action-Version header

        Returns:
            List of formatted action dictionaries
        """
        from apps.products.services.action_search_service import action_search_service

        return await action_search_service.search(
            query=query,
            product=product,
            platform=platform,
            version=version,
            max_results=max_results,
        )

    async def _extract_action_data(
        self,
        query: str,
        actions: List[Dict[str, Any]],
        help_center_config,
    ) -> List[Dict[str, Any]]:
        """
        Extract data from user query and populate action data fields.

        Uses LLM to extract structured data based on each action's data_schema.
        Only processes actions that have a data_schema defined.

        Args:
            query: The user's original query
            actions: List of action dictionaries from search
            help_center_config: HelpCenterConfig instance

        Returns:
            Actions with extracted data merged into their data fields
        """
        import json
        from common.utils.llm_config import LLMConfigService
        from common.utils.json_parser import parse_json_from_llm

        # Find actions with data schemas
        actions_with_schema = [
            (i, a) for i, a in enumerate(actions)
            if a.get('data_schema') and a.get('data_schema', {}).get('properties')
        ]

        if not actions_with_schema:
            return actions  # No extraction needed

        logger.info(
            f"[AskTool] Extracting data for {len(actions_with_schema)} actions with schemas"
        )

        # Build extraction prompt for all actions at once
        extraction_prompt = f"""Extract data from this user message for the specified actions.

User message: "{query}"

For each action below, extract the requested data from the user's message.
Return a JSON object where keys are action names and values are the extracted data.

Actions:
"""
        for idx, action in actions_with_schema:
            name = action.get('name')
            schema = action.get('data_schema', {})
            props = schema.get('properties', {})
            required = schema.get('required', [])

            extraction_prompt += f"\n### {name}\n"
            for prop_name, prop_def in props.items():
                prop_type = prop_def.get('type', 'string')
                prop_desc = prop_def.get('description', '')
                is_required = prop_name in required
                req_label = " (required)" if is_required else " (optional)"
                
                # Handle enums
                if 'enum' in prop_def:
                    enum_values = ', '.join(f'"{v}"' for v in prop_def['enum'])
                    extraction_prompt += f"- {prop_name} ({prop_type}, one of: {enum_values}){req_label}: {prop_desc}\n"
                else:
                    extraction_prompt += f"- {prop_name} ({prop_type}){req_label}: {prop_desc}\n"

        extraction_prompt += """
Return ONLY valid JSON in this format:
{
  "action_name": {
    "field1": extracted_value,
    "field2": extracted_value
  }
}

If no data can be extracted for an action, omit it from the response.
For arrays, return an array of values. For emails, extract all email addresses mentioned.
"""

        try:
            llm_client, model_name, _, _ = LLMConfigService.create_llm_client_for_task(
                site=help_center_config,
                task_type='help_center_public_ai',
                temperature=0.1,  # Low temperature for accurate extraction
                max_tokens=500,
            )

            # Add timeout to prevent hanging the stream if LLM is slow
            try:
                extraction_result = await asyncio.wait_for(
                    llm_client.complete_async(
                        prompt=extraction_prompt,
                        system_prompt="You are a precise data extraction assistant. Extract only the data that is clearly present in the user's message. Return valid JSON only.",
                        max_tokens=500,
                        temperature=0.1,
                    ),
                    timeout=15.0,  # 15 second timeout for data extraction
                )
            except asyncio.TimeoutError:
                logger.warning("[AskTool] Data extraction LLM call timed out after 15s")
                return actions  # Return original actions without extracted data

            # Parse the extraction result
            extracted_data = parse_json_from_llm(extraction_result, expected_type="object")

            if not isinstance(extracted_data, dict):
                logger.warning(f"[AskTool] Extraction returned non-dict: {type(extracted_data)}")
                return actions

            logger.info(f"[AskTool] Extracted data: {extracted_data}")

            # Merge extracted data into actions and validate required fields
            for idx, action in enumerate(actions):
                action_name = action.get('name')
                schema = action.get('data_schema', {})
                required_fields = schema.get('required', [])
                properties = schema.get('properties', {})
                
                if action_name in extracted_data:
                    action_data = extracted_data[action_name]
                    if isinstance(action_data, dict):
                        # Merge with existing data (extracted data takes precedence)
                        current_data = action.get('data', {}) or {}
                        merged_data = {**current_data, **action_data}
                        actions[idx]['data'] = merged_data
                        logger.info(
                            f"[AskTool] Merged data for '{action_name}': {merged_data}"
                        )
                
                # Validate required fields
                if required_fields:
                    action_data = actions[idx].get('data', {}) or {}
                    missing = []
                    missing_descriptions = []
                    
                    for field_name in required_fields:
                        value = action_data.get(field_name)
                        # Check if field is missing or empty
                        if value is None or value == '' or (isinstance(value, list) and len(value) == 0):
                            missing.append(field_name)
                            # Get human-readable description for the field
                            prop_def = properties.get(field_name, {})
                            field_desc = prop_def.get('description', field_name.replace('_', ' '))
                            missing_descriptions.append(field_desc)
                    
                    if missing:
                        actions[idx]['data_incomplete'] = True
                        actions[idx]['missing_fields'] = missing
                        actions[idx]['missing_field_descriptions'] = missing_descriptions
                        logger.info(
                            f"[AskTool] Action '{action_name}' missing required fields: {missing}"
                        )

            return actions

        except Exception as e:
            logger.warning(f"[AskTool] Data extraction failed: {e}", exc_info=True)
            return actions  # Return original actions on failure
