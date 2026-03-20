"""
Discord integration models.

DiscordInstallation stores per-guild OAuth credentials.
DiscordConversationMapping links Discord threads/channels to ChatConversation records.
"""
from django.db import models

from common.models.base import BaseModel, TenantAwareModel

try:
    from encrypted_fields.fields import EncryptedTextField
except ImportError:
    from django.db.models import TextField as EncryptedTextField


class DiscordInstallation(TenantAwareModel):
    """
    Stores a Discord guild (server) installation.
    One installation per Discord guild (guild_id).
    """
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='discord_installations',
        help_text="Product this Discord server is connected to",
    )
    guild_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Discord guild (server) snowflake ID",
    )
    guild_name = models.CharField(
        max_length=255,
        help_text="Human-readable guild name",
    )
    bot_token = EncryptedTextField(
        help_text="Bot token from Discord OAuth. Encrypted at rest via Fernet.",
    )
    bot_user_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Bot user snowflake ID in this guild",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False if removed from guild or deactivated from dashboard",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Channel restrictions, DM settings, etc.",
    )

    class Meta:
        verbose_name = "Discord Installation"
        verbose_name_plural = "Discord Installations"
        indexes = [
            models.Index(
                fields=['organization', '-created_at'],
                name='idx_discord_inst_org_created',
            ),
            models.Index(
                fields=['product', 'is_active'],
                name='idx_discord_inst_prod_active',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.guild_name} ({self.guild_id}) → {self.product.name}"


class DiscordConversationMapping(BaseModel):
    """
    Maps a Discord channel/thread to a ChatConversation.

    For guild messages the bot creates a thread so thread_id will be set.
    For DMs thread_id is blank and channel_id is the DM channel snowflake.
    """
    installation = models.ForeignKey(
        DiscordInstallation,
        on_delete=models.CASCADE,
        related_name='conversation_mappings',
    )
    guild_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Discord guild snowflake (denormalised for query convenience)",
    )
    channel_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Discord channel snowflake",
    )
    thread_id = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Discord thread snowflake (empty for DMs)",
    )
    conversation = models.OneToOneField(
        'analytics.ChatConversation',
        on_delete=models.CASCADE,
        related_name='discord_mapping',
    )

    class Meta:
        verbose_name = "Discord Conversation Mapping"
        verbose_name_plural = "Discord Conversation Mappings"
        constraints = [
            models.UniqueConstraint(
                fields=['installation', 'channel_id', 'thread_id'],
                name='uq_discord_conv_mapping',
            ),
        ]
        indexes = [
            models.Index(
                fields=['installation', 'channel_id', 'thread_id'],
                name='idx_discord_conv_lookup',
            ),
        ]

    def __str__(self) -> str:
        loc = f"thread {self.thread_id}" if self.thread_id else f"channel {self.channel_id}"
        return f"Discord {loc} in guild {self.guild_id}"
