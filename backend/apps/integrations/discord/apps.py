from django.apps import AppConfig


class DiscordIntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations.discord'
    label = 'discord_integration'
    verbose_name = 'Discord Integration'
