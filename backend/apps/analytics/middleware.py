"""
Middleware for extracting analytics context from SDK request headers.

Fully async to avoid blocking the ASGI event loop.
"""
import logging
from asgiref.sync import iscoroutinefunction, markcoroutinefunction

logger = logging.getLogger(__name__)


class AnalyticsMiddleware:
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

    This middleware is fully async-native to avoid serializing ASGI
    requests through Django's single-thread sync_to_async executor.
    """

    async_capable = True
    sync_capable = False

    def __init__(self, get_response):
        self.get_response = get_response
        if iscoroutinefunction(self.get_response):
            markcoroutinefunction(self)

    async def __call__(self, request):
        self.process_request(request)
        response = await self.get_response(request)
        return response

    def process_request(self, request):
        """Extract analytics headers and attach to request.

        Pure CPU work (no I/O), safe to call synchronously from async context.
        """
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
