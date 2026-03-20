"""
Agent configuration resolution service.

Resolves the effective agent configuration for a product + channel by merging
product-level defaults with agent-level overrides. Supports multi-agent routing
via channel_context (e.g. Slack channel ID).
"""
import logging
from dataclasses import dataclass, field

from apps.products.models import Agent
from apps.products.models.agent import KnowledgeScope

logger = logging.getLogger(__name__)


TONE_INSTRUCTIONS = {
    "professional": "Use a professional, confident tone. Be informative and empathetic.",
    "friendly": "Use a warm, enthusiastic tone. Be encouraging and approachable.",
    "neutral": "Use a balanced, objective tone. Be clear and respectful.",
    "concise": "Keep responses brief and direct. Prioritize clarity over elaboration.",
    "formal": "Use formal language with proper salutations. Be thorough and structured.",
}

CHANNEL_CONTEXT_KEYS: dict[str, tuple[str, str]] = {
    "slack": ("slack_channel_id", "slack_channel_ids"),
    "discord": ("discord_channel_id", "discord_channel_ids"),
    "email": ("email_address", "email_addresses"),
}


@dataclass(frozen=True)
class AgentConfig:
    """Resolved, immutable agent configuration for a single request."""
    agent_id: str | None
    agent_name: str
    channel: str
    guidance: str
    tone: str
    llm_model: str
    temperature: float
    max_response_tokens: int | None
    include_sources: bool
    include_suggested_followups: bool
    tool_allowlist: list[str]
    tool_denylist: list[str]
    language: str
    channel_config: dict
    knowledge_scope: str = KnowledgeScope.ALL
    knowledge_source_ids: list[str] = field(default_factory=list)


def _get_product_default_model(product) -> str:
    """Get the default LLM model for a product (empty string = system default)."""
    return ''


def _match_agent_by_context(
    agents: list[Agent],
    channel: str,
    channel_context: dict,
) -> Agent | None:
    """
    Pick the best agent from a list using channel_context routing.

    Returns the agent whose channel_config contains a matching ID,
    or the default agent (one with an empty/missing ID list),
    or None if no agents are provided.
    """
    mapping = CHANNEL_CONTEXT_KEYS.get(channel)
    if not mapping:
        return agents[0] if agents else None

    context_key, config_key = mapping
    context_value = channel_context.get(context_key)
    if not context_value:
        return agents[0] if agents else None

    default_agent: Agent | None = None
    for agent in agents:
        assigned_ids = (agent.channel_config or {}).get(config_key, [])
        if not assigned_ids:
            if default_agent is None:
                default_agent = agent
            continue
        if context_value in assigned_ids:
            return agent

    return default_agent or (agents[0] if agents else None)


async def _resolve_knowledge_source_ids(agent: Agent, product) -> list[str]:
    """Resolve knowledge source IDs based on the agent's knowledge_scope."""
    from apps.knowledge.models import KnowledgeSource

    scope = agent.knowledge_scope
    if scope == KnowledgeScope.ALL:
        return []
    elif scope == KnowledgeScope.ALL_INTERNAL:
        return [
            str(pk) async for pk in KnowledgeSource.objects.filter(
                product=product,
                visibility__in=[KnowledgeSource.Visibility.INTERNAL, KnowledgeSource.Visibility.ALL],
                status=KnowledgeSource.Status.ACTIVE,
            ).values_list('id', flat=True)
        ]
    elif scope == KnowledgeScope.ALL_EXTERNAL:
        return [
            str(pk) async for pk in KnowledgeSource.objects.filter(
                product=product,
                visibility__in=[KnowledgeSource.Visibility.EXTERNAL, KnowledgeSource.Visibility.ALL],
                status=KnowledgeSource.Status.ACTIVE,
            ).values_list('id', flat=True)
        ]
    elif scope == KnowledgeScope.SELECTED:
        return [
            str(pk) async for pk in agent.knowledge_sources.filter(
                status=KnowledgeSource.Status.ACTIVE,
            ).values_list('id', flat=True)
        ]
    return []


def _build_agent_config(
    agent: Agent, product, channel: str,
    knowledge_source_ids: list[str] | None = None,
) -> AgentConfig:
    """Build an AgentConfig from an Agent instance merged with product defaults."""
    guidance_parts = []
    if product.agent_guidance:
        guidance_parts.append(product.agent_guidance)
    if agent.guidance_override:
        guidance_parts.append(agent.guidance_override)
    if agent.tone and agent.tone in TONE_INSTRUCTIONS:
        guidance_parts.append(TONE_INSTRUCTIONS[agent.tone])
    guidance = "\n\n".join(p for p in guidance_parts if isinstance(p, str))

    return AgentConfig(
        agent_id=str(agent.id),
        agent_name=agent.name,
        channel=channel,
        guidance=guidance,
        tone=agent.tone or '',
        llm_model=agent.llm_model or _get_product_default_model(product),
        temperature=agent.temperature if agent.temperature is not None else 0.3,
        max_response_tokens=agent.max_response_tokens,
        include_sources=agent.include_sources,
        include_suggested_followups=agent.include_suggested_followups,
        tool_allowlist=agent.tool_allowlist or [],
        tool_denylist=agent.tool_denylist or [],
        language=agent.default_language or getattr(product, 'default_language', 'auto') or 'auto',
        channel_config=agent.channel_config or {},
        knowledge_scope=agent.knowledge_scope or KnowledgeScope.ALL,
        knowledge_source_ids=knowledge_source_ids or [],
    )


def _build_product_defaults(product, channel: str) -> AgentConfig:
    """Build an AgentConfig from product-level defaults (no agent configured)."""
    return AgentConfig(
        agent_id=None,
        agent_name=getattr(product, 'name', 'Assistant'),
        channel=channel,
        guidance=getattr(product, 'agent_guidance', '') or '',
        tone='',
        llm_model=_get_product_default_model(product),
        temperature=0.3,
        max_response_tokens=None,
        include_sources=True,
        include_suggested_followups=True,
        tool_allowlist=[],
        tool_denylist=[],
        language=getattr(product, 'default_language', 'auto') or 'auto',
        channel_config={},
    )


async def resolve_agent_config_from_agent(agent: Agent, product) -> AgentConfig:
    """Build AgentConfig directly from a pre-resolved Agent instance."""
    knowledge_source_ids = await _resolve_knowledge_source_ids(agent, product)
    return _build_agent_config(agent, product, agent.channel, knowledge_source_ids)


async def resolve_agent_config(
    product,
    channel: str,
    channel_context: dict | None = None,
) -> AgentConfig:
    """
    Resolve the effective agent configuration for a product + channel.

    When multiple agents exist for the same product+channel, uses channel_context
    to route to the correct agent (e.g. by Slack channel ID). Falls back to the
    default agent (one with no channel assignments), then to the first active agent.

    Returns product defaults if no agent exists for this channel.
    """
    agents = [
        a async for a in Agent.objects.filter(
            product=product,
            channel=channel,
            is_active=True,
        ).order_by('created_at')
    ]

    if not agents:
        return _build_product_defaults(product, channel)

    if channel_context and len(agents) > 1:
        agent = _match_agent_by_context(agents, channel, channel_context)
    else:
        agent = agents[0]

    if agent is None:
        return _build_product_defaults(product, channel)

    knowledge_source_ids = await _resolve_knowledge_source_ids(agent, product)
    return _build_agent_config(agent, product, channel, knowledge_source_ids)


def filter_tools_for_agent(
    all_tools: list[dict],
    channel: str,
    allowlist: list[str],
    denylist: list[str],
) -> list[dict]:
    """
    Filter tools based on channel compatibility and agent access control.

    Filtering order:
    1. Channel compatibility (from tool.channel_compatibility field)
    2. Allowlist (if non-empty, only these tools are included)
    3. Denylist (these tools are always excluded)
    """
    compatible = [
        t for t in all_tools
        if channel in t.get('channel_compatibility', ['web'])
    ]

    if allowlist:
        compatible = [t for t in compatible if t['name'] in allowlist]

    if denylist:
        compatible = [t for t in compatible if t['name'] not in denylist]

    return compatible
