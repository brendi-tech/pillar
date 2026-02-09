"""
Custom admin-only views for API documentation.
These views require superuser permissions and use Django's admin session authentication.
"""

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import user_passes_test
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from drf_spectacular.openapi import AutoSchema
from django.conf import settings


def superuser_required(view_func):
    """Decorator that requires user to be a superuser and redirects to admin login."""
    def check_superuser(user):
        return user.is_authenticated and user.is_superuser

    # Redirect to admin login page if not authenticated/authorized
    actual_decorator = user_passes_test(
        check_superuser,
        login_url='/admin/login/'
    )
    return actual_decorator(view_func)


@method_decorator([never_cache, csrf_exempt, superuser_required], name='dispatch')
class AdminSpectacularAPIView(SpectacularAPIView):
    """API schema view that requires superuser permissions."""
    serializer_class = None  # No input serializer needed for schema endpoint

    def get(self, request, *args, **kwargs):
        """Override to dynamically set servers based on current request."""
        # Get the current request's host and scheme
        current_host = request.get_host()

        # Debug: log the current host for troubleshooting
        if settings.DEBUG:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"AdminSpectacularAPIView: current_host = '{current_host}'")

        # Determine if we should use HTTPS
        # In containerized environments (Cloud Run, etc.), we should always use HTTPS
        # Also check for forwarded headers that indicate HTTPS
        is_secure = (
            request.is_secure() or  # Standard Django HTTPS detection
            request.META.get('HTTP_X_FORWARDED_PROTO') == 'https' or  # Load balancer header
            request.META.get('HTTP_X_FORWARDED_SSL') == 'on' or  # Alternative header
            getattr(settings, 'IS_CLOUD_RUN', False) or  # Cloud Run always serves over HTTPS
            current_host.endswith('.run.app') or  # Cloud Run domain
            not settings.DEBUG  # Use HTTPS for all non-debug environments
        )

        current_scheme = 'https' if is_secure else 'http'
        current_url = f"{current_scheme}://{current_host}"

        # Create dynamic servers list
        dynamic_servers = []

        # For local development, always prefer localhost:8003 as the primary server
        # Handle both cases: with port (127.0.0.1:8003) and without port (127.0.0.1)
        is_local_dev = (
            settings.DEBUG and (
                current_host in ['localhost:8003', '127.0.0.1:8003', 'localhost', '127.0.0.1'] or
                current_host.startswith('localhost:') or
                current_host.startswith('127.0.0.1:')
            )
        )

        if is_local_dev:
            dynamic_servers.append({
                'url': 'http://localhost:8003',
                'description': 'Local development server'
            })
            # Add current server as secondary if it's different
            if not current_url.startswith('http://localhost:8003'):
                dynamic_servers.append({
                    'url': current_url,
                    'description': f'Current server ({current_host})'
                })
        else:
            # Always add the current request's host first for non-local environments
            dynamic_servers.append({
                'url': current_url,
                'description': 'Current server'
            })

            # Add localhost for development if not already the current host
            if current_host != 'localhost:8003' and current_host != '127.0.0.1:8003':
                dynamic_servers.append({
                    'url': 'http://localhost:8003',
                    'description': 'Local development server'
                })

        # Temporarily override the SPECTACULAR_SETTINGS
        original_servers = settings.SPECTACULAR_SETTINGS.get('SERVERS', [])
        settings.SPECTACULAR_SETTINGS['SERVERS'] = dynamic_servers

        try:
            response = super().get(request, *args, **kwargs)
        finally:
            # Restore original servers
            settings.SPECTACULAR_SETTINGS['SERVERS'] = original_servers

        return response


@method_decorator([never_cache, csrf_exempt, superuser_required], name='dispatch')
class AdminSpectacularSwaggerView(SpectacularSwaggerView):
    """Swagger UI view that requires superuser permissions."""
    pass


@method_decorator([never_cache, csrf_exempt, superuser_required], name='dispatch')
class AdminSpectacularRedocView(SpectacularRedocView):
    """ReDoc view that requires superuser permissions."""
    pass
