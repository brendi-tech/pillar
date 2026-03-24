"""
Agent configuration resolution service.

Resolves the effective agent configuration for a product + channel by merging
product-level defaults with agent-level overrides. Supports multi-agent routing
via channel_context (e.g. Slack channel ID).
"""
import logging
from dataclasses import dataclass, field

from apps.products.models import (
    Agent,
    AgentOpenAPISource, AgentOpenAPIOperationOverride,
    AgentMCPSource, AgentMCPToolOverride,
)
from apps.products.models.agent import KnowledgeScope, ToolScope

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
    tool_scope: str
    tool_restriction_ids: list[str]
    tool_allowance_ids: list[str]
    language: str
    channel_config: dict
    tool_context_restrictions: dict[str, list[str]] = field(default_factory=dict)
    knowledge_scope: str = KnowledgeScope.ALL
    knowledge_source_ids: list[str] = field(default_factory=list)
    mcp_source_ids: list[str] = field(default_factory=list)
    mcp_tool_selections: dict[str, list[str]] = field(default_factory=dict)
    mcp_confirmation_config: dict[str, dict] = field(default_factory=dict)
    openapi_source_ids: list[str] = field(default_factory=list)
    openapi_operation_selections: dict[str, list[str]] = field(default_factory=dict)
    openapi_confirmation_config: dict[str, dict] = field(default_factory=dict)


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
    tool_restriction_ids: list[str] | None = None,
    tool_allowance_ids: list[str] | None = None,
    mcp_source_ids: list[str] | None = None,
    mcp_tool_selections: dict[str, list[str]] | None = None,
    mcp_confirmation_config: dict[str, dict] | None = None,
    openapi_source_ids: list[str] | None = None,
    openapi_operation_selections: dict[str, list[str]] | None = None,
    openapi_confirmation_config: dict[str, dict] | None = None,
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
        tool_scope=agent.tool_scope or ToolScope.ALL,
        tool_restriction_ids=tool_restriction_ids or [],
        tool_allowance_ids=tool_allowance_ids or [],
        tool_context_restrictions=agent.tool_context_restrictions or {},
        language=agent.default_language or getattr(product, 'default_language', 'auto') or 'auto',
        channel_config=agent.channel_config or {},
        knowledge_scope=agent.knowledge_scope or KnowledgeScope.ALL,
        knowledge_source_ids=knowledge_source_ids or [],
        mcp_source_ids=mcp_source_ids or [],
        mcp_tool_selections=mcp_tool_selections or {},
        mcp_confirmation_config=mcp_confirmation_config or {},
        openapi_source_ids=openapi_source_ids or [],
        openapi_operation_selections=openapi_operation_selections or {},
        openapi_confirmation_config=openapi_confirmation_config or {},
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
        tool_scope=ToolScope.ALL,
        tool_restriction_ids=[],
        tool_allowance_ids=[],
        language=getattr(product, 'default_language', 'auto') or 'auto',
        channel_config={},
    )


async def _resolve_tool_scope_ids(agent: Agent) -> tuple[list[str], list[str]]:
    """Resolve tool restriction/allowance IDs from the agent's M2M fields."""
    scope = agent.tool_scope or ToolScope.ALL
    restriction_ids: list[str] = []
    allowance_ids: list[str] = []
    if scope == ToolScope.RESTRICTED:
        restriction_ids = [
            str(pk) async for pk in
            agent.tool_restrictions.values_list('id', flat=True)
        ]
    elif scope == ToolScope.ALLOWED:
        allowance_ids = [
            str(pk) async for pk in
            agent.tool_allowances.values_list('id', flat=True)
        ]
    return restriction_ids, allowance_ids


async def _resolve_openapi_config(
    agent: Agent,
) -> tuple[list[str], dict[str, list[str]], dict[str, dict]]:
    """Resolve OpenAPI source IDs, operation selections, and confirmation config.

    Queries the relational models:
    - OpenAPIOperationConfig for source-level defaults
    - AgentOpenAPIOperationOverride for per-agent overrides

    Builds dicts compatible with the executor:
    - operation_selections: source_id -> list of allowed tool_names
      (absent key = all operations allowed)
    - confirmation_config: source_id -> {source_defaults: {tool_name: bool}, overrides: {tool_name: bool}}
    """
    from apps.tools.models import OpenAPIOperationConfig

    source_ids: list[str] = []
    operation_selections: dict[str, list[str]] = {}
    confirmation_config: dict[str, dict] = {}

    async for cfg in AgentOpenAPISource.objects.filter(
        agent=agent,
    ).select_related('openapi_source').prefetch_related('operation_overrides'):
        sid = str(cfg.openapi_source_id)
        source_ids.append(sid)

        agent_overrides: dict[str, dict] = {}
        disabled_ops: list[str] = []
        has_any_disabled = False

        async for ov in AgentOpenAPIOperationOverride.objects.filter(
            agent_openapi_source=cfg,
        ):
            if ov.is_enabled is False:
                disabled_ops.append(ov.tool_name)
                has_any_disabled = True
            if ov.requires_confirmation is not None:
                agent_overrides[ov.tool_name] = ov.requires_confirmation

        source_defaults: dict[str, bool] = {}
        async for op_cfg in OpenAPIOperationConfig.objects.filter(
            openapi_source_id=cfg.openapi_source_id,
        ):
            source_defaults[op_cfg.tool_name] = op_cfg.requires_confirmation
            if not op_cfg.is_enabled:
                has_any_disabled = True

        if has_any_disabled:
            enabled_source_ops = {
                op_id for op_id, conf in source_defaults.items()
                if op_id not in disabled_ops
            }
            disabled_at_source = {
                op_cfg_op_id
                async for op_cfg_op_id in OpenAPIOperationConfig.objects.filter(
                    openapi_source_id=cfg.openapi_source_id,
                    is_enabled=False,
                ).values_list('tool_name', flat=True)
            }
            enabled_source_ops -= disabled_at_source

            re_enabled = {
                ov.tool_name
                async for ov in AgentOpenAPIOperationOverride.objects.filter(
                    agent_openapi_source=cfg,
                    is_enabled=True,
                )
            }
            enabled_source_ops |= re_enabled

            operation_selections[sid] = list(enabled_source_ops)

        confirmation_config[sid] = {
            'source_defaults': source_defaults,
            'overrides': agent_overrides,
        }

    return source_ids, operation_selections, confirmation_config


async def _resolve_mcp_config(
    agent: Agent,
) -> tuple[list[str], dict[str, list[str]], dict[str, dict]]:
    """Resolve MCP source IDs, tool selections, and confirmation config.

    Mirrors _resolve_openapi_config but for MCP sources.
    """
    from apps.tools.models import MCPToolConfig

    source_ids: list[str] = []
    tool_selections: dict[str, list[str]] = {}
    confirmation_config: dict[str, dict] = {}

    async for cfg in AgentMCPSource.objects.filter(
        agent=agent,
    ).select_related('mcp_source').prefetch_related('tool_overrides'):
        sid = str(cfg.mcp_source_id)
        source_ids.append(sid)

        agent_overrides: dict[str, bool] = {}
        disabled_ops: list[str] = []
        has_any_disabled = False

        async for ov in AgentMCPToolOverride.objects.filter(
            agent_mcp_source=cfg,
        ):
            if ov.is_enabled is False:
                disabled_ops.append(ov.tool_name)
                has_any_disabled = True
            if ov.requires_confirmation is not None:
                agent_overrides[ov.tool_name] = ov.requires_confirmation

        source_defaults: dict[str, bool] = {}
        async for tool_cfg in MCPToolConfig.objects.filter(
            mcp_source_id=cfg.mcp_source_id,
        ):
            source_defaults[tool_cfg.tool_name] = tool_cfg.requires_confirmation
            if not tool_cfg.is_enabled:
                has_any_disabled = True

        if has_any_disabled:
            enabled_source_tools = {
                tn for tn in source_defaults
                if tn not in disabled_ops
            }
            disabled_at_source = {
                tn async for tn in MCPToolConfig.objects.filter(
                    mcp_source_id=cfg.mcp_source_id,
                    is_enabled=False,
                ).values_list('tool_name', flat=True)
            }
            enabled_source_tools -= disabled_at_source

            re_enabled = {
                ov.tool_name
                async for ov in AgentMCPToolOverride.objects.filter(
                    agent_mcp_source=cfg,
                    is_enabled=True,
                )
            }
            enabled_source_tools |= re_enabled

            tool_selections[sid] = list(enabled_source_tools)

        confirmation_config[sid] = {
            'source_defaults': source_defaults,
            'overrides': agent_overrides,
        }

    return source_ids, tool_selections, confirmation_config


async def resolve_agent_config_from_agent(
    agent: Agent, product, channel: str | None = None,
) -> AgentConfig:
    """Build AgentConfig directly from a pre-resolved Agent instance."""
    knowledge_source_ids = await _resolve_knowledge_source_ids(agent, product)
    tool_restriction_ids, tool_allowance_ids = await _resolve_tool_scope_ids(agent)
    mcp_source_ids, mcp_tool_sel, mcp_confirm = await _resolve_mcp_config(agent)
    openapi_source_ids, openapi_op_selections, openapi_confirm = (
        await _resolve_openapi_config(agent)
    )
    return _build_agent_config(
        agent, product, channel or agent.channel, knowledge_source_ids,
        tool_restriction_ids, tool_allowance_ids, mcp_source_ids,
        mcp_tool_sel, mcp_confirm,
        openapi_source_ids, openapi_op_selections, openapi_confirm,
    )


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
    tool_restriction_ids, tool_allowance_ids = await _resolve_tool_scope_ids(agent)
    mcp_source_ids, mcp_tool_sel, mcp_confirm = await _resolve_mcp_config(agent)
    openapi_source_ids, openapi_op_selections, openapi_confirm = (
        await _resolve_openapi_config(agent)
    )
    return _build_agent_config(
        agent, product, channel, knowledge_source_ids,
        tool_restriction_ids, tool_allowance_ids, mcp_source_ids,
        mcp_tool_sel, mcp_confirm,
        openapi_source_ids, openapi_op_selections, openapi_confirm,
    )


CLIENT_SIDE_CHANNELS = {'web', 'api'}


def filter_tools_for_agent(
    all_tools: list[dict],
    channel: str,
    tool_scope: str = ToolScope.ALL,
    restriction_ids: list[str] | None = None,
    allowance_ids: list[str] | None = None,
    message_context: str = "private",
    context_restrictions: dict[str, list[str]] | None = None,
) -> list[dict]:
    """
    Filter tools based on channel compatibility, agent tool scope,
    and message context (private vs public).

    Filtering order:
    1. Channel compatibility (from tool.channel_compatibility field)
    2. Client-side eligibility (only web/api channels can use client-side tools)
    3. Scope-based filtering (tool_type, restrictions, allowances, or none)
    4. Context restrictions (if tool is in the map, current message_context
       must be in the tool's allowed contexts list)
    """
    compatible = [
        t for t in all_tools
        if '*' in t.get('channel_compatibility', ['web'])
        or channel in t.get('channel_compatibility', ['web'])
    ]

    if channel not in CLIENT_SIDE_CHANNELS:
        compatible = [t for t in compatible if t.get('tool_type') != 'client_side']

    if tool_scope == ToolScope.NONE:
        return []
    elif tool_scope == ToolScope.ALL_SERVER_SIDE:
        compatible = [t for t in compatible if t.get('tool_type') == 'server_side']
    elif tool_scope == ToolScope.ALL_CLIENT_SIDE:
        compatible = [t for t in compatible if t.get('tool_type') == 'client_side']
    elif tool_scope == ToolScope.RESTRICTED and restriction_ids:
        restricted = set(str(rid) for rid in restriction_ids)
        compatible = [t for t in compatible if str(t.get('id', '')) not in restricted]
    elif tool_scope == ToolScope.ALLOWED:
        allowed = set(str(aid) for aid in (allowance_ids or []))
        compatible = [t for t in compatible if str(t.get('id', '')) in allowed]

    if context_restrictions:
        compatible = [
            t for t in compatible
            if message_context in context_restrictions.get(t['name'], [message_context])
        ]

    return compatible
