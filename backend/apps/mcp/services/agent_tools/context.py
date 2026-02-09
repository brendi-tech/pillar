"""
Agent context accumulator for the agentic reasoning loop.

Tracks all actions, knowledge, and query results found during tool calls,
plus the history of tool calls for reasoning. Also tracks tool errors for
LLM-based recovery.
"""
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from common.utils.token_budget import TokenBudget

# Score threshold for considering an action a good match
ACTION_MATCH_THRESHOLD = 0.6


@dataclass
class AgentContext:
    """
    Accumulator for context gathered during the agentic loop.
    
    Tracks all actions, knowledge, and query results found during tool calls,
    plus the history of tool calls for reasoning.
    
    Also maintains the multi-turn conversation history for LLM calls
    and tracks tool errors for LLM-based recovery decisions.
    
    Registered actions persist across conversation turns, enabling the LLM
    to call previously discovered actions without re-searching.
    """
    found_actions: List[Dict[str, Any]] = field(default_factory=list)
    found_knowledge: List[Dict[str, Any]] = field(default_factory=list)
    query_results: List[Dict[str, Any]] = field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    
    # Multi-turn conversation history for LLM calls
    messages: List[Dict[str, Any]] = field(default_factory=list)
    
    # Token budget tracking (optional, set by agentic loop)
    token_budget: Optional['TokenBudget'] = None
    
    # Tool errors for LLM-based recovery decisions
    tool_errors: List[Dict[str, Any]] = field(default_factory=list)
    
    # Registered actions as native tools (persisted across conversation turns)
    # Full action dicts for tool generation via action_to_tool()
    registered_actions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Conditional tool flags
    # has_page_context: True when DOM snapshot with element refs is present
    has_page_context: bool = False
    # get_article_unlocked: True after search returns knowledge chunks
    get_article_unlocked: bool = False
    
    def set_initial_messages(self, messages: List[Dict[str, Any]]) -> None:
        """
        Set the initial messages for the conversation (iteration 0).
        
        Args:
            messages: List of message dicts with 'role' and 'content' keys.
                      Typically includes system prompt and user query.
        """
        self.messages = messages.copy()
    
    def add_assistant_message(self, content: str) -> None:
        """
        Add an assistant message to the conversation history.
        
        Called after each tool decision to record what the agent decided.
        
        Args:
            content: The assistant's response (typically JSON tool decision)
        """
        self.messages.append({"role": "assistant", "content": content})
    
    def add_tool_result_message(self, tool: str, result_summary: str) -> None:
        """
        Add a tool result as a user message to continue the conversation.
        
        In multi-turn format, tool results are added as user messages so the
        assistant can continue reasoning based on what was returned.
        
        Args:
            tool: Name of the tool that was executed
            result_summary: Human-readable summary of the tool's result
        """
        self.messages.append({
            "role": "user",
            "content": f"[Tool Result: {tool}]\n{result_summary}"
        })
    
    def add_action_results(self, actions: List[Dict[str, Any]], query: str) -> None:
        """Add action search results to context."""
        for action in actions:
            # Avoid duplicates by name
            if not any(a.get("name") == action.get("name") for a in self.found_actions):
                self.found_actions.append(action)
        
        self.tool_calls.append({
            "tool": "search",
            "query": query,
            "results_count": len(actions),
        })
    
    def add_knowledge_results(self, results: List[Dict[str, Any]], query: str) -> None:
        """Add knowledge search results to context."""
        for result in results:
            # Avoid duplicates by URL
            url = result.get("url", "")
            if not any(k.get("url") == url for k in self.found_knowledge):
                self.found_knowledge.append(result)
        
        self.tool_calls.append({
            "tool": "search",
            "query": query,
            "results_count": len(results),
        })
    
    def add_query_result(
        self,
        action_name: str,
        result: Any,
        success: bool = True,
        error: str = None,
        hint: str = None,
    ) -> None:
        """
        Add action execution result to context.
        
        Query results are data fetched from the client application via
        execute tool calls. The agent can use this data for reasoning.
        
        Args:
            action_name: Name of the query action that was executed
            result: The result data returned by the client (or None on failure)
            success: Whether the query executed successfully
            error: Error message if success=False
            hint: Hint for LLM to fix the error (e.g., expected parameters)
        """
        self.query_results.append({
            "action_name": action_name,
            "result": result,
            "success": success,
            "error": error,
            "hint": hint,
        })
        
        self.tool_calls.append({
            "tool": "execute",
            "action_name": action_name,
            "success": success,
            "error": error,
        })
    
    def get_query_result(self, action_name: str) -> Optional[Any]:
        """
        Get the result of a query action by name.
        
        Args:
            action_name: Name of the query action
            
        Returns:
            The result data, or None if not found or failed
        """
        for qr in self.query_results:
            if qr.get("action_name") == action_name and qr.get("success"):
                return qr.get("result")
        return None
    
    def get_action_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find an action by name in found_actions or registered_actions."""
        # Check found_actions first (discovered this turn)
        for action in self.found_actions:
            if action.get("name") == name:
                return action
        # Also check registered_actions (restored from previous turn or registered as tools)
        for action in self.registered_actions:
            if action.get("name") == name:
                return action
        return None
    
    def get_best_action_for_query(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Find the best matching action for a query from accumulated results.
        
        Looks for actions where the name or description contains keywords from the query.
        Returns None if no good match is found.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        best_match = None
        best_score = 0
        
        for action in self.found_actions:
            name = action.get("name", "").lower()
            description = action.get("description", "").lower()
            action_score = action.get("score", 0)
            
            # Simple word overlap matching
            name_words = set(name.replace("_", " ").split())
            desc_words = set(description.split())
            
            name_overlap = len(query_words & name_words)
            desc_overlap = len(query_words & desc_words)
            
            # Combine embedding score with word overlap
            match_score = action_score + (name_overlap * 0.1) + (desc_overlap * 0.05)
            
            if match_score > best_score and action_score >= ACTION_MATCH_THRESHOLD:
                best_score = match_score
                best_match = action
        
        return best_match
    
    def get_token_summary(self) -> Dict[str, Any]:
        """
        Return token usage summary for analytics.
        
        Returns:
            Dict with token usage data, or empty dict if no token budget.
        """
        if not self.token_budget:
            return {}
        return self.token_budget.to_dict()
    
    def add_tool_error(
        self,
        tool: str,
        error: str,
        hint: str = None,
        recoverable: bool = True,
    ) -> None:
        """
        Record a tool error for LLM-based recovery reasoning.
        
        Instead of silently swallowing errors, we record them so the LLM
        can decide how to recover (retry, try different approach, or give up).
        
        Args:
            tool: Name of the tool that failed
            error: Human-readable error message
            hint: Optional suggestion for how to fix the error
            recoverable: Whether the error might be fixed by retrying
        """
        self.tool_errors.append({
            "tool": tool,
            "error": error,
            "hint": hint,
            "recoverable": recoverable,
            "timestamp": time.time(),
        })
        
        # Also record in tool_calls for the full history
        self.tool_calls.append({
            "tool": tool,
            "success": False,
            "error": error,
        })
    
    def get_recent_errors(self, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Get the most recent tool errors for inclusion in prompts.
        
        Args:
            limit: Maximum number of errors to return
            
        Returns:
            List of recent error dicts, most recent last
        """
        return self.tool_errors[-limit:] if self.tool_errors else []
    
    def has_recent_errors(self) -> bool:
        """Check if there are any tool errors recorded."""
        return len(self.tool_errors) > 0
    
    # =========================================================================
    # REGISTERED ACTIONS - Persist actions as native tools across turns
    # =========================================================================
    
    def register_actions_as_tools(self, actions: List[Dict[str, Any]]) -> None:
        """
        Add actions to the registered set (deduplicates by name).
        
        Actions registered here will be available as native LLM tools,
        enabling direct calls with schema validation.
        
        Args:
            actions: List of action dicts from search results
        """
        existing_names = {a["name"] for a in self.registered_actions}
        for action in actions:
            action_name = action.get("name")
            if action_name and action_name not in existing_names:
                self.registered_actions.append(action)
                existing_names.add(action_name)
    
    def is_action_tool(self, tool_name: str) -> bool:
        """
        Check if a tool name is a registered action.
        
        Used to route tool calls: if the tool is a registered action,
        it should be handled as an action_request rather than a built-in.
        
        Args:
            tool_name: Name of the tool being called
            
        Returns:
            True if the tool is a registered action, False otherwise
        """
        return any(a.get("name") == tool_name for a in self.registered_actions)
    
    def get_action_tools(self) -> List[Dict[str, Any]]:
        """
        Get all registered actions as OpenAI tool format.
        
        Returns:
            List of tool definitions ready for the LLM API
        """
        from apps.mcp.services.agent_tools.definitions import action_to_tool
        return [action_to_tool(a) for a in self.registered_actions]
    
    def get_base_tools(self) -> List[Dict[str, Any]]:
        """
        Get base tools filtered by conditional tool state.
        
        Returns core tools (search) plus any conditional tools
        that have been unlocked:
        - get_article: after search returns knowledge chunks
        - interact_with_page: when DOM snapshot is present
        
        Returns:
            List of tool definitions in OpenAI format
        """
        from apps.mcp.services.agent_tools.definitions import get_tools_for_api
        return get_tools_for_api(
            include_get_article=self.get_article_unlocked,
            include_interact_with_page=self.has_page_context,
        )