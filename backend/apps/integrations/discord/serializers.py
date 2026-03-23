from rest_framework import serializers

from .models import DiscordInstallation


class DiscordInstallationSerializer(serializers.ModelSerializer):
    slash_command_name = serializers.SerializerMethodField()

    class Meta:
        model = DiscordInstallation
        fields = [
            'id',
            'guild_id',
            'guild_name',
            'bot_user_id',
            'application_id',
            'is_active',
            'is_byob',
            'config',
            'slash_command_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'guild_id', 'guild_name', 'bot_user_id',
            'application_id', 'is_active', 'is_byob',
            'created_at', 'updated_at',
        ]

    def get_slash_command_name(self, obj):
        return (obj.config or {}).get('slash_command_name', 'pillar')


class DiscordBYOBSetupSerializer(serializers.Serializer):
    bot_token = serializers.CharField(help_text="Bot token from the Discord Developer Portal.")
    public_key = serializers.CharField(
        required=False, default='',
        help_text="Application public key for Ed25519 verification. Auto-fetched from Discord if omitted.",
    )
    guild_id = serializers.CharField(
        required=False, default='',
        help_text="Guild ID. If omitted, auto-detected when the bot is in exactly one guild.",
    )
    slash_command_name = serializers.RegexField(
        r'^[-_\w]{1,32}$', required=False, default='pillar',
        help_text="Root slash command name. Default: pillar. e.g. 'autumn' gives /autumn ask.",
    )
