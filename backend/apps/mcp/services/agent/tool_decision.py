"""
LLM tool decision logic for the agentic loop.

Handles streaming tool calls from the LLM with automatic model fallback.
Extracted from agentic_loop.py to keep the main loop focused on orchestration.
"""
import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any

logger = logging.getLogger(__name__)


async def agent_decide_tool_native(
    service,
    messages: list[dict[str, Any]],
    context,  # AgentContext - for token budget tracking
    iteration: int,
    cancel_event=None,
    extra_tools: list[dict] = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Native tool calling version of agent_decide_tool_stream.
    
    Uses OpenRouter's native tool calling API instead of JSON extraction.
    This eliminates JSON parsing failures and provides structured tool calls directly.
    
    Supports parallel tool calls: when the model returns multiple tool calls in one
    response, all are collected and yielded as separate tool_decision events.
    
    Includes automatic fallback: if the primary model fails, retries with Google's
    flagship model (Gemini 3 Pro) as a reliable fallback.
    
    Args:
        service: AgentAnswerServiceReActAsync instance
        messages: Full conversation history (system + user + assistant + tool messages)
        context: AgentContext for token budget tracking
        iteration: Current iteration number (for token budget tracking)
        cancel_event: Optional cancellation event
        extra_tools: Additional tools from discovered actions (dynamic action tools)
    
    Yields:
        {'type': 'thinking', 'content': '...'} - Reasoning tokens as they stream
        {'type': 'tool_decision', 'tool': '...', 'arguments': {...}, 'tool_call_id': '...'} - Tool decision(s)
    """
    from common.utils.llm_config import LLMConfigService
    
    base_tools = context.get_base_tools()
    if extra_tools:
        tools = base_tools + extra_tools
        logger.debug(f"[AgenticLoop Native] Using {len(base_tools)} base + {len(extra_tools)} action tools")
    else:
        tools = base_tools
    
    async def stream_tool_calls_with_model(
        model_override: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], tuple[list[dict], dict | None]]:
        """
        Stream tool calls from the LLM, optionally overriding the model.
        
        Yields events from the LLM stream, then a _stream_complete marker
        with collected tool calls and usage info.
        """
        usage_info = None
        all_tool_calls = []
        accumulated_content: list[str] = []
        reasoning_details_for_turn: list[dict] = []
        thinking_text_for_turn: str = ""
        
        async for event in service.llm_client.stream_complete_with_tools_async(
            messages=messages,
            tools=tools,
            tool_choice="auto",
            reasoning_effort="high",
            temperature=0.2,
            model=model_override,
            cancel_event=cancel_event,
        ):
            if cancel_event and cancel_event.is_set():
                raise asyncio.CancelledError("Operation cancelled by user")
            
            event_type = event.get('type')
            
            if event_type == 'thinking':
                yield {'type': 'thinking', 'content': event.get('content', '')}
            
            elif event_type == 'token':
                content_text = event.get('content', '')
                if content_text:
                    accumulated_content.append(content_text)
                    yield {'type': 'content_token', 'content': content_text}
            
            elif event_type == 'tool_call_delta':
                yield event
            
            elif event_type == 'tool_call':
                all_tool_calls.append({
                    'tool': event.get('name', 'unknown'),
                    'arguments': event.get('arguments', {}),
                    'tool_call_id': event.get('id', ''),
                })
            
            elif event_type == 'done':
                usage_info = event.get('usage')
                finish_reason = event.get('finish_reason', 'stop')
                reasoning_details_for_turn = event.get('reasoning_details', [])
                thinking_text_for_turn = event.get('thinking_text', '')
                
                if finish_reason == 'stop' and not all_tool_calls:
                    logger.info("[AgenticLoop Native] Model responded directly via content tokens")
        
        yield {
            'type': '_stream_complete',
            'tool_calls': all_tool_calls,
            'accumulated_content': ''.join(accumulated_content),
            'usage': usage_info,
            'reasoning_details': reasoning_details_for_turn,
            'thinking_text': thinking_text_for_turn,
        }
    
    def process_stream_results(
        all_tool_calls: list[dict],
        usage_info: dict | None,
        used_fallback: bool = False,
    ) -> dict | None:
        """Process and log token usage after successful stream."""
        if all_tool_calls:
            tool_names = [tc.get('tool', '?') for tc in all_tool_calls]
            logger.info(f"[AgenticLoop] Tool calls: {', '.join(tool_names)}")
        
        if used_fallback:
            logger.info("[AgenticLoop Native] Fallback model succeeded")
        
        if usage_info and context.token_budget:
            context.token_budget.log_iteration(
                iteration=iteration,
                prompt_tokens=usage_info.get('prompt_tokens', 0),
                completion_tokens=usage_info.get('completion_tokens', 0),
            )
            logger.info(
                f"[AgenticLoop] Tokens: {usage_info.get('prompt_tokens', 0):,}p "
                f"+ {usage_info.get('completion_tokens', 0):,}c "
                f"= {usage_info.get('prompt_tokens', 0) + usage_info.get('completion_tokens', 0):,}t"
            )
            
            if context.token_budget.should_compact:
                logger.warning(
                    f"[AgenticLoop Native] Context at {context.token_budget.occupancy_pct:.1f}% "
                    f"({context.token_budget.total_used:,}/{context.token_budget.context_window:,} tokens)"
                )
            
            return {
                "type": "token_usage",
                "data": {
                    "prompt_tokens": usage_info.get('prompt_tokens', 0),
                    "completion_tokens": usage_info.get('completion_tokens', 0),
                    "total_prompt_tokens": context.token_budget.total_prompt_tokens,
                    "total_completion_tokens": context.token_budget.total_completion_tokens,
                    "total_used": context.token_budget.total_used,
                    "context_window": context.token_budget.context_window,
                    "occupancy_pct": round(context.token_budget.occupancy_pct, 2),
                    "model_name": context.token_budget.model_name,
                    "iteration": iteration,
                }
            }
        
        return None
    
    all_tool_calls = []
    accumulated_content = ""
    usage_info = None
    reasoning_details_for_turn: list[dict] = []
    thinking_text_for_turn: str = ""
    used_fallback = False
    
    try:
        async for event in stream_tool_calls_with_model():
            if event.get('type') == '_stream_complete':
                all_tool_calls = event.get('tool_calls', [])
                accumulated_content = event.get('accumulated_content', '')
                usage_info = event.get('usage')
                reasoning_details_for_turn = event.get('reasoning_details', [])
                thinking_text_for_turn = event.get('thinking_text', '')
            else:
                yield event
    
    except asyncio.CancelledError:
        logger.info("[AgenticLoop Native] Operation cancelled by user")
        return
    
    except Exception as e:
        primary_model = getattr(service, 'model_name', 'unknown')
        
        try:
            fallback_model_name = LLMConfigService.get_model('google', 'flagship')
            fallback_model_info = LLMConfigService.get_model_info(fallback_model_name)
            fallback_openrouter = fallback_model_info.get('openrouter_model') if fallback_model_info else None
        except Exception:
            fallback_openrouter = None
        
        if not fallback_openrouter:
            logger.error(f"[AgenticLoop Native] Tool calling error and no fallback available: {e}", exc_info=True)
            yield {'type': 'content_token', 'content': "I encountered an error. Please try again."}
            return
        
        logger.warning(
            f"[AgenticLoop Native] Tool calling failed with {primary_model}, "
            f"retrying with fallback: {fallback_openrouter}. Error: {e}"
        )
        
        try:
            used_fallback = True
            async for event in stream_tool_calls_with_model(model_override=fallback_openrouter):
                if event.get('type') == '_stream_complete':
                    all_tool_calls = event.get('tool_calls', [])
                    accumulated_content = event.get('accumulated_content', '')
                    usage_info = event.get('usage')
                    reasoning_details_for_turn = event.get('reasoning_details', [])
                    thinking_text_for_turn = event.get('thinking_text', '')
                else:
                    yield event
        
        except asyncio.CancelledError:
            logger.info("[AgenticLoop Native] Operation cancelled during fallback")
            return
        
        except Exception as fallback_error:
            logger.error(
                f"[AgenticLoop Native] Fallback also failed: {fallback_error}",
                exc_info=True
            )
            yield {'type': 'content_token', 'content': "I encountered an error. Please try again."}
            return
    
    token_usage_event = process_stream_results(all_tool_calls, usage_info, used_fallback)
    if token_usage_event:
        yield token_usage_event
    
    if all_tool_calls:
        current_model = service.llm_client.get_current_model() if hasattr(service.llm_client, 'get_current_model') else 'unknown'
        
        for i, tc in enumerate(all_tool_calls):
            yield {
                'type': 'tool_decision',
                'tool': tc['tool'],
                'arguments': tc['arguments'],
                'reasoning': '',
                'tool_call_id': tc['tool_call_id'],
                'reasoning_details': reasoning_details_for_turn if i == 0 else [],
                'thinking_text': thinking_text_for_turn if i == 0 else '',
            }
