from django.apps import AppConfig


class DemosConfig(AppConfig):
    """Django app configuration for the demos app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.demos'
    verbose_name = 'Demos'
