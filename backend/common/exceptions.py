"""
Custom exception handlers for Django REST Framework.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.
    """
    # Handle plan limit exceptions with 402 Payment Required
    if isinstance(exc, PlanLimitExceeded):
        return Response(
            {
                'error': 'Plan Limit Exceeded',
                'detail': exc.message,
                'limit_type': exc.limit_type,
                'current_value': exc.current_value,
                'max_value': exc.max_value,
                'upgrade_url': '/settings/billing',
            },
            status=status.HTTP_402_PAYMENT_REQUIRED
        )

    if isinstance(exc, FeatureNotAvailableOnPlan):
        return Response(
            {
                'error': 'Feature Not Available',
                'detail': exc.message,
                'feature': exc.feature,
                'required_plan': exc.required_plan,
                'upgrade_url': '/settings/billing',
            },
            status=status.HTTP_402_PAYMENT_REQUIRED
        )

    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # If response is None, it's an unhandled exception
    if response is None:
        logger.error(
            f"Unhandled exception: {exc}",
            exc_info=True,
            extra={'context': context}
        )
        return Response(
            {
                'error': 'Internal server error',
                'detail': 'An unexpected error occurred. Please try again later.'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Log 4xx errors for debugging (especially validation errors)
    if response.status_code >= 400:
        view = context.get('view')
        view_name = view.__class__.__name__ if view else 'Unknown'
        request = context.get('request')
        method = request.method if request else 'Unknown'
        path = request.path if request else 'Unknown'

        log_level = logging.WARNING if response.status_code < 500 else logging.ERROR
        logger.log(
            log_level,
            f"API error {response.status_code} on {method} {path} [{view_name}]: {response.data}",
        )

    # Customize the response format
    if isinstance(response.data, dict):
        error_data = {
            'error': response.status_text,
            'status_code': response.status_code,
        }

        # Handle different error formats
        if 'detail' in response.data:
            error_data['detail'] = response.data['detail']
        else:
            error_data['errors'] = response.data

        response.data = error_data

    return response


class OrganizationMismatchError(Exception):
    """
    Raised when attempting to access a resource from a different organization.
    """
    pass


class RateLimitExceeded(Exception):
    """
    Raised when rate limit is exceeded.
    """
    pass


class LLMAPIError(Exception):
    """
    Raised when LLM API calls fail.
    """
    pass


class PlanLimitExceeded(Exception):
    """
    Raised when a plan limit is exceeded.

    Attributes:
        message: Human-readable error message
        limit_type: Type of limit exceeded (e.g., 'sites', 'competitors')
        current_value: Current usage count
        max_value: Maximum allowed by plan
    """
    def __init__(self, message: str, limit_type: str, current_value: int, max_value: int):
        self.message = message
        self.limit_type = limit_type
        self.current_value = current_value
        self.max_value = max_value
        super().__init__(self.message)


class FeatureNotAvailableOnPlan(Exception):
    """
    Raised when trying to use a feature not available on current plan.

    Attributes:
        message: Human-readable error message
        feature: Feature name (e.g., 'custom_domain', 's3_integration')
        required_plan: Minimum plan tier required (e.g., 'starter', 'pro')
    """
    def __init__(self, message: str, feature: str, required_plan: str = 'starter'):
        self.message = message
        self.feature = feature
        self.required_plan = required_plan
        super().__init__(self.message)


class CrawlError(Exception):
    """
    Raised when a crawl operation fails.
    """
    pass
