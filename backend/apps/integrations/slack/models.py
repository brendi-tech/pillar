"""
Slack integration models.

SlackInstallation stores per-workspace OAuth credentials.
SlackConversationMapping links Slack threads to ChatConversation records.
"""
import uuid_utils.compat as uuid_utils
from django.db import models

from common.models.base import BaseModel, TenantAwareModel

try:
    from encrypted_fields.fields import EncryptedTextField
except ImportError:
    from django.db.models import TextField as EncryptedTextField


class SlackInstallation(TenantAwareModel):
    """
    Stores a Slack workspace installation.

    Supports two modes:
    - OAuth (is_byob=False): Pillar's shared Slack app, token obtained via OAuth.
    - BYOB (is_byob=True): Customer's own Slack app, token pasted manually.
    """
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='slack_installations',
        help_text="Product this Slack workspace is connected to",
    )
    team_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Slack workspace (team) ID, e.g. T04ABCDEF",
    )
    team_name = models.CharField(
        max_length=255,
        help_text="Human-readable workspace name",
    )
    bot_token = EncryptedTextField(
        help_text="xoxb-... bot token. Encrypted at rest via Fernet.",
    )
    bot_user_id = models.CharField(
        max_length=50,
        help_text="Bot user ID in the workspace, e.g. U04BOTID",
    )
    installing_user_id = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Slack user ID of the person who installed the app",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False if uninstalled or deactivated from dashboard",
    )
    scopes = models.JSONField(
        default=list,
        blank=True,
        help_text="OAuth scopes granted at install time",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Channel configuration: allowed_channels, dm_enabled, identity_link_url, etc.",
    )

    # BYOB fields
    app_id = models.CharField(
        max_length=50,
        blank=True,
        default='',
        db_index=True,
        help_text="Slack app ID (api_app_id). Empty for legacy OAuth installs.",
    )
    signing_secret = EncryptedTextField(
        blank=True,
        null=True,
        default='',
        help_text="Per-installation signing secret for BYOB apps. Empty = use global.",
    )
    is_byob = models.BooleanField(
        default=False,
        help_text="True if customer provided their own Slack app credentials.",
    )
    agent = models.ForeignKey(
        'products.Agent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='slack_installations',
        help_text="Specific agent to route messages to. Null = use product+channel resolver.",
    )

    class Meta:
        verbose_name = "Slack Installation"
        verbose_name_plural = "Slack Installations"
        constraints = [
            models.UniqueConstraint(
                fields=['team_id', 'app_id'],
                name='uq_slack_team_app',
            ),
        ]
        indexes = [
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['organization', '-updated_at']),
            models.Index(fields=['product', 'is_active']),
        ]

    def __str__(self):
        return f"{self.team_name} ({self.team_id}) → {self.product.name}"

    def get_client(self):
        """Return a WebClient authenticated with this installation's bot token."""
        from slack_sdk import WebClient
        return WebClient(token=self.bot_token)


class SlackConversationMapping(BaseModel):
    """
    Maps a Slack thread to a ChatConversation.
    Each unique (installation, channel_id, thread_ts) tuple is one conversation.
    """
    installation = models.ForeignKey(
        SlackInstallation,
        on_delete=models.CASCADE,
        related_name='conversation_mappings',
    )
    channel_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Slack channel ID (C..., D..., or G...)",
    )
    thread_ts = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Parent message timestamp that defines the thread",
    )
    conversation = models.OneToOneField(
        'analytics.ChatConversation',
        on_delete=models.CASCADE,
        related_name='slack_mapping',
    )

    class Meta:
        verbose_name = "Slack Conversation Mapping"
        verbose_name_plural = "Slack Conversation Mappings"
        constraints = [
            models.UniqueConstraint(
                fields=['installation', 'channel_id', 'thread_ts'],
                name='uq_slack_conv_mapping',
            ),
        ]
        indexes = [
            models.Index(
                fields=['installation', 'channel_id', 'thread_ts'],
                name='idx_slack_conv_lookup',
            ),
        ]

    def __str__(self):
        return f"Thread {self.thread_ts} in {self.channel_id}"
