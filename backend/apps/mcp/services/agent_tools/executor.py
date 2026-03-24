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
        mcp_source_ids: Optional[List[str]] = None,
        mcp_tool_selections: Optional[Dict[str, List[str]]] = None,
        mcp_confirmation_config: Optional[Dict[str, dict]] = None,
        openapi_source_ids: Optional[List[str]] = None,
        openapi_operation_selections: Optional[Dict[str, List[str]]] = None,
        openapi_confirmation_config: Optional[Dict[str, dict]] = None,
    ):
        self.product = product
        self.organization = organization
        self.platform = platform
        self.version = version
        self.channel = channel
        self.knowledge_source_ids = knowledge_source_ids or []
        self.endpoint_healthy = endpoint_healthy
        self.mcp_source_ids = mcp_source_ids or []
        self.mcp_tool_selections = mcp_tool_selections or {}
        self.mcp_confirmation_config = mcp_confirmation_config or {}
        self.openapi_source_ids = openapi_source_ids or []
        self.openapi_operation_selections = openapi_operation_selections or {}
        self.openapi_confirmation_config = openapi_confirmation_config or {}
    
    async def execute_search_actions(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for available actions matching a query.

        Searches both Action rows (SDK/CLI tools) and external MCP source
        tools in parallel, then merges results by score.

        Args:
            query: What action to search for
            limit: Maximum number of actions to return

        Returns:
            List of action dictionaries with scores
        """
        logger.info(f"[AgentToolExecutor] Searching actions for: '{query}' (limit={limit})")

        try:
            action_results, mcp_results, openapi_results = await asyncio.gather(
                self._search_action_rows(query, limit),
                self._search_mcp_tools(query, limit),
                self._search_openapi_tools(query, limit),
                return_exceptions=True,
            )

            actions: List[Dict[str, Any]] = []
            if isinstance(action_results, Exception):
                logger.error(f"[AgentToolExecutor] Action row search failed: {action_results}")
            else:
                actions.extend(action_results)

            if isinstance(mcp_results, Exception):
                logger.error(f"[AgentToolExecutor] MCP tool search failed: {mcp_results}")
            elif mcp_results:
                actions.extend(mcp_results)

            if isinstance(openapi_results, Exception):
                logger.error(f"[AgentToolExecutor] OpenAPI tool search failed: {openapi_results}")
            elif openapi_results:
                actions.extend(openapi_results)

            actions.sort(key=lambda a: a.get("score", 0), reverse=True)
            actions = actions[:limit]

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

    async def _search_action_rows(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Search Action model rows via embedding similarity (existing path)."""
        from apps.products.services.action_search_service import action_search_service

        result = await action_search_service.search_with_metadata(
            query=query,
            product=self.product,
            platform=self.platform,
            version=self.version,
            max_results=limit,
        )

        actions = result.actions

        if self.channel:
            actions = [
                a for a in actions
                if "*" in (a.get("channel_compatibility") or [])
                or self.channel in (a.get("channel_compatibility") or [])
            ]

        if not self.endpoint_healthy:
            before = len(actions)
            actions = [a for a in actions if a.get("tool_type") != "server_side"]
            dropped = before - len(actions)
            if dropped:
                logger.info(
                    "[AgentToolExecutor] Excluded %d server-side tool(s) (no healthy endpoint)",
                    dropped,
                )

        return actions

    async def _search_mcp_tools(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Search MCP source tools using pre-computed embeddings."""
        if not self.mcp_source_ids:
            return []

        from apps.tools.models import MCPToolSource
        from common.services.embedding_service import get_embedding_service

        service = get_embedding_service()
        query_embedding = await service.embed_query_async(query)

        scored: List[tuple] = []

        async for source in MCPToolSource.objects.filter(
            id__in=self.mcp_source_ids,
            is_active=True,
            discovery_status="success",
        ).aiterator():
            source_id_str = str(source.id)
            allowed_tools = self.mcp_tool_selections.get(source_id_str)

            for tool_def in source.discovered_tools:
                tool_name = tool_def.get("name", "")
                if allowed_tools is not None and tool_name not in allowed_tools:
                    continue
                embedding = tool_def.get("_description_embedding")
                if not embedding:
                    continue
                sim = service.calculate_similarity(query_embedding, embedding)
                scored.append((sim, tool_def, source))

        scored.sort(key=lambda x: -x[0])

        results: List[Dict[str, Any]] = []
        for score, tool_def, source in scored[:limit]:
            slug_prefix = source.slug or source.name.lower().replace(" ", "_")
            source_id_str = str(source.id)
            results.append({
                "name": f"{slug_prefix}_{tool_def['name']}",
                "description": tool_def.get("description", ""),
                "data_schema": tool_def.get("inputSchema", {}),
                "tool_type": "server_side",
                "channel_compatibility": ["*"],
                "score": round(score, 3),
                "_mcp_source_id": source_id_str,
                "_mcp_original_name": tool_def["name"],
                "_requires_confirmation": self._resolve_mcp_confirmation(
                    source_id_str, tool_def,
                ),
            })

        if results:
            logger.info(
                "[AgentToolExecutor] MCP tool search found %d tools from %d source(s)",
                len(results),
                len(self.mcp_source_ids),
            )

        return results
    
    async def _search_mcp_resources(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Search MCP source resources using pre-computed embeddings."""
        if not self.mcp_source_ids:
            return []

        from apps.tools.models import MCPToolSource
        from common.services.embedding_service import get_embedding_service

        service = get_embedding_service()
        query_embedding = await service.embed_query_async(query)

        scored: List[tuple] = []

        async for source in MCPToolSource.objects.filter(
            id__in=self.mcp_source_ids,
            is_active=True,
            discovery_status="success",
        ).aiterator():
            for res in (source.discovered_resources or []):
                embedding = res.get("_description_embedding")
                if not embedding:
                    continue
                sim = service.calculate_similarity(query_embedding, embedding)
                scored.append((sim, res, source))

        scored.sort(key=lambda x: -x[0])

        results: List[Dict[str, Any]] = []
        for score, res, source in scored[:limit]:
            slug_prefix = source.slug or source.name.lower().replace(" ", "_")
            results.append({
                "name": res.get("name", ""),
                "description": res.get("description", ""),
                "uri": res["uri"],
                "mimeType": res.get("mimeType", ""),
                "source_name": slug_prefix,
                "score": round(score, 3),
                "_mcp_source_id": str(source.id),
            })

        if results:
            logger.info(
                "[AgentToolExecutor] MCP resource search found %d resources from %d source(s)",
                len(results),
                len(self.mcp_source_ids),
            )

        return results

    def _resolve_openapi_confirmation(
        self, source_id_str: str, op: dict,
    ) -> bool:
        """Resolve whether an OpenAPI operation requires confirmation.

        Resolution chain:
        1. Agent-level override (if present) wins
        2. Source-level default from OpenAPIOperationConfig
        3. Fallback: False
        """
        cfg = self.openapi_confirmation_config.get(source_id_str, {})
        op_id = op.get('operation_id', '')

        overrides = cfg.get('overrides', {})
        if op_id in overrides:
            return overrides[op_id]

        source_defaults = cfg.get('source_defaults', {})
        if op_id in source_defaults:
            return source_defaults[op_id]

        return False

    def _resolve_mcp_confirmation(
        self, source_id_str: str, tool_def: dict,
    ) -> bool:
        """Resolve whether an MCP tool requires confirmation.

        Same resolution chain as OpenAPI:
        1. Agent-level override wins
        2. Source-level default from MCPToolConfig
        3. Fallback: False
        """
        cfg = self.mcp_confirmation_config.get(source_id_str, {})
        name = tool_def.get('name', '')

        overrides = cfg.get('overrides', {})
        if name in overrides:
            return overrides[name]

        source_defaults = cfg.get('source_defaults', {})
        if name in source_defaults:
            return source_defaults[name]

        return False

    async def _search_openapi_tools(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Search OpenAPI source tools using pre-computed embeddings."""
        if not self.openapi_source_ids:
            return []

        from apps.tools.models import OpenAPIToolSource
        from common.services.embedding_service import get_embedding_service

        service = get_embedding_service()
        query_embedding = await service.embed_query_async(query)

        scored: List[tuple] = []

        async for source in OpenAPIToolSource.objects.filter(
            id__in=self.openapi_source_ids,
            is_active=True,
            discovery_status="success",
        ).aiterator():
            source_id_str = str(source.id)
            allowed_ops = self.openapi_operation_selections.get(source_id_str)

            for op in source.discovered_operations:
                if allowed_ops is not None and op.get("operation_id") not in allowed_ops:
                    continue

                embedding = op.get("_description_embedding")
                if not embedding:
                    continue
                sim = service.calculate_similarity(query_embedding, embedding)
                scored.append((sim, op, source))

        scored.sort(key=lambda x: -x[0])

        results: List[Dict[str, Any]] = []
        for score, op, source in scored[:limit]:
            slug_prefix = source.slug or source.name.lower().replace(" ", "_")
            source_id_str = str(source.id)

            op_with_confirmation = {**op}
            op_with_confirmation["_requires_confirmation"] = (
                self._resolve_openapi_confirmation(source_id_str, op)
            )

            results.append({
                "name": f"{slug_prefix}_{op['operation_id']}",
                "description": op.get("summary") or op.get("description", ""),
                "data_schema": op.get("input_schema", {}),
                "tool_type": "server_side",
                "channel_compatibility": ["*"],
                "score": round(score, 3),
                "_openapi_source_id": source_id_str,
                "_openapi_operation": op_with_confirmation,
            })

        if results:
            logger.info(
                "[AgentToolExecutor] OpenAPI tool search found %d tools from %d source(s)",
                len(results),
                len(self.openapi_source_ids),
            )

        return results

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
    
    async def _search_skills(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Search RegisteredSkill rows via embedding similarity."""
        from apps.tools.models import RegisteredSkill
        from common.services.embedding_service import get_embedding_service
        from pgvector.django import CosineDistance

        service = get_embedding_service()
        query_embedding = await service.embed_query_async(query)

        qs = (
            RegisteredSkill.objects
            .filter(product=self.product, is_active=True, description_embedding__isnull=False)
            .annotate(distance=CosineDistance('description_embedding', query_embedding))
            .order_by('distance')[:limit]
        )

        results: List[Dict[str, Any]] = []
        async for skill in qs.aiterator():
            results.append({
                "name": skill.name,
                "description": skill.description,
                "type": "skill",
                "score": round(1 - skill.distance, 3),
            })

        if results:
            logger.info(
                "[AgentToolExecutor] Skill search found %d skill(s)",
                len(results),
            )

        return results

    async def execute_search(
        self,
        query: str,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """
        Unified search returning actions, knowledge, MCP resources, and skills.
        
        All searches run in parallel. Results from each type are returned
        separately for the LLM to use as appropriate.
        
        Args:
            query: What to search for
            limit: Maximum number of results per type
        
        Returns:
            Dict with:
            - actions: List of action dicts with full schemas
            - knowledge: List of knowledge result dicts
            - mcp_resources: List of MCP resource dicts
            - skills: List of skill dicts (name + description only)
        """
        results: Dict[str, Any] = {"actions": [], "knowledge": [], "mcp_resources": [], "skills": []}
        
        logger.info(
            f"[AgentToolExecutor] Unified search for: '{query}' (limit={limit})"
        )
        
        action_results, knowledge_results, resource_results, skill_results = await asyncio.gather(
            self.execute_search_actions(query, limit),
            self.execute_search_knowledge(query, limit),
            self._search_mcp_resources(query, limit),
            self._search_skills(query, limit),
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

        # Process MCP resource results
        if isinstance(resource_results, Exception):
            logger.error(f"[AgentToolExecutor] MCP resource search failed: {resource_results}")
        elif resource_results:
            results["mcp_resources"] = resource_results

        # Process skill results
        if isinstance(skill_results, Exception):
            logger.error(f"[AgentToolExecutor] Skill search failed: {skill_results}")
        elif skill_results:
            results["skills"] = skill_results
        
        logger.info(
            "[AgentToolExecutor] Unified search complete: "
            "%d actions, %d knowledge, %d mcp_resources, %d skills",
            len(results["actions"]),
            len(results["knowledge"]),
            len(results["mcp_resources"]),
            len(results["skills"]),
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
