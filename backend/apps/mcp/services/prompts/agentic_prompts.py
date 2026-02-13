"""
Agentic loop prompts for tool-based reasoning.

Native tool calling architecture:
- search: Find actions and documentation. Discovered actions become native tools.
- interact_with_page: Interact with elements on the user's current page.
- [dynamic action tools]: Actions found via search are registered as callable tools.

The model responds directly via content tokens (no respond tool).
When the model produces content with no tool calls, the turn is over.

Uses OpenRouter's native tool calling API for structured tool decisions.
"""
import json
from typing import Any

def format_sources_for_prompt(sources: list[dict], non_citable_sources: list[dict] = None) -> str:
    """
    Format sources for LLM prompt.

    Uses a simple format that doesn't encourage inline citations.
    The LLM is separately instructed to list sources at the end via SOURCES_USED footer.

    Args:
        sources: List of source dicts with:
            - 'citation_num': The citation number (e.g., 1, 2, 3)
            - 'title' or 'page_title': Source title
            - 'content': Pre-computed smart context (preferred)
            - 'chunk_text': Fallback content
        non_citable_sources: Optional list of context-only sources (no citation number)

    Returns:
        Formatted context string
    """
    if not sources and not non_citable_sources:
        return "No sources available."

    formatted = []

    for s in sources:
        citation_num = s.get('citation_num', '?')
        title = s.get('title') or s.get('page_title') or s.get('url', 'Source')
        # Prefer pre-computed 'content', fall back to raw fields
        content = s.get('content') or s.get('chunk_text', '')
        # Use "Source N:" instead of "[N]" to avoid priming LLM to use bracket citations
        formatted.append(f"Source {citation_num}: {title}\n{content}")

    if non_citable_sources:
        formatted.append("\nAdditional context (for reference only):")
        for s in non_citable_sources:
            title = s.get('title', 'Background Knowledge')
            content = s.get('content') or s.get('chunk_text', '')
            formatted.append(f"{title}\n{content}")

    return "\n\n".join(formatted)


def format_conversation_history(history: list[dict]) -> str:
    """
    Format conversation history for inclusion in prompts.

    Args:
        history: List of conversation turns with 'role' and 'content' keys

    Returns:
        Formatted conversation history string
    """
    if not history:
        return ""

    formatted = []
    for turn in history:
        role = turn.get('role', 'user')
        content = turn.get('content', '')

        if role == 'user':
            formatted.append(f"User: {content}")
        elif role == 'assistant':
            formatted.append(f"Assistant: {content}")
        else:
            formatted.append(f"{role.title()}: {content}")

    return "\n\n".join(formatted)


# =============================================================================
# NATIVE TOOL CALLING MESSAGE HELPERS
# =============================================================================

def build_agentic_prompt(
    question: str,
    site_context: str,
    environment: str = "",
    capabilities: str = "",
    product_guidance: str = "",
    images: list[dict[str, str]] = None,
    conversation_history: list[dict[str, str]] = None,
    has_page_context: bool = False,
) -> list[dict[str, Any]]:
    """
    Build initial messages for the agentic ReAct loop with native tool calling.
    
    This creates the system prompt and user message for the main reasoning loop.
    Tool definitions are passed separately via the API's tools parameter.
    
    Args:
        question: User's question/request
        site_context: Name of the product/site (e.g., "Superset")
        environment: Formatted user environment context (page, role, etc.)
        capabilities: Summary of available actions/capabilities
        product_guidance: Custom product-specific instructions
        images: Optional list of image dicts
        conversation_history: Optional list of prior conversation turns
        has_page_context: Whether DOM snapshot with element refs is available
        
    Returns:
        List of message dicts ready for LLM API call with tools parameter
    """
    messages = []
    
    # Build tools section - core tools always listed, conditional tools only when relevant
    tools_lines = [
        "You have access to these tools:",
        "- search: Find actions and documentation relevant to the user's request.",
    ]
    if has_page_context:
        tools_lines.extend([
            "- interact_with_page: Click, type, or interact with elements on the user's current page.",
            '  - operation: "click" | "type" | "select" | "focus" | "toggle"',
            '  - ref: The exact ref from page context (e.g., "pr-ml72ub3b-f"). Look for [[pr-...]] refs.',
            "  - value: Text to type or option to select (for type/select operations)",
        ])
    tools_lines.append("")
    tools_lines.append("Occasionally, if it helps the user understand what's happening, briefly explain why you're calling a tool.")
    tools_lines.append("When you have enough information, respond directly to the user without calling any tools.")
    tools_section = "\n".join(tools_lines)
    
    # Build how_it_works section
    # NOTE: Only include guidance that applies universally. For conditional features
    # (e.g., corrections, get_article), add guidance to search results instead.
    # This avoids wasting tokens when those features don't exist for a given site.
    how_it_works_lines = [
        "Search returns two types of results:",
        "- Actions: capabilities you can execute (create, navigate, fetch data). These become tools you can call directly with structured parameters.",
        "- Knowledge: documentation and help articles relevant to the user's question.",
        "",
        "Use knowledge to inform your responses. Use actions to perform tasks.",
        "Each action has a parameter schema -- fill in only the fields its schema requires.",
    ]
    how_it_works = "\n".join(how_it_works_lines)
    
    # System prompt - tools are defined via API parameter
    # IMPORTANT: Only include guidance that applies to ALL sites/products.
    # Do NOT add conditional features here (e.g., corrections, get_article hints).
    # Instead, add them to search results or tool results when the feature is
    # actually encountered. This saves ~80 tokens per turn for sites without
    # these features and keeps the prompt lean.
    system_prompt_text = f"""You are an AI assistant for {site_context}.

You help users accomplish tasks in their app.

<tools>
{tools_section}
</tools>

<how_it_works>
{how_it_works}
</how_it_works>

<response_guidelines>
Actions are YOUR tools -- never mention action names, tool names, or API details to the user.
Describe what you can do in natural language ("I can do that for you"), not in technical terms ("I'll call the create_report action").
When answering "how do I" questions, use knowledge articles to explain the process in user-friendly terms, and offer to perform the action if one exists.
</response_guidelines>

<thoroughness>
Think before you act. Before executing, make sure you understand what the user actually needs -- not just what they literally said. For complex requests, search broadly and plan the sequence before starting. After completing, verify the result makes sense before presenting it.
</thoroughness>

<persistence>
Keep working until the user's request is fully resolved. Use results from earlier actions to inform later ones. If something fails, retry with different parameters or try an alternative approach. If stuck after 2-3 attempts, explain what's blocking you.
</persistence>

<usefulness>
Your goal is to actually help the user, not just call tools successfully. A successful action isn't the same as a useful outcome. If data is sparse or meaningless, say so rather than producing empty results. If the user's approach won't give them what they want, say so and suggest a better path. The user is better served by honest feedback than technically correct but useless output.
</usefulness>

<scope>
Match your effort to the request. Simple questions get direct answers. Complex tasks get careful execution. Don't over-build -- if the user asks for one chart, don't add six filters they didn't request. Don't under-build either -- if creating something, make it actually useful, not just technically present.
</scope>

<show_your_work>
After completing a task, check that the result makes sense -- a dashboard should have data, a query should return meaningful results. Then navigate the user to where they can see it. The user should end up looking at something useful, not an empty shell.
</show_your_work>"""
    
    # Add environment context to system prompt if available
    if environment:
        system_prompt_text += f"\n\n<user_environment>\n{environment}\n</user_environment>"
    
    if capabilities:
        system_prompt_text += f"\n\n<available_capabilities>\n{capabilities}\n</available_capabilities>"
        
    if product_guidance:
        system_prompt_text += f"\n\n<product_guidance>\n{product_guidance}\n</product_guidance>"
    
    # System message is always plain text (images go in user message)
    messages.append({"role": "system", "content": system_prompt_text})
    
    # Add prior conversation history if provided.
    # Always full-fidelity: messages with tool_calls, tool results, reasoning_details
    # (from ChatMessage rows)
    if conversation_history:
        messages.extend(conversation_history)
    
    # Add user message with question (include images via image_url if provided)
    if images:
        user_content: list[dict[str, Any]] = [{"type": "text", "text": question}]
        for img in images:
            img_url = img.get("url")
            if img_url:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": img_url,
                        "detail": img.get("detail", "low"),
                    }
                })
        messages.append({"role": "user", "content": user_content})
    else:
        messages.append({"role": "user", "content": question})
    
    return messages


def format_assistant_tool_call_message(
    tool_name: str,
    arguments: dict,
    tool_call_id: str,
    reasoning_details: list[dict] | None = None,
    content: str | None = None,
) -> dict[str, Any]:
    """
    Format an assistant message with a tool call for native tool calling.
    
    This creates the message format required by OpenAI/OpenRouter for
    representing that the assistant called a tool.
    
    Args:
        tool_name: Name of the tool being called
        arguments: Arguments passed to the tool
        tool_call_id: Unique ID for this tool call
        reasoning_details: Raw reasoning_details from the LLM response.
            OpenRouter requires these to be passed back on assistant messages
            for reasoning continuity across tool-calling turns.
        content: Optional text content the model produced alongside the tool call
            (narration before calling a tool). Included in the assistant message
            so the model has context in subsequent turns.
        
    Returns:
        Message dict with role='assistant' and tool_calls array
    """
    msg = {
        "role": "assistant",
        "content": content,
        "tool_calls": [{
            "id": tool_call_id,
            "type": "function",
            "function": {
                "name": tool_name,
                "arguments": json.dumps(arguments),
            },
        }],
    }
    if reasoning_details:
        msg["reasoning_details"] = reasoning_details
    return msg


def format_assistant_tool_calls_message(
    tool_calls: list[dict[str, Any]],
    reasoning_details: list[dict] | None = None,
    content: str | None = None,
) -> dict[str, Any]:
    """
    Format an assistant message with multiple tool calls for native tool calling.
    
    This creates the message format required by OpenAI/OpenRouter for
    representing that the assistant called multiple tools in parallel.
    
    Args:
        tool_calls: List of tool call dicts, each with:
            - tool_call_id: Unique ID for the tool call
            - tool_name: Name of the tool being called
            - arguments: Arguments dict passed to the tool
        reasoning_details: Raw reasoning_details from the LLM response.
            OpenRouter requires these to be passed back on assistant messages
            for reasoning continuity across tool-calling turns.
        content: Optional text content the model produced alongside the tool calls
            (narration before calling tools). Included in the assistant message
            so the model has context in subsequent turns.
        
    Returns:
        Message dict with role='assistant' and tool_calls array containing all calls
    """
    msg = {
        "role": "assistant",
        "content": content,
        "tool_calls": [
            {
                "id": tc["tool_call_id"],
                "type": "function",
                "function": {
                    "name": tc["tool_name"],
                    "arguments": json.dumps(tc["arguments"]),
                },
            }
            for tc in tool_calls
        ],
    }
    if reasoning_details:
        msg["reasoning_details"] = reasoning_details
    return msg


def format_tool_result_message_native(
    tool_call_id: str,
    result_content: str,
) -> dict[str, Any]:
    """
    Format a tool result message for native tool calling.
    
    This creates the message format required by OpenAI/OpenRouter for
    providing tool results back to the model.
    
    Args:
        tool_call_id: The ID from the tool call this is responding to
        result_content: The result content as a string
        
    Returns:
        Message dict with role='tool' and tool_call_id
    """
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": result_content,
    }


def format_search_result_content(
    query: str,
    actions: list[dict] = None,
    knowledge: list[dict] = None,
) -> str:
    """
    Format search results as content string for tool result message.
    
    Args:
        query: The search query
        actions: List of action dicts found
        knowledge: List of knowledge dicts found
        
    Returns:
        Formatted string for tool result content
    """
    parts = [f"Search results for '{query}':"]
    
    if actions:
        parts.append(f"\nActions ({len(actions)} found):")
        for action in actions[:5]:
            name = action.get("name", "unknown")
            desc = action.get("description", "")
            action_type = action.get("action_type", "")
            schema = action.get("schema") or action.get("data_schema", {})
            schema_str = json.dumps(schema, indent=2) if schema else "{}"
            parts.append(f"  - {name} [{action_type}]: {desc}\n    Schema: {schema_str}")
    
    if knowledge:
        parts.append(f"\nKnowledge ({len(knowledge)} found):")
        for k in knowledge[:3]:
            title = k.get("title", "Untitled")
            content = k.get("content", "")
            heading_path = k.get("heading_path", [])
            item_id = k.get("item_id", "")
            source_type = k.get("source_type", "")
            section = " > ".join(heading_path) if heading_path else ""
            
            # Label corrections distinctly so LLM knows to prioritize them
            if source_type == "correction":
                header = f"  - [CORRECTION] {title}"
            else:
                header = f"  - {title}"
            
            if section:
                header += f" [{section}]"
            if item_id:
                header += f" (item_id: {item_id})"
            parts.append(f"{header}:\n    {content}")
    
    if not actions and not knowledge:
        parts.append("\nNo results found. Try a different query or respond to the user.")
    
    # Append contextual hints only when relevant
    # These hints are added here (not in the system prompt) because they only
    # apply when specific features are present. This follows the principle of
    # keeping the system prompt lean and adding conditional guidance just-in-time.
    hints = []
    
    # Check if any knowledge has item_id (for get_article hint)
    has_item_ids = any(k.get("item_id") for k in (knowledge or []))
    if has_item_ids:
        hints.append("Use get_article with item_id to fetch full article content.")
    
    # Check if any knowledge is a correction
    has_corrections = any(k.get("source_type") == "correction" for k in (knowledge or []))
    if has_corrections:
        hints.append(
            "[CORRECTION] results are verified human feedback. "
            "Prefer them over conflicting documentation. "
            "Use the information naturally without mentioning corrections to the user."
        )
    
    if hints:
        parts.append("\n[Hints]\n" + "\n".join(hints))
    
    return "\n".join(parts)


def format_execute_result_content(
    action_name: str,
    success: bool,
    result: Any = None,
    error: str = None,
    dom_snapshot: str = None,
) -> str:
    """
    Format execute results as content string for tool result message.
    
    Args:
        action_name: Name of the action executed
        success: Whether execution succeeded
        result: Result data if successful
        error: Error message if failed
        dom_snapshot: Updated DOM content after action (for interact_with_page)
        
    Returns:
        Formatted string for tool result content
    """
    if success:
        result_preview = json.dumps(result, default=str) if result else "{}"
        content = f"Action '{action_name}' completed successfully.\nResult: {result_preview}"
        
        # Append DOM changes if provided (for interact_with_page actions)
        if dom_snapshot:
            content += f"\n\n[Page changes after action]\n{dom_snapshot}"
        
        return content
    else:
        return f"Action '{action_name}' failed: {error or 'Unknown error'}"


# =============================================================================

# NOTE: build_session_resume_prompt was removed -- session resumption now uses
# simple continuation prompt in session_resume.py
