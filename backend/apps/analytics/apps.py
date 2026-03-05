import atexit
import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.analytics'
    verbose_name = 'Analytics'

    def ready(self):
        from django.conf import settings

        org_id = getattr(settings, 'AGNOST_ORG_ID', '')
        if org_id:
            import agnost
            agnost.init(org_id)
            atexit.register(agnost.shutdown)
            logger.info("[Agnost] Initialized conversation tracking")
