"""
Smart default actions and recovery logic for LLM failures.

Recovery strategy:
- search: The safe fallback (always works)
- execute: Use when we have actions
- search again: When we have knowledge or results but no tool calls,
  the model will respond directly on the next turn

Copyright (C) 2025 Pillar Team
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Recovery prompt for lightweight LLM fallback (used in non-streaming path only)
RECOVERY_PROMPT = """The previous attempt to process this query failed.

Query: {question}
Current state: {state_summary}
Error: {error_type}

What should we do? Choose ONE:
1. search - Look for actions or documentation
2. skip - Tell user we're having trouble

Respond with just the action name."""


def get_smart_default_action(
    question: str,
    iteration: int = 0,
    found_tools: Optional[List[Dict]] = None,
    found_knowledge: Optional[List[Dict]] = None,
    query_results: Optional[List[Dict]] = None,
    error_type: Optional[str] = None,
    # backward compat alias
    found_actions: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Return a simple default action based on current state.
    
    Decision tree:
    1. If we have found_tools -> execute the first one
    2. If we have found_knowledge or query_results -> search again
       (the model will see the context and respond directly)
    3. Otherwise -> search (most common fallback)
    
    Args:
        question: The user's question
        iteration: Current iteration in the agent loop (0-indexed)
        found_tools: Tools found in previous iterations
        found_knowledge: Knowledge found in previous iterations
        query_results: Results from tool execution
        error_type: Type of error that triggered fallback (for logging)
        
    Returns:
        Tool decision dict with tool, arguments, and reasoning
    """
    # Accept old kwarg name for backward compat
    if found_tools is None and found_actions is not None:
        found_tools = found_actions

    logger.info(
        f"[Recovery] Last resort fallback: iteration={iteration}, "
        f"tools={len(found_tools) if found_tools else 0}, "
        f"knowledge={len(found_knowledge) if found_knowledge else 0}, "
        f"query_results={len(query_results) if query_results else 0}, "
        f"error={error_type}"
    )
    
    # Priority 1: If we have tools, execute the top one
    if found_tools and len(found_tools) > 0:
        top_tool = found_tools[0]
        tool_name = top_tool.get("name", "unknown_tool")
        logger.info(f"[Recovery] Executing tool: {tool_name}")
        return {
            "tool": "execute",
            "arguments": {
                "action_name": tool_name,
                "parameters": {},
            },
            "reasoning": f"Executing top tool '{tool_name}' (recovery)",
        }
    
    # Priority 2-4: Search (safe fallback for all cases)
    # If we have knowledge or query results, the model will see them
    # in context and respond directly on the next turn.
    if found_knowledge and len(found_knowledge) > 0:
        logger.info("[Recovery] Have knowledge but no tool calls, searching for more context")
    elif query_results and len(query_results) > 0:
        logger.info("[Recovery] Have query results but no tool calls, searching for more context")
    else:
        logger.info("[Recovery] No context available, searching")
    
    return {
        "tool": "search",
        "arguments": {"query": question},
        "reasoning": "Searching for relevant actions and knowledge (recovery)",
    }


def _summarize_query_results(results: List[Dict]) -> str:
    """
    Create a simple summary of query results without LLM.
    
    Provides a basic template-based summary that's better than
    showing raw data or an error message.
    
    Args:
        results: List of query result dicts
        
    Returns:
        Human-readable summary string
    """
    if not results:
        return "No data was returned from the query."
    
    # Get the first result
    result = results[0]
    action_name = result.get("action_name", "query")
    data = result.get("result", {})
    
    # Format based on data type
    if isinstance(data, list):
        count = len(data)
        if count == 0:
            return f"The {action_name} returned no items."
        elif count == 1:
            return f"Found 1 item from {action_name}."
        else:
            return f"Found {count} items from {action_name}."
    elif isinstance(data, dict):
        keys = list(data.keys())[:5]
        if keys:
            return f"Retrieved data with fields: {', '.join(keys)}"
        else:
            return f"Retrieved empty data from {action_name}."
    elif data is None:
        return f"The {action_name} returned no data."
    else:
        return f"Retrieved result from {action_name}."


def _summarize_knowledge(question: str, knowledge: List[Dict]) -> str:
    """
    Create a simple summary from knowledge without LLM.
    
    Provides the most relevant content from the top knowledge result.
    
    Args:
        question: The user's question
        knowledge: List of knowledge result dicts
        
    Returns:
        Summary based on the top knowledge result
    """
    if not knowledge:
        return "I couldn't find specific information about that."
    
    top = knowledge[0]
    title = top.get("title", "our documentation")
    content = top.get("content", "")
    
    # Send full content - no truncation so LLM sees complete information
    if content:
        return f"Based on {title}:\n\n{content}"
    else:
        return f"I found relevant information in {title}, but couldn't extract the details."


async def try_recovery_llm(
    llm_client,
    question: str,
    state_summary: str,
    error_type: str,
    timeout: float = 5.0,
) -> Optional[Dict[str, Any]]:
    """
    Attempt a simple recovery LLM call.
    
    Uses a minimal prompt that's less likely to fail.
    Returns None on any failure - caller should use smart default.
    
    Key differences from main LLM call:
    - Much shorter prompt (fewer tokens)
    - Lower max_tokens (just need one word)
    - Shorter timeout (don't wait long)
    - No retry (if this fails, use deterministic fallback)
    
    Args:
        llm_client: The LLM client instance
        question: The user's original question
        state_summary: Brief summary of current agent state
        error_type: Type of error that triggered recovery
        timeout: Maximum time to wait for response
        
    Returns:
        Tool decision dict if successful, None if failed
    """
    try:
        prompt = RECOVERY_PROMPT.format(
            question=question,  # Send full question for accurate recovery
            state_summary=state_summary,
            error_type=error_type,
        )
        
        response = await asyncio.wait_for(
            llm_client.complete_async(
                prompt=prompt,
                system_prompt="Respond with just the action name, nothing else.",
                max_tokens=20,  # We only need one word
                temperature=0.1,  # Deterministic
            ),
            timeout=timeout,
        )
        
        if not response or not response.strip():
            logger.debug("[Recovery] Recovery LLM returned empty response")
            return None
        
        action = response.strip().lower()
        
        logger.info(
            f"[Recovery] Recovery LLM suggested: {action}",
            extra={
                "event_type": "llm_recovery_suggestion",
                "suggestion": action,
            }
        )
        
        if "search" in action:
            return {"tool": "search", "arguments": {"query": question}, "reasoning": "Recovery LLM suggested search"}
        else:
            logger.debug(f"[Recovery] Unrecognized recovery suggestion: {action}")
            return None  # Unrecognized - use smart default
            
    except asyncio.TimeoutError:
        logger.warning(f"[Recovery] Recovery LLM timed out after {timeout}s")
        return None
    except Exception as e:
        logger.warning(f"[Recovery] Recovery LLM failed: {e}")
        return None  # Fail silently - smart default will handle


def build_state_summary(
    iteration: int,
    found_tools: Optional[List[Dict]] = None,
    found_knowledge: Optional[List[Dict]] = None,
    query_results: Optional[List[Dict]] = None,
    # backward compat alias
    found_actions: Optional[List[Dict]] = None,
) -> str:
    """
    Build a brief summary of current agent state for recovery prompts.
    
    Args:
        iteration: Current iteration number
        found_tools: Tools found so far
        found_knowledge: Knowledge found so far
        query_results: Query results received
        
    Returns:
        Brief text summary of state
    """
    if found_tools is None and found_actions is not None:
        found_tools = found_actions

    parts = [f"Iteration {iteration}"]
    
    if found_tools:
        tool_names = [t.get("name", "?") for t in found_tools[:3]]
        parts.append(f"Found tools: {', '.join(tool_names)}")
    
    if found_knowledge:
        knowledge_titles = [k.get("title", "?") for k in found_knowledge[:2]]
        parts.append(f"Found docs: {', '.join(knowledge_titles)}")
    
    if query_results:
        parts.append(f"{len(query_results)} query result(s)")
    
    if not found_tools and not found_knowledge and not query_results:
        parts.append("No context gathered yet")
    
    return ". ".join(parts)
