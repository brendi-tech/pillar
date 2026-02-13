from django.apps import AppConfig


class KnowledgeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.knowledge'

    def ready(self):
        # Import signals to register them
        from apps.knowledge import signals  # noqa: F401
