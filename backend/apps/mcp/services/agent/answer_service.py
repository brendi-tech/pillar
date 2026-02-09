"""
Tool-based agentic answer service for multi-step reasoning.

This service uses a tool-calling architecture where the agent
dynamically decides which tools to use:
- search: Find actions and documentation
- execute: Run actions on the client

The model responds directly via content tokens (no respond tool).
When the model produces content with no tool calls, the turn is over.

Implements:
- Tool-based agentic loop with dynamic tool selection
- Parallel speculative search for latency optimization
- Multi-turn conversation support
- Source tracking across tool calls
- Streaming SOURCES_USED footer detection
- Parallel operations for performance

Key features:
- Unified search returning both actions and knowledge
- Direct action execution (no explicit plan creation)
- Graceful degradation with knowledge fallbacks
"""
import logging
import time
from typing import Any, Dict, List, Optional

from apps.mcp.services.source_tracking import SourceTracker
from apps.mcp.services.injection_detection import detect_injection
from apps.mcp.services.agent.messages import get_injection_response
from apps.mcp.services.agent.agentic_loop import run_agentic_loop
from common.utils.llm_config import LLMConfigService

logger = logging.getLogger(__name__)


class AgentAnswerServiceReActAsync:
    """
    ReAct-based answer service with proper source tracking.
    
    Key features:
    - Multi-step reasoning (thought -> action -> observation loop)
    - Source tracking across multiple tool calls
    - Dual mode: direct answer for greetings, ReAct for complex queries
    - Smart context: use full page if small, chunk if large
    - Quality filtering based on relevance scores
    
    Example flow:
        1. User asks: "What are your pricing plans and do you offer discounts?"
        2. Agent thinks: "I need pricing info first"
        3. Agent searches: "pricing plans" -> gets sources 1, 2, 3
        4. Agent thinks: "Now I need discount info"
        5. Agent searches: "discounts" -> gets source 4 (source 2 duplicate)
        6. Agent answers: Using sources 1, 2, 4
        7. Returns sources with stable numbers (no renumbering)
    """
    
    def __init__(
        self,
        help_center_config,
        organization,
        conversation_history: List[Dict[str, Any]] = None,
        registered_actions: List[Dict[str, Any]] = None,
        conversation_id: str = None,
        assistant_message_id: str = None,
    ):
        """
        Initialize ReAct answer service.
        
        Args:
            help_center_config: HelpCenterConfig instance
            organization: Organization instance
            conversation_history: Previous conversation messages
            registered_actions: Actions from previous turns (persisted by client)
            conversation_id: Conversation UUID for incremental message persistence
            assistant_message_id: Pre-created assistant message UUID for DB updates
        """
        self.help_center_config = help_center_config
        self.organization = organization
        self.conversation_history = conversation_history or []
        self.registered_actions = registered_actions or []
        self.conversation_id = conversation_id
        self.assistant_message_id = assistant_message_id
        
        logger.info(f"[ReAct] Initializing for help center {help_center_config.id}")
        
        # Initialize source tracker (shared across all tools)
        self.source_tracker = SourceTracker()
        
        # Create LLM client
        self.llm_client, self.model_name, self.temperature, self.max_tokens = LLMConfigService.create_llm_client_for_task(
            site=help_center_config,
            task_type=LLMConfigService.TASK_AGENT_QA,
            temperature=1.0,
            max_tokens=2000
        )
        
        logger.info(f"[ReAct] Initialized with model: {self.model_name}")
    
    async def ask_stream(
        self,
        question: str,
        top_k: int = 10,
        cancel_event=None,
        platform: str = None,
        version: str = None,
        user_context: List[Dict] = None,
        images: Optional[List[Dict[str, str]]] = None,
        context: dict = None,
        user_profile: dict = None,
        page_url: str = None,
        session_id: str = None,
        language: str = 'en',
    ):
        """
        Stream answer using unified ReAct agent for all queries.
        
        The ReAct agent handles all decision-making on every iteration:
        - RETURN_ACTION: Single action to execute (e.g., "open settings")
        - CREATE_PLAN: Multi-step execution plan (e.g., "set up help center and view analytics")
        - CALL_ACTION: Query action that returns data for further reasoning (e.g., "list_sources")
        - SEARCH: Search knowledge base for information
        - ANSWER: Direct response (greetings, simple responses)
        - DEFER: Cannot help (outside scope, no relevant information)
        - ESCALATE: User wants human support (e.g., "talk to support", billing issues)
        
        Args:
            question: User's question
            top_k: Number of chunks to retrieve per search
            cancel_event: Optional event to signal cancellation
            platform: Optional platform filter for action search
            version: Optional version filter for action search
            user_context: Optional list of context items (highlighted text, etc.)
            images: Optional list of image dicts with 'url' and optional 'detail'
            context: Optional user context for action filtering (currentPage, userRole, etc.)
            user_profile: Optional user profile (name, role, accountType, etc.)
            page_url: Optional current page URL from X-Page-Url header
            session_id: Optional session ID for query action result correlation
        
        Yields:
            Dict events with 'type' and data:
                - {'type': 'token', 'text': '...'}  - answer tokens
                - {'type': 'sources', 'sources': [...]}  - cited sources
                - {'type': 'actions', 'actions': [...]}  - suggested actions
                - {'type': 'plan.created', 'plan': {...}}  - execution plan
                - {'type': 'query_request', 'action_name': '...'}  - query action request
                - {'type': 'complete', ...}  - completion event
                - {'type': 'error', 'message': '...'}  - errors
        """
        start_time = time.time()
        
        logger.info(f"[Agent] Starting query: {question[:100]}...")
        if user_context:
            logger.info(f"[Agent] User context provided: {len(user_context)} item(s)")
        logger.info(f"[Agent] Starting query: {question[:100]}... (images={len(images) if images else 0})")
        
        # Note: We don't emit a thinking event here - the agentic loop emits its own
        # thinking_start at the beginning of each iteration, which is the correct place
        
        try:
            # STEP 1: Security check (ALWAYS first)
            is_blocked, reason = detect_injection(question)
            if is_blocked:
                logger.warning(
                    f"[SECURITY] Prompt injection blocked: reason={reason}, "
                    f"help_center={self.help_center_config.id}"
                )
                yield {"type": "token", "text": get_injection_response()}
                yield {"type": "sources", "sources": [], "no_sources_used": True}
                yield {"type": "complete"}
                return
            
            # STEP 2: Use tool-based agentic loop
            async for event in run_agentic_loop(
                service=self,
                question=question,
                top_k=top_k,
                cancel_event=cancel_event,
                platform=platform,
                version=version,
                user_context=user_context,
                images=images,
                context=context,
                user_profile=user_profile,
                page_url=page_url,
                session_id=session_id,
                language=language,
                conversation_history=self.conversation_history,
                registered_actions=self.registered_actions,
                conversation_id=self.conversation_id,
                assistant_message_id=self.assistant_message_id,
            ):
                # Update registered_actions from complete event for persistence
                if event.get("type") == "complete":
                    self.registered_actions = event.get("registered_actions", [])
                yield event
            
            total_time = time.time() - start_time
            logger.info(f"[Agent] Completed in {total_time:.2f}s")
            
        except Exception as e:
            logger.error(f"[Agent] Error: {e}", exc_info=True)
            yield {"type": "error", "message": str(e)}
