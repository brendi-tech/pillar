"""
Tool-based agentic answer service for multi-step reasoning.

This service uses a tool-calling architecture where the agent
dynamically decides which tools to use:
- search: Find tools and documentation
- execute: Run tools on the client

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
- Unified search returning both tools and knowledge
- Direct tool execution (no explicit plan creation)
- Graceful degradation with knowledge fallbacks
"""
import logging
import time
from typing import Any, Dict, List, Optional

from apps.mcp.services.source_tracking import SourceTracker
from apps.mcp.services.injection_detection import detect_injection
from apps.mcp.services.agent.messages import get_injection_response
from apps.mcp.services.agent.agentic_loop import run_agentic_loop
from apps.mcp.services.agent.channels import Channel
from apps.mcp.services.agent.models import AgentMessage, CallerContext
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
        registered_tools: List[Dict[str, Any]] = None,
        conversation_id: str = None,
        assistant_message_id: str = None,
        agent_config=None,
    ):
        """
        Initialize ReAct answer service.
        
        Args:
            help_center_config: HelpCenterConfig instance
            organization: Organization instance
            conversation_history: Previous conversation messages
            registered_tools: Tools from previous turns (persisted by client)
            conversation_id: Conversation UUID for incremental message persistence
            assistant_message_id: Pre-created assistant message UUID for DB updates
            agent_config: Resolved AgentConfig for per-channel overrides
        """
        self.help_center_config = help_center_config
        self.organization = organization
        self.conversation_history = conversation_history or []
        self.registered_tools = registered_tools or []
        self.conversation_id = conversation_id
        self.assistant_message_id = assistant_message_id
        self.agent_config = agent_config
        
        logger.info(f"[ReAct] Initializing for help center {help_center_config.id}")
        
        # Initialize source tracker (shared across all tools)
        self.source_tracker = SourceTracker()
        
        # Create LLM client
        self.llm_client, self.model_name, self.temperature, self.max_tokens = LLMConfigService.create_llm_client_for_task(
            site=help_center_config,
            task_type=LLMConfigService.TASK_AGENT_QA,
            agent_config=agent_config,
            temperature=1.0,
            max_tokens=2000
        )
        
        logger.info(f"[ReAct] Initialized with model: {self.model_name}")
    
    async def ask_stream(
        self,
        question: str = "",
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
        external_user_id: str = None,
        visitor_id: str = None,
        agent_message: Optional[AgentMessage] = None,
    ):
        """
        Stream answer using unified ReAct agent for all queries.

        When ``agent_message`` is provided (e.g. from Slack, Discord, or
        the headless API), it is used directly — preserving the caller
        identity, channel, and channel_context that the connector built.
        Otherwise the method builds an AgentMessage from the individual
        kwargs (the web SDK path).

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

        effective_question = agent_message.text if agent_message else question

        logger.info(f"[Agent] Starting query: {effective_question[:100]}...")
        if user_context:
            logger.info(f"[Agent] User context provided: {len(user_context)} item(s)")
        logger.info(f"[Agent] Starting query: {effective_question[:100]}... (images={len(images) if images else 0})")

        try:
            # STEP 1: Security check (ALWAYS first)
            is_blocked, reason = detect_injection(effective_question)
            if is_blocked:
                logger.warning(
                    f"[SECURITY] Prompt injection blocked: reason={reason}, "
                    f"help_center={self.help_center_config.id}"
                )
                yield {"type": "token", "text": get_injection_response()}
                yield {"type": "sources", "sources": [], "no_sources_used": True}
                yield {"type": "complete"}
                return

            # STEP 2: Use the pre-built AgentMessage or construct one from kwargs
            if agent_message is None:
                agent_message = AgentMessage(
                    text=question,
                    channel=Channel.WEB,
                    conversation_id=self.conversation_id or "",
                    product_id=str(self.help_center_config.id),
                    organization_id=str(self.organization.id) if self.organization else "",
                    caller=CallerContext(
                        channel_user_id=visitor_id or None,
                        external_user_id=external_user_id or None,
                        user_profile=user_profile or {},
                    ),
                    conversation_history=self.conversation_history or [],
                    registered_tools=self.registered_tools or [],
                    images=images or [],
                    language=language,
                    channel_context={
                        "page_url": page_url or "",
                        "user_context": user_context or [],
                        "sdk_context": context or {},
                    },
                    assistant_message_id=self.assistant_message_id,
                    session_id=session_id,
                    cancel_event=cancel_event,
                    top_k=top_k,
                    platform=platform,
                    version=version,
                )

            async for event in run_agentic_loop(
                service=self,
                message=agent_message,
            ):
                if event.get("type") == "complete":
                    self.registered_tools = event.get("registered_tools", [])
                yield event

            total_time = time.time() - start_time
            logger.info(f"[Agent] Completed in {total_time:.2f}s")

        except Exception as e:
            logger.error(f"[Agent] Error: {e}", exc_info=True)
            yield {"type": "error", "message": str(e)}
