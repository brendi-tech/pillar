from django.db import models

from common.models.base import TenantAwareModel


class IdentityMapping(TenantAwareModel):
    """
    Links a channel-specific user identity to a customer's internal user ID.

    Each record says: "In this product, the Slack user U04ABCD1234 is
    customer user 7842."

    Created through the account linking flow (slash command or API) and
    used at the start of every non-web request to resolve caller identity
    before running the agentic loop.
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='identity_mappings',
        help_text="Product this mapping belongs to",
    )

    # Channel identity (the "from" side)
    channel = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Channel type: slack, discord, email, api",
    )
    channel_user_id = models.CharField(
        max_length=255,
        help_text="Channel-native user identifier (Slack user ID, Discord user ID, email address)",
    )

    # Customer identity (the "to" side)
    external_user_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Customer's internal user ID, as passed to Pillar.identify() on web",
    )

    # Profile cache (denormalized from channel for display)
    email = models.EmailField(
        blank=True,
        default='',
        help_text="User's email (from channel profile or linking flow)",
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="User's display name from the channel",
    )

    # Linking metadata
    linked_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this mapping was created",
    )
    linked_via = models.CharField(
        max_length=50,
        default='manual',
        help_text="How the link was created: slash_command, api, auto_email, dashboard",
    )
    linked_by = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Who initiated the link (admin user ID or 'self')",
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this mapping is active (False = revoked)",
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this mapping was revoked",
    )

    class Meta:
        verbose_name = 'Identity Mapping'
        verbose_name_plural = 'Identity Mappings'
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'channel', 'channel_user_id'],
                condition=models.Q(is_active=True),
                name='idmap_active_chan_user_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['product', 'channel', 'channel_user_id'],
                name='idmap_prod_chan_uid_idx',
            ),
            models.Index(
                fields=['product', 'external_user_id'],
                name='idmap_prod_extuid_idx',
            ),
            models.Index(
                fields=['product', 'channel', 'is_active'],
                name='idmap_prod_chan_active_idx',
            ),
        ]

    def __str__(self):
        return f"{self.channel}:{self.channel_user_id} → {self.external_user_id}"


class LinkCode(TenantAwareModel):
    """
    Short-lived one-time code for the account linking flow.

    Generated when a user initiates linking from a non-web channel
    (e.g., /pillar connect in Slack). The code is exchanged for a
    permanent IdentityMapping when the user authenticates on the
    customer's system and confirms the link.
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='link_codes',
    )

    code = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        help_text="The one-time linking code (alphanumeric, URL-safe)",
    )

    # Who is trying to link
    channel = models.CharField(max_length=20)
    channel_user_id = models.CharField(max_length=255)
    channel_display_name = models.CharField(max_length=255, blank=True, default='')
    channel_email = models.CharField(max_length=255, blank=True, default='')

    # Lifecycle
    expires_at = models.DateTimeField(
        db_index=True,
        help_text="When this code expires (default: 10 minutes after creation)",
    )
    is_used = models.BooleanField(
        default=False,
        help_text="Whether this code has been redeemed",
    )
    used_at = models.DateTimeField(null=True, blank=True)
    used_by_external_user_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="The external_user_id that redeemed this code",
    )

    class Meta:
        verbose_name = 'Link Code'
        verbose_name_plural = 'Link Codes'
        indexes = [
            models.Index(
                fields=['product', 'channel', 'channel_user_id'],
                name='linkcode_prod_chan_uid_idx',
            ),
            models.Index(
                fields=['expires_at', 'is_used'],
                name='linkcode_expires_used_idx',
            ),
        ]

    def __str__(self):
        status = "used" if self.is_used else ("expired" if self.is_expired else "active")
        return f"LinkCode {self.code[:8]}... ({status})"

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        return timezone.now() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired
