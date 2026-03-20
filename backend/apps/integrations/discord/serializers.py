from rest_framework import serializers

from .models import DiscordInstallation


class DiscordInstallationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscordInstallation
        fields = [
            'id',
            'guild_id',
            'guild_name',
            'bot_user_id',
            'is_active',
            'config',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'guild_id', 'guild_name', 'bot_user_id',
            'is_active', 'created_at', 'updated_at',
        ]
