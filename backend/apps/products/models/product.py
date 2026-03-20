"""
Product model - central configuration for a product assistant.
"""
import re
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from common.models.base import TenantAwareModel


# Language choices for AI responses
LANGUAGE_CHOICES = [
    ('auto', 'Auto-detect from browser'),
    ('en', 'English'),
    ('es', 'Spanish'),
    ('fr', 'French'),
    ('de', 'German'),
    ('pt', 'Portuguese'),
    ('it', 'Italian'),
    ('zh', 'Chinese'),
    ('ja', 'Japanese'),
    ('ko', 'Korean'),
    ('ar', 'Arabic'),
]


# Reserved subdomains that cannot be used.
# Kept in sync with frontend/middleware.ts RESERVED_SUBDOMAINS (routing layer).
RESERVED_SUBDOMAINS = {
    # Infrastructure routing (must match frontend middleware)
    'admin', 'api', 'ai', 'app', 'help-api', 'www', 'staging',
    # Web / product defaults
    'dashboard', 'login', 'signup', 'register', 'status', 'docs',
    'blog', 'news', 'store', 'shop', 'changelog', 'updates',
    'community', 'forum', 'feedback', 'roadmap',
    'about', 'brand', 'press',
    'partners', 'affiliates', 'careers', 'jobs',
    'pricing', 'enterprise', 'sales',
    # Auth / identity
    'auth', 'oauth', 'sso', 'id', 'identity', 'account', 'accounts',
    # Billing
    'billing', 'pay', 'checkout',
    # Email / compliance (RFC 2142)
    'mail', 'email', 'postmaster', 'webmaster', 'hostmaster',
    'abuse', 'noreply', 'no-reply', 'mailer-daemon', 'info', 'contact',
    # Security / trust
    'security', 'privacy', 'trust', 'verify',
    'compliance', 'legal', 'terms', 'dmca',
    # Infrastructure / DNS
    'cdn', 'static', 'assets', 'ftp',
    'proxy', 'gateway', 'vpn',
    'monitoring', 'metrics', 'logs', 'alerts', 'backup',
    'ns1', 'ns2', 'mx', 'smtp', 'imap', 'pop', 'dns',
    'ws', 'socket', 'realtime',
    'media', 'images', 'files', 'uploads',
    'workers', 'cron',
    # Developer-facing
    'sdk', 'developers', 'sandbox', 'preview',
    'packages', 'webhooks', 'graphql', 'git',
    # Environments / release channels
    'demo', 'test', 'dev', 'development', 'production',
    'beta', 'alpha', 'canary', 'nightly', 'rc',
    # Pillar-specific
    'pillar', 'trypillar', 'help', 'support',
    'internal', 'external', 'public', 'private',
    # Dangerous / confusing values
    'root', 'null', 'undefined', 'localhost',
    'system', 'config', 'www2', 'origin', 'self',
}


def validate_subdomain(value: str) -> None:
    """
    Validate subdomain format.

    Rules:
    - 3-50 characters
    - Lowercase alphanumeric and hyphens only
    - Cannot start or end with hyphen
    - Cannot be a reserved word
    """
    if not value:
        return

    if len(value) < 3:
        raise ValidationError("Subdomain must be at least 3 characters")

    if len(value) > 50:
        raise ValidationError("Subdomain must be 50 characters or less")

    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$', value):
        raise ValidationError(
            "Subdomain must contain only lowercase letters, numbers, and hyphens, "
            "and cannot start or end with a hyphen"
        )

    if value in RESERVED_SUBDOMAINS:
        raise ValidationError(f"'{value}' is a reserved subdomain and cannot be used")


class Product(TenantAwareModel):
    """
    Central configuration for a product assistant.

    Each organization can have multiple products (e.g., different products, internal tools).
    Each product has a unique subdomain for public access.

    Stores branding, layout, and feature settings as JSON.
    """

    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        related_name='products',
        help_text="Organization this product belongs to"
    )

    # Product identity
    name = models.CharField(
        max_length=100,
        default='Product',
        help_text="Display name for this product (e.g., 'Customer Support', 'Internal Docs')"
    )

    subdomain = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        validators=[validate_subdomain],
        help_text="Unique subdomain for this product (e.g., 'acme' for acme.help.pillar.io)"
    )

    # Product website URL (used for prefilling sources, brand analysis, etc.)
    website_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="Primary website URL for the product"
    )

    # SDK integration tracking
    sdk_last_initialized_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the SDK last called the embed-config endpoint"
    )

    # Configuration stored as JSON
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Product configuration (branding, layout, features, etc.)"
    )

    # Whether this is the default/primary product for the org
    is_default = models.BooleanField(
        default=True,
        help_text="Whether this is the default product for the organization"
    )

    # Track auto-generation to prevent overwriting user customizations
    auto_theme_generated = models.BooleanField(
        default=False,
        help_text="Whether theme was auto-generated from brand analysis"
    )

    # Article display settings
    show_article_owner = models.BooleanField(
        default=False,
        help_text="Show article owner on public article pages (can be overridden per-article)"
    )

    # Language settings for AI responses
    default_language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        default='auto',
        help_text="Default language for AI responses. 'auto' detects from user's browser."
    )

    # AI Agent guidance
    agent_guidance = models.TextField(
        blank=True,
        default='',
        help_text='Custom instructions for the AI agent. Injected into the agent prompt for product-specific guidance.'
    )

    # Identity linking configuration
    identity_link_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text="URL template for account linking. Use {code} placeholder. "
                  "Example: https://app.acme.com/connect?code={code}",
    )
    identity_auto_link_by_email = models.BooleanField(
        default=False,
        help_text="Auto-link channel users to customer accounts by matching email addresses",
    )

    class Meta:
        # NO db_table - Django creates 'products_product'
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        indexes = [
            models.Index(fields=['organization', 'is_default']),
        ]

    def __str__(self):
        return f"{self.name} ({self.subdomain or 'draft'})"

    def save(self, *args, **kwargs):
        # Ensure subdomain is lowercase
        if self.subdomain:
            self.subdomain = self.subdomain.lower()
        super().save(*args, **kwargs)

    @property
    def public_url(self) -> str:
        """Get the public URL for this product.
        
        If a custom domain is configured and active, returns that.
        Otherwise, returns the default Pillar domain.
        """
        # Check for active custom domain in config
        seo_config = self.config.get('seo', {})
        custom_domain = seo_config.get('customDomain')
        custom_domain_status = seo_config.get('customDomainStatus')
        
        if custom_domain and custom_domain_status == 'active':
            # Use custom domain if configured and active
            return f"https://{custom_domain}"
        
        # Fall back to Pillar domain
        base_domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'trypillar.com')
        return f"https://{self.subdomain}.{base_domain}"

    def get_branding(self):
        """Get branding config."""
        return self.config.get('branding', {})

    def get_colors(self):
        """Get color config."""
        return self.config.get('colors', {})

    def get_layout(self):
        """Get layout config."""
        return self.config.get('layout', {})

    def get_features(self):
        """Get features config."""
        return self.config.get('features', {})
