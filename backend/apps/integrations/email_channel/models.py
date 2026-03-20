"""
Email channel integration models.

EmailChannelConfig stores per-product email channel settings.
EmailMessageMapping links email Message-IDs to ChatConversation records for threading.
"""
from django.db import models

from common.models.base import BaseModel, TenantAwareModel


class EmailChannelConfiguration(TenantAwareModel):
    """
    Configuration for a product's email channel.
    Each product can have one email channel with a unique inbound address.
    """
    product = models.OneToOneField(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='email_channel_config',
        help_text="Product this email channel is connected to",
    )
    inbound_address = models.EmailField(
        unique=True,
        help_text="Inbound email address, e.g. support-acme@inbound.trypillar.com",
    )
    from_name = models.CharField(
        max_length=255,
        help_text="Display name for outbound emails, e.g. 'Acme Support'",
    )
    from_address = models.EmailField(
        help_text="From address for outbound replies",
    )
    reply_to = models.EmailField(
        blank=True,
        help_text="Reply-To address (defaults to inbound_address if blank)",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False if deactivated from dashboard",
    )

    # Branding
    logo_url = models.URLField(
        blank=True,
        help_text="Logo URL for HTML email header",
    )
    accent_color = models.CharField(
        max_length=7,
        blank=True,
        help_text="Hex color for links and accent elements, e.g. #2563eb",
    )
    footer_text = models.TextField(
        blank=True,
        help_text="Footer text for outbound emails",
    )

    # Provider config
    provider = models.CharField(
        max_length=20,
        default='postmark',
        choices=[
            ('postmark', 'Postmark'),
            ('sendgrid', 'SendGrid'),
        ],
        help_text="Email provider for outbound delivery",
    )
    provider_api_key = models.TextField(
        blank=True,
        help_text="API key for the selected email provider (encrypted at rest)",
    )

    class Meta:
        verbose_name = "Email Channel Configuration"
        verbose_name_plural = "Email Channel Configurations"
        indexes = [
            models.Index(
                fields=['organization', '-created_at'],
                name='idx_email_cfg_org_created',
            ),
        ]

    def __str__(self) -> str:
        return f"Email: {self.inbound_address} → {self.product.name}"


class EmailMessageMapping(BaseModel):
    """
    Maps an email Message-ID to a ChatConversation for threading.
    Both inbound and outbound Message-IDs are stored so that replies
    in either direction can be threaded correctly.
    """
    config = models.ForeignKey(
        EmailChannelConfiguration,
        on_delete=models.CASCADE,
        related_name='message_mappings',
    )
    message_id = models.CharField(
        max_length=500,
        unique=True,
        db_index=True,
        help_text="RFC 5322 Message-ID header value, e.g. <abc@domain>",
    )
    conversation = models.ForeignKey(
        'analytics.ChatConversation',
        on_delete=models.CASCADE,
        related_name='email_mappings',
    )
    sender_email = models.EmailField(
        help_text="Email address of the sender",
    )
    subject = models.CharField(
        max_length=500,
        help_text="Email subject line",
    )
    direction = models.CharField(
        max_length=10,
        choices=[
            ('inbound', 'Inbound'),
            ('outbound', 'Outbound'),
        ],
        default='inbound',
        help_text="Whether this message was received or sent",
    )

    class Meta:
        verbose_name = "Email Message Mapping"
        verbose_name_plural = "Email Message Mappings"
        indexes = [
            models.Index(
                fields=['config', '-created_at'],
                name='idx_email_msg_cfg_created',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.direction}: {self.message_id[:40]}"
