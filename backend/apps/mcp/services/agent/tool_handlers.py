"""
Tool execution handlers for the agentic loop.

Each handler is an async generator that yields SSE events and appends
tool-result messages to the conversation. Extracted from the single-tool
path in agentic_loop.py so that both single and parallel tool calls share
one code path with full observability (OTel spans, log_action_execution,
citation tracking, debug events).
"""
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from opentelemetry.trace import StatusCode

from apps.mcp.services.agent.error_types import is_tool_error
from apps.mcp.services.agent.helpers import log_action_execution, wait_for_query_result
from apps.mcp.services.agent.streaming_events import (
    emit_debug_action_execute,
    emit_debug_action_found,
    emit_search_complete,
    emit_search_start,
    emit_tool_call_complete,
    emit_tool_call_start,
    format_query_result_summary,
    format_tool_name_for_display,
)
from apps.mcp.services.prompts.agentic_prompts import (
    format_execute_result_content,
    format_search_result_content,
    format_tool_result_message_native,
)
from common.observability.tracing import get_tracer

logger = logging.getLogger(__name__)

RELEVANCE_THRESHOLD = 0.20

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


async def execute_search(
    *,
    messages: list[dict],
    agent_context: Any,
    tool_executor: Any,
    service: Any,
    session_id: str = "",
    display_trace: list[dict],
    iteration: int,
    start_time_ms: int,
    cancel_event: Any = None,
    conversation_id: str | None = None,
    tracer: Any,
    iter_span: Any,
    tool_call_id: str,
    arguments: dict,
    question: str,
) -> AsyncGenerator[dict, None]:
    """Execute a search tool call with full observability."""
    query = arguments.get("query", question)
    limit = arguments.get("limit", 5)

    search_event = emit_search_start(query)
    search_id = search_event["data"]["id"]
    yield search_event

    _tool_span = tracer.start_span(
        "tool.search",
        attributes={"tool.query": query[:200], "tool.limit": limit},
    )

    tool_start = time.time()
    results = await tool_executor.execute_search(query, limit)

    actions = results.get("actions", [])
    knowledge = results.get("knowledge", [])

    if actions:
        agent_context.add_action_results(actions, query)
        agent_context.register_actions_as_tools(actions)
        logger.info(f"[AgenticLoop] Registered {len(actions)} actions as native tools")
        iter_span.add_event("actions_registered", {
            "source": "search",
            "action_names": json.dumps([a.get("name", "unknown") for a in actions]),
            "count": len(actions),
        })
    if knowledge:
        agent_context.add_knowledge_results(knowledge, query)
        agent_context.get_article_unlocked = True
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

    for action in actions:
        yield emit_debug_action_found(
            action.get("name", "unknown"),
            action.get("score")
        )

    result_content = format_search_result_content(
        query=query,
        actions=actions,
        knowledge=knowledge,
    )
    messages.append(format_tool_result_message_native(
        tool_call_id=tool_call_id,
        result_content=result_content,
    ))
    logger.info(f"[AgenticLoop] search -> OK: {len(actions)} actions, {len(knowledge)} knowledge items")

    yield emit_search_complete(
        search_id,
        len(actions) + len(knowledge),
        ui_sources,
        query=query
    )


async def execute_get_article(
    *,
    messages: list[dict],
    tool_executor: Any,
    display_trace: list[dict],
    iteration: int,
    start_time_ms: int,
    tracer: Any,
    tool_call_id: str,
    arguments: dict,
) -> AsyncGenerator[dict, None]:
    """Execute a get_article tool call with full observability."""
    item_id = arguments.get("item_id", "")

    if not item_id:
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content="Error: item_id is required",
        ))
        return

    logger.info(f"[AgenticLoop] Getting full article: {item_id}")

    tool_event = emit_tool_call_start("get_article", arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    _tool_span = tracer.start_span(
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
    logger.info(
        f"[AgenticLoop] get_article -> {'OK' if is_success else 'ERROR'}: "
        f"{result.get('title', 'Untitled') if is_success else result_content[:300]}"
    )

    yield emit_tool_call_complete(
        tool_id, "get_article", success=is_success,
        result_summary=f"Retrieved article: {result.get('title', 'Untitled')}" if is_success else result_content,
        arguments=arguments,
    )


async def execute_client_action(
    *,
    messages: list[dict],
    service: Any,
    session_id: str,
    display_trace: list[dict],
    iteration: int,
    start_time_ms: int,
    cancel_event: Any,
    conversation_id: str | None,
    tracer: Any,
    tool_call_id: str,
    action_name: str,
    parameters: dict,
    action: dict,
    thinking_text: str = "",
) -> AsyncGenerator[dict, None]:
    """
    Unified handler for all client-side action types.

    Covers interact_with_page, dynamic action tools, and legacy execute —
    they all follow the same emit -> request -> wait -> process pattern.
    """
    tool_event = emit_tool_call_start(action_name, parameters, reasoning=thinking_text)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    yield emit_debug_action_execute(action_name)

    yield {
        "type": "action_request",
        "action_name": action_name,
        "parameters": parameters,
        "action": action,
        "tool_call_id": tool_call_id,
    }

    _qa_span = tracer.start_span(
        "query_action.round_trip",
        attributes={
            "query_action.name": action_name,
            "query_action.tool_call_id": tool_call_id or "",
        },
    )

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
        _qa_span.set_attribute("query_action.result", "timeout")
        _qa_span.set_status(StatusCode.ERROR, "Timeout waiting for client result")
        _qa_span.end()

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

        display_name = format_tool_name_for_display(action_name)
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": action_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": "Timeout waiting for result from client",
            "arguments": parameters,
            "success": False,
            "error": "Timeout",
        })

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=f"Action '{action_name}' timed out after 60s. The client may be unresponsive.",
        ))
        logger.warning(f"[AgenticLoop] {action_name} -> TIMEOUT after 60s")

        yield emit_tool_call_complete(
            tool_id, action_name, success=False,
            result_summary="Timeout waiting for result from client",
            arguments=parameters,
        )
        return

    # Got result
    _qa_span.set_attribute("query_action.result", "received")
    _qa_span.end()

    is_success = True
    error_msg = ""
    result_data = result
    dom_snapshot = None

    if isinstance(result, dict):
        if action_name == "interact_with_page":
            dom_snapshot = result.pop("dom_snapshot", None)

        if "error" in result:
            is_success = False
            error_msg = result.get("error", "Unknown error")
        elif "success" in result:
            is_success = result.get("success", True)
            if not is_success:
                error_msg = result.get("error", result.get("message", "Action failed"))
            result_data = result.get("result", result)

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
        "arguments": parameters,
        "success": is_success,
        "wait_duration_ms": wait_duration_ms,
        "result_keys": list(result_data.keys()) if isinstance(result_data, dict) else type(result_data).__name__,
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
    logger.info(f"[AgenticLoop] {action_name} -> {'OK' if is_success else 'ERROR'}: {result_summary[:300]}")

    yield emit_tool_call_complete(
        tool_id, action_name, success=is_success,
        result_summary=result_summary,
        arguments=parameters,
    )


def resolve_execute_action(
    *,
    messages: list[dict],
    agent_context: Any,
    tool_executor: Any,
    tool_call_id: str,
    arguments: dict,
) -> tuple[str, dict, dict] | None:
    """
    Pre-process legacy 'execute' tool call.

    Resolves the action from arguments, validates parameters, and returns
    the resolved (action_name, parameters, action) triple. Returns None
    and appends an error message to messages on failure.

    NOTE: This is synchronous validation only. The async action search
    fallback is handled inline in the dispatch loop because it needs await.
    """
    from apps.mcp.services.agent.helpers import validate_query_params

    action_name = arguments.get("action_name", "")
    parameters = arguments.get("parameters", {})

    if not action_name:
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content="Error: action_name is required",
        ))
        return None

    action = BUILTIN_ACTIONS.get(action_name)
    if not action:
        action = agent_context.get_action_by_name(action_name)

    if action and action.get("data_schema"):
        validation_result = validate_query_params(parameters, action["data_schema"])
        if not validation_result["valid"]:
            error_msg = validation_result["error"]
            expected = validation_result.get("expected_params", [])
            hint = f"Expected parameters: {expected}" if expected else ""
            logger.warning(f"[AgenticLoop] Parameter validation failed for {action_name}: {error_msg}")
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id,
                result_content=f"Parameter validation failed: {error_msg}. {hint}",
            ))
            return None

    return action_name, parameters, action
