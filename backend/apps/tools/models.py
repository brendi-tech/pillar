"""
Server-side tool infrastructure models.

ToolEndpoint — registered webhook endpoint for backend SDK tool calls.
MCPToolSource — customer's MCP server for zero-code tool integration.
OpenAPIToolSource — customer's OpenAPI spec for direct HTTP tool integration.
UserToolCredential — per-user OAuth token storage for OpenAPI tools.
OAuthLinkToken — short-lived tokens for the OAuth linking flow.
RegisteredSkill — SDK-registered skill (instructional prompt content).
"""
from django.db import models
from pgvector.django import HnswIndex, VectorField

from common.fields import EncryptedTextField
from common.models.base import BaseModel, TenantAwareModel


class ToolEndpoint(TenantAwareModel):
    """Registered HTTP endpoint that receives server-side tool calls."""

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='tool_endpoints',
        help_text="Product this endpoint serves"
    )

    endpoint_url = models.URLField(
        max_length=500,
        help_text="URL where Pillar POSTs tool calls"
    )

    registered_tools = models.JSONField(
        default=list,
        help_text="List of tool schemas registered by the SDK"
    )

    sdk_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="SDK identifier sent during registration (e.g. 'pillar-python/0.1.0')"
    )

    last_call_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time a tool call was dispatched to this endpoint"
    )

    last_ping_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time a health-check ping was sent"
    )

    last_ping_success = models.BooleanField(
        default=False,
        help_text="Whether the most recent ping succeeded"
    )

    consecutive_failures = models.PositiveIntegerField(
        default=0,
        help_text="Number of consecutive ping failures"
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this endpoint accepts tool calls"
    )

    class Meta:
        verbose_name = 'Tool Endpoint'
        verbose_name_plural = 'Tool Endpoints'
        indexes = [
            models.Index(
                fields=['product', 'is_active'],
                name='toolep_product_active_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.subdomain} → {self.endpoint_url}"


class MCPToolSource(TenantAwareModel):
    """Customer's MCP server that Pillar connects to as a client."""

    class AuthType(models.TextChoices):
        NONE = 'none', 'None'
        BEARER = 'bearer', 'Bearer Token'
        HEADER = 'header', 'Custom Header'
        OAUTH = 'oauth', 'OAuth 2.1'

    class DiscoveryStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        ERROR = 'error', 'Error'

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='mcp_sources',
        help_text="Product this MCP source belongs to"
    )

    name = models.CharField(
        max_length=255,
        help_text="Human-readable name (e.g. 'Acme internal tools')"
    )

    slug = models.SlugField(
        max_length=50,
        blank=True,
        default='',
        help_text="Short identifier used to namespace tool names (e.g. 'datadog')",
    )

    url = models.URLField(
        max_length=500,
        help_text="MCP server Streamable HTTP endpoint URL"
    )

    auth_type = models.CharField(
        max_length=20,
        choices=AuthType.choices,
        default=AuthType.NONE,
    )

    auth_credentials = EncryptedTextField(
        blank=True,
        null=True,
        default='',
        help_text="Auth credentials (encrypted). JSON: {'token': '...'} or {'header_name': '...', 'header_value': '...'}"
    )

    discovered_tools = models.JSONField(
        default=list,
        help_text="Tool schemas returned by the last tools/list call"
    )

    discovered_resources = models.JSONField(
        default=list,
        blank=True,
        help_text="Resource descriptors from the last resources/list call, with embeddings"
    )

    discovered_prompts = models.JSONField(
        default=list,
        blank=True,
        help_text="Prompt definitions from the last prompts/list call"
    )

    last_discovery_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When tools/list was last called"
    )

    discovery_status = models.CharField(
        max_length=20,
        choices=DiscoveryStatus.choices,
        default=DiscoveryStatus.PENDING,
    )

    discovery_error = models.TextField(
        blank=True,
        default='',
        help_text="Error message from the last failed discovery"
    )

    last_ping_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_ping_success = models.BooleanField(
        default=False,
    )

    consecutive_failures = models.PositiveIntegerField(
        default=0,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    # OAuth 2.1 fields (populated during discovery when auth_type='oauth')
    oauth_client_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Client ID obtained via Dynamic Client Registration",
    )
    oauth_authorization_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="External server's OAuth authorization endpoint",
    )
    oauth_token_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="External server's OAuth token endpoint",
    )
    oauth_registration_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="External server's DCR endpoint",
    )
    oauth_scopes = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Space-separated OAuth scopes requested",
    )

    class OAuthStatus(models.TextChoices):
        NONE = 'none', 'N/A'
        DISCOVERING = 'discovering', 'Discovering'
        AUTHORIZATION_REQUIRED = 'authorization_required', 'Authorization Required'
        AUTHORIZED = 'authorized', 'Authorized'
        EXPIRED = 'expired', 'Token Expired'
        ERROR = 'error', 'Error'

    oauth_status = models.CharField(
        max_length=25,
        choices=OAuthStatus.choices,
        default=OAuthStatus.NONE,
        help_text="Current state of the OAuth authorization flow",
    )
    oauth_token_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the current access token expires",
    )

    class Meta:
        verbose_name = 'MCP Tool Source'
        verbose_name_plural = 'MCP Tool Sources'
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'slug'],
                name='mcpsrc_product_slug_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['product', 'is_active'],
                name='mcpsrc_product_active_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.subdomain} / {self.name} ({self.url})"


class OpenAPIToolSource(TenantAwareModel):
    """Customer's OpenAPI spec that Pillar uses to call their API directly."""

    class AuthType(models.TextChoices):
        NONE = 'none', 'None'
        API_KEY = 'api_key', 'API Key'
        BEARER = 'bearer', 'Bearer Token'
        OAUTH2_CLIENT_CREDENTIALS = 'oauth2_client_credentials', 'OAuth2 Client Credentials'
        OAUTH2_AUTHORIZATION_CODE = 'oauth2_authorization_code', 'OAuth2 Authorization Code'

    class DiscoveryStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        ERROR = 'error', 'Error'

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='openapi_sources',
        help_text="Product this OpenAPI source belongs to",
    )

    name = models.CharField(
        max_length=255,
        help_text="Human-readable name (e.g. 'Acme API')",
    )

    slug = models.SlugField(
        max_length=50,
        blank=True,
        default='',
        help_text="Short identifier to namespace tool names (e.g. 'acme')",
    )

    spec_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="URL to the OpenAPI spec (JSON or YAML). Mutually exclusive with spec_content.",
    )

    spec_content = models.TextField(
        blank=True,
        default='',
        help_text="Raw OpenAPI spec content (JSON or YAML). Mutually exclusive with spec_url.",
    )

    spec_format = models.CharField(
        max_length=10,
        blank=True,
        default='json',
        help_text="Format of the spec: 'json' or 'yaml'",
    )

    spec_version = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="API version from spec info.version",
    )

    base_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="Base URL for API calls (overrides spec servers[0].url)",
    )

    # --- Org-level auth ---
    auth_type = models.CharField(
        max_length=30,
        choices=AuthType.choices,
        default=AuthType.NONE,
    )

    auth_credentials = EncryptedTextField(
        blank=True,
        null=True,
        default='',
        help_text="Encrypted org-level credentials. JSON: {'token': '...'} or {'header_name': '...', 'header_value': '...'}",
    )

    # --- Per-user OAuth (authorization_code flow) ---
    oauth_client_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="OAuth client ID for the customer's authorization server",
    )

    oauth_client_secret = EncryptedTextField(
        blank=True,
        null=True,
        default='',
        help_text="OAuth client secret (encrypted at rest)",
    )

    oauth_authorization_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="OAuth authorization endpoint URL",
    )

    oauth_token_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="OAuth token endpoint URL",
    )

    oauth_scopes = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Space-separated OAuth scopes to request",
    )

    # --- Discovered operations ---
    discovered_operations = models.JSONField(
        default=list,
        help_text="Parsed operations from the OpenAPI spec, with input schemas and embeddings",
    )

    last_discovery_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the spec was last fetched and parsed",
    )

    discovery_status = models.CharField(
        max_length=20,
        choices=DiscoveryStatus.choices,
        default=DiscoveryStatus.PENDING,
    )

    discovery_error = models.TextField(
        blank=True,
        default='',
        help_text="Error message from the last failed spec parse",
    )

    current_version_number = models.PositiveIntegerField(
        default=0,
        help_text="Auto-incrementing version counter, bumped on each spec update",
    )

    # --- Health tracking ---
    last_ping_at = models.DateTimeField(null=True, blank=True)
    last_ping_success = models.BooleanField(default=False)
    consecutive_failures = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    oauth_environments = models.JSONField(
        default=list,
        blank=True,
        help_text='List of OAuth environments, e.g. [{"name": "Sandbox", "extra_scope": "env:sandbox", "credential_key": "sandbox_key"}]',
    )

    oauth_token_exchange_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Optional. POST to this URL with Bearer {oauth_token} after OAuth to provision API keys. "
                  "Response JSON field is specified per-environment via credential_key.",
    )

    class Meta:
        verbose_name = 'OpenAPI Tool Source'
        verbose_name_plural = 'OpenAPI Tool Sources'
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'slug'],
                name='openapisrc_product_slug_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['product', 'is_active'],
                name='openapisrc_product_active_idx',
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.spec_url and not self.spec_content:
            raise ValidationError("Either spec_url or spec_content must be provided.")
        if self.spec_url and self.spec_content:
            raise ValidationError("Only one of spec_url or spec_content can be set.")

    @property
    def is_url_based(self) -> bool:
        return bool(self.spec_url)

    def __str__(self) -> str:
        source_label = self.spec_url or "pasted spec"
        return f"{self.product.subdomain} / {self.name} ({source_label})"


class OpenAPIToolSourceVersion(TenantAwareModel):
    """Immutable snapshot of an OpenAPI spec at a point in time."""

    source = models.ForeignKey(
        OpenAPIToolSource,
        on_delete=models.CASCADE,
        related_name='versions',
    )

    version_number = models.PositiveIntegerField(
        help_text="Monotonically increasing counter (1, 2, 3...)",
    )

    spec_version = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="API version from spec info.version (e.g. '1.0.0')",
    )

    revision = models.PositiveIntegerField(
        default=1,
        help_text="Revision within the same spec_version (1 for first, 2+ for duplicates)",
    )

    label = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Optional user-provided suffix (e.g. 'scopes-fix')",
    )

    spec_content = models.TextField(
        blank=True,
        default='',
    )

    spec_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
    )

    spec_format = models.CharField(
        max_length=10,
        blank=True,
        default='',
    )

    discovered_operations = models.JSONField(
        default=list,
        blank=True,
    )

    operation_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'OpenAPI Tool Source Version'
        verbose_name_plural = 'OpenAPI Tool Source Versions'
        ordering = ['-version_number']
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'version_number'],
                name='openapiver_source_vernum_uniq',
            ),
        ]

    @property
    def display_version(self) -> str:
        base = self.spec_version or f'v{self.version_number}'
        if self.revision > 1:
            base = f'{base}-rev{self.revision}'
        if self.label:
            base = f'{base}-{self.label}'
        return base

    def __str__(self) -> str:
        return f'{self.source.name} {self.display_version}'


class UserToolCredential(TenantAwareModel):
    """Per-user OAuth token for calling OpenAPI tools on behalf of a specific user."""

    openapi_source = models.ForeignKey(
        OpenAPIToolSource,
        on_delete=models.CASCADE,
        related_name='user_credentials',
        help_text="Which OpenAPI source these credentials are for",
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='user_tool_credentials',
    )

    channel = models.CharField(
        max_length=50,
        help_text="Channel where the user authenticated (web, slack, discord, etc.)",
    )

    channel_user_id = models.CharField(
        max_length=255,
        help_text="User identifier on the channel (Slack user ID, Discord snowflake, visitor_id)",
    )

    external_user_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Customer-side user ID (from IdentityMapping), nullable",
    )

    oauth_environment = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Which OAuth environment this credential is for (e.g. 'sandbox', 'live')",
    )

    access_token = EncryptedTextField(
        help_text="OAuth access token (encrypted at rest)",
    )

    refresh_token = EncryptedTextField(
        blank=True,
        null=True,
        default='',
        help_text="OAuth refresh token (encrypted at rest)",
    )

    token_type = models.CharField(
        max_length=50,
        default='Bearer',
        help_text="Token type (usually 'Bearer')",
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the access token expires",
    )

    scopes = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Space-separated scopes granted by this token",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Set to False when token is revoked or refresh fails irrecoverably",
    )

    class Meta:
        verbose_name = 'User Tool Credential'
        verbose_name_plural = 'User Tool Credentials'
        constraints = [
            models.UniqueConstraint(
                fields=['openapi_source', 'channel', 'channel_user_id'],
                name='usertoolcred_source_chan_user_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['openapi_source', 'is_active'],
                name='usertoolcred_source_active_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.channel}:{self.channel_user_id} → {self.openapi_source.name}"

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        if self.expires_at is None:
            return False
        return self.expires_at < timezone.now()


class OAuthLinkToken(TenantAwareModel):
    """Short-lived token binding an OAuth consent flow to a channel user."""

    openapi_source = models.ForeignKey(
        OpenAPIToolSource,
        on_delete=models.CASCADE,
        related_name='link_tokens',
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
    )

    token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Cryptographically random token used as OAuth state",
    )

    channel = models.CharField(max_length=50)
    channel_user_id = models.CharField(max_length=255)

    expires_at = models.DateTimeField(
        help_text="Token expires after 10 minutes",
    )

    is_used = models.BooleanField(
        default=False,
        help_text="Set to True after successful OAuth callback",
    )

    used_at = models.DateTimeField(null=True, blank=True)

    code_verifier = models.CharField(
        max_length=128,
        blank=True,
        default='',
        help_text="PKCE code_verifier stored during authorize, sent during token exchange",
    )

    oauth_environment = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Which OAuth environment this link is for",
    )

    class Meta:
        verbose_name = 'OAuth Link Token'
        verbose_name_plural = 'OAuth Link Tokens'

    def __str__(self) -> str:
        return f"Link {self.channel}:{self.channel_user_id} → {self.openapi_source.name}"

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        return self.expires_at < timezone.now()


class RegisteredSkill(TenantAwareModel):
    """SDK-registered skill — instructional content for AI agents.

    Skills are structured markdown instructions registered via the server
    SDKs or CLI sync. They are exposed to the dashboard agent via unified
    search + ``load_skill``, and to IDE clients as both MCP prompts and
    MCP resources.
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='registered_skills',
        help_text="Product this skill belongs to",
    )
    endpoint = models.ForeignKey(
        ToolEndpoint,
        on_delete=models.CASCADE,
        related_name='skills',
        null=True,
        blank=True,
        help_text="Server SDK endpoint that registered this skill (null for CLI sync)",
    )

    name = models.CharField(
        max_length=100,
        help_text="Unique skill name (e.g. 'autumn-setup')",
    )
    description = models.TextField(
        help_text="When/why to use this skill",
    )
    content = models.TextField(
        help_text="Full skill content (markdown)",
    )

    description_embedding = VectorField(
        dimensions=1536,
        null=True,
        blank=True,
    )
    embedding_model = models.CharField(
        max_length=50,
        blank=True,
        default='',
    )

    is_active = models.BooleanField(default=True, db_index=True)

    class SourceType(models.TextChoices):
        CLI_SYNC = 'cli_sync', 'CLI Sync'
        BACKEND_SDK = 'backend_sdk', 'Backend SDK'
        MANUAL = 'manual', 'Manual'

    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.BACKEND_SDK,
    )

    class Meta:
        verbose_name = 'Registered Skill'
        verbose_name_plural = 'Registered Skills'
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'name'],
                name='regskill_product_name_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['product', 'is_active'],
                name='regskill_prod_active_idx',
            ),
            HnswIndex(
                name='regskill_desc_emb_idx',
                fields=['description_embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.subdomain} / {self.name}"


class OpenAPIOperationConfig(BaseModel):
    """Per-operation source-level defaults for an OpenAPI source.

    Auto-created during spec discovery. Controls whether each operation
    is enabled and whether it requires user confirmation before execution.
    """

    openapi_source = models.ForeignKey(
        OpenAPIToolSource,
        on_delete=models.CASCADE,
        related_name='operation_configs',
    )
    tool_name = models.CharField(max_length=255)
    is_enabled = models.BooleanField(default=True)
    requires_confirmation = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'OpenAPI Operation Config'
        verbose_name_plural = 'OpenAPI Operation Configs'
        constraints = [
            models.UniqueConstraint(
                fields=['openapi_source', 'tool_name'],
                name='openapi_op_config_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['openapi_source'],
                name='openapi_opconfig_source_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.openapi_source.name} / {self.tool_name}"


class MCPToolConfig(BaseModel):
    """Per-tool source-level defaults for an MCP source.

    Auto-created during discovery. Controls whether each tool
    is enabled and whether it requires user confirmation before execution.
    """

    mcp_source = models.ForeignKey(
        MCPToolSource,
        on_delete=models.CASCADE,
        related_name='tool_configs',
    )
    tool_name = models.CharField(max_length=255)
    is_enabled = models.BooleanField(default=True)
    requires_confirmation = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'MCP Tool Config'
        verbose_name_plural = 'MCP Tool Configs'
        constraints = [
            models.UniqueConstraint(
                fields=['mcp_source', 'tool_name'],
                name='mcp_tool_config_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['mcp_source'],
                name='mcp_toolconfig_source_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.mcp_source.name} / {self.tool_name}"
