"""
Streaming event schema and emitter functions.

Event Type Reference (Backend -> SDK)
=====================================

All events yielded from agentic_loop must be handled by:
1. streamable_http.py (transforms to JSON-RPC SSE format)
2. SDK mcp-client.ts (handles via callbacks)

VALID EVENT TYPES (yielded from agentic_loop):

| Event Type           | Handler Location          | SDK Callback              |
|----------------------|---------------------------|---------------------------|
| token                | streamable_http L346-363  | onToken                   |
| sources              | streamable_http L395-397  | structuredContent.sources |
| actions              | streamable_http L399-402  | structuredContent.actions |
| progress             | streamable_http L365-376  | onProgress                |
| debug                | streamable_http L378-393  | debugLog.add (DebugPanel) |
| action_request       | streamable_http L429-447  | onActionRequest           |
| conversation_started | streamable_http L404-419  | onConversationStarted     |
| token_usage          | streamable_http            | onTokenUsage              |
| plan.created         | streamable_http L421-427  | onPlan                    |
| complete             | streamable_http L499-533  | onComplete (final resp)   |
| error                | streamable_http L535-565  | onError                   |

PROGRESS EVENT KINDS (nested in type="progress"):

| Kind       | Emitter Function      | UI Display                    |
|------------|-----------------------|-------------------------------|
| thinking   | emit_thinking_*       | Collapsible thinking section  |
| search     | emit_search_*         | Search with result count      |
| tool_call  | emit_tool_call_*      | Tool execution status         |
| plan       | emit_plan_*           | Plan creation status          |
| generating | emit_generating_start | Response generation spinner   |

SERVER-SIDE ONLY (not yielded to client):

- reasoning_trace: Token usage analytics, captured via OpenTelemetry span attributes
- tool_decision: Internal event consumed by agentic loop

DEPRECATED (handlers removed from streamable_http.py):

- query_request: Superseded by action_request
- execute_step: Superseded by action_request

Progress Event Schema:

    {
        "type": "progress",
        "data": {
            "kind": str,           # "thinking", "search", "tool_call", "plan", "generating"
            "id": str,             # Unique ID (for streaming updates)
            "label": str,          # Display label
            "status": str,         # "active", "done", "error"
            "text": str | None,    # Streaming text (delta mode)
            "children": list,      # Sub-items (e.g., search sources)
            "metadata": dict       # Event-specific data
        }
    }
"""

from typing import Literal, Optional, TypedDict
import uuid


class ProgressChild(TypedDict, total=False):
    """A child item within a progress event (e.g., search source)."""
    id: str
    label: str
    url: Optional[str]


class ProgressData(TypedDict, total=False):
    """The data payload for a progress event."""
    kind: Literal["thinking", "search", "tool_call", "plan", "generating"]
    id: str
    label: str
    status: Literal["active", "done", "error"]
    text: Optional[str]
    children: list[ProgressChild]
    metadata: dict


class ProgressEvent(TypedDict):
    """A progress event with nested data structure."""
    type: Literal["progress"]
    data: ProgressData


# Event kind constants
KIND_THINKING = "thinking"
KIND_SEARCH = "search"
KIND_TOOL_CALL = "tool_call"
KIND_PLAN = "plan"
KIND_GENERATING = "generating"
KIND_TOKEN_USAGE = "token_usage"
KIND_SECRET_REVEAL = "secret_reveal"


def format_tool_name_for_display(tool_name: str) -> str:
    """Format a tool/action name for user-friendly display.
    
    Converts snake_case to Title Case with spaces.
    Examples:
        - "interact_with_page" -> "Interact with page"
        - "search_knowledge_base" -> "Search knowledge base"
        - "execute" -> "Execute"
    
    Args:
        tool_name: The internal tool name (typically snake_case)
        
    Returns:
        Human-readable display name
    """
    if not tool_name:
        return "Action"
    
    # Replace underscores with spaces and capitalize first letter
    display_name = tool_name.replace("_", " ")
    
    # Capitalize only the first letter, keep rest lowercase
    return display_name.capitalize()


def emit_thinking_start() -> ProgressEvent:
    """Emit start of thinking phase."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_THINKING,
            "id": str(uuid.uuid4()),
            "label": "Thinking...",
            "status": "active",
        }
    }


def emit_thinking_delta(id: str, text_delta: str) -> ProgressEvent:
    """Emit thinking text delta (append mode)."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_THINKING,
            "id": id,
            "label": "Thinking...",
            "status": "active",
            "text": text_delta,
        }
    }


def emit_thinking_done(id: str) -> ProgressEvent:
    """Emit thinking complete."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_THINKING,
            "id": id,
            "label": "Thinking...",
            "status": "done",
        }
    }


def emit_search_start(query: str) -> ProgressEvent:
    """Emit start of search."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_SEARCH,
            "id": str(uuid.uuid4()),
            "label": f"Searching: {query}",
            "status": "active",
            "metadata": {"query": query}
        }
    }


def emit_search_complete(id: str, result_count: int, sources: list = None, query: str = None) -> ProgressEvent:
    """Emit search complete with results.
    
    Args:
        id: Event ID from the corresponding emit_search_start
        result_count: Number of results found
        sources: Optional list of source dicts with title/url
        query: Optional search query (displayed in label for context, especially for 0 results)
    """
    # Include query in label for context (especially useful when 0 results)
    if query:
        label = f"Found {result_count} results for '{query}'"
    else:
        label = f"Found {result_count} results"
    
    metadata = {"result_count": result_count}
    if query:
        metadata["query"] = query
    
    event: ProgressEvent = {
        "type": "progress",
        "data": {
            "kind": KIND_SEARCH,
            "id": id,
            "label": label,
            "status": "done",
            "metadata": metadata
        }
    }
    if sources:
        event["data"]["children"] = [
            {"id": str(i), "label": s.get("title", ""), "url": s.get("url")}
            for i, s in enumerate(sources[:5])
        ]
    return event


def emit_generating_start() -> ProgressEvent:
    """Emit start of response generation."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_GENERATING,
            "id": str(uuid.uuid4()),
            "label": "Generating response...",
            "status": "active",
        }
    }


def emit_tool_call_start(
    tool_name: str,
    arguments: dict = None,
    reasoning: str = None,
) -> ProgressEvent:
    """Emit start of tool/action call.
    
    Args:
        tool_name: Name of the tool/action being called
        arguments: Parameters passed to the tool
        reasoning: LLM's thinking/reasoning that led to this tool call (shown when expanded)
    """
    display_name = format_tool_name_for_display(tool_name)
    event: ProgressEvent = {
        "type": "progress",
        "data": {
            "kind": KIND_TOOL_CALL,
            "id": str(uuid.uuid4()),
            "label": f"Running {display_name}...",
            "status": "active",
            "metadata": {"tool_name": tool_name, "arguments": arguments or {}}
        }
    }
    if reasoning:
        event["data"]["text"] = reasoning
    return event


def emit_tool_call_complete(
    id: str,
    tool_name: str,
    success: bool = True,
    result_summary: str = None,
    arguments: dict = None,
) -> ProgressEvent:
    """Emit tool call complete with optional result summary.
    
    The completion event is self-contained: it includes both the original
    arguments (inputs) and the result summary (output) so the final state
    tells the full story without needing to reference the start event.
    
    Args:
        id: Event ID from the corresponding emit_tool_call_start
        tool_name: Name of the tool/action
        success: Whether the tool call succeeded
        result_summary: Optional formatted summary of the result (shown when expanded)
        arguments: Original arguments/parameters passed to the tool call
    """
    display_name = format_tool_name_for_display(tool_name)
    label = f"Completed {display_name}" if success else f"Failed {display_name}"
    event: ProgressEvent = {
        "type": "progress",
        "data": {
            "kind": KIND_TOOL_CALL,
            "id": id,
            "label": label,
            "status": "done" if success else "error",
            "metadata": {"tool_name": tool_name, "arguments": arguments or {}},
        }
    }
    if result_summary:
        event["data"]["text"] = result_summary
    return event


def emit_plan_start() -> ProgressEvent:
    """Emit start of plan creation."""
    return {
        "type": "progress",
        "data": {
            "kind": KIND_PLAN,
            "id": str(uuid.uuid4()),
            "label": "Creating plan...",
            "status": "active",
        }
    }


def emit_plan_complete(id: str, plan_steps: list = None) -> ProgressEvent:
    """Emit plan complete with optional steps as children."""
    event: ProgressEvent = {
        "type": "progress",
        "data": {
            "kind": KIND_PLAN,
            "id": id,
            "label": "Plan created",
            "status": "done",
        }
    }
    if plan_steps:
        event["data"]["children"] = [
            {"id": str(i), "label": step.get("title", step.get("action", ""))}
            for i, step in enumerate(plan_steps)
        ]
    return event


def emit_token_usage(
    prompt_tokens: int,
    completion_tokens: int,
    total_prompt_tokens: int,
    total_completion_tokens: int,
    total_used: int,
    context_window: int,
    occupancy_pct: float,
    model_name: str,
    iteration: int,
) -> dict:
    """Emit token usage event for real-time context window tracking.
    
    Sent after each LLM iteration so the client can render a
    Cursor-style context gauge that fills progressively.
    
    Args:
        prompt_tokens: Input tokens for this iteration
        completion_tokens: Output tokens for this iteration
        total_prompt_tokens: Cumulative prompt tokens across all iterations
        total_completion_tokens: Cumulative completion tokens across all iterations
        total_used: Current total tokens in context
        context_window: Maximum context window for the model
        occupancy_pct: Current context occupancy percentage (0-100)
        model_name: Name of the model in use
        iteration: Current iteration number (0-indexed)
    
    Returns:
        Event dict to yield in the SSE stream
    """
    return {
        "type": "token_usage",
        "data": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_prompt_tokens": total_prompt_tokens,
            "total_completion_tokens": total_completion_tokens,
            "total_used": total_used,
            "context_window": context_window,
            "occupancy_pct": round(occupancy_pct, 2),
            "model_name": model_name,
            "iteration": iteration,
        }
    }


def emit_action_request(
    action_name: str,
    parameters: dict,
    action: dict = None,
) -> dict:
    """
    Emit action_request event to tell SDK to execute an action.
    
    This is the unified action execution event for the simplified 3-tool
    architecture. The SDK executes the action and sends the result back
    via action/result JSON-RPC.
    
    Args:
        action_name: Name of the action to execute
        parameters: Parameters to pass to the action handler
        action: Full action definition for SDK (schema, type, etc.)
    
    Returns:
        Event dict to yield in the SSE stream
    """
    return {
        "type": "action_request",
        "action_name": action_name,
        "parameters": parameters or {},
        "action": action or {},
    }


# ============================================================================
# Debug Events (for SDK DebugPanel)
# ============================================================================

class DebugEvent(TypedDict):
    """A debug event for SDK DebugPanel visibility into server-side processing."""
    type: Literal["debug"]
    event: str
    data: dict


def emit_debug_event(event: str, data: dict = None) -> DebugEvent:
    """
    Emit a debug event for SDK DebugPanel.
    
    These events are curated summaries of server-side processing,
    not verbose internal logs. They help SDK implementers understand
    what the agent is doing without overwhelming them with details.
    
    Args:
        event: Event name (e.g., 'server:thinking', 'server:tool_call')
        data: Event data (curated, not verbose)
    
    Returns:
        Debug event dict to yield in the SSE stream
    """
    return {
        "type": "debug",
        "event": event,
        "data": data or {},
    }


def emit_debug_thinking(summary: str) -> DebugEvent:
    """Emit a curated thinking summary (not full chain-of-thought)."""
    return emit_debug_event("server:thinking", {"summary": summary})


def emit_debug_tool_call(tool: str, args: dict = None) -> DebugEvent:
    """Emit when agent decides to call a tool."""
    return emit_debug_event("server:tool_call", {"tool": tool, "args": args or {}})


def emit_debug_action_found(action: str, score: float = None) -> DebugEvent:
    """Emit when an action is matched from search."""
    data = {"action": action}
    if score is not None:
        data["score"] = round(score, 2)
    return emit_debug_event("server:action_found", data)


def emit_debug_action_execute(action: str) -> DebugEvent:
    """Emit when server is about to execute an action."""
    return emit_debug_event("server:action_execute", {"action": action})


def emit_debug_iteration(current: int, max_iterations: int) -> DebugEvent:
    """Emit agent loop iteration progress."""
    return emit_debug_event("server:iteration", {"current": current, "max": max_iterations})


def emit_debug_error(message: str, code: str = None) -> DebugEvent:
    """Emit a server-side error."""
    data = {"message": message}
    if code:
        data["code"] = code
    return emit_debug_event("server:error", data)


def emit_secret_reveal(
    ref: str,
    field_name: str,
    endpoint: str,
) -> dict:
    """Emit a secret_reveal progress event for the SDK reveal UI.

    Args:
        ref: Redemption token or customer reference
        field_name: Name of the sensitive field (used as label)
        endpoint: Relative path (Tier 1) or absolute URL (Tier 2) to fetch the secret
    """
    return {
        "type": "progress",
        "data": {
            "kind": KIND_SECRET_REVEAL,
            "id": f"secret-{ref}",
            "label": field_name,
            "status": "done",
            "metadata": {
                "ref": ref,
                "endpoint": endpoint,
            },
        },
    }


def format_query_result_summary(result: dict) -> str:
    """Format a query result dict for UI display. Returns the full result."""
    import json

    if not result:
        return ""

    if not isinstance(result, dict):
        return str(result)

    lines = []

    # Status line
    if "success" in result:
        status = "✓" if result["success"] else "✗"
        lines.append(f"{status} {'Success' if result['success'] else 'Failed'}")

    # Error details
    if "error" in result and result.get("error"):
        lines.append(f"Error: {result['error']}")

    # Full result as formatted JSON
    try:
        formatted = json.dumps(result, indent=2, default=str)
        lines.append(formatted)
    except Exception:
        lines.append(str(result))

    return "\n".join(lines)
