"""
Agent context accumulator for the agentic reasoning loop.

Tracks all tools, knowledge, and query results found during tool calls,
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
    
    Tracks all tools, knowledge, and query results found during tool calls,
    plus the history of tool calls for reasoning.
    
    Also maintains the multi-turn conversation history for LLM calls
    and tracks tool errors for LLM-based recovery decisions.
    
    Registered tools persist across conversation turns, enabling the LLM
    to call previously discovered tools without re-searching.
    """
    found_tools: List[Dict[str, Any]] = field(default_factory=list)
    found_knowledge: List[Dict[str, Any]] = field(default_factory=list)
    query_results: List[Dict[str, Any]] = field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    
    # Multi-turn conversation history for LLM calls
    messages: List[Dict[str, Any]] = field(default_factory=list)
    
    # Token budget tracking (optional, set by agentic loop)
    token_budget: Optional['TokenBudget'] = None
    
    # Tool errors for LLM-based recovery decisions
    tool_errors: List[Dict[str, Any]] = field(default_factory=list)
    
    # Registered tools as native LLM tools (persisted across conversation turns)
    # Full action dicts for tool generation via action_to_tool()
    registered_tools: List[Dict[str, Any]] = field(default_factory=list)
    
    # Conditional tool flags
    # has_page_context: True when DOM snapshot with element refs is present
    has_page_context: bool = False
    # get_article_unlocked: True after search returns knowledge chunks
    get_article_unlocked: bool = False
    # read_mcp_resource_unlocked: True after search returns MCP resources
    read_mcp_resource_unlocked: bool = False
    # load_skill_unlocked: True after search returns skills
    load_skill_unlocked: bool = False
    # reconnect_account_enabled: True when product has OAuth-based tool sources
    reconnect_account_enabled: bool = False
    
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
    
    def add_tool_results(self, tools: List[Dict[str, Any]], query: str) -> None:
        """Add tool search results to context."""
        for tool in tools:
            if not any(t.get("name") == tool.get("name") for t in self.found_tools):
                self.found_tools.append(tool)
        
        self.tool_calls.append({
            "tool": "search",
            "query": query,
            "results_count": len(tools),
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
        tool_name: str,
        result: Any,
        success: bool = True,
        error: str = None,
        hint: str = None,
    ) -> None:
        """
        Add tool execution result to context.
        
        Query results are data fetched from the client application via
        execute tool calls. The agent can use this data for reasoning.
        
        Args:
            tool_name: Name of the tool that was executed
            result: The result data returned by the client (or None on failure)
            success: Whether the query executed successfully
            error: Error message if success=False
            hint: Hint for LLM to fix the error (e.g., expected parameters)
        """
        self.query_results.append({
            "tool_name": tool_name,
            "result": result,
            "success": success,
            "error": error,
            "hint": hint,
        })
        
        self.tool_calls.append({
            "tool": "execute",
            "tool_name": tool_name,
            "success": success,
            "error": error,
        })
    
    def get_query_result(self, tool_name: str) -> Optional[Any]:
        """
        Get the result of a tool query by name.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            The result data, or None if not found or failed
        """
        for qr in self.query_results:
            if qr.get("tool_name") == tool_name and qr.get("success"):
                return qr.get("result")
        return None
    
    def get_tool_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a tool by name in found_tools or registered_tools."""
        for tool in self.found_tools:
            if tool.get("name") == name:
                return tool
        for tool in self.registered_tools:
            if tool.get("name") == name:
                return tool
        return None
    
    def get_best_tool_for_query(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Find the best matching tool for a query from accumulated results.
        
        Looks for tools where the name or description contains keywords from the query.
        Returns None if no good match is found.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        best_match = None
        best_score = 0
        
        for tool in self.found_tools:
            name = tool.get("name", "").lower()
            description = tool.get("description", "").lower()
            tool_score = tool.get("score", 0)
            
            name_words = set(name.replace("_", " ").split())
            desc_words = set(description.split())
            
            name_overlap = len(query_words & name_words)
            desc_overlap = len(query_words & desc_words)
            
            match_score = tool_score + (name_overlap * 0.1) + (desc_overlap * 0.05)
            
            if match_score > best_score and tool_score >= ACTION_MATCH_THRESHOLD:
                best_score = match_score
                best_match = tool
        
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
    # REGISTERED TOOLS - Persist tools as native LLM tools across turns
    # =========================================================================
    
    def register_tools(self, tools: List[Dict[str, Any]]) -> None:
        """
        Add tools to the registered set (deduplicates by name).
        
        Tools registered here will be available as native LLM tools,
        enabling direct calls with schema validation.
        
        Args:
            tools: List of tool/action dicts from search results
        """
        existing_names = {t["name"] for t in self.registered_tools}
        for tool in tools:
            name = tool.get("name")
            if name and name not in existing_names:
                self.registered_tools.append(tool)
                existing_names.add(name)
    
    def is_registered_tool(self, tool_name: str) -> bool:
        """
        Check if a tool name is a registered tool.
        
        Used to route tool calls: if the tool is registered,
        it should be handled as a tool execution rather than a built-in.
        
        Args:
            tool_name: Name of the tool being called
            
        Returns:
            True if the tool is registered, False otherwise
        """
        return any(t.get("name") == tool_name for t in self.registered_tools)
    
    def get_registered_tool_defs(self) -> List[Dict[str, Any]]:
        """
        Get all registered tools as OpenAI tool format.
        
        Returns:
            List of tool definitions ready for the LLM API
        """
        from apps.mcp.services.agent_tools.definitions import action_to_tool
        return [action_to_tool(a) for a in self.registered_tools]
    
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
            include_read_mcp_resource=self.read_mcp_resource_unlocked,
            include_load_skill=self.load_skill_unlocked,
            include_reconnect_account=self.reconnect_account_enabled,
        )