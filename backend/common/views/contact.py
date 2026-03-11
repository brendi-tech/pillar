"""
Public contact form endpoint for the marketing site.
"""
import logging

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.serializers import ContactSubmissionSerializer
from common.services.contact_email import send_contact_submission_email
from common.services.slack import notify_contact_submission
from common.throttles import (
    PublicFormDayThrottle,
    PublicFormHourThrottle,
    PublicFormMinuteThrottle,
)
from common.views.early_access import get_client_ip

logger = logging.getLogger(__name__)


@extend_schema(
    operation_id="public_contact_form",
    tags=["Public"],
    summary="Submit Contact Us form",
    description="Accept a public contact form submission from the marketing site.",
    request=ContactSubmissionSerializer,
    responses={
        201: OpenApiResponse(
            response={
                "type": "object",
                "properties": {
                    "detail": {"type": "string"},
                },
            },
            description="Contact form submitted successfully",
        ),
        400: OpenApiResponse(description="Validation error"),
        429: OpenApiResponse(description="Rate limit exceeded"),
        503: OpenApiResponse(description="Email delivery failed"),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([
    PublicFormMinuteThrottle,
    PublicFormHourThrottle,
    PublicFormDayThrottle,
])
def contact_form(request):
    """
    Process a public marketing contact form submission.

    Sends an email to the founder inbox and mirrors the submission to Slack.
    Slack failures are logged but do not fail the request.
    """
    serializer = ContactSubmissionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    validated_data = serializer.validated_data
    client_ip = get_client_ip(request)

    email_sent = send_contact_submission_email(
        name=validated_data["name"],
        email=validated_data["email"],
        company=validated_data["company"],
        message=validated_data["message"],
        source_path=validated_data.get("source_path", ""),
        ip_address=client_ip,
    )

    if not email_sent:
        logger.error(
            "Contact form email delivery failed for %s <%s>",
            validated_data["name"],
            validated_data["email"],
        )
        return Response(
            {"detail": "We could not send your message right now. Please try again shortly."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    slack_sent = notify_contact_submission(
        name=validated_data["name"],
        email=validated_data["email"],
        company=validated_data["company"],
        message=validated_data["message"],
        source_path=validated_data.get("source_path", ""),
        ip_address=client_ip,
    )

    if not slack_sent:
        logger.warning(
            "Slack notification failed for contact submission from %s <%s>",
            validated_data["name"],
            validated_data["email"],
        )

    return Response(
        {"detail": "Thanks for reaching out. We'll get back to you soon."},
        status=status.HTTP_201_CREATED,
    )
