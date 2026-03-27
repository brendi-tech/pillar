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

from django.utils import timezone
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

BUILTIN_TOOLS = {
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
    },
    "render_chart": {
        "name": "render_chart",
        "description": "Render an interactive chart or graph inline in the conversation",
        "action_type": "inline_ui",
        "data_schema": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "horizontal_bar", "stacked_bar", "line", "pie", "scatter", "area", "donut", "radar"],
                },
                "title": {"type": "string"},
                "data": {
                    "type": "object",
                    "properties": {
                        "labels": {"type": "array", "items": {"type": "string"}},
                        "datasets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "values": {"type": "array", "items": {"type": "number"}},
                                },
                                "required": ["values"],
                            },
                        },
                    },
                    "required": ["labels", "datasets"],
                },
            },
            "required": ["chart_type", "data"],
        },
        "auto_run": True,
        "returns_data": True,
    },
}
BUILTIN_ACTIONS = BUILTIN_TOOLS


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
    mcp_resources = results.get("mcp_resources", [])

    if actions:
        agent_context.add_tool_results(actions, query)
        agent_context.register_tools(actions)
        logger.info(f"[AgenticLoop] Registered {len(actions)} tools from search")
        iter_span.add_event("tools_registered", {
            "source": "search",
            "tool_names": json.dumps([a.get("name", "unknown") for a in actions]),
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
    skills = results.get("skills", [])

    if mcp_resources:
        agent_context.read_mcp_resource_unlocked = True
    if skills:
        agent_context.load_skill_unlocked = True

    _search_duration_ms = int((time.time() - tool_start) * 1000)
    _tool_span.set_attribute("tool.duration_ms", _search_duration_ms)
    _tool_span.set_attribute("tool.actions_count", len(actions))
    _tool_span.set_attribute("tool.knowledge_count", len(knowledge))
    _tool_span.set_attribute("tool.mcp_resources_count", len(mcp_resources))
    _tool_span.set_attribute("tool.skills_count", len(skills))
    _tool_span.end()

    ui_sources = []
    for a in actions:
        ui_sources.append({"title": a.get("name", ""), "url": None})
    for k in knowledge:
        if k.get("url"):
            ui_sources.append({"title": k.get("title", ""), "url": k.get("url")})
    for r in mcp_resources:
        ui_sources.append({"title": r.get("name", ""), "url": r.get("uri")})
    for s in skills:
        ui_sources.append({"title": s.get("name", ""), "url": None})

    result_count = len(actions) + len(knowledge) + len(mcp_resources) + len(skills)
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
        "mcp_resources_count": len(mcp_resources),
        "skills_count": len(skills),
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
        tools=actions,
        knowledge=knowledge,
        mcp_resources=mcp_resources,
        skills=skills,
    )
    messages.append(format_tool_result_message_native(
        tool_call_id=tool_call_id,
        result_content=result_content,
    ))
    logger.info(
        "[AgenticLoop] search -> OK: %d tools, %d knowledge, %d mcp_resources, %d skills",
        len(actions), len(knowledge), len(mcp_resources), len(skills),
    )

    yield emit_search_complete(
        search_id,
        result_count,
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


async def execute_read_mcp_resource(
    *,
    messages: list[dict],
    display_trace: list[dict],
    iteration: int,
    start_time_ms: int,
    tracer: Any,
    tool_call_id: str,
    arguments: dict,
    caller: Any,
) -> AsyncGenerator[dict, None]:
    """Execute a read_mcp_resource tool call to fetch content from an external MCP server."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import read_mcp_resource

    uri = arguments.get("uri", "")
    source_id = arguments.get("source_id", "")

    if not uri or not source_id:
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content="Error: both uri and source_id are required",
        ))
        return

    logger.info("[AgenticLoop] Reading MCP resource: %s (source=%s)", uri, source_id)

    tool_event = emit_tool_call_start("read_mcp_resource", arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    _tool_span = tracer.start_span(
        "tool.read_mcp_resource",
        attributes={"tool.uri": uri, "tool.source_id": source_id},
    )

    try:
        mcp_source = await MCPToolSource.objects.aget(id=source_id)
    except MCPToolSource.DoesNotExist:
        _tool_span.set_status(StatusCode.ERROR, "MCP source not found")
        _tool_span.end()

        error_msg = f"MCP source '{source_id}' not found."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=error_msg,
        ))

        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": "read_mcp_resource",
            "kind": "tool_call",
            "label": "Failed read_mcp_resource",
            "text": error_msg,
            "arguments": arguments,
            "success": False,
            "error": error_msg,
        })

        yield emit_tool_call_complete(
            tool_id, "read_mcp_resource", success=False,
            result_summary=error_msg, arguments=arguments,
        )
        return

    tool_start = time.time()
    result = await read_mcp_resource(
        uri=uri,
        mcp_source=mcp_source,
        caller=caller,
    )
    duration_ms = int((time.time() - tool_start) * 1000)
    _tool_span.set_attribute("tool.duration_ms", duration_ms)

    if result.get("timed_out"):
        _tool_span.set_status(StatusCode.ERROR, "Timeout")
        _tool_span.end()
        result_content = f"MCP resource read timed out for URI: {uri}"
        is_success = False
    elif result.get("connection_error"):
        _tool_span.set_status(StatusCode.ERROR, "Connection error")
        _tool_span.end()
        result_content = f"MCP server unreachable for resource: {uri}"
        is_success = False
    elif not result.get("success"):
        _tool_span.set_status(StatusCode.ERROR, "Read failed")
        _tool_span.end()
        result_content = f"Error reading resource: {result.get('error', 'Unknown error')}"
        is_success = False
    else:
        _tool_span.end()
        is_success = True
        contents = result.get("contents", [])
        result_content = "\n\n".join(
            block.get("text", json.dumps(block, default=str))
            for block in contents
        ) if contents else "(empty resource)"

    display_trace.append({
        "step_type": "tool_result",
        "iteration": iteration,
        "timestamp_ms": int(time.time() * 1000) - start_time_ms,
        "tool": "read_mcp_resource",
        "kind": "tool_call",
        "label": "Completed read_mcp_resource" if is_success else "Failed read_mcp_resource",
        "text": result_content[:500] if is_success else result_content,
        "arguments": arguments,
        "success": is_success,
    })

    messages.append(format_tool_result_message_native(
        tool_call_id=tool_call_id,
        result_content=result_content,
    ))
    logger.info(
        "[AgenticLoop] read_mcp_resource -> %s (%dms): %s",
        "OK" if is_success else "ERROR", duration_ms, result_content[:300],
    )

    yield emit_tool_call_complete(
        tool_id, "read_mcp_resource", success=is_success,
        result_summary=result_content[:500],
        arguments=arguments,
    )


async def execute_load_skill(
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
    """Execute a load_skill tool call to fetch full skill content."""
    from apps.tools.models import RegisteredSkill

    name = arguments.get("name", "")

    if not name:
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content="Error: name is required",
        ))
        return

    logger.info("[AgenticLoop] Loading skill: %s", name)

    tool_event = emit_tool_call_start("load_skill", arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    _tool_span = tracer.start_span(
        "tool.load_skill",
        attributes={"tool.skill_name": name},
    )

    tool_start = time.time()

    try:
        skill = await RegisteredSkill.objects.aget(
            product=tool_executor.product,
            name=name,
            is_active=True,
        )
        is_success = True
        result_content = f"Skill: {skill.name}\n\n{skill.content}"
    except RegisteredSkill.DoesNotExist:
        is_success = False
        result_content = f"Skill not found: {name}"

    _duration_ms = int((time.time() - tool_start) * 1000)
    _tool_span.set_attribute("tool.duration_ms", _duration_ms)
    _tool_span.set_attribute("tool.success", is_success)
    _tool_span.end()

    display_name = format_tool_name_for_display("load_skill")
    display_trace.append({
        "step_type": "tool_result",
        "iteration": iteration,
        "timestamp_ms": int(time.time() * 1000) - start_time_ms,
        "tool": "load_skill",
        "kind": "tool_call",
        "label": f"Completed {display_name}" if is_success else f"Failed {display_name}",
        "skill_name": name,
        "arguments": {"name": name},
        "success": is_success,
    })

    messages.append(format_tool_result_message_native(
        tool_call_id=tool_call_id,
        result_content=result_content,
    ))
    logger.info(
        "[AgenticLoop] load_skill -> %s: %s",
        "OK" if is_success else "ERROR",
        name if is_success else result_content,
    )

    yield emit_tool_call_complete(
        tool_id, "load_skill", success=is_success,
        result_summary=f"Loaded skill: {name}" if is_success else result_content,
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

    # Un-nest { data } envelope for backward compat with old SDK versions
    # that wrap tool results in { success: true, data: { ... } }
    if isinstance(result_data, dict) and "data" in result_data and isinstance(result_data["data"], (dict, list)):
        result_data = result_data["data"]

    # --- Sensitive field interception (Tier 1 & Tier 2) ---
    if is_success and isinstance(result_data, dict) and action_name != "interact_with_page":
        from apps.mcp.services.agent.helpers import (
            detect_customer_secret_ref,
            get_sensitive_output_fields,
            strip_and_store_sensitive_fields,
        )
        from apps.mcp.services.agent.streaming_events import emit_secret_reveal

        sensitive_fields = get_sensitive_output_fields(action)
        if sensitive_fields:
            result_data, refs = strip_and_store_sensitive_fields(
                result=result_data,
                sensitive_fields=sensitive_fields,
                session_id=session_id,
                user_id="",
            )
            for ref_info in refs:
                yield emit_secret_reveal(
                    ref=ref_info["ref"],
                    field_name=ref_info["field"],
                    endpoint=ref_info["endpoint"],
                )
        else:
            result_data, cust_ref = detect_customer_secret_ref(result_data)
            if cust_ref:
                yield emit_secret_reveal(
                    ref=cust_ref["ref"],
                    field_name=cust_ref["field"],
                    endpoint=cust_ref["endpoint"],
                )

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
        tool_name=action_name,
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


async def execute_server_tool(
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
    tool_name: str,
    arguments: dict,
    tool_config: dict,
    caller: Any,
) -> AsyncGenerator[dict, None]:
    """Execute a server-side tool via HTTP POST to the customer's endpoint."""
    from apps.tools.services.dispatch import get_tool_endpoint, post_tool_call

    tool_event = emit_tool_call_start(tool_name, arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    _span = tracer.start_span(
        "server_tool.round_trip",
        attributes={"server_tool.name": tool_name, "server_tool.call_id": tool_call_id},
    )

    endpoint = await get_tool_endpoint(str(service.help_center_config.id))
    sdk_version = getattr(endpoint, "sdk_version", "") if endpoint else ""
    if sdk_version:
        _span.set_attribute("server_tool.sdk_version", sdk_version)

    if not endpoint:
        _span.set_status(StatusCode.ERROR, "No endpoint registered")
        _span.end()

        error_msg = (
            f"Tool '{tool_name}' requires a server-side endpoint, "
            f"but no endpoint is registered."
        )
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=error_msg,
        ))

        display_name = format_tool_name_for_display(tool_name)
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": "No endpoint registered",
            "arguments": arguments,
            "success": False,
            "error": "No endpoint registered",
        })

        logger.warning(
            "[AgenticLoop] %s -> ERROR: No endpoint registered for product %s",
            tool_name, service.help_center_config.id,
        )

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="No endpoint registered",
            arguments=arguments,
        )
        return

    timeout = tool_config.get("timeout_ms", 30000) / 1000

    call_start = time.time()
    result = await post_tool_call(
        endpoint_url=endpoint.endpoint_url,
        call_id=tool_call_id,
        tool_name=tool_name,
        arguments=arguments,
        caller=caller,
        timeout=timeout,
        conversation_id=conversation_id,
        product=service.help_center_config,
    )
    call_duration_ms = int((time.time() - call_start) * 1000)
    _span.set_attribute("server_tool.duration_ms", call_duration_ms)

    display_name = format_tool_name_for_display(tool_name)

    if result.get("timed_out"):
        _span.set_status(StatusCode.ERROR, "Timeout")
        _span.end()

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=f"Tool '{tool_name}' timed out after {timeout}s.",
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": f"Timed out after {timeout}s",
            "arguments": arguments,
            "success": False,
            "error": "Timeout",
        })

        logger.warning(
            "[AgenticLoop] server_tool %s -> TIMEOUT after %ss",
            tool_name, timeout,
        )

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="Timeout",
            arguments=arguments,
        )

    elif result.get("connection_error"):
        _span.set_status(StatusCode.ERROR, "Endpoint unreachable")
        _span.end()

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=(
                f"Tool '{tool_name}' endpoint is unreachable. "
                f"The server may be offline."
            ),
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": "Endpoint unreachable",
            "arguments": arguments,
            "success": False,
            "error": "Endpoint unreachable",
        })

        logger.warning(
            "[AgenticLoop] server_tool %s -> ERROR: Endpoint unreachable",
            tool_name,
        )

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="Endpoint unreachable",
            arguments=arguments,
        )

    elif result.get("server_error"):
        error_msg = result.get("error", "Unknown server error")
        _span.set_status(StatusCode.ERROR, f"Server error: {error_msg}")
        _span.end()

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=f"Tool '{tool_name}' failed: {error_msg}",
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": error_msg,
            "arguments": arguments,
            "success": False,
            "error": error_msg,
        })

        logger.warning(
            "[AgenticLoop] server_tool %s -> SERVER_ERROR (%dms): %s",
            tool_name, call_duration_ms, error_msg,
        )

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_msg,
            arguments=arguments,
        )

    else:
        _span.end()

        raw_result = result.get("result")
        is_confirmation = (
            isinstance(raw_result, dict)
            and raw_result.get("confirmation_required") is True
        )

        if is_confirmation:
            confirm_title = raw_result.get("title") or tool_name
            confirm_message = (
                raw_result.get("message")
                or raw_result.get("summary")
                or f"Confirm {tool_name}?"
            )
            confirm_details = raw_result.get("details")
            confirm_payload = raw_result.get("confirm_payload", arguments)

            logger.info(
                "[AgenticLoop] server_tool %s returned confirmation_required (%dms): %s",
                tool_name, call_duration_ms, confirm_message,
            )

            display_trace.append({
                "step_type": "confirmation_request",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": tool_name,
                "message": confirm_message,
            })

            yield emit_tool_call_complete(
                tool_id, tool_name, success=True,
                result_summary=f"Confirmation required: {confirm_message}",
                arguments=arguments,
            )

            yield {
                "type": "confirmation_request",
                "tool_name": tool_name,
                "call_id": tool_call_id,
                "title": confirm_title,
                "message": confirm_message,
                "details": confirm_details,
                "confirm_payload": confirm_payload,
                "conversation_id": conversation_id,
                "source_type": "server",
            }
            return

        is_success = result.get("success", True)
        result_content = raw_result if raw_result is not None else result.get("error", "")
        if not isinstance(result_content, str):
            result_content = json.dumps(result_content, default=str)

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=result_content,
        ))

        label = f"Completed {display_name}" if is_success else f"Failed {display_name}"
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": label,
            "text": result_content[:500],
            "arguments": arguments,
            "success": is_success,
        })

        logger.info(
            "[AgenticLoop] server_tool %s -> %s (%dms): %s",
            tool_name, "OK" if is_success else "ERROR",
            call_duration_ms, result_content[:300],
        )

        yield emit_tool_call_complete(
            tool_id, tool_name,
            success=is_success,
            result_summary=result_content[:500],
            arguments=arguments,
        )


async def execute_mcp_source_tool(
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
    tool_name: str,
    mcp_original_name: str,
    mcp_source_id: str,
    arguments: dict,
    caller: Any,
    requires_confirmation: bool = False,
) -> AsyncGenerator[dict, None]:
    """Execute a tool on an external MCP server."""
    from apps.tools.models import MCPToolSource
    from apps.tools.services.mcp_client import execute_mcp_tool

    tool_event = emit_tool_call_start(tool_name, arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    if requires_confirmation:
        confirm_message = f"Confirm executing {mcp_original_name}?"

        display_trace.append({
            "step_type": "confirmation_request",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "message": confirm_message,
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=True,
            result_summary=f"Confirmation required: {confirm_message}",
            arguments=arguments,
        )

        yield {
            "type": "confirmation_request",
            "tool_name": tool_name,
            "call_id": tool_call_id,
            "title": format_tool_name_for_display(tool_name),
            "message": confirm_message,
            "details": {"tool": mcp_original_name, "arguments": arguments},
            "confirm_payload": arguments,
            "conversation_id": conversation_id,
            "source_type": "mcp",
            "mcp_source_id": mcp_source_id,
            "mcp_original_name": mcp_original_name,
        }
        return

    _span = tracer.start_span(
        "mcp_source_tool.round_trip",
        attributes={
            "mcp_tool.name": tool_name,
            "mcp_tool.original_name": mcp_original_name,
            "mcp_tool.source_id": mcp_source_id,
            "mcp_tool.call_id": tool_call_id,
        },
    )

    try:
        mcp_source = await MCPToolSource.objects.aget(id=mcp_source_id)
    except MCPToolSource.DoesNotExist:
        _span.set_status(StatusCode.ERROR, "MCP source not found")
        _span.end()

        error_msg = f"MCP source '{mcp_source_id}' not found."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=error_msg,
        ))

        display_name = format_tool_name_for_display(tool_name)
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": error_msg,
            "arguments": arguments,
            "success": False,
            "error": error_msg,
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_msg,
            arguments=arguments,
        )
        return

    # Per-user OAuth check for client-auth MCP sources
    user_access_token: str | None = None
    if (
        mcp_source.auth_type == MCPToolSource.AuthType.OAUTH
        and mcp_source.oauth_mode == MCPToolSource.OAuthMode.CLIENT
    ):
        from apps.tools.models import UserToolCredential

        channel = getattr(caller, "channel", "web")
        channel_user_id = getattr(caller, "channel_user_id", None)
        external_user_id = getattr(caller, "external_user_id", None)

        user_credential = None
        if channel_user_id:
            user_credential = await UserToolCredential.objects.filter(
                mcp_source=mcp_source,
                channel=channel,
                channel_user_id=channel_user_id,
                is_active=True,
            ).afirst()

        if not user_credential and external_user_id:
            user_credential = await UserToolCredential.objects.filter(
                mcp_source=mcp_source,
                external_user_id=external_user_id,
                is_active=True,
            ).afirst()

        if not user_credential:
            _span.end()
            oauth_link = await _generate_oauth_link(
                source=mcp_source,
                channel=channel,
                channel_user_id=channel_user_id or "",
                product=mcp_source.product,
            )
            auth_msg = (
                f"This action requires authentication. "
                f"Please connect your account: {oauth_link}"
            )
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id, result_content=auth_msg,
            ))
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": tool_name,
                "kind": "tool_call",
                "label": f"Auth required for {format_tool_name_for_display(tool_name)}",
                "text": "User needs to authenticate",
                "arguments": arguments,
                "success": False,
                "error": "auth_required",
            })
            yield emit_tool_call_complete(
                tool_id, tool_name, success=False,
                result_summary="Authentication required",
                arguments=arguments,
            )
            return

        user_access_token = user_credential.access_token

    call_start = time.time()
    result = await execute_mcp_tool(
        tool_name=mcp_original_name,
        arguments=arguments,
        mcp_source=mcp_source,
        caller=caller,
        user_access_token=user_access_token,
    )
    call_duration_ms = int((time.time() - call_start) * 1000)
    _span.set_attribute("mcp_tool.duration_ms", call_duration_ms)

    display_name = format_tool_name_for_display(tool_name)

    if result.get("timed_out"):
        _span.set_status(StatusCode.ERROR, "Timeout")
        _span.end()
        logger.warning(
            "[AgenticLoop] mcp_tool %s (source=%s) TIMEOUT (%dms)",
            tool_name, mcp_source.name, call_duration_ms,
        )

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=f"MCP tool '{tool_name}' timed out after {call_duration_ms}ms connecting to {mcp_source.url}.",
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": "Timed out",
            "arguments": arguments,
            "success": False,
            "error": "Timeout",
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="Timeout",
            arguments=arguments,
        )

    elif result.get("auth_error"):
        _span.set_status(StatusCode.ERROR, "Auth error")
        _span.end()

        dashboard_link = _build_mcp_dashboard_link(mcp_source)
        error_detail = result.get("error", "Authentication failed.")

        if mcp_source.auth_type == "oauth" and mcp_source.oauth_mode == "client":
            channel = getattr(caller, "channel", "web")
            channel_user_id = getattr(caller, "channel_user_id", None)
            oauth_link = await _generate_oauth_link(
                source=mcp_source,
                channel=channel,
                channel_user_id=channel_user_id or "",
                product=mcp_source.product,
            )
            auth_msg = (
                f"Your authentication for '{mcp_source.name}' has expired. "
                f"Please reconnect your account: {oauth_link}"
            )
        elif mcp_source.auth_type == "oauth":
            auth_msg = (
                f"Authentication for '{mcp_source.name}' has expired. "
                f"An admin needs to re-authorize this connection from the dashboard: {dashboard_link}\n"
                f"You MUST include this link in your response to the user."
            )
        else:
            auth_msg = (
                f"The API credentials for '{mcp_source.name}' are invalid or expired. "
                f"An admin needs to update them in the dashboard: {dashboard_link}\n"
                f"You MUST include this link in your response to the user."
            )

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=auth_msg,
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": error_detail,
            "arguments": arguments,
            "success": False,
            "error": "auth_error",
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_detail,
            arguments=arguments,
        )

    elif result.get("connection_error"):
        _span.set_status(StatusCode.ERROR, "MCP server unreachable")
        _span.end()
        error_detail = result.get("error", "")
        logger.warning(
            "[AgenticLoop] mcp_tool %s (source=%s) CONNECT_ERROR (%dms): %s",
            tool_name, mcp_source.name, call_duration_ms, error_detail,
        )

        _trigger_mcp_rediscovery(mcp_source)

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=(
                f"MCP tool '{tool_name}' server at {mcp_source.url} is unreachable. "
                f"The server may be offline."
            ),
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Failed {display_name}",
            "text": "MCP server unreachable",
            "arguments": arguments,
            "success": False,
            "error": "MCP server unreachable",
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="MCP server unreachable",
            arguments=arguments,
        )

    else:
        _span.end()

        is_success = result.get("success", True)

        if is_success:
            content_blocks = result.get("result", [])
            result_text = "\n".join(
                block.get("text", json.dumps(block, default=str))
                for block in content_blocks
            ) if isinstance(content_blocks, list) else json.dumps(content_blocks, default=str)
        else:
            result_text = result.get("error", "Unknown error")

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=result_text,
        ))

        label = f"Completed {display_name}" if is_success else f"Failed {display_name}"
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": label,
            "text": result_text[:500],
            "arguments": arguments,
            "success": is_success,
        })

        logger.info(
            "[AgenticLoop] mcp_tool %s (source=%s) -> %s (%dms): %s",
            tool_name, mcp_source.name,
            "OK" if is_success else "ERROR",
            call_duration_ms, result_text[:300],
        )

        yield emit_tool_call_complete(
            tool_id, tool_name,
            success=is_success,
            result_summary=result_text[:500],
            arguments=arguments,
        )


async def execute_openapi_source_tool(
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
    tool_name: str,
    openapi_source_id: str,
    openapi_operation: dict,
    arguments: dict,
    caller: Any,
) -> AsyncGenerator[dict, None]:
    """Execute an OpenAPI tool via direct HTTP call to the customer's API."""
    from apps.tools.models import OpenAPIToolSource, UserToolCredential
    from apps.tools.services.openapi_executor import execute_openapi_call

    tool_event = emit_tool_call_start(tool_name, arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    if openapi_operation.get("_requires_confirmation"):
        method = openapi_operation.get("method", "").upper()
        path = openapi_operation.get("path", "")
        confirm_message = (
            openapi_operation.get("summary")
            or f"Confirm {method} {path}?"
        )

        display_trace.append({
            "step_type": "confirmation_request",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "message": confirm_message,
        })

        yield emit_tool_call_complete(
            tool_id, tool_name, success=True,
            result_summary=f"Confirmation required: {confirm_message}",
            arguments=arguments,
        )

        yield {
            "type": "confirmation_request",
            "tool_name": tool_name,
            "call_id": tool_call_id,
            "title": format_tool_name_for_display(tool_name),
            "message": confirm_message,
            "details": {"method": method, "path": path, "arguments": arguments},
            "confirm_payload": arguments,
            "conversation_id": conversation_id,
            "source_type": "openapi",
            "openapi_source_id": openapi_source_id,
            "openapi_operation": openapi_operation,
        }
        return

    _span = tracer.start_span(
        "openapi_tool.round_trip",
        attributes={"openapi_tool.name": tool_name, "openapi_tool.call_id": tool_call_id},
    )

    try:
        source = await OpenAPIToolSource.objects.select_related('product').aget(id=openapi_source_id)
    except OpenAPIToolSource.DoesNotExist:
        _span.set_status(StatusCode.ERROR, "Source not found")
        _span.end()
        error_msg = f"OpenAPI source '{openapi_source_id}' not found."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id, result_content=error_msg,
        ))
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_msg, arguments=arguments,
        )
        return

    user_credential = None
    passthrough_token = getattr(caller, "user_api_token", None)

    if passthrough_token and source.auth_type in ("oauth2_authorization_code", "bearer"):
        # Web SDK passthrough: use the token directly without credential lookup.
        # We create a lightweight credential-like object for the executor.
        from types import SimpleNamespace
        user_credential = SimpleNamespace(
            access_token=passthrough_token,
            token_type="Bearer",
            is_active=True,
            is_expired=False,
            refresh_token=None,
        )
    elif source.auth_type == "oauth2_authorization_code":
        channel = getattr(caller, "channel", "web")
        channel_user_id = getattr(caller, "channel_user_id", None)
        external_user_id = getattr(caller, "external_user_id", None)
        environments = source.oauth_environments or []

        user_credentials = []
        if channel_user_id:
            user_credentials = [
                c async for c in UserToolCredential.objects.filter(
                    openapi_source=source,
                    channel=channel,
                    channel_user_id=channel_user_id,
                    is_active=True,
                )
            ]

        if not user_credentials and external_user_id:
            user_credentials = [
                c async for c in UserToolCredential.objects.filter(
                    openapi_source=source,
                    external_user_id=external_user_id,
                    is_active=True,
                )
            ]

        if not user_credentials:
            _span.end()
            if environments:
                links = []
                for env in environments:
                    link = await _generate_oauth_link(
                        source=source,
                        channel=channel,
                        channel_user_id=channel_user_id or "",
                        product=source.product,
                        oauth_environment=env["name"].lower(),
                    )
                    links.append(f"Connect {env['name']}: {link}")
                auth_msg = (
                    "This action requires authentication.\n"
                    + "\n".join(links)
                    + "\nYou MUST include ALL of the above URLs in your response to the user."
                )
            else:
                oauth_link = await _generate_oauth_link(
                    source=source,
                    channel=channel,
                    channel_user_id=channel_user_id or "",
                    product=source.product,
                )
                auth_msg = (
                    f"This action requires authentication. "
                    f"Please connect your account: {oauth_link}"
                )
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id, result_content=auth_msg,
            ))
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": tool_name,
                "kind": "tool_call",
                "label": f"Auth required for {format_tool_name_for_display(tool_name)}",
                "text": "User needs to authenticate",
                "arguments": arguments,
                "success": False,
                "error": "auth_required",
            })
            yield emit_tool_call_complete(
                tool_id, tool_name, success=False,
                result_summary="Authentication required",
                arguments=arguments,
            )
            return

        if len(user_credentials) == 1:
            user_credential = user_credentials[0]
        else:
            env_names = [c.oauth_environment or "default" for c in user_credentials]
            auth_msg = (
                f"Multiple environments connected: {', '.join(env_names)}. "
                "Ask the user which environment they want to use for this action."
            )
            messages.append(format_tool_result_message_native(
                tool_call_id=tool_call_id, result_content=auth_msg,
            ))
            display_trace.append({
                "step_type": "tool_result",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": tool_name,
                "kind": "tool_call",
                "label": f"Environment choice needed for {format_tool_name_for_display(tool_name)}",
                "text": f"Multiple environments: {', '.join(env_names)}",
                "arguments": arguments,
                "success": False,
                "error": "environment_choice_required",
            })
            yield emit_tool_call_complete(
                tool_id, tool_name, success=False,
                result_summary="Multiple environments - ask user",
                arguments=arguments,
            )
            return

    call_start = time.time()
    result = await execute_openapi_call(
        source=source,
        operation=openapi_operation,
        arguments=arguments,
        user_credential=user_credential,
    )
    call_duration_ms = int((time.time() - call_start) * 1000)
    _span.set_attribute("openapi_tool.duration_ms", call_duration_ms)

    display_name = format_tool_name_for_display(tool_name)

    error_detail = result.get("error", "")

    if result.get("timed_out"):
        _span.set_status(StatusCode.ERROR, "Timeout")
        _span.end()
        logger.warning(
            "[AgenticLoop] openapi_tool %s TIMEOUT (%dms): %s",
            tool_name, call_duration_ms, error_detail,
        )
        result_msg = error_detail or f"API call '{tool_name}' timed out."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=result_msg,
        ))
        display_trace.append({
            "step_type": "tool_result", "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name, "kind": "tool_call",
            "label": f"Failed {display_name}", "text": result_msg,
            "arguments": arguments, "success": False, "error": "Timeout",
        })
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=result_msg, arguments=arguments,
        )

    elif result.get("connection_error"):
        _span.set_status(StatusCode.ERROR, "API unreachable")
        _span.end()
        logger.warning(
            "[AgenticLoop] openapi_tool %s CONNECT_ERROR (%dms): %s",
            tool_name, call_duration_ms, error_detail,
        )
        result_msg = error_detail or f"API for '{tool_name}' is unreachable."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id,
            result_content=result_msg,
        ))
        display_trace.append({
            "step_type": "tool_result", "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name, "kind": "tool_call",
            "label": f"Failed {display_name}", "text": result_msg,
            "arguments": arguments, "success": False, "error": "API unreachable",
        })
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=result_msg, arguments=arguments,
        )

    elif result.get("auth_required"):
        _span.end()
        re_auth_channel = getattr(caller, "channel", "web")
        re_auth_channel_user_id = getattr(caller, "channel_user_id", "") or ""
        re_auth_environments = source.oauth_environments or []

        if re_auth_environments:
            links = []
            for env in re_auth_environments:
                link = await _generate_oauth_link(
                    source=source,
                    channel=re_auth_channel,
                    channel_user_id=re_auth_channel_user_id,
                    product=source.product,
                    oauth_environment=env["name"].lower(),
                )
                links.append(f"Reconnect {env['name']}: {link}")
            auth_msg = (
                f"Authentication expired for {format_tool_name_for_display(tool_name)}.\n"
                + "\n".join(links)
                + "\nYou MUST include ALL of the above URLs in your response to the user."
            )
        else:
            oauth_link = await _generate_oauth_link(
                source=source,
                channel=re_auth_channel,
                channel_user_id=re_auth_channel_user_id,
                product=source.product,
            )
            auth_msg = (
                f"Authentication expired for {format_tool_name_for_display(tool_name)}. "
                f"The user MUST click this link to reconnect: {oauth_link}\n"
                f"You MUST include this exact URL in your response to the user."
            )
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id, result_content=auth_msg,
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": f"Auth required for {format_tool_name_for_display(tool_name)}",
            "text": "User needs to re-authenticate",
            "arguments": arguments,
            "success": False,
            "error": "auth_required",
        })
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary="Re-authentication required", arguments=arguments,
        )
        return

    else:
        _span.end()
        is_success = result.get("success", False)
        result_data = result.get("result", result.get("error", ""))
        result_text = json.dumps(result_data, default=str) if not isinstance(result_data, str) else result_data

        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id, result_content=result_text,
        ))
        display_trace.append({
            "step_type": "tool_result", "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name, "kind": "tool_call",
            "label": f"{'Completed' if is_success else 'Failed'} {display_name}",
            "text": result_text[:500],
            "arguments": arguments, "success": is_success,
            "error": None if is_success else result_text[:500],
        })
        logger.info(
            "[AgenticLoop] openapi_tool %s -> %s (%dms): %s",
            tool_name, "OK" if is_success else "ERROR",
            call_duration_ms, result_text[:300],
        )
        yield emit_tool_call_complete(
            tool_id, tool_name, success=is_success,
            result_summary=result_text[:500], arguments=arguments,
        )


async def _generate_oauth_link(
    *,
    source,
    channel: str,
    channel_user_id: str,
    product,
    oauth_environment: str = "",
) -> str:
    """Generate a short-lived OAuth link token and return the authorization URL."""
    import secrets
    from datetime import timedelta

    from django.conf import settings

    from apps.tools.models import MCPToolSource, OAuthLinkToken, OpenAPIToolSource

    source_kwargs: dict = {}
    if isinstance(source, OpenAPIToolSource):
        source_kwargs["openapi_source"] = source
    elif isinstance(source, MCPToolSource):
        source_kwargs["mcp_source"] = source
    else:
        raise ValueError(f"Unsupported source type: {type(source)}")

    now = timezone.now()

    invalidation_filter = {
        **source_kwargs,
        "channel": channel,
        "channel_user_id": channel_user_id,
        "is_used": False,
    }
    if oauth_environment:
        invalidation_filter["oauth_environment"] = oauth_environment

    await OAuthLinkToken.objects.filter(
        **invalidation_filter,
    ).aupdate(is_used=True, used_at=now)

    token = secrets.token_urlsafe(32)
    await OAuthLinkToken.objects.acreate(
        organization_id=source.organization_id,
        **source_kwargs,
        product=product,
        token=token,
        channel=channel,
        channel_user_id=channel_user_id,
        expires_at=now + timedelta(minutes=10),
        code_verifier='',
        oauth_environment=oauth_environment,
    )

    base_url = getattr(settings, 'API_BASE_URL', '')
    return f"{base_url}/api/tools/oauth/authorize/{token}/"


async def execute_reconnect_account(
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
    arguments: dict,
    caller: Any,
) -> AsyncGenerator[dict, None]:
    """Invalidate a user's connection to a tool integration and generate a reconnection link."""
    from apps.tools.models import MCPToolSource, OpenAPIToolSource, UserToolCredential

    tool_name = "reconnect_account"
    tool_event = emit_tool_call_start(tool_name, arguments)
    tool_id = tool_event["data"]["id"]
    yield tool_event

    integration_name = (arguments.get("integration_name") or "").strip()
    if not integration_name:
        error_msg = "integration_name is required."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id, result_content=error_msg,
        ))
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_msg, arguments=arguments,
        )
        return

    product = service.help_center_config
    organization = service.organization
    search_term = integration_name.lower()

    openapi_sources = [
        s async for s in OpenAPIToolSource.objects.filter(
            product=product, is_active=True,
        ).select_related('product')
    ]
    mcp_sources = [
        s async for s in MCPToolSource.objects.filter(
            product=product, is_active=True,
        )
    ]

    matched_openapi = None
    matched_mcp = None
    for s in openapi_sources:
        if search_term in s.name.lower():
            matched_openapi = s
            break
    if not matched_openapi:
        for s in mcp_sources:
            if search_term in s.name.lower():
                matched_mcp = s
                break

    if not matched_openapi and not matched_mcp:
        available = [s.name for s in openapi_sources] + [s.name for s in mcp_sources]
        if available:
            error_msg = (
                f"No integration matching '{integration_name}' found. "
                f"Available integrations: {', '.join(available)}"
            )
        else:
            error_msg = f"No integrations are configured for this product."
        messages.append(format_tool_result_message_native(
            tool_call_id=tool_call_id, result_content=error_msg,
        ))
        display_trace.append({
            "step_type": "tool_result",
            "iteration": iteration,
            "timestamp_ms": int(time.time() * 1000) - start_time_ms,
            "tool": tool_name,
            "kind": "tool_call",
            "label": "Failed reconnect_account",
            "text": error_msg,
            "arguments": arguments,
            "success": False,
            "error": error_msg,
        })
        yield emit_tool_call_complete(
            tool_id, tool_name, success=False,
            result_summary=error_msg, arguments=arguments,
        )
        return

    if matched_openapi:
        source = matched_openapi
        if source.auth_type != "oauth2_authorization_code":
            dashboard_link = _build_openapi_dashboard_link(source)
            result_msg = (
                f"'{source.name}' uses {source.get_auth_type_display()} authentication. "
                f"An admin needs to update the credentials in the dashboard: {dashboard_link}\n"
                f"You MUST include this link in your response to the user."
            )
        else:
            channel = getattr(caller, "channel", "web")
            channel_user_id = getattr(caller, "channel_user_id", "") or ""

            if channel_user_id:
                await UserToolCredential.objects.filter(
                    openapi_source=source,
                    channel=channel,
                    channel_user_id=channel_user_id,
                    is_active=True,
                ).aupdate(is_active=False)

            environments = source.oauth_environments or []
            if environments:
                links = []
                for env in environments:
                    link = await _generate_oauth_link(
                        source=source,
                        channel=channel,
                        channel_user_id=channel_user_id,
                        product=product,
                        oauth_environment=env["name"].lower(),
                    )
                    links.append(f"Connect {env['name']}: {link}")
                result_msg = (
                    f"Previous connection to '{source.name}' has been invalidated.\n"
                    + "\n".join(links)
                    + "\nYou MUST include ALL of the above URLs in your response to the user."
                )
            else:
                oauth_link = await _generate_oauth_link(
                    source=source,
                    channel=channel,
                    channel_user_id=channel_user_id,
                    product=product,
                )
                result_msg = (
                    f"Previous connection to '{source.name}' has been invalidated. "
                    f"Please reconnect your account: {oauth_link}\n"
                    f"You MUST include this exact URL in your response to the user."
                )
    else:
        source = matched_mcp
        if source.auth_type == "oauth" and source.oauth_mode == "client":
            channel = getattr(caller, "channel", "web")
            channel_user_id = getattr(caller, "channel_user_id", "") or ""

            if channel_user_id:
                await UserToolCredential.objects.filter(
                    mcp_source=source,
                    channel=channel,
                    channel_user_id=channel_user_id,
                    is_active=True,
                ).aupdate(is_active=False)

            oauth_link = await _generate_oauth_link(
                source=source,
                channel=channel,
                channel_user_id=channel_user_id,
                product=product,
            )
            result_msg = (
                f"Previous connection to '{source.name}' has been invalidated. "
                f"Please reconnect your account: {oauth_link}\n"
                f"You MUST include this exact URL in your response to the user."
            )
        elif source.auth_type == "oauth":
            dashboard_link = _build_mcp_dashboard_link(source)
            result_msg = (
                f"'{source.name}' uses OAuth authentication. "
                f"An admin needs to re-authorize this connection from the dashboard: {dashboard_link}\n"
                f"You MUST include this link in your response to the user."
            )
        else:
            dashboard_link = _build_mcp_dashboard_link(source)
            auth_label = source.get_auth_type_display() if source.auth_type != "none" else "no"
            result_msg = (
                f"'{source.name}' uses {auth_label} authentication. "
                f"An admin needs to update the connection in the dashboard: {dashboard_link}\n"
                f"You MUST include this link in your response to the user."
            )

    messages.append(format_tool_result_message_native(
        tool_call_id=tool_call_id, result_content=result_msg,
    ))
    display_trace.append({
        "step_type": "tool_result",
        "iteration": iteration,
        "timestamp_ms": int(time.time() * 1000) - start_time_ms,
        "tool": tool_name,
        "kind": "tool_call",
        "label": "Completed reconnect_account",
        "text": result_msg[:500],
        "arguments": arguments,
        "success": True,
    })
    yield emit_tool_call_complete(
        tool_id, tool_name, success=True,
        result_summary=result_msg[:500], arguments=arguments,
    )


def _trigger_mcp_rediscovery(mcp_source) -> None:
    """Fire-and-forget rediscovery for a failed MCP source."""
    try:
        from common.hatchet_client import get_hatchet_client
        hatchet = get_hatchet_client()
        hatchet.admin.run_workflow(
            "tools-mcp-source-refresh",
            {"mcp_source_id": str(mcp_source.id)},
        )
    except Exception as exc:
        logger.warning(
            "[AgenticLoop] Failed to trigger rediscovery for %s: %s",
            mcp_source.name, exc,
        )


def _build_admin_base_url() -> str:
    """Build the admin dashboard base URL."""
    from django.conf import settings as django_settings

    admin_url = getattr(django_settings, 'HELP_CENTER_URL', 'http://localhost:3001')
    if 'localhost' in admin_url:
        admin_url = admin_url.replace('localhost', 'admin.localhost')
    elif not admin_url.startswith('https://admin.'):
        admin_url = admin_url.replace('https://', 'https://admin.')
    return admin_url


def _build_mcp_dashboard_link(mcp_source) -> str:
    """Build a dashboard URL pointing to the MCP source settings page."""
    return f"{_build_admin_base_url()}/tools/mcp/{mcp_source.id}"


def _build_openapi_dashboard_link(openapi_source) -> str:
    """Build a dashboard URL pointing to the OpenAPI source settings page."""
    return f"{_build_admin_base_url()}/tools/api/{openapi_source.id}"


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

    action = BUILTIN_TOOLS.get(action_name)
    if not action:
        action = agent_context.get_tool_by_name(action_name)

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
