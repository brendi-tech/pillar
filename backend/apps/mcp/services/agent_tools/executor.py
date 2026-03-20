"""
Agent Tool Executor - Executes tools for the agentic reasoning loop.

Tool architecture:
- search: Unified search for actions and knowledge
- execute: Unified action execution on client

The model responds directly via content tokens (no respond tool).

The executor provides:
- execute_search(): Unified search returning actions (with schemas) and knowledge
- execute_action(): Unified action execution for any action type
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from apps.mcp.services.agent_tools.context import AgentContext

logger = logging.getLogger(__name__)


class AgentToolExecutor:
    """
    Executes tools for the agentic reasoning loop.
    
    Provides access to:
    - ActionSearchService for finding executable actions
    - KnowledgeRAGServiceAsync for searching documentation
    - Plan creation with hybrid action/guidance steps
    """
    
    def __init__(
        self,
        product,
        organization,
        platform: Optional[str] = None,
        version: Optional[str] = None,
        channel: str = "web",
        knowledge_source_ids: Optional[List[str]] = None,
        endpoint_healthy: bool = False,
    ):
        """
        Initialize the tool executor.
        
        Args:
            product: HelpCenterConfig/Product instance
            organization: Organization instance
            platform: Optional platform filter for action search
            version: Optional version filter for action search
            channel: Channel to filter tools by compatibility
            knowledge_source_ids: Restrict knowledge search to these source IDs.
                Empty list or None = search all sources.
            endpoint_healthy: Whether the product has a healthy server-side tool endpoint.
                When False, server-side tools are excluded from search results.
        """
        self.product = product
        self.organization = organization
        self.platform = platform
        self.version = version
        self.channel = channel
        self.knowledge_source_ids = knowledge_source_ids or []
        self.endpoint_healthy = endpoint_healthy
    
    async def execute_search_actions(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for available actions matching a query.
        
        Args:
            query: What action to search for
            limit: Maximum number of actions to return
        
        Returns:
            List of action dictionaries with scores
        """
        from apps.products.services.action_search_service import action_search_service
        
        logger.info(f"[AgentToolExecutor] Searching actions for: '{query}' (limit={limit})")
        
        try:
            result = await action_search_service.search_with_metadata(
                query=query,
                product=self.product,
                platform=self.platform,
                version=self.version,
                max_results=limit,
            )
            
            actions = result.actions

            # Filter by channel compatibility (empty list = unavailable, ["*"] = all channels)
            if self.channel:
                actions = [
                    a for a in actions
                    if "*" in (a.get("channel_compatibility") or [])
                    or self.channel in (a.get("channel_compatibility") or [])
                ]

            # Exclude server-side tools when no healthy endpoint is registered
            if not self.endpoint_healthy:
                before = len(actions)
                actions = [a for a in actions if a.get("tool_type") != "server_side"]
                dropped = before - len(actions)
                if dropped:
                    logger.info(
                        "[AgentToolExecutor] Excluded %d server-side tool(s) (no healthy endpoint)",
                        dropped,
                    )

            logger.info(f"[AgentToolExecutor] Found {len(actions)} actions (channel={self.channel})")
            return actions
            
        except Exception as e:
            logger.error(f"[AgentToolExecutor] Action search failed: {e}", exc_info=True)
            return {
                "error": f"Action search failed: {str(e)}",
                "tool": "search_actions",
                "recoverable": True,
                "hint": "The search service may be temporarily unavailable. Consider retrying or searching for something different.",
            }
    
    async def execute_search_knowledge(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search documentation and help articles.
        
        Args:
            query: What to search for in the knowledge base
            limit: Maximum number of results to return
        
        Returns:
            List of search result dictionaries
        """
        from apps.knowledge.services import KnowledgeRAGServiceAsync
        
        logger.info(f"[AgentToolExecutor] Searching knowledge for: '{query}' (limit={limit})")
        
        try:
            rag_service = KnowledgeRAGServiceAsync(
                organization_id=str(self.organization.id),
                product_id=str(self.product.id)
            )
            results = await rag_service.hybrid_search(
                query=query,
                top_k=limit,
                source_ids=self.knowledge_source_ids or None,
            )
            
            # Convert SearchResult objects to dicts
            formatted = [
                {
                    "title": r.title,
                    "url": r.url or "",
                    "content": r.content,
                    "heading_path": r.heading_path,
                    "item_id": r.item_id,
                    "score": r.score,
                    "source_type": r.item_type,
                    "source_name": r.source_name,
                }
                for r in results
            ]
            
            logger.info(f"[AgentToolExecutor] Found {len(formatted)} knowledge results")
            return formatted
            
        except Exception as e:
            logger.error(f"[AgentToolExecutor] Knowledge search failed: {e}", exc_info=True)
            return {
                "error": f"Knowledge search failed: {str(e)}",
                "tool": "search_knowledge",
                "recoverable": True,
                "hint": "The knowledge base may be temporarily unavailable. Consider retrying or responding with available context.",
            }
    
    async def execute_search(
        self,
        query: str,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """
        Unified search returning both actions (with full schemas) and knowledge.
        
        Always searches both actions and knowledge in parallel. Results from
        each type are returned separately for the LLM to use as appropriate.
        
        Args:
            query: What to search for
            limit: Maximum number of results per type
        
        Returns:
            Dict with:
            - actions: List of action dicts with full schemas
            - knowledge: List of knowledge result dicts
        """
        results = {"actions": [], "knowledge": []}
        
        logger.info(
            f"[AgentToolExecutor] Unified search for: '{query}' (limit={limit})"
        )
        
        # Always run both searches in parallel
        action_results, knowledge_results = await asyncio.gather(
            self.execute_search_actions(query, limit),
            self.execute_search_knowledge(query, limit),
            return_exceptions=True,
        )
        
        # Process action results
        if isinstance(action_results, Exception):
            logger.error(f"[AgentToolExecutor] Action search failed: {action_results}")
        elif isinstance(action_results, dict) and "error" in action_results:
            logger.warning(f"[AgentToolExecutor] Action search error: {action_results.get('error')}")
        else:
            for action in action_results:
                if action.get("data_schema"):
                    action["schema"] = action["data_schema"]
            results["actions"] = action_results
        
        # Process knowledge results
        if isinstance(knowledge_results, Exception):
            logger.error(f"[AgentToolExecutor] Knowledge search failed: {knowledge_results}")
        elif isinstance(knowledge_results, dict) and "error" in knowledge_results:
            logger.warning(f"[AgentToolExecutor] Knowledge search error: {knowledge_results.get('error')}")
        else:
            results["knowledge"] = knowledge_results
        
        logger.info(
            f"[AgentToolExecutor] Unified search complete: "
            f"{len(results['actions'])} actions, {len(results['knowledge'])} knowledge"
        )
        
        return results
    
    async def execute_get_article(
        self,
        item_id: str,
    ) -> Dict[str, Any]:
        """
        Get the full content of a knowledge article by its ID.
        
        Used when a search result chunk is relevant but incomplete and the
        LLM needs the full article content.
        
        Args:
            item_id: UUID of the KnowledgeItem
        
        Returns:
            Dict with title, url, and full content, or error dict
        """
        from apps.knowledge.models import KnowledgeItem
        
        logger.info(f"[AgentToolExecutor] Getting full article: {item_id}")
        
        try:
            item = await KnowledgeItem.objects.aget(
                id=item_id,
                organization=self.organization,
            )
            
            # Prefer optimized_content (LLM-cleaned), fall back to raw_content
            content = item.optimized_content or item.raw_content
            
            logger.info(
                f"[AgentToolExecutor] Retrieved article: {item.title} "
                f"({len(content)} chars)"
            )
            
            return {
                "title": item.title,
                "url": item.url or "",
                "content": content,
            }
            
        except KnowledgeItem.DoesNotExist:
            logger.warning(f"[AgentToolExecutor] Article not found: {item_id}")
            return {
                "error": f"Article not found: {item_id}",
                "recoverable": False,
                "hint": "The item_id may be incorrect. Check the search results for valid item IDs.",
            }
    
    async def validate_action(
        self,
        action_name: str,
        context: "AgentContext",
    ) -> Optional[Dict[str, Any]]:
        """
        Validate that an action exists and can be executed.
        
        Args:
            action_name: Name of the action to validate
            context: Agent context with accumulated search results
        
        Returns:
            Action dict if valid, None if not found
        """
        # First check if action is in context from previous search
        action = context.get_tool_by_name(action_name)
        
        # If not in context, search for it
        if not action:
            actions = await self.execute_search_actions(action_name)
            if actions:
                # Prefer exact name match
                for a in actions:
                    if a.get("name") == action_name:
                        action = a
                        break
                # Fall back to top result
                if not action:
                    action = actions[0]
                context.add_tool_results(actions, action_name)
        
        if not action:
            logger.warning(f"[AgentToolExecutor] Action not found: {action_name}")
            return None
        
        logger.info(
            f"[AgentToolExecutor] Validated action: {action_name} "
            f"(type={action.get('action_type', 'unknown')})"
        )
        
        return action
