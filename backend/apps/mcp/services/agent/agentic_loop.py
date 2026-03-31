"""
Agentic reasoning loop for multi-step query handling.

Orchestrates the tool-based agentic loop that dynamically decides
which tools to call based on query complexity and accumulated context.
Tool execution is handled by tool_handlers.py; LLM tool decisions
by tool_decision.py.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import TYPE_CHECKING, Any

from opentelemetry import trace, context as otel_context

if TYPE_CHECKING:
    from apps.mcp.services.agent.models import AgentMessage

from apps.mcp.services.agent.error_types import is_tool_error
from apps.mcp.services.agent.messages import get_fallback_message
from apps.mcp.services.agent.streaming_events import (
    emit_thinking_delta,
    emit_thinking_done,
    emit_thinking_start,
    emit_debug_iteration,
    emit_debug_tool_call,
)
from apps.mcp.services.agent.tool_decision import agent_decide_tool_native
from apps.mcp.services.agent.tool_handlers import (
    BUILTIN_TOOLS,
    execute_client_action,
    execute_get_article,
    execute_load_skill,
    execute_mcp_source_tool,
    execute_openapi_source_tool,
    execute_read_mcp_resource,
    execute_reconnect_account,
    execute_search,
    execute_server_tool,
    resolve_execute_action,
)
from common.observability.tracing import get_tracer

logger = logging.getLogger(__name__)

MAX_AGENT_ITERATIONS = 100


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
        "registered_tools": agent_context.registered_tools,
        "model_used": model_name,
        "prompt_tokens": agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else None,
        "completion_tokens": agent_context.token_budget.total_completion_tokens if agent_context.token_budget else None,
        "peak_context_occupancy": round(agent_context.token_budget.peak_occupancy_pct, 2) if agent_context.token_budget else None,
    }


async def run_agentic_loop(
    service,
    message: "AgentMessage",
):
    """
    Tool-based agentic reasoning loop.

    Accepts a single AgentMessage that normalizes input from any channel.
    The loop remains channel-agnostic -- it yields event dicts that
    channel-specific ResponseAdapters consume.

    Args:
        service: AgentAnswerServiceReActAsync instance
        message: Canonical input from any channel

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
    all_reasoning_details: list[dict] = []
    all_thinking_text: str = ""
    current_assistant_message_id: str | None = message.assistant_message_id

    # OpenTelemetry: root span for the agentic loop
    _tracer = get_tracer("pillar.agent")
    run_id = str(uuid.uuid4())
    thread_id = message.session_id or str(uuid.uuid4())
    widget_id = str(service.help_center_config.id)
    org_id = str(service.organization.id) if service.organization else "unknown"

    _loop_span = _tracer.start_span(
        "agentic_loop",
        attributes={
            "agent.question": message.text,
            "agent.session_id": message.session_id or "",
            "agent.thread_id": thread_id,
            "agent.run_id": run_id,
            "agent.conversation_id": message.conversation_id or "",
            "agent.widget_id": widget_id,
            "agent.org_id": org_id,
            "agent.channel": message.channel,
        },
    )
    _loop_ctx = trace.set_span_in_context(_loop_span)
    _loop_token = otel_context.attach(_loop_ctx)

    site_context = f"{service.help_center_config.name}"
    site_description = getattr(service.help_center_config, 'description', None)

    # Build environment context from SDK context and user profile
    environment_context = build_environment_context(
        sdk_context=message.sdk_context,
        user_profile=message.caller.user_profile,
        page_url=message.page_url,
    )
    if environment_context:
        logger.info(f"[AgenticLoop] Environment context built: {len(environment_context)} chars")

    # Build capabilities summary (cached per-product)
    capabilities_summary = await build_capabilities_summary(service.help_center_config)
    if capabilities_summary:
        logger.info(f"[AgenticLoop] Capabilities summary built: {len(capabilities_summary)} chars")

    # Get agent guidance: prefer resolved AgentConfig, fall back to product-level field
    agent_config = getattr(service, 'agent_config', None)
    if agent_config and agent_config.guidance:
        product_guidance = agent_config.guidance
        logger.info(f"[AgenticLoop] Agent guidance loaded from AgentConfig: {len(product_guidance)} chars")
    else:
        product_guidance = getattr(service.help_center_config, 'agent_guidance', '') or ''
        if product_guidance:
            logger.info(f"[AgenticLoop] Product guidance loaded: {len(product_guidance)} chars")

    logger.info(f"[AgenticLoop] Starting for question: {message.text[:100]}...")

    # Fast path check for simple cases
    if is_fast_path_eligible(message.text):
        fast_result = await fast_path_handle(message.text, message.platform, message.version)
        if fast_result:
            for event in fast_result:
                yield event
            return

    # Initialize context accumulator
    agent_context = AgentContext()
    
    # Detect DOM snapshot in user_context to conditionally enable interact_with_page
    if message.user_context:
        has_dom = any(item.get('type') == 'dom_snapshot' for item in message.user_context)
        if has_dom:
            agent_context.has_page_context = True
            logger.info("[AgenticLoop] DOM snapshot detected, interact_with_page tool enabled")
    
    # Check if product has OAuth-based tool sources for reconnect_account
    from apps.tools.models import MCPToolSource, OpenAPIToolSource

    has_oauth_sources = await OpenAPIToolSource.objects.filter(
        product=service.help_center_config,
        is_active=True,
        auth_type="oauth2_authorization_code",
    ).aexists() or await MCPToolSource.objects.filter(
        product=service.help_center_config,
        is_active=True,
        auth_type="oauth",
    ).aexists()
    if has_oauth_sources:
        agent_context.reconnect_account_enabled = True

    # Restore tools from previous conversation turns
    if message.registered_tools:
        agent_context.register_tools(message.registered_tools)
        for tool in message.registered_tools:
            if not any(t.get("name") == tool.get("name") for t in agent_context.found_tools):
                agent_context.found_tools.append(tool)
        logger.info(f"[AgenticLoop] Restored {len(message.registered_tools)} registered tools from previous turns")
        _loop_span.add_event("tools_registered", {
            "source": "restored_from_previous_turn",
            "tool_names": json.dumps([t.get("name", "unknown") for t in message.registered_tools]),
            "count": len(message.registered_tools),
        })

    # Check endpoint health (used by search to decide whether to include
    # server-side Action tools in results).
    from apps.tools.services.health import is_endpoint_healthy

    product_id = str(service.help_center_config.id)
    endpoint_healthy = await is_endpoint_healthy(product_id)

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
        platform=message.platform,
        version=message.version,
        channel=message.channel,
        knowledge_source_ids=agent_config.knowledge_source_ids if agent_config else [],
        endpoint_healthy=endpoint_healthy,
        mcp_source_ids=agent_config.mcp_source_ids if agent_config else [],
        mcp_tool_selections=(
            agent_config.mcp_tool_selections if agent_config else {}
        ),
        mcp_confirmation_config=(
            agent_config.mcp_confirmation_config if agent_config else {}
        ),
        openapi_source_ids=agent_config.openapi_source_ids if agent_config else [],
        openapi_operation_selections=(
            agent_config.openapi_operation_selections if agent_config else {}
        ),
        openapi_confirmation_config=(
            agent_config.openapi_confirmation_config if agent_config else {}
        ),
    )

    from apps.mcp.services.prompts.agentic_prompts import (
        build_agentic_prompt,
        format_assistant_tool_calls_message,
        format_tool_result_message_native,
    )
    from apps.mcp.services.agent.helpers import build_user_context_prompt

    # Merge user_context (e.g., DOM snapshot) into environment context
    full_environment = environment_context or ""
    if message.user_context:
        user_context_section = build_user_context_prompt(message.user_context)
        if user_context_section:
            full_environment = f"{full_environment}\n{user_context_section}" if full_environment else user_context_section

    messages = build_agentic_prompt(
        question=message.text,
        site_context=site_context,
        environment=full_environment,
        capabilities=capabilities_summary,
        product_guidance=product_guidance,
        images=message.images,
        conversation_history=message.conversation_history,
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
        if message.cancel_event and message.cancel_event.is_set():
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
        _iter_span.set_attribute("context.found_tools_count", len(agent_context.found_tools))
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

        # Build dynamic tool defs from registered tools for this iteration
        dynamic_tool_defs = agent_context.get_registered_tool_defs()

        _llm_span = _tracer.start_span(
            "llm.tool_decision",
            attributes={"agent.iteration": iteration + 1},
        )

        async for event in agent_decide_tool_native(
            service=service,
            messages=messages,
            context=agent_context,
            iteration=iteration,
            cancel_event=message.cancel_event,
            extra_tools=dynamic_tool_defs,
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
            duration_ms = int((time.time() - start_time) * 1000)
            total_p = agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0
            total_c = agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0
            logger.info(
                f"[AgenticLoop] Done: {iteration + 1} iterations, {duration_ms}ms, "
                f"{total_p + total_c:,} tokens ({total_p:,}p + {total_c:,}c)"
            )
            _loop_span.end()
            otel_context.detach(_loop_token)

            # Final state checkpoint so flush picks up everything
            yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

            yield {
                "type": "complete",
                "registered_tools": agent_context.registered_tools,
                "display_trace": display_trace,
                "thinking_text": all_thinking_text.strip(),
            }
            return

        # If no tool calls AND no content, fall back to search
        if not tool_calls:
            from apps.mcp.services.agent.recovery import get_smart_default_action
            fallback = get_smart_default_action(
                question=message.text,
                iteration=iteration,
                found_tools=agent_context.found_tools,
                found_knowledge=agent_context.found_knowledge,
                query_results=agent_context.query_results,
                error_type="empty_stream",
            )
            tool_calls = [{"type": "tool_decision", **fallback}]
            logger.warning(
                f"[AgenticLoop] Empty response, falling back to: "
                f"{fallback.get('tool', '?')}({json.dumps(fallback.get('arguments', {}), default=str)[:200]})"
            )

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


        # Capture decision in reasoning trace
        if len(tool_calls) > 1:
            display_trace.append({
                "step_type": "parallel_tool_decision",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tools": [{"tool": tc.get("tool"), "arguments": tc.get("arguments", {})} for tc in tool_calls],
            })
        else:
            tc0 = tool_calls[0]
            display_trace.append({
                "step_type": "tool_decision",
                "iteration": iteration,
                "timestamp_ms": int(time.time() * 1000) - start_time_ms,
                "tool": tc0.get("tool", "unknown"),
                "reasoning": tc0.get("reasoning", ""),
                "arguments": tc0.get("arguments", {}),
            })

        # Append ONE assistant message with all tool calls (works for 1 or N)
        narration_content = narration_text or None
        messages.append(format_assistant_tool_calls_message(
            [
                {
                    "tool_call_id": tc.get("tool_call_id") or f"call_{tc.get('tool')}_{iteration}_{i}",
                    "tool_name": tc.get("tool"),
                    "arguments": tc.get("arguments", {}),
                }
                for i, tc in enumerate(tool_calls)
            ],
            reasoning_details=turn_reasoning_details,
            content=narration_content,
        ))

        # Shared handler kwargs that don't change per tool call
        _handler_common = dict(
            messages=messages,
            service=service,
            session_id=message.session_id,
            display_trace=display_trace,
            iteration=iteration,
            start_time_ms=start_time_ms,
            cancel_event=message.cancel_event,
            conversation_id=message.conversation_id,
            tracer=_tracer,
        )

        confirmation_pending = False

        for i, tc in enumerate(tool_calls):
            tool_name = tc.get("tool", "unknown")
            arguments = tc.get("arguments", {})
            tool_call_id = tc.get("tool_call_id") or f"call_{tool_name}_{iteration}_{i}"

            yield emit_debug_tool_call(tool_name, arguments)
            logger.info(f"[AgenticLoop] Exec {tool_name}({json.dumps(arguments, default=str)[:500]})")

            if tool_name == "search":
                async for event in execute_search(
                    **_handler_common,
                    agent_context=agent_context,
                    tool_executor=tool_executor,
                    iter_span=_iter_span,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                    question=message.text,
                ):
                    yield event

            elif tool_name == "get_article":
                async for event in execute_get_article(
                    messages=messages,
                    tool_executor=tool_executor,
                    display_trace=display_trace,
                    iteration=iteration,
                    start_time_ms=start_time_ms,
                    tracer=_tracer,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                ):
                    yield event

            elif tool_name == "read_mcp_resource":
                async for event in execute_read_mcp_resource(
                    messages=messages,
                    display_trace=display_trace,
                    iteration=iteration,
                    start_time_ms=start_time_ms,
                    tracer=_tracer,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                    caller=message.caller,
                ):
                    yield event

            elif tool_name == "load_skill":
                async for event in execute_load_skill(
                    messages=messages,
                    tool_executor=tool_executor,
                    display_trace=display_trace,
                    iteration=iteration,
                    start_time_ms=start_time_ms,
                    tracer=_tracer,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                ):
                    yield event

            elif tool_name == "interact_with_page":
                action = BUILTIN_TOOLS["interact_with_page"]
                async for event in execute_client_action(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    action_name=tool_name,
                    parameters=arguments,
                    action=action,
                    thinking_text=thinking_text,
                ):
                    yield event

            elif tool_name == "render_chart":
                action = BUILTIN_TOOLS["render_chart"]
                async for event in execute_client_action(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    action_name=tool_name,
                    parameters=arguments,
                    action=action,
                    thinking_text=thinking_text,
                ):
                    yield event

            elif tool_name == "render_table":
                action = BUILTIN_TOOLS["render_table"]
                async for event in execute_client_action(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    action_name=tool_name,
                    parameters=arguments,
                    action=action,
                    thinking_text=thinking_text,
                ):
                    yield event

            elif tool_name == "render_metric":
                action = BUILTIN_TOOLS["render_metric"]
                async for event in execute_client_action(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    action_name=tool_name,
                    parameters=arguments,
                    action=action,
                    thinking_text=thinking_text,
                ):
                    yield event

            elif tool_name == "reconnect_account":
                async for event in execute_reconnect_account(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                    caller=message.caller,
                ):
                    yield event

            elif agent_context.is_registered_tool(tool_name):
                action = agent_context.get_tool_by_name(tool_name)
                if not action:
                    messages.append(format_tool_result_message_native(
                        tool_call_id=tool_call_id,
                        result_content=f"Tool '{tool_name}' not found in registered tools.",
                    ))
                    continue

                if action.get("_openapi_source_id"):
                    async for event in execute_openapi_source_tool(
                        **_handler_common,
                        tool_call_id=tool_call_id,
                        tool_name=tool_name,
                        openapi_source_id=action["_openapi_source_id"],
                        openapi_operation=action["_openapi_operation"],
                        arguments=arguments,
                        caller=message.caller,
                    ):
                        yield event
                        if event.get("type") == "confirmation_request":
                            confirmation_pending = True
                elif action.get("_mcp_source_id"):
                    async for event in execute_mcp_source_tool(
                        **_handler_common,
                        tool_call_id=tool_call_id,
                        tool_name=tool_name,
                        mcp_original_name=action["_mcp_original_name"],
                        mcp_source_id=action["_mcp_source_id"],
                        arguments=arguments,
                        caller=message.caller,
                        requires_confirmation=action.get("_requires_confirmation", False),
                    ):
                        yield event
                        if event.get("type") == "confirmation_request":
                            confirmation_pending = True
                elif action.get("tool_type") == "server_side":
                    async for event in execute_server_tool(
                        **_handler_common,
                        tool_call_id=tool_call_id,
                        tool_name=tool_name,
                        arguments=arguments,
                        tool_config=action,
                        caller=message.caller,
                    ):
                        yield event
                        if event.get("type") == "confirmation_request":
                            confirmation_pending = True
                else:
                    async for event in execute_client_action(
                        **_handler_common,
                        tool_call_id=tool_call_id,
                        action_name=tool_name,
                        parameters=arguments,
                        action=action,
                        thinking_text=thinking_text,
                    ):
                        yield event

            elif tool_name == "execute":
                resolved = resolve_execute_action(
                    messages=messages,
                    agent_context=agent_context,
                    tool_executor=tool_executor,
                    tool_call_id=tool_call_id,
                    arguments=arguments,
                )
                if resolved is None:
                    continue
                action_name, parameters, action = resolved
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
                            agent_context.add_tool_results(search_results, action_name)
                if not action:
                    messages.append(format_tool_result_message_native(
                        tool_call_id=tool_call_id,
                        result_content=f"Tool '{action_name}' not found. Use search to find available tools.",
                    ))
                    continue
                async for event in execute_client_action(
                    **_handler_common,
                    tool_call_id=tool_call_id,
                    action_name=action_name,
                    parameters=parameters,
                    action=action,
                    thinking_text=thinking_text,
                ):
                    yield event

            else:
                base_tools = ["search", "interact_with_page"]
                action_tool_names = [t.get("name") for t in agent_context.registered_tools]
                all_tools = base_tools + action_tool_names
                logger.warning(f"[AgenticLoop] Unknown tool: {tool_name}")
                messages.append(format_tool_result_message_native(
                    tool_call_id=tool_call_id or f"call_unknown_{iteration}",
                    result_content=f"Unknown tool '{tool_name}'. Available tools: {', '.join(all_tools)}",
                ))

            if confirmation_pending:
                break

        if thinking_started:
            yield emit_thinking_done(thinking_id)

        # End of iteration -- checkpoint state for periodic flush
        if _iter_span:
            _iter_span.end()
            _iter_span = None
        yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

        if confirmation_pending:
            logger.info("[AgenticLoop] Confirmation requested, stopping loop")
            _loop_span.set_attribute("agent.status", "CONFIRMATION_PENDING")
            _loop_span.set_attribute("agent.iterations", iteration + 1)
            _loop_span.set_attribute("agent.duration_ms", int((time.time() - start_time) * 1000))
            _loop_span.end()
            otel_context.detach(_loop_token)
            yield {
                "type": "complete",
                "registered_tools": agent_context.registered_tools,
                "display_trace": display_trace,
                "thinking_text": all_thinking_text.strip(),
            }
            return

    # Max iterations reached - generate fallback response
    logger.warning(f"[AgenticLoop] Max iterations ({MAX_AGENT_ITERATIONS}) reached")

    if agent_context.found_knowledge:
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
            question=message.text,
            sources=sources,
            classification=classification,
            site_context=site_context,
            site_description=site_description,
            cancel_event=message.cancel_event,
            user_context=message.user_context,
            images=message.images,
            environment_context=environment_context,
            temperature=service.temperature,
            max_tokens=service.max_tokens,
            language=message.language,
        ):
            yield event
    else:
        yield {"type": "token", "text": get_fallback_message()}
        yield {"type": "sources", "sources": []}

    if agent_context.token_budget and agent_context.token_budget.iteration_history:
        display_trace.append({
            "step_type": "token_summary",
            "total_prompt_tokens": agent_context.token_budget.total_prompt_tokens,
            "total_completion_tokens": agent_context.token_budget.total_completion_tokens,
            "peak_occupancy_pct": round(agent_context.token_budget.peak_occupancy_pct, 2),
            "iterations": len(agent_context.token_budget.iteration_history),
        })

    _loop_span.set_attribute("agent.status", "MAX_ITERATIONS")
    _loop_span.set_attribute("agent.iterations", MAX_AGENT_ITERATIONS)
    _loop_span.set_attribute("agent.duration_ms", int((time.time() - start_time) * 1000))
    _loop_span.set_attribute("agent.total_tokens_prompt", agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0)
    _loop_span.set_attribute("agent.total_tokens_completion", agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0)
    duration_ms = int((time.time() - start_time) * 1000)
    total_p = agent_context.token_budget.total_prompt_tokens if agent_context.token_budget else 0
    total_c = agent_context.token_budget.total_completion_tokens if agent_context.token_budget else 0
    logger.warning(
        f"[AgenticLoop] Max iterations reached: {MAX_AGENT_ITERATIONS} iterations, {duration_ms}ms, "
        f"{total_p + total_c:,} tokens ({total_p:,}p + {total_c:,}c)"
    )
    _loop_span.end()
    otel_context.detach(_loop_token)

    yield _build_state_checkpoint(messages, turn_start_idx, display_trace, agent_context, model_name)

    yield {
        "type": "complete",
        "registered_tools": agent_context.registered_tools,
        "display_trace": display_trace,
        "thinking_text": all_thinking_text.strip(),
    }
