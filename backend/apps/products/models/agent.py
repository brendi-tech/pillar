"""
Agent model - per-channel deployment configuration for a product's AI agent.
"""
import re

from django.core.exceptions import ValidationError
from django.db import models

from common.models.base import TenantAwareModel
from apps.mcp.services.agent.channels import Channel


CHANNEL_CHOICES = [
    ("web", "Web Widget"),
    ("slack", "Slack"),
    ("discord", "Discord"),
    ("email", "Email"),
    ("api", "API"),
    ("mcp", "MCP Server"),
]

TONE_CHOICES = [
    ("professional", "Professional"),
    ("friendly", "Friendly"),
    ("neutral", "Neutral"),
    ("concise", "Concise"),
    ("formal", "Formal"),
]


def validate_slug(value: str) -> None:
    """Validate agent slug format (same rules as product subdomain)."""
    if not value:
        return
    if len(value) < 3:
        raise ValidationError("Slug must be at least 3 characters")
    if len(value) > 100:
        raise ValidationError("Slug must be 100 characters or less")
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$', value):
        raise ValidationError(
            "Slug must contain only lowercase letters, numbers, and hyphens, "
            "and cannot start or end with a hyphen"
        )


class KnowledgeScope(models.TextChoices):
    ALL = 'all', 'All Sources'
    ALL_INTERNAL = 'all_internal', 'All Internal'
    ALL_EXTERNAL = 'all_external', 'All External'
    SELECTED = 'selected', 'Selected Sources'


class ToolScope(models.TextChoices):
    ALL = 'all', 'All Tools'
    ALL_SERVER_SIDE = 'all_server_side', 'All Server-Side'
    ALL_CLIENT_SIDE = 'all_client_side', 'All Client-Side'
    RESTRICTED = 'restricted', 'All With Restrictions'
    ALLOWED = 'allowed', 'Allowed Only'
    NONE = 'none', 'No Tools'


class Agent(TenantAwareModel):
    """
    Per-channel deployment configuration for a product's AI agent.

    Each agent inherits product-level defaults and can override
    personality, tool access, response behavior, and LLM model.

    Nullable fields use product-level defaults when not set.
    """

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='agents',
        db_index=True,
        help_text="Organization that owns this agent",
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='agents',
        help_text="Product this agent belongs to",
    )

    # Identity
    name = models.CharField(
        max_length=255,
        help_text="Display name for this agent (e.g., 'Support Bot', 'Email Assistant')",
    )
    slug = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        validators=[validate_slug],
        help_text="Globally unique slug used as the SDK install key (e.g., 'acme')",
    )
    channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
        db_index=True,
        help_text="Channel this agent serves",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this agent is accepting messages",
    )

    # Personality
    tone = models.CharField(
        max_length=50,
        choices=TONE_CHOICES,
        blank=True,
        default='',
        help_text="Tone of voice. Empty = use product default.",
    )
    guidance_override = models.TextField(
        blank=True,
        default='',
        help_text=(
            "Channel-specific instructions appended to product agent_guidance. "
            "Use for channel-appropriate behavior: 'Keep responses under 3 sentences' "
            "for Slack, 'Use formal salutations' for email."
        ),
    )

    # Tool access control
    tool_scope = models.CharField(
        max_length=20,
        choices=ToolScope.choices,
        default=ToolScope.ALL,
        help_text="How this agent's tool access is scoped.",
    )
    tool_restrictions = models.ManyToManyField(
        'products.Action',
        blank=True,
        related_name='restricted_by_agents',
        help_text="Tools excluded when scope is 'restricted'.",
    )
    tool_allowances = models.ManyToManyField(
        'products.Action',
        blank=True,
        related_name='allowed_by_agents',
        help_text="Tools included when scope is 'allowed'.",
    )
    tool_context_restrictions = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Map of tool_name -> list of allowed contexts '
            '(e.g. ["private"], ["public"], ["private", "team"]). '
            'Tools not listed are available in all contexts.'
        ),
    )

    # Response format
    max_response_tokens = models.IntegerField(
        null=True,
        blank=True,
        help_text="Max tokens for LLM response. Null = model default.",
    )
    include_sources = models.BooleanField(
        default=True,
        help_text="Whether to include source citations in responses",
    )
    include_suggested_followups = models.BooleanField(
        default=True,
        help_text="Whether to suggest follow-up questions",
    )

    # LLM configuration
    llm_model = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="LLM model override. Empty = use product/org default.",
    )
    temperature = models.FloatField(
        null=True,
        blank=True,
        help_text="Temperature override for LLM. Null = use default.",
    )

    # Channel-specific UI config
    channel_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Channel-specific configuration (web embed settings, Slack formatting, etc.)",
    )

    # MCP custom domain
    mcp_domain = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        help_text="Custom domain for MCP server access (e.g., 'mcp.acme.com'). "
                  "Client CNAMEs this to mcp-proxy.trypillar.com.",
    )
    cf_custom_hostname_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Cloudflare Custom Hostname ID for mcp_domain",
    )

    # Language override
    default_language = models.CharField(
        max_length=10,
        blank=True,
        default='',
        help_text="Language override for this agent. Empty = use product default.",
    )

    # External MCP sources (through table carries per-tool config)
    mcp_sources = models.ManyToManyField(
        'tools.MCPToolSource',
        through='products.AgentMCPSource',
        blank=True,
        related_name='agents',
        help_text="External MCP servers whose tools this agent can use.",
    )

    # OpenAPI tool sources (through table carries per-operation config)
    openapi_sources = models.ManyToManyField(
        'tools.OpenAPIToolSource',
        through='products.AgentOpenAPISource',
        blank=True,
        related_name='agents',
        help_text="OpenAPI specs whose operations this agent can call directly.",
    )

    # Knowledge scoping
    knowledge_scope = models.CharField(
        max_length=20,
        choices=KnowledgeScope.choices,
        default=KnowledgeScope.ALL,
        help_text="How this agent's knowledge access is scoped.",
    )
    knowledge_sources = models.ManyToManyField(
        'knowledge.KnowledgeSource',
        blank=True,
        related_name='agents',
        help_text="Knowledge sources this agent can access (used when scope is 'selected').",
    )

    class Meta:
        verbose_name = 'Agent'
        verbose_name_plural = 'Agents'
        indexes = [
            models.Index(
                fields=['product', 'channel', 'is_active'],
                name='agent_prod_chan_active_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.slug:
            self.slug = self.slug.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.channel})"
