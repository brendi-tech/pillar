"""
Custom throttle classes for API rate limiting.
"""
from rest_framework.throttling import AnonRateThrottle


class PublicFormMinuteThrottle(AnonRateThrottle):
    """Rate limit: 5 requests per minute for public form endpoints."""
    scope = 'public_form_minute'


class PublicFormHourThrottle(AnonRateThrottle):
    """Rate limit: 15 requests per hour for public form endpoints."""
    scope = 'public_form_hour'


class PublicFormDayThrottle(AnonRateThrottle):
    """Rate limit: 30 requests per day for public form endpoints."""
    scope = 'public_form_day'




