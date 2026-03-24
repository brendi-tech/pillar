"""
OAuth 2.1 models for MCP authentication.

Inbound models (Pillar as authorization server):
  - MCPApplication: Dynamically registered MCP clients
  - MCPGrant: Authorization grants with nullable user
  - MCPAccessToken: Access tokens with external identity
  - MCPRefreshToken: Refresh tokens with nullable user
  - OAuthProvider: Customer IdP configuration

Outbound OAuth state is stored on MCPToolSource (apps.tools.models).
"""
from django.conf import settings
from django.db import models
from oauth2_provider.models import (
    AbstractAccessToken,
    AbstractApplication,
    AbstractGrant,
    AbstractIDToken,
    AbstractRefreshToken,
)

from common.fields import EncryptedTextField
from common.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Inbound: DOT custom models (Pillar as OAuth authorization server)
# ---------------------------------------------------------------------------


class MCPApplication(AbstractApplication):
    """
    Dynamically registered MCP client (Cursor, Claude Desktop, etc.).

    Scoped to a product so each product's MCP server has independent clients.
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='mcp_oauth_apps',
        help_text="Product this OAuth client is registered for",
    )

    class Meta(AbstractApplication.Meta):
        verbose_name = 'MCP OAuth Application'
        verbose_name_plural = 'MCP OAuth Applications'


class MCPGrant(AbstractGrant):
    """
    Authorization grant with nullable user.

    MCP end-users are authenticated by the customer's IdP, not Django.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mcp_grants',
    )
    external_user_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="User claims from the customer's IdP",
    )

    class Meta(AbstractGrant.Meta):
        pass


class MCPAccessToken(AbstractAccessToken):
    """
    Access token with external identity from the customer's IdP.

    The user FK is already nullable in DOT's AbstractAccessToken.
    We add product scope and external identity fields.
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mcp_access_tokens',
    )
    external_user_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="User ID from the customer's IdP (e.g. 'sub' claim)",
    )
    external_email = models.EmailField(
        null=True,
        blank=True,
    )
    external_display_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )
    external_user_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full user claims from the customer's IdP",
    )

    class Meta(AbstractAccessToken.Meta):
        pass


class MCPRefreshToken(AbstractRefreshToken):
    """Refresh token with nullable user (MCP users aren't Django users)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mcp_refresh_tokens',
    )

    class Meta(AbstractRefreshToken.Meta):
        pass


class MCPIDToken(AbstractIDToken):
    """Stub ID token required by DOT's swappable model system.

    Not used for MCP OAuth (no OIDC), but AbstractAccessToken has a FK
    to OAUTH2_PROVIDER_ID_TOKEN_MODEL so a concrete model must exist.
    """

    class Meta(AbstractIDToken.Meta):
        pass


# ---------------------------------------------------------------------------
# Inbound: Customer IdP configuration
# ---------------------------------------------------------------------------


class OAuthProvider(TenantAwareModel):
    """
    Customer's identity provider configuration for inbound MCP OAuth.

    Each product can have one IdP. When configured, MCP clients must
    authenticate via OAuth 2.1 through this provider.
    """

    class ProviderType(models.TextChoices):
        OIDC = 'oidc', 'OpenID Connect'
        OAUTH2 = 'oauth2', 'OAuth 2.0'

    product = models.OneToOneField(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='oauth_provider',
    )

    provider_type = models.CharField(
        max_length=20,
        choices=ProviderType.choices,
        default=ProviderType.OIDC,
    )

    issuer_url = models.URLField(
        blank=True,
        default='',
        help_text="OIDC issuer URL for auto-discovery",
    )

    authorization_endpoint = models.URLField(
        help_text="OAuth authorization endpoint URL",
    )
    token_endpoint = models.URLField(
        help_text="OAuth token endpoint URL",
    )
    userinfo_endpoint = models.URLField(
        blank=True,
        default='',
        help_text="OIDC userinfo endpoint (optional if using id_token claims)",
    )

    client_id = models.CharField(
        max_length=255,
        help_text="OAuth client ID registered with the IdP",
    )
    client_secret = EncryptedTextField(
        blank=True,
        default='',
        help_text="OAuth client secret (encrypted at rest)",
    )

    scopes = models.CharField(
        max_length=500,
        default='openid email profile',
        help_text="Space-separated scopes to request from the IdP",
    )

    user_id_claim = models.CharField(
        max_length=100,
        default='sub',
        help_text="IdP claim that maps to user ID",
    )
    email_claim = models.CharField(
        max_length=100,
        default='email',
        help_text="IdP claim that maps to email",
    )
    name_claim = models.CharField(
        max_length=100,
        default='name',
        help_text="IdP claim that maps to display name",
    )

    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether OAuth is required for MCP clients",
    )

    class Meta:
        verbose_name = 'OAuth Provider'
        verbose_name_plural = 'OAuth Providers'

    def __str__(self) -> str:
        return f"{self.product.name} ({self.provider_type})"
