"""
Agentic reasoning loop for multi-step query handling.

Implements the tool-based agentic loop that dynamically decides
which tools to call based on query complexity and accumulated context.
"""
import asyncio
import json
import logging
import re
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from opentelemetry import trace, context as otel_context
from opentelemetry.trace import StatusCode

from apps.mcp.services.agent.error_types import is_tool_error
from apps.mcp.services.agent.helpers import log_action_execution
from apps.mcp.services.agent.messages import get_fallback_message
from common.observability.file_exporter import sanitize_attributes
from common.observability.tracing import get_tracer
from apps.mcp.services.agent.streaming_events import (
    emit_search_complete,
    emit_search_start,
    emit_thinking_delta,
    emit_thinking_done,
    emit_thinking_start,
    emit_tool_call_complete,
    emit_tool_call_start,
    format_query_result_summary,
    format_tool_name_for_display,
    emit_debug_iteration,
    emit_debug_tool_call,
    emit_debug_action_found,
    emit_debug_action_execute,
)

logger = logging.getLogger(__name__)

# Configuration constants
RELEVANCE_THRESHOLD = 0.20  # Minimum similarity score (20%) for quality filtering
MAX_RESPONSE_SOURCES = 3  # Maximum number of sources to show the user
MAX_AGENT_ITERATIONS = 100  # Maximum tool calls in agentic loop

# Built-in actions that don't need database lookup
# These are always available to the agent without searching
BUILTIN_ACTIONS = {
    "interact_with_page": {
        "name": "interact_with_page",
        "description": "Interact with elements on the user's current page",
        "action_type": "trigger_action",
        "data_schema": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["click", "type", "select", "focus", "toggle"],
                    "description": "The interaction type",
                },
                "ref": {
                    "type": "string",
                    "description": "Element ref from page scan (e.g., pr-a1)",
                },
                "value": {
                    "type": "string",
                    "description": "Text to type or option to select",
                },
            },
            "required": ["operation", "ref"],
        },
        "auto_run": True,
        "returns_data": False,
    }
}


def validate_query_params(params: dict, schema: dict) -> dict:
    """
    Validate query parameters against an action's data_schema.
    
    Returns a dict with:
    - valid: bool - whether params are valid
    - error: str - error message if invalid
    - expected_params: list - list of expected parameter names
    """
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    
    # If no properties defined, can't validate - allow anything
    if not properties:
        return {"valid": True}
    
    expected_params = list(properties.keys())
    
    # Check required params are present
    missing = [p for p in required if p not in params]
    if missing:
        return {
            "valid": False,
            "error": f"Missing required parameters: {missing}",
            "expected_params": expected_params,
        }
    
    # Check for unknown params (LLM used wrong names)
    unknown = [p for p in params if p not in properties]
    if unknown:
        return {
            "valid": False,
            "error": f"Unknown parameters: {unknown}",
            "expected_params": expected_params,
        }
    
    return {"valid": True, "expected_params": expected_params}


async def _handle_parallel_tool_calls(
    tool_calls: list[dict],
    messages: list[dict],
    agent_context,
    tool_executor,
    service,
    session_id: str,
    display_trace: list[dict],
    iteration: int,
    start_time_ms: int,
    cancel_event,
    question: str,
    format_assistant_tool_calls_message,
    format_tool_result_message_native,
    format_search_result_content,
    format_execute_result_content,
    thinking_text: str = "",
    reasoning_details: list[dict] | None = None,
    conversation_id: str = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Handle parallel tool calls from a single LLM response.
    
    Appends ONE assistant message with all tool_calls, then executes each tool
    sequentially and appends separate tool result messages for each.
    
    Args:
        tool_calls: List of tool_decision dicts from agent_decide_tool_native
        messages: The messages array to append to
        agent_context: AgentContext for accumulating results
        tool_executor: AgentToolExecutor instance
        service: AgentAnswerServiceReActAsync instance
        session_id: Session ID for query result correlation
        display_trace: List to append reasoning trace entries
        iteration: Current iteration number
        start_time_ms: Start timestamp for timing
        cancel_event: Optional cancellation event
        question: Original user question
        format_assistant_tool_calls_message: Message formatter function
        format_tool_result_message_native: Result formatter function
        format_search_result_content: Search result formatter function
        format_execute_result_content: Execute result formatter function
    
    Yields:
        Events for UI updates (search_start, search_complete, tool_call_start, etc.)
    """
    from apps.mcp.services.agent.error_types import is_tool_error
    from apps.mcp.services.agent.streaming_events import (
        emit_search_complete,
        emit_search_start,
        emit_tool_call_complete,
        emit_tool_call_start,
        format_query_result_summary,
        format_tool_name_for_display,
    )
    
    tools_to_process = tool_calls
    
    # 1. Append ONE assistant message with all tool_calls
    messages.append(format_assistant_tool_calls_message(
        [
            {
                "tool_call_id": tc.get("tool_call_id") or f"call_{tc.get('tool')}_{iteration}_{i}",
                "tool_name": tc.get("tool"),
                "arguments": tc.get("arguments", {}),
            }
            for i, tc in enumerate(tools_to_process)
        ],
        reasoning_details=reasoning_details,
    ))
    await _noop_persist()
    
    # 2. Execute each tool sequentially and append results
    # NOTE: We no longer validate tool calls here - native LLM tool calling
    # already validates that the tool exists and parameters match the schema.
    for i, tc in enumerate(tools_to_process):
        tool_name = tc.get("tool", "unknown")
        arguments = tc.get("arguments", {})
        tool_call_id = tc.get("tool_call_id") or f"call_{tool_name}_{iteration}_{i}"
        
        # Handle search tool
        if tool_name == "search":
            query = arguments.get("query", question)
            limit = arguments.get("limit", 5)
            
            search_event = emit_search_start(query)
            search_id = search_event["data"]["id"]
            yield search_event
            
            tool_start = time.time()
            results = await tool_executor.execute_search(query, limit)
            
            actions = results.get("actions", [])
            knowledge = results.get("knowledge", [])
            
            # Add results to context
            if actions:
                agent_context.add_action_results(actions, query)
                # Register discovered actions as native tools for future iterations
                agent_context.register_actions_as_tools(actions)
            if knowledge:
                agent_context.add_knowledge_results(knowledge, query)
                # Unlock get_article tool now that we have knowledge with item_ids
                agent_context.get_article_unlocked = True
            
            # UI sources
            ui_sources = []
            for a in actions:
                ui_sources.append({"title": a.get("name", ""), "url": None})
            for k in knowledge:
                if k.get("url"):
                    ui_sources.append({"title": k.get("title", ""), "url": k.get("url")})
            
            result_count = len(actions) + len(knowledge)
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": "search",
                "kind": "search",
                "label": f"Found {result_count} results for '{query}'",
                "children": [
                    {"id": str(i), "label": s.get("title", ""), "url": s.get("url")}
                    for i, s in enumerate(ui_sources)
                ],
                "query": query,
                "parallel": True,
                "actions_count": len(actions),
                "knowledge_count": len(knowledge),
            })
            
            # Format result message for LLM
            result_content = format_search_result_content(
                query=query,
                actions=actions,
                knowledge=knowledge,
            )
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=result_content,
            ))
            
            yield emit_search_complete(
                search_id,
                len(actions) + len(knowledge),
                ui_sources,
                query=query
            )
        
        # Handle get_article tool
        elif tool_name == "get_article":
            item_id = arguments.get("item_id", "")
            
            if not item_id:
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content="Error: item_id is required",
                ))
                continue
            
            tool_event = emit_tool_call_start("get_article", arguments)
            tool_id = tool_event["data"]["id"]
            yield tool_event
            
            tool_start = time.time()
            result = await tool_executor.execute_get_article(item_id)
            
            is_success = "error" not in result
            if not is_success:
                result_content = f"Error: {result['error']}"
            else:
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content = result.get("content", "")
                result_content = f"Article: {title}"
                if url:
                    result_content += f" ({url})"
                result_content += f"\n\n{content}"
            
            display_name = format_tool_name_for_display("get_article")
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": "get_article",
                "kind": "tool_call",
                "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                "parallel": True,
                "item_id": item_id,
                "arguments": arguments,
                "success": is_success,
            })
            
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=result_content,
            ))
            
            yield emit_tool_call_complete(
                tool_id, "get_article", success=is_success,
                result_summary=f"Retrieved article: {result.get('title', 'Untitled')}" if is_success else result_content,
                arguments=arguments,
            )
        
        # Handle execute tool
        elif tool_name == "execute":
            action_name = arguments.get("action_name", "")
            parameters = arguments.get("parameters", {})
            
            if not action_name:
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content="Error: action_name is required",
                ))
                continue
            
            # Get action from context
            action = agent_context.get_action_by_name(action_name)
            if not action:
                search_results = await tool_executor.execute_search_actions(action_name)
                if search_results and not is_tool_error(search_results):
                    for a in search_results:
                        if a.get("name") == action_name:
                            action = a
                            break
                    if not action and search_results:
                        action = search_results[0]
                    if search_results:
                        agent_context.add_action_results(search_results, action_name)
            
            if not action:
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=f"Action '{action_name}' not found. Use search to find available actions.",
                ))
                continue
            
            # Validate parameters
            if action.get("data_schema"):
                validation_result = validate_query_params(parameters, action["data_schema"])
                if not validation_result["valid"]:
                    error_msg = validation_result["error"]
                    expected = validation_result.get("expected_params", [])
                    hint = f"Expected parameters: {expected}" if expected else ""
                    messages.append(format_tool_result_message_native(
                        tool_call_id=tool_call_id,
                        result_content=f"Parameter validation failed: {error_msg}. {hint}",
                    ))
                    continue
            
            tool_event = emit_tool_call_start(action_name, parameters, reasoning=thinking_text)
            tool_id = tool_event["data"]["id"]
            yield tool_event
            
            # Emit action_request event
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,
                "tool_call_id": tool_call_id,
            }
            
            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result
            
            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )
            wait_duration_ms = int((time.time() - wait_start) * 1000)
            
            if result is None:
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": "execute",
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result",
                    "parallel": True,
                    "action_name": action_name,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=f"Action '{action_name}' timed out after 60s.",
                ))
                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result",
                    arguments=parameters,
                )
            else:
                
                is_success = True
                error_msg = ""
                result_data = result
                
                if isinstance(result, dict):
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)
                
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": "execute",
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "parallel": True,
                    "action_name": action_name,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                })
                
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                
                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
        
        # Handle interact_with_page built-in action (always available)
        elif tool_name == "interact_with_page":
            action_name = tool_name
            parameters = arguments  # Arguments ARE the parameters (no wrapper)
            action = BUILTIN_ACTIONS.get("interact_with_page")
            
            logger.info(f"[AgenticLoop Parallel] Executing built-in action: {action_name}")
            
            tool_event = emit_tool_call_start(action_name, parameters)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            # Emit action_request event
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,
                "tool_call_id": tool_call_id,
            }

            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result

            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )
            wait_duration_ms = int((time.time() - wait_start) * 1000)

            if result is None:
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result",
                    "parallel": True,
                    "is_builtin_action": True,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=f"Action '{action_name}' timed out after 60s.",
                ))
                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result",
                    arguments=parameters,
                )
            else:
                is_success = True
                error_msg = ""
                result_data = result
                dom_snapshot = None
                
                if isinstance(result, dict):
                    # Extract dom_snapshot before processing (for interact_with_page)
                    dom_snapshot = result.pop("dom_snapshot", None)
                    
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)
                
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "parallel": True,
                    "is_builtin_action": True,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                })
                
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                    dom_snapshot=dom_snapshot,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                
                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
        
        # Handle dynamic action tools (discovered actions registered as native tools)
        elif agent_context.is_action_tool(tool_name):
            action_name = tool_name
            parameters = arguments  # Arguments ARE the parameters (no wrapper)
            
            # Get action from registered actions
            action = agent_context.get_action_by_name(action_name)
            if not action:
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=f"Action '{action_name}' not found in registered actions.",
                ))
                continue
            
            logger.info(f"[AgenticLoop Parallel] Executing action tool: {action_name}")
            
            tool_event = emit_tool_call_start(action_name, parameters, reasoning=thinking_text)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            # Emit action_request event
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,
                "tool_call_id": tool_call_id,
            }

            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result

            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )
            wait_duration_ms = int((time.time() - wait_start) * 1000)

            if result is None:
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result",
                    "parallel": True,
                    "is_action_tool": True,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=f"Action '{action_name}' timed out after 60s.",
                ))
                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result",
                    arguments=parameters,
                )
            else:
                
                is_success = True
                error_msg = ""
                result_data = result
                
                if isinstance(result, dict):
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)
                
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "parallel": True,
                    "is_action_tool": True,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                })
                
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                
                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
        
        else:
            # Unknown tool - build list of available tools for error message
            base_tools = ["search", "interact_with_page"]
            action_tool_names = [a.get("name") for a in agent_context.registered_actions]
            all_tools = base_tools + action_tool_names
            logger.warning(f"[AgenticLoop Parallel] Unknown tool: {tool_name}")
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=f"Unknown tool '{tool_name}'. Available tools: {', '.join(all_tools)}",
            ))



async def _append_display_step(
    message_id: str,
    step: dict,
):
    """Append a display step to an existing ChatMessage's display_trace."""
    if not message_id:
        return
    
    from apps.analytics.models import ChatMessage
    
    # Fetch current display_trace, append, and update
    try:
        msg = await ChatMessage.objects.filter(id=message_id).afirst()
        if msg:
            current_trace = msg.display_trace or []
            current_trace.append(step)
            await ChatMessage.objects.filter(id=message_id).aupdate(
                display_trace=current_trace
            )
    except Exception as e:
        logger.warning(f"Failed to append display step: {e}")


async def _noop_persist(*args, **kwargs):
    """No-op placeholder -- persistence is handled by periodic flush in streamable_http."""
    pass


def _build_state_checkpoint(
    messages: list[dict],
    turn_start_idx: int,
    display_trace: list[dict],
    agent_context,
    model_name: str,
) -> dict:
    """Build a state_checkpoint event from current loop state."""
    return {
        "type": "state_checkpoint",
        "llm_messages": messages[turn_start_idx:],
        "display_trace": display_trace,
        "registered_actions": agent_context.registered_actions,
        "model_used": model_name,
        "prompt_tokens": agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else None,
        "completion_tokens": agent_context.token_budget.total_completion_tokens if agent_context.token_budget else None,
        "peak_context_occupancy": round(agent_context.token_budget.peak_occupancy_pct, 2) if agent_context.token_budget else None,
    }


async def run_agentic_loop(
    service,
    question: str,
    top_k: int = 10,
    cancel_event=None,
    platform: str = None,
    version: str = None,
    user_context: list[dict] = None,
    images: list[dict[str, str]] | None = None,
    context: dict = None,
    user_profile: dict = None,
    page_url: str = None,
    session_id: str = None,
    language: str = 'en',
    conversation_history: list[dict] = None,
    registered_actions: list[dict] = None,
    conversation_id: str = None,
    assistant_message_id: str = None,
):
    """
    Tool-based agentic reasoning loop.

    Unlike the legacy _react_loop which searches for actions upfront, this loop
    uses tools to dynamically search for actions and knowledge as needed.

    Enables:
    - Targeted searches per intent (multi-intent queries handled correctly)
    - Natural mixing of knowledge and actions (hybrid queries)
    - Graceful degradation with "guidance" steps when actions don't exist
    - Query actions that fetch data from the client

    Yields display_trace before 'complete' event for analytics.

    Args:
        service: AgentAnswerServiceReActAsync instance
        question: User's question
        top_k: Number of results per search
        cancel_event: Optional cancellation event
        platform: Optional platform filter
        version: Optional version filter
        user_context: Optional user context items
        images: Optional image dicts for vision
        context: Optional user context for action filtering
        user_profile: Optional user profile (name, role, accountType, etc.)
        page_url: Optional current page URL from X-Page-Url header
        session_id: Session ID for query action result correlation
        language: Language code for AI responses (e.g., 'en', 'es', 'fr')
        conversation_history: Previous conversation messages
        registered_actions: Actions from previous turns (persisted by client)

    Yields:
        Event dicts with 'type' key
    """
    # Import here to avoid circular imports
    from apps.mcp.services.agent.answer_generator import generate_answer_stream
    from apps.mcp.services.agent.fast_path import fast_path_handle, is_fast_path_eligible
    from apps.mcp.services.agent_tools.context import AgentContext
    from apps.mcp.services.agent_tools.executor import AgentToolExecutor
    from apps.mcp.services.prompts.capabilities import build_capabilities_summary
    from apps.mcp.services.prompts.environment_context import build_environment_context
    from common.utils.llm_config import LLMConfigService
    from common.utils.token_budget import TokenBudget

    start_time = time.time()
    start_time_ms = int(start_time * 1000)
    display_trace = []
    all_reasoning_details: list[dict] = []  # Accumulated across all LLM turns for DB persistence
    all_thinking_text: str = ""  # Accumulated thinking text across all LLM turns for display
    current_assistant_message_id: str | None = assistant_message_id  # Pre-created by ask.py; enables UPDATE instead of INSERT

    # OpenTelemetry: root span for the agentic loop
    _tracer = get_tracer("pillar.agent")
    run_id = str(uuid.uuid4())
    thread_id = session_id or str(uuid.uuid4())
    widget_id = str(service.help_center_config.id)
    org_id = str(service.organization.id) if service.organization else "unknown"

    _loop_span = _tracer.start_span(
        "agentic_loop",
        attributes={
            "agent.question": question,
            "agent.session_id": session_id or "",
            "agent.thread_id": thread_id,
            "agent.run_id": run_id,
            "agent.conversation_id": conversation_id or "",
            "agent.widget_id": widget_id,
            "agent.org_id": org_id,
        },
    )
    _loop_ctx = trace.set_span_in_context(_loop_span)
    _loop_token = otel_context.attach(_loop_ctx)

    site_context = f"{service.help_center_config.name}"
    site_description = getattr(service.help_center_config, 'description', None)

    # Build environment context from SDK context and user profile
    environment_context = build_environment_context(
        sdk_context=context,
        user_profile=user_profile,
        page_url=page_url,
    )
    if environment_context:
        logger.info(f"[AgenticLoop] Environment context built: {len(environment_context)} chars")

    # Build capabilities summary (cached per-product)
    capabilities_summary = await build_capabilities_summary(service.help_center_config)
    if capabilities_summary:
        logger.info(f"[AgenticLoop] Capabilities summary built: {len(capabilities_summary)} chars")

    # Get product-specific agent guidance
    product_guidance = getattr(service.help_center_config, 'agent_guidance', '') or ''
    if product_guidance:
        logger.info(f"[AgenticLoop] Product guidance loaded: {len(product_guidance)} chars")

    logger.info(f"[AgenticLoop] Starting for question: {question[:100]}...")

    # Fast path check for simple cases
    if is_fast_path_eligible(question):
        fast_result = await fast_path_handle(question, platform, version)
        if fast_result:
            for event in fast_result:
                yield event
            return

    # Initialize context accumulator
    agent_context = AgentContext()
    
    # Detect DOM snapshot in user_context to conditionally enable interact_with_page
    if user_context:
        has_dom = any(item.get('type') == 'dom_snapshot' for item in user_context)
        if has_dom:
            agent_context.has_page_context = True
            logger.info("[AgenticLoop] DOM snapshot detected, interact_with_page tool enabled")
    
    # Restore actions from previous conversation turns
    if registered_actions:
        agent_context.register_actions_as_tools(registered_actions)
        # Also add to found_actions so they're available via get_action_by_name()
        for action in registered_actions:
            if not any(a.get("name") == action.get("name") for a in agent_context.found_actions):
                agent_context.found_actions.append(action)
        logger.info(f"[AgenticLoop] Restored {len(registered_actions)} registered actions from previous turns")
        _loop_span.add_event("actions_registered", {
            "source": "restored_from_previous_turn",
            "action_names": json.dumps([a.get("name", "unknown") for a in registered_actions]),
            "count": len(registered_actions),
        })

    # Initialize token budget tracking
    model_name = getattr(service, 'model_name', None) or 'unknown'
    model_info = LLMConfigService.get_model_info(model_name)
    context_window = model_info.get('context_window', 200000) if model_info else 200000

    token_budget = TokenBudget(
        model_name=model_name,
        context_window=context_window,
    )
    agent_context.token_budget = token_budget
    logger.info(f"[AgenticLoop] Token budget initialized: {context_window:,} token window")

    # Initialize tool executor
    tool_executor = AgentToolExecutor(
        product=service.help_center_config,
        organization=service.organization,
        platform=platform,
        version=version,
    )

    # Build initial messages for multi-turn conversation with native tool calling
    # This is done once at the start - messages grow with each iteration
    from apps.mcp.services.prompts.agentic_prompts import (
        build_agentic_prompt,
        format_assistant_tool_call_message,
        format_assistant_tool_calls_message,
        format_tool_result_message_native,
        format_search_result_content,
        format_execute_result_content,
    )
    from apps.mcp.services.agent.helpers import build_user_context_prompt

    # Merge user_context (e.g., DOM snapshot) into environment context
    full_environment = environment_context or ""
    if user_context:
        user_context_section = build_user_context_prompt(user_context)
        if user_context_section:
            full_environment = f"{full_environment}\n{user_context_section}" if full_environment else user_context_section

    messages = build_agentic_prompt(
        question=question,
        site_context=site_context,
        environment=full_environment,
        capabilities=capabilities_summary,
        product_guidance=product_guidance,
        images=images,
        conversation_history=conversation_history,
        has_page_context=agent_context.has_page_context,
    )

    # Track where this turn's messages start (everything after system + history + user).
    # Used at persist time to extract just this turn's tool interactions for llm_message.
    turn_start_idx = len(messages)

    logger.info(f"[AgenticLoop] Built initial messages: {len(messages)} messages")

    # Log system prompt as span event
    if messages and messages[0].get('role') == 'system':
        _loop_span.add_event("system_prompt", {
            "prompt": messages[0].get('content', ''),
        })

    # Main agentic loop
    _iter_span = None
    for iteration in range(MAX_AGENT_ITERATIONS):
        if cancel_event and cancel_event.is_set():
            _loop_span.set_attribute("agent.status", "CANCELLED")
            _loop_span.set_attribute("agent.total_tokens_prompt", agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0)
            _loop_span.set_attribute("agent.total_tokens_completion", agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0)
            break

        # OTel: span per iteration
        _iter_span = _tracer.start_span(
            f"agentic_loop.iteration",
            context=_loop_ctx,
            attributes={"agent.iteration": iteration + 1},
        )

        logger.info(f"[AgenticLoop] Iteration {iteration + 1}/{MAX_AGENT_ITERATIONS}")

        # Emit debug event for SDK DebugPanel
        yield emit_debug_iteration(iteration + 1, MAX_AGENT_ITERATIONS)

        # Enrich iteration span with context state
        _iter_span.set_attribute("context.found_actions_count", len(agent_context.found_actions))
        _iter_span.set_attribute("context.found_knowledge_count", len(agent_context.found_knowledge))
        _iter_span.set_attribute("context.query_results_count", len(agent_context.query_results))
        _iter_span.set_attribute("context.tool_calls_count", len(agent_context.tool_calls))
        if agent_context.token_budget:
            _iter_span.set_attribute("tokens.used", agent_context.token_budget.total_used)
            _iter_span.set_attribute("tokens.total", agent_context.token_budget.context_window)
            _iter_span.set_attribute("tokens.occupancy_pct", round(agent_context.token_budget.occupancy_pct, 1))

        # Prepare thinking event (only emit when we receive actual thinking content)
        thinking_event = emit_thinking_start()
        thinking_id = thinking_event["data"]["id"]
        thinking_started = False  # Track whether we've emitted thinking_start

        # Agent decides which tool(s) to call using native tool calling
        # Supports parallel tool calls - collect ALL decisions from this LLM turn
        tool_calls = []
        thinking_content = []
        content_tokens: list[str] = []  # Accumulated content tokens from the model

        # Build action tools from registered actions for this iteration
        action_tools = agent_context.get_action_tools()

        _llm_span = _tracer.start_span(
            "llm.tool_decision",
            attributes={"agent.iteration": iteration + 1},
        )

        async for event in agent_decide_tool_native(
            service=service,
            messages=messages,
            context=agent_context,
            iteration=iteration,
            cancel_event=cancel_event,
            extra_tools=action_tools,
        ):
            if event['type'] == 'thinking':
                thinking_text = event.get('content', '')
                thinking_content.append(thinking_text)
                # Only emit thinking_start on first thinking delta
                if not thinking_started:
                    yield thinking_event
                    thinking_started = True
                yield emit_thinking_delta(thinking_id, thinking_text)
            elif event['type'] == 'content_token':
                # Model is writing text directly — stream to frontend
                token_text = event.get('content', '')
                content_tokens.append(token_text)
                # Close thinking before content starts
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
                    thinking_started = False
                yield {"type": "token", "text": token_text}
            elif event['type'] == 'tool_decision':
                tool_calls.append(event)
                # Don't break - collect all tool decisions for parallel support

        # End the LLM decision span
        thinking_text = ''.join(thinking_content)
        if thinking_text:
            _llm_span.set_attribute("llm.thinking", thinking_text)
        if tool_calls:
            _llm_span.set_attribute("llm.tool_calls", json.dumps(
                [{"tool": tc.get("tool"), "id": tc.get("tool_call_id", "")} for tc in tool_calls],
                default=str,
            ))
        _llm_span.end()

        # Determine if the model responded directly (no tool calls, has content)
        final_content = ''.join(content_tokens)
        if not tool_calls and final_content:
            # Model responded directly via content tokens — turn is complete
            logger.info(f"[AgenticLoop] Model responded directly ({len(final_content)} chars)")

            _iter_span.add_event("direct_response", {
                "response.content": final_content,
            })

            # Add final response to display_trace so history replay includes it
            display_trace.append({
                "step_type": "narration",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "content": final_content,
            })

            # Signal thinking step completion
            if thinking_started:
                yield emit_thinking_done(thinking_id)

            # End iteration + loop spans before returning
            if _iter_span:
                _iter_span.set_attribute("agent.direct_response", True)
                _iter_span.end()
            _loop_span.set_attribute("agent.status", "SUCCESS")
            _loop_span.set_attribute("agent.iterations", iteration + 1)
            _loop_span.set_attribute("agent.duration_ms", int((time.time() - start_time) * 1000))
            _loop_span.set_attribute("agent.total_tokens_prompt", agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0)
            _loop_span.set_attribute("agent.total_tokens_completion", agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0)
            _loop_span.end()
            otel_context.detach(_loop_token)

            # Final state checkpoint so flush picks up everything
            yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

            yield {
                "type": "complete",
                "registered_actions": agent_context.registered_actions,
                "display_trace": display_trace,
                "thinking_text": all_thinking_text.strip(),
            }
            return

        # If no tool calls AND no content, fall back to search
        if not tool_calls:
            from apps.mcp.services.agent.recovery import get_smart_default_action
            fallback = get_smart_default_action(
                question=question,
                iteration=iteration,
                found_actions=agent_context.found_actions,
                found_knowledge=agent_context.found_knowledge,
                query_results=agent_context.query_results,
                error_type="empty_stream",
            )
            tool_calls = [{"type": "tool_decision", **fallback}]

        # Extract reasoning_details and thinking_text from the first tool_decision event
        # (attached by agent_decide_tool_native to the first tool_decision)
        turn_reasoning_details = tool_calls[0].get('reasoning_details', []) if tool_calls else []
        if turn_reasoning_details:
            all_reasoning_details.extend(turn_reasoning_details)
        
        turn_thinking_text = tool_calls[0].get('thinking_text', '') if tool_calls else ''
        if turn_thinking_text:
            all_thinking_text += turn_thinking_text + "\n\n"

        # Add thinking to display_trace (unified timeline with thinking interleaved)
        if turn_thinking_text:
            display_trace.append({
                "step_type": "thinking",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "content": turn_thinking_text,
            })

        # Add narration text to display_trace for history replay
        narration_text = ''.join(content_tokens)
        if narration_text:
            display_trace.append({
                "step_type": "narration",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "content": narration_text,
            })

        # Check if we have parallel tool calls
        if len(tool_calls) > 1:
            logger.info(f"[AgenticLoop] Parallel tool calls: {len(tool_calls)} tools")
            
            tool_names = [tc.get("tool", "unknown") for tc in tool_calls]
            
            # Capture decision in reasoning trace
            display_trace.append({
                "step_type": "parallel_tool_decision",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tools": [{"tool": tc.get("tool"), "arguments": tc.get("arguments", {})} for tc in tool_calls],
            })
            
            # Handle parallel tool calls
            async for event in _handle_parallel_tool_calls(
                tool_calls=tool_calls,
                messages=messages,
                agent_context=agent_context,
                tool_executor=tool_executor,
                service=service,
                session_id=session_id,
                display_trace=display_trace,
                iteration=iteration,
                start_time_ms=start_time_ms,
                cancel_event=cancel_event,
                question=question,
                format_assistant_tool_calls_message=format_assistant_tool_calls_message,
                format_tool_result_message_native=format_tool_result_message_native,
                format_search_result_content=format_search_result_content,
                format_execute_result_content=format_execute_result_content,
                thinking_text=thinking_text,
                reasoning_details=turn_reasoning_details,
                conversation_id=conversation_id,
            ):
                yield event
            
            await _noop_persist()
            
            # Signal thinking step completion and continue to next iteration
            if thinking_started:
                yield emit_thinking_done(thinking_id)
            continue

        # Single tool call - use existing logic (backward compatible)
        tool_call = tool_calls[0]
        tool_name = tool_call.get("tool", "unknown")
        arguments = tool_call.get("arguments", {})
        reasoning = tool_call.get("reasoning", "")
        tool_call_id = tool_call.get("tool_call_id", "")

        # Capture decision in reasoning trace
        display_trace.append({
            "step_type": "tool_decision",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "reasoning": reasoning,
            "arguments": arguments,
        })

        logger.info(f"[AgenticLoop] Tool decision: {tool_name} - {reasoning}")

        # Emit debug event for SDK DebugPanel
        yield emit_debug_tool_call(tool_name, arguments)

        # NOTE: We no longer validate tool calls here - native LLM tool calling
        # already validates that the tool exists and parameters match the schema.
        # Dynamic action tools are registered via agent_context.register_actions_as_tools()
        # and passed to the LLM along with base tools.

        # Append assistant message with tool call in native format
        # Include any content tokens the model produced alongside the tool call
        if not tool_call_id:
            tool_call_id = f"call_{tool_name}_{iteration}"
        narration_content = narration_text or None
        messages.append(format_assistant_tool_call_message(
            tool_name=tool_name,
            arguments=arguments,
            tool_call_id=tool_call_id,
            reasoning_details=turn_reasoning_details,
            content=narration_content,
        ))
        await _noop_persist()

        # Handle unified search tool (replaces search_actions + search_knowledge + get_action_details)
        if tool_name == "search":
            query = arguments.get("query", question)
            limit = arguments.get("limit", 5)

            search_event = emit_search_start(query)
            search_id = search_event["data"]["id"]
            yield search_event

            _tool_span = _tracer.start_span(
                "tool.search",
                attributes={"tool.query": query[:200], "tool.limit": limit},
            )

            tool_start = time.time()
            results = await tool_executor.execute_search(query, limit)
            
            actions = results.get("actions", [])
            knowledge = results.get("knowledge", [])
            
            # Add results to context
            if actions:
                agent_context.add_action_results(actions, query)
                # Register discovered actions as native tools for future iterations
                agent_context.register_actions_as_tools(actions)
                logger.info(f"[AgenticLoop] Registered {len(actions)} actions as native tools")
                _iter_span.add_event("actions_registered", {
                    "source": "search",
                    "action_names": json.dumps([a.get("name", "unknown") for a in actions]),
                    "count": len(actions),
                })
            if knowledge:
                agent_context.add_knowledge_results(knowledge, query)
                # Unlock get_article tool now that we have knowledge with item_ids
                agent_context.get_article_unlocked = True
                # Track sources for citation
                for result in knowledge:
                    if result.get("score", 0) >= RELEVANCE_THRESHOLD:
                        url = result.get("url", "")
                        if url:
                            citation_num = service.source_tracker.add_source({
                                "url": url,
                                "title": result.get("title", "Untitled"),
                                "content": result.get("content", ""),
                                "score": result.get("score", 0),
                                "source_type": "article",
                            })
                            result["citation_num"] = citation_num

            _search_duration_ms = int((time.time() - tool_start) * 1000)
            _tool_span.set_attribute("tool.duration_ms", _search_duration_ms)
            _tool_span.set_attribute("tool.actions_count", len(actions))
            _tool_span.set_attribute("tool.knowledge_count", len(knowledge))
            _tool_span.end()

            # Convert results to source format for UI
            ui_sources = []
            for a in actions:
                ui_sources.append({"title": a.get("name", ""), "url": None})
            for k in knowledge:
                if k.get("url"):
                    ui_sources.append({"title": k.get("title", ""), "url": k.get("url")})

            result_count = len(actions) + len(knowledge)
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": "search",
                "kind": "search",
                "label": f"Found {result_count} results for '{query}'",
                "children": [
                    {"id": str(i), "label": s.get("title", ""), "url": s.get("url")}
                    for i, s in enumerate(ui_sources)
                ],
                "query": query,
                "actions_count": len(actions),
                "knowledge_count": len(knowledge),
                "top_action": actions[0].get("name") if actions else None,
                "top_knowledge": knowledge[0].get("title") if knowledge else None,
            })

            # Emit debug events for found actions (for SDK DebugPanel)
            for action in actions:
                yield emit_debug_action_found(
                    action.get("name", "unknown"),
                    action.get("score")
                )

            # Format result message for LLM using native tool result format
            result_content = format_search_result_content(
                query=query,
                actions=actions,
                knowledge=knowledge,
            )
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=result_content,
            ))
            await _noop_persist()
            
            yield emit_search_complete(
                search_id,
                len(actions) + len(knowledge),
                ui_sources,
                query=query
            )

            # Signal thinking step completion
            if thinking_started:
                yield emit_thinking_done(thinking_id)

        # Handle get_article tool (fetch full knowledge article)
        elif tool_name == "get_article":
            item_id = arguments.get("item_id", "")
            
            if not item_id:
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content="Error: item_id is required",
                ))
                await _noop_persist()
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
                continue
            
            logger.info(f"[AgenticLoop] Getting full article: {item_id}")
            
            tool_event = emit_tool_call_start("get_article", arguments)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            _tool_span = _tracer.start_span(
                "tool.get_article",
                attributes={"tool.item_id": item_id},
            )
            
            tool_start = time.time()
            result = await tool_executor.execute_get_article(item_id)

            _article_duration_ms = int((time.time() - tool_start) * 1000)
            is_success = "error" not in result
            _tool_span.set_attribute("tool.duration_ms", _article_duration_ms)
            _tool_span.set_attribute("tool.success", is_success)
            _tool_span.end()
            
            if not is_success:
                result_content = f"Error: {result['error']}"
            else:
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content = result.get("content", "")
                result_content = f"Article: {title}"
                if url:
                    result_content += f" ({url})"
                result_content += f"\n\n{content}"
            
            display_name = format_tool_name_for_display("get_article")
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": "get_article",
                "kind": "tool_call",
                "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                "item_id": item_id,
                "arguments": {"item_id": item_id},
                "success": is_success,
            })
            
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=result_content,
            ))
            await _noop_persist()
            
            yield emit_tool_call_complete(
                tool_id, "get_article", success=is_success,
                result_summary=f"Retrieved article: {result.get('title', 'Untitled')}" if is_success else result_content,
                arguments=arguments,
            )
            
            # Signal thinking step completion
            if thinking_started:
                yield emit_thinking_done(thinking_id)

        # Handle interact_with_page built-in action (always available)
        elif tool_name == "interact_with_page":
            action_name = tool_name
            parameters = arguments  # Arguments ARE the parameters (no wrapper)
            action = BUILTIN_ACTIONS.get("interact_with_page")
            
            logger.info(f"[AgenticLoop] Executing built-in action: {action_name} with params: {parameters}")
            
            tool_event = emit_tool_call_start(action_name, parameters)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            # Emit action_request event to tell SDK to execute the action
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,  # Include full action definition for SDK
                "tool_call_id": tool_call_id,
            }

            _qa_span = _tracer.start_span(
                "query_action.round_trip",
                attributes={"query_action.name": action_name, "query_action.tool_call_id": tool_call_id or ""},
            )

            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result

            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )

            wait_duration_ms = int((time.time() - wait_start) * 1000)
            _qa_span.set_attribute("query_action.wait_ms", wait_duration_ms)

            if result is None:
                # Timeout
                _qa_span.set_attribute("query_action.result", "timeout")
                _qa_span.set_status(StatusCode.ERROR, "Timeout waiting for client result")
                _qa_span.end()

                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result from client",
                    "is_builtin_action": True,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })

                result_content = f"Action '{action_name}' timed out after 60s. The client may be unresponsive."
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result from client",
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
            else:
                # Got result
                _qa_span.set_attribute("query_action.result", "received")
                _qa_span.end()

                # Check if result indicates success or failure
                is_success = True
                error_msg = ""
                result_data = result
                dom_snapshot = None
                
                if isinstance(result, dict):
                    # Extract dom_snapshot before processing (for interact_with_page)
                    dom_snapshot = result.pop("dom_snapshot", None)
                    
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)

                # Format result summary for UI display
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "is_builtin_action": True,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                })

                # Format result for agent using native format
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                    dom_snapshot=dom_snapshot,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)

        # Handle dynamic action tools (discovered actions registered as native tools)
        elif agent_context.is_action_tool(tool_name):
            # This is a registered action - LLM called it directly with native schema
            action_name = tool_name
            parameters = arguments  # Arguments ARE the parameters (no wrapper)
            
            # Get action from registered actions
            action = agent_context.get_action_by_name(action_name)
            if not action:
                # Shouldn't happen since is_action_tool returned True, but handle gracefully
                result_content = f"Action '{action_name}' not found in registered actions."
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
                continue
            
            logger.info(f"[AgenticLoop] Executing action tool: {action_name} with params: {list(parameters.keys()) if parameters else '(none)'}")
            
            tool_event = emit_tool_call_start(action_name, parameters, reasoning=thinking_text)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            # Emit action_request event to tell SDK to execute the action
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,  # Include full action definition for SDK
                "tool_call_id": tool_call_id,
            }

            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result

            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )

            wait_duration_ms = int((time.time() - wait_start) * 1000)

            if result is None:
                # Timeout
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result from client",
                    "is_action_tool": True,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })

                # Log execution to ActionExecutionLog
                await log_action_execution(
                    action_name=action_name,
                    product_id=str(service.help_center_config.id),
                    organization_id=str(service.organization.id) if service.organization else "",
                    session_id=session_id or "",
                    conversation_id=conversation_id,
                    status='failure',
                    error_message='Timeout waiting for result from client',
                    duration_ms=wait_duration_ms,
                    metadata={'source': 'mcp'},
                )

                result_content = f"Action '{action_name}' timed out after 60s. The client may be unresponsive."
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result from client",
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
            else:
                # Got result
                # Check if result indicates success or failure
                is_success = True
                error_msg = ""
                result_data = result
                
                if isinstance(result, dict):
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)

                # Log execution to ActionExecutionLog
                await log_action_execution(
                    action_name=action_name,
                    product_id=str(service.help_center_config.id),
                    organization_id=str(service.organization.id) if service.organization else "",
                    session_id=session_id or "",
                    conversation_id=conversation_id,
                    status='success' if is_success else 'failure',
                    error_message=error_msg,
                    duration_ms=wait_duration_ms,
                    metadata={'source': 'mcp'},
                )

                # Format result summary for UI display
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": action_name,
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "is_action_tool": True,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                    "result_keys": list(result_data.keys()) if isinstance(result_data, dict) else type(result_data).__name__,
                })

                # Format result for agent using native format
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)

        # Handle unified execute tool (LEGACY - kept for backward compatibility)
        # NOTE: This will be removed once dynamic action tools are fully deployed
        elif tool_name == "execute":
            action_name = arguments.get("action_name", "")
            parameters = arguments.get("parameters", {})

            if not action_name:
                result_content = "Error: action_name is required"
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
                continue

            # Check built-in actions first (always available, no search needed)
            action = BUILTIN_ACTIONS.get(action_name)
            
            # If not built-in, get action from context
            if not action:
                action = agent_context.get_action_by_name(action_name)
            
            if not action:
                # Try searching for it
                search_results = await tool_executor.execute_search_actions(action_name)
                if search_results and not is_tool_error(search_results):
                    for a in search_results:
                        if a.get("name") == action_name:
                            action = a
                            break
                    if not action and search_results:
                        action = search_results[0]
                    if search_results:
                        agent_context.add_action_results(search_results, action_name)

            if not action:
                result_content = f"Action '{action_name}' not found. Use search to find available actions."
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
                continue

            # Validate parameters against action's data_schema
            if action.get("data_schema"):
                validation_result = validate_query_params(parameters, action["data_schema"])
                if not validation_result["valid"]:
                    error_msg = validation_result["error"]
                    expected = validation_result.get("expected_params", [])
                    hint = f"Expected parameters: {expected}" if expected else ""
                    
                    logger.warning(f"[AgenticLoop] Parameter validation failed for {action_name}: {error_msg}")
                    
                    result_content = f"Parameter validation failed: {error_msg}. {hint}"
                    messages.append(format_tool_result_message_native(
                        tool_call_id=tool_call_id,
                        result_content=result_content,
                    ))
                    await _noop_persist()
                    if thinking_started:
                        yield emit_thinking_done(thinking_id)
                    continue

            tool_event = emit_tool_call_start(action_name, parameters, reasoning=thinking_text)
            tool_id = tool_event["data"]["id"]
            yield tool_event

            # Emit debug event for SDK DebugPanel
            yield emit_debug_action_execute(action_name)

            # Emit action_request event to tell SDK to execute the action
            yield {
                "type": "action_request",
                "action_name": action_name,
                "parameters": parameters,
                "action": action,  # Include full action definition for SDK
                "tool_call_id": tool_call_id,
            }

            # Wait for result from client
            from apps.mcp.services.agent.helpers import wait_for_query_result

            wait_start = time.time()
            result = await wait_for_query_result(
                session_id=session_id,
                action_name=action_name,
                tool_call_id=tool_call_id,
                timeout=60.0,
                cancel_event=cancel_event,
            )

            wait_duration_ms = int((time.time() - wait_start) * 1000)

            if result is None:
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": "execute",
                    "kind": "tool_call",
                    "label": f"Failed {display_name}",
                    "text": "Timeout waiting for result from client",
                    "action_name": action_name,
                    "arguments": parameters,
                    "success": False,
                    "error": "Timeout",
                })

                result_content = f"Action '{action_name}' timed out after 60s. The client may be unresponsive."
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=False,
                    result_summary="Timeout waiting for result from client",
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)
            else:
                # Check if result indicates success or failure
                is_success = True
                error_msg = ""
                result_data = result
                
                if isinstance(result, dict):
                    if "error" in result:
                        is_success = False
                        error_msg = result.get("error", "Unknown error")
                    elif "success" in result:
                        is_success = result.get("success", True)
                        if not is_success:
                            error_msg = result.get("error", result.get("message", "Action failed"))
                        result_data = result.get("result", result)

                # Format result summary for UI display
                result_summary = format_query_result_summary(result_data if is_success else result)
                display_name = format_tool_name_for_display(action_name)
                display_trace.append({
                    "step_type": "tool_result",
                    "iteration": iteration,
                    "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                    "tool": "execute",
                    "kind": "tool_call",
                    "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
                    "text": result_summary,
                    "action_name": action_name,
                    "arguments": parameters,
                    "success": is_success,
                    "wait_duration_ms": wait_duration_ms,
                    "result_keys": list(result_data.keys()) if isinstance(result_data, dict) else type(result_data).__name__,
                })

                # Format result for agent using native format
                result_content = format_execute_result_content(
                    action_name=action_name,
                    success=is_success,
                    result=result_data if is_success else None,
                    error=error_msg if not is_success else None,
                )
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id,
                    result_content=result_content,
                ))
                await _noop_persist()

                yield emit_tool_call_complete(
                    tool_id, action_name, success=is_success,
                    result_summary=result_summary,
                    arguments=parameters,
                )
                if thinking_started:
                    yield emit_thinking_done(thinking_id)

        else:
            # Unknown tool - build list of available tools for error message
            base_tools = ["search", "interact_with_page"]
            action_tool_names = [a.get("name") for a in agent_context.registered_actions]
            all_tools = base_tools + action_tool_names
            
            logger.warning(f"[AgenticLoop] Unknown tool: {tool_name}")

            # Append tool result as tool message for unknown tool
            result_content = f"Unknown tool '{tool_name}'. Available tools: {', '.join(all_tools)}"
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id or f"call_unknown_{iteration}",
                result_content=result_content,
            ))
            await _noop_persist()

            # Signal thinking step completion for unknown tool
            if thinking_started:
                yield emit_thinking_done(thinking_id)

        # End of iteration -- checkpoint state for periodic flush
        if _iter_span:
            _iter_span.end()
            _iter_span = None
        yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

    # Max iterations reached - generate fallback response
    logger.warning(f"[AgenticLoop] Max iterations ({MAX_AGENT_ITERATIONS}) reached")

    if agent_context.found_knowledge:
        # Generate answer from accumulated knowledge
        sources = [
            {
                "title": k.get("title", ""),
                "url": k.get("url", ""),
                "content": k.get("content", ""),
                "score": k.get("score", 0),
                "citation_num": k.get("citation_num"),
            }
            for k in agent_context.found_knowledge
        ]

        classification = {"qtype": "general", "intent": "exploring", "complexity": "moderate"}
        async for event in generate_answer_stream(
            llm_client=service.llm_client,
            help_center_config=service.help_center_config,
            question=question,
            sources=sources,
            classification=classification,
            site_context=site_context,
            site_description=site_description,
            cancel_event=cancel_event,
            user_context=user_context,
            images=images,
            environment_context=environment_context,
            temperature=service.temperature,
            max_tokens=service.max_tokens,
            language=language,
        ):
            yield event
    else:
        yield {"type": "token", "text": get_fallback_message()}
        yield {"type": "sources", "sources": []}

    # Add token usage summary to reasoning trace
    if agent_context.token_budget and agent_context.token_budget.iteration_history:
        display_trace.append({
            "step_type": "token_summary",
            "total_prompt_tokens": agent_context.token_budget.total_prompt_tokens,
            "total_completion_tokens": agent_context.token_budget.total_completion_tokens,
            "peak_occupancy_pct": round(agent_context.token_budget.peak_occupancy_pct, 2),
            "iterations": len(agent_context.token_budget.iteration_history),
        })

    # End the loop span
    _loop_span.set_attribute("agent.status", "MAX_ITERATIONS")
    _loop_span.set_attribute("agent.iterations", MAX_AGENT_ITERATIONS)
    _loop_span.set_attribute("agent.duration_ms", int((time.time() - start_time) * 1000))
    _loop_span.set_attribute("agent.total_tokens_prompt", agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0)
    _loop_span.set_attribute("agent.total_tokens_completion", agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0)
    _loop_span.end()
    otel_context.detach(_loop_token)

    # Final state checkpoint so flush picks up everything
    yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

    yield {
        "type": "complete",
        "registered_actions": agent_context.registered_actions,
        "display_trace": display_trace,
        "thinking_text": all_thinking_text.strip(),
    }


async def agent_decide_tool_native(
    service,
    messages: list[dict[str, Any]],
    context,  # AgentContext - for token budget tracking
    iteration: int,  # For token budget tracking
    cancel_event=None,
    extra_tools: list[dict] = None,  # Additional tools (discovered actions)
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
    
    # Build the full tool list: base tools (filtered by context) + discovered action tools
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
        
        Args:
            model_override: OpenRouter model path to use instead of the default
            
        Yields:
            Events from the LLM stream (thinking tokens, content tokens, etc.)
            
        Returns:
            Tuple of (all_tool_calls, usage_info) after stream completes
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
            # Check for cancellation - don't retry on cancellation
            if cancel_event and cancel_event.is_set():
                raise asyncio.CancelledError("Operation cancelled by user")
            
            event_type = event.get('type')
            
            if event_type == 'thinking':
                # Forward thinking tokens immediately
                yield {'type': 'thinking', 'content': event.get('content', '')}
            
            elif event_type == 'token':
                # Content tokens - the model is writing text directly to the user.
                # This includes narration between tool calls and the final response.
                content_text = event.get('content', '')
                if content_text:
                    accumulated_content.append(content_text)
                    yield {'type': 'content_token', 'content': content_text}
            
            elif event_type == 'tool_call_delta':
                # Forward argument deltas for streaming consumers
                yield event
            
            elif event_type == 'tool_call':
                # Native tool call from the API - collect for parallel support
                all_tool_calls.append({
                    'tool': event.get('name', 'unknown'),
                    'arguments': event.get('arguments', {}),
                    'tool_call_id': event.get('id', ''),
                })
            
            elif event_type == 'done':
                # Capture usage info for token budget tracking
                usage_info = event.get('usage')
                finish_reason = event.get('finish_reason', 'stop')
                # Capture reasoning_details for passing back on assistant messages
                reasoning_details_for_turn = event.get('reasoning_details', [])
                # Capture thinking_text for storage/display
                thinking_text_for_turn = event.get('thinking_text', '')
                
                # finish_reason == 'stop' with no tool calls means the model
                # responded directly via content tokens — this is the expected
                # turn termination (no respond tool needed).
                if finish_reason == 'stop' and not all_tool_calls:
                    logger.info("[AgenticLoop Native] Model responded directly via content tokens")
        
        # Store results for caller to access via generator return value
        # Since Python generators can't truly return, we yield a special marker
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
        """Process and log token usage after successful stream.
        
        Returns:
            A token_usage event dict to yield to the client, or None if no usage data.
        """
        if all_tool_calls and len(all_tool_calls) > 1:
            logger.info(f"[AgenticLoop Native] Parallel tool calls: {len(all_tool_calls)} tools")
        
        if used_fallback:
            logger.info("[AgenticLoop Native] Fallback model succeeded")
        
        # Log token usage to the context's token budget
        if usage_info and context.token_budget:
            context.token_budget.log_iteration(
                iteration=iteration,
                prompt_tokens=usage_info.get('prompt_tokens', 0),
                completion_tokens=usage_info.get('completion_tokens', 0),
            )
            
            # Warn if approaching context limit
            if context.token_budget.should_compact:
                logger.warning(
                    f"[AgenticLoop Native] Context at {context.token_budget.occupancy_pct:.1f}% "
                    f"({context.token_budget.total_used:,}/{context.token_budget.context_window:,} tokens)"
                )
            
            # Return token_usage event for streaming to client
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
    
    # Try with primary model first
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
        # User cancelled - don't retry, just return
        logger.info("[AgenticLoop Native] Operation cancelled by user")
        return
    
    except Exception as e:
        # Primary model failed - try fallback
        primary_model = getattr(service, 'model_name', 'unknown')
        
        # Get fallback model (Google flagship)
        try:
            fallback_model_name = LLMConfigService.get_model('google', 'flagship')
            fallback_model_info = LLMConfigService.get_model_info(fallback_model_name)
            fallback_openrouter = fallback_model_info.get('openrouter_model') if fallback_model_info else None
        except Exception:
            fallback_openrouter = None
        
        if not fallback_openrouter:
            # Can't get fallback model, yield error content directly
            logger.error(f"[AgenticLoop Native] Tool calling error and no fallback available: {e}", exc_info=True)
            yield {'type': 'content_token', 'content': "I encountered an error. Please try again."}
            return
        
        logger.warning(
            f"[AgenticLoop Native] Tool calling failed with {primary_model}, "
            f"retrying with fallback: {fallback_openrouter}. Error: {e}"
        )
        
        # Retry with fallback model
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
            # Both primary and fallback failed
            logger.error(
                f"[AgenticLoop Native] Fallback also failed: {fallback_error}",
                exc_info=True
            )
            yield {'type': 'content_token', 'content': "I encountered an error. Please try again."}
            return
    
    # Process results and yield tool decisions
    token_usage_event = process_stream_results(all_tool_calls, usage_info, used_fallback)
    if token_usage_event:
        yield token_usage_event
    
    if all_tool_calls:
        # Get model name for logging
        current_model = service.llm_client.get_current_model() if hasattr(service.llm_client, 'get_current_model') else 'unknown'
        
        for i, tc in enumerate(all_tool_calls):
            yield {
                'type': 'tool_decision',
                'tool': tc['tool'],
                'arguments': tc['arguments'],
                'reasoning': '',  # Not available in native tool calling
                'tool_call_id': tc['tool_call_id'],
                # Attach reasoning_details and thinking_text to the first tool_decision
                # so the main loop can capture them once for the assistant message.
                'reasoning_details': reasoning_details_for_turn if i == 0 else [],
                'thinking_text': thinking_text_for_turn if i == 0 else '',
            }
