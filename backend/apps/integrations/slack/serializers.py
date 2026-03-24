from rest_framework import serializers

from .models import SlackInstallation


class SlackInstallationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SlackInstallation
        fields = [
            'id',
            'team_id',
            'team_name',
            'bot_user_id',
            'is_active',
            'is_byob',
            'app_id',
            'scopes',
            'config',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'team_id', 'team_name', 'bot_user_id',
            'is_active', 'is_byob', 'app_id', 'scopes',
            'created_at', 'updated_at',
        ]


class SlackInstallationConfigSerializer(serializers.Serializer):
    dm_enabled = serializers.BooleanField(required=False, default=True)
    identity_link_url = serializers.URLField(required=False, allow_blank=True)
    auto_link_by_email = serializers.BooleanField(required=False, default=False)
    allowed_channels = serializers.ListField(
        child=serializers.CharField(), required=False, default=list,
    )


class SlackBYOBSetupSerializer(serializers.Serializer):
    bot_token = serializers.CharField(
        required=True,
        help_text="xoxb-... bot token from your Slack app",
    )
    signing_secret = serializers.CharField(
        required=True,
        help_text="Signing secret from your Slack app's Basic Information page",
    )
    app_id = serializers.CharField(
        required=True,
        help_text="App ID from your Slack app's Basic Information page (e.g. A07...)",
    )
