from django.apps import AppConfig


class SlackIntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations.slack'
    label = 'slack_integration'
    verbose_name = 'Slack Integration'
