"""
Server-side tool infrastructure models.

ToolEndpoint — registered webhook endpoint for backend SDK tool calls.
MCPToolSource — customer's MCP server for zero-code tool integration.
"""
from django.db import models

from common.fields import EncryptedTextField
from common.models.base import TenantAwareModel


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
        default=True,
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
        default=True,
    )

    consecutive_failures = models.PositiveIntegerField(
        default=0,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    class Meta:
        verbose_name = 'MCP Tool Source'
        verbose_name_plural = 'MCP Tool Sources'
        indexes = [
            models.Index(
                fields=['product', 'is_active'],
                name='mcpsrc_product_active_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.subdomain} / {self.name} ({self.url})"
