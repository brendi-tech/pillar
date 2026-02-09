"""
Answer generation with streaming support.

Provides the final answer generation using accumulated sources,
with support for multimodal (image) inputs.
"""
import logging
from typing import Any, Dict, List, Optional

from apps.mcp.services.agent.streaming_buffer import StreamingSourcesBuffer
from apps.mcp.services.agent.helpers import build_user_context_prompt

logger = logging.getLogger(__name__)


async def generate_answer_stream(
    llm_client,
    help_center_config,
    question: str,
    sources: List[Dict],
    classification: Dict[str, Any],
    site_context: str,
    site_description: str = None,
    cancel_event=None,
    user_context: List[Dict] = None,
    images: Optional[List[Dict[str, str]]] = None,
    environment_context: str = "",
    temperature: float = 1.0,
    max_tokens: int = 2000,
    language: str = 'en',
    conversation_history: List[Dict] = None,
):
    """
    Generate final answer with streaming using accumulated sources.
    
    If images are provided, uses multimodal streaming with vision model.
    
    Args:
        llm_client: LLM client for generation
        help_center_config: HelpCenterConfig instance
        question: User's question
        sources: List of source dicts with content
        classification: Question classification dict
        site_context: Site name/description
        site_description: Optional site description
        cancel_event: Optional cancellation event
        user_context: Optional user context items
        images: Optional image dicts for vision
        environment_context: Formatted environment context (user's page, role, etc.)
        temperature: LLM temperature
        max_tokens: Max tokens for response
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')
        conversation_history: Previous conversation messages for multi-turn context
    
    Yields:
        Event dicts with 'type' key:
        - {'type': 'thinking', 'content': '...'} - LLM reasoning/thinking tokens
        - {'type': 'token', 'text': '...'} - Response content tokens
        - {'type': 'sources', 'sources': [...]} - Cited sources at end
        - {'type': 'error', 'message': '...'} - Error occurred
    """
    # Import here to avoid circular imports
    from apps.mcp.services.prompts import (
        get_agent_system_prompt,
        build_dynamic_instructions,
        format_sources_for_prompt,
        format_conversation_history,
    )
    
    # Note: Progress events are no longer emitted here.
    # The caller (agentic_loop) handles step lifecycle.
    
    # Get personality from config
    personality = 'professional'
    if hasattr(help_center_config, 'settings'):
        settings_dict = help_center_config.settings or {}
        personality = settings_dict.get('personality', {}).get('preset', 'professional')
    
    # Build system prompt
    system_prompt = get_agent_system_prompt(
        site_context=site_context,
        personality=personality,
        site_description=site_description,
        language=language,
    )
    
    # Build dynamic instructions based on classification
    instructions = build_dynamic_instructions(
        site_context=site_context,
        classification=classification,
    )
    
    # Format sources for prompt
    formatted_sources = format_sources_for_prompt(sources)
    
    # Build user context section if provided
    user_context_section = build_user_context_prompt(user_context) if user_context else ""
    
    # Build environment context section if provided
    environment_section = ""
    if environment_context:
        environment_section = f"\n=== USER CONTEXT ===\n{environment_context}\n"
    
    # Build conversation history section for multi-turn context
    conversation_section = ""
    if conversation_history:
        formatted_history = format_conversation_history(conversation_history)
        if formatted_history:
            conversation_section = f"\n=== CONVERSATION HISTORY ===\n{formatted_history}\n"
    
    # Build final prompt
    answer_prompt = f"""{instructions}
{environment_section}
{conversation_section}
=== SOURCES ===
{formatted_sources}
{user_context_section}
=== QUESTION ===
{question}

Answer the question using the sources above. Be direct and helpful.
If user context is provided above, consider it when answering (e.g., reference their current page or help with their error).
If conversation history is provided, consider it for context on what the user is referring to.

After your answer, on a new line, list which source numbers you actually used:
SOURCES_USED: 1, 2 (or SOURCES_USED: none if you didn't use any)"""

    # Stream the answer - use multimodal if images provided
    sources_buffer = StreamingSourcesBuffer()
    
    try:
        if images:
            # Use multimodal streaming for vision capabilities
            logger.info(f"[ReAct] Using multimodal streaming with {len(images)} image(s)")
            stream = llm_client.complete_stream_multimodal(
                prompt=answer_prompt,
                images=images,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                cancel_event=cancel_event,
            )
        else:
            # Use standard text streaming
            stream = llm_client.stream_complete_async(
                prompt=answer_prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        
        async for chunk in stream:
            if cancel_event and cancel_event.is_set():
                break
            
            chunk_type = chunk.get('type', '')
            if chunk_type == 'thinking':
                # Forward thinking/reasoning tokens for UI display
                thinking_text = chunk.get('content', '')
                if thinking_text:
                    yield {"type": "thinking", "content": thinking_text}
            elif chunk_type == 'token':
                text = chunk.get('content', '')
                to_stream = sources_buffer.process_token(text)
                if to_stream:
                    yield {"type": "token", "text": to_stream}
            elif chunk_type == 'error':
                yield {"type": "error", "message": chunk.get('error', 'Unknown error')}
                return
        
        # Flush remaining buffer
        remaining = sources_buffer.flush()
        if remaining:
            yield {"type": "token", "text": remaining}
        
        # Get cited sources
        cited_numbers = sources_buffer.get_sources_used()
        cited_sources = []
        for s in sources:
            if s.get('citation_num') in cited_numbers:
                cited_sources.append({
                    'title': s.get('title', ''),
                    'url': s.get('url', ''),
                    'excerpt': s.get('content', ''),
                })
        
        yield {"type": "sources", "sources": cited_sources}
        
    except Exception as e:
        logger.error(
            f"[ReAct] Answer generation error: {e}",
            exc_info=True,
            extra={
                "event_type": "answer_generation_error",
                "error": str(e)[:200],
            }
        )
        # Provide a user-friendly error message instead of raw exception
        yield {
            "type": "error",
            "message": "I encountered an issue generating a response. Please try rephrasing your question."
        }


async def analyze_image_detailed(
    llm_client,
    image: Dict[str, str],
    focus: str,
    question: str,
) -> str:
    """
    Perform detailed analysis of a specific image with a focus area.

    Called when agent uses VIEW_IMAGE action to get more detail than
    the cached summary provides.
    
    Args:
        llm_client: LLM client for analysis
        image: Image dict with 'url' and optional 'detail'
        focus: What to focus on in the image
        question: User's original question
    
    Returns:
        Analysis text
    """
    from common.utils.llm_config import LLMConfigService

    analysis_prompt = f"""Analyze this image in detail, focusing on: {focus}

The user's question is: "{question}"

Provide a detailed analysis that helps answer their question. Include:
- Specific text, numbers, or data you can see
- UI elements, error messages, or status indicators
- Any relevant details that relate to the user's question

Be thorough but concise."""

    from common.utils.llm_resilience import resilient_complete
    
    try:
        vision_model = LLMConfigService.get_vision_model()
        
        # Use resilient completion with retry
        result = await resilient_complete(
            llm_client=llm_client,
            prompt=analysis_prompt,
            system_prompt="You are an expert image analyst helping to answer user questions.",
            max_tokens=500,
            temperature=0.2,
            max_retries=1,
            timeout=30.0,
            context={"question": question},
            model=vision_model,
            images=[image],
        )
        
        if result.success and result.content:
            return result.content.strip()
        else:
            logger.warning(
                f"[ReAct] Image analysis LLM failed: {result.original_error}",
                extra={"event_type": "image_analysis_llm_failed"}
            )
            return "I can see the image but encountered an issue analyzing it in detail. Please describe what you'd like me to focus on."
            
    except Exception as e:
        logger.error(
            f"[ReAct] Image analysis failed: {e}",
            extra={"event_type": "image_analysis_error"}
        )
        return "I encountered an issue analyzing the image. Please try again or describe what you see."
