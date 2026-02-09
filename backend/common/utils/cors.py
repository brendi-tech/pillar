"""
CORS utilities for HTTP responses.

Provides a consistent CORS implementation across all views.
"""

from django.http import HttpRequest, HttpResponse


def add_cors_headers(response: HttpResponse, request: HttpRequest) -> HttpResponse:
    """
    Add CORS headers to response.

    Handles the full set of CORS headers needed for the SDK to communicate
    with the backend from any origin.

    Args:
        response: The HTTP response to add headers to
        request: The original HTTP request (used to get origin)

    Returns:
        The response with CORS headers added
    """
    origin = request.META.get("HTTP_ORIGIN", "*")

    response["Access-Control-Allow-Origin"] = origin
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Requested-With, "
        "X-Help-Center-Id, X-Thread-Id, X-Run-Id, x-customer-id, "
        "x-visitor-id, x-session-id, x-external-user-id, x-user-profile, "
        "x-page-url, Accept-Language, X-Pillar-Platform, X-Pillar-Action-Version"
    )
    response["Access-Control-Allow-Credentials"] = "true"
    response["Access-Control-Expose-Headers"] = "X-Run-Id, X-Thread-Id"

    return response
