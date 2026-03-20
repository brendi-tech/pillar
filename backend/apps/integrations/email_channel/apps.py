from django.apps import AppConfig


class EmailChannelConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations.email_channel'
    label = 'email_channel'
    verbose_name = 'Email Channel Integration'
