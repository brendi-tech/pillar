"""
Custom throttle classes for API rate limiting.
"""
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class PublicFormMinuteThrottle(AnonRateThrottle):
    """Rate limit: 5 requests per minute for public form endpoints."""
    scope = 'public_form_minute'


class PublicFormHourThrottle(AnonRateThrottle):
    """Rate limit: 15 requests per hour for public form endpoints."""
    scope = 'public_form_hour'


class PublicFormDayThrottle(AnonRateThrottle):
    """Rate limit: 30 requests per day for public form endpoints."""
    scope = 'public_form_day'


class HeadlessChatThrottle(SimpleRateThrottle):
    """
    Rate limit for headless chat API, keyed by product API key.
    Configure via DEFAULT_THROTTLE_RATES['headless_chat'] in settings.
    """
    scope = 'headless_chat'

    def get_cache_key(self, request, view):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('Bearer '):
            token = auth[7:]
            return self.cache_format % {'scope': self.scope, 'ident': token}
        return self.get_ident(request)


