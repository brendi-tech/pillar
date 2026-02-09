"""
Middleware for extracting analytics context from SDK request headers.
"""
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class AnalyticsMiddleware(MiddlewareMixin):
    """
    Middleware to extract analytics context from SDK request headers.

    Sets request.analytics dict with visitor/session info for passive tracking.
    This allows views to capture analytics without explicit SDK event calls.

    Headers extracted:
    - x-visitor-id: Persistent browser ID from SDK localStorage
    - x-session-id: Session ID from SDK sessionStorage
    - x-external-user-id: Client's authenticated user ID (for cross-device history)
    - x-page-url: Current page URL
    - User-Agent: Browser user agent
    - Referer: Referrer URL
    """

    def process_request(self, request):
        """Extract analytics headers and attach to request."""
        visitor_id = request.headers.get('x-visitor-id', '')
        session_id = request.headers.get('x-session-id', '')
        
        # Debug logging to trace header extraction
        if not visitor_id:
            # Check all headers to see what we're receiving
            all_headers = {k: v for k, v in request.headers.items()}
            logger.debug(f"[AnalyticsMiddleware] No visitor_id found. All headers: {list(all_headers.keys())}")
        else:
            logger.debug(f"[AnalyticsMiddleware] visitor_id={visitor_id}, session_id={session_id}")
        
        request.analytics = {
            'visitor_id': visitor_id,
            'session_id': session_id,
            'external_user_id': request.headers.get('x-external-user-id', ''),
            'page_url': request.headers.get('x-page-url', ''),
            'user_agent': request.headers.get('User-Agent', ''),
            'referer': request.headers.get('Referer', ''),
        }
        return None
