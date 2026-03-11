"""
Outbound email helpers for public contact form submissions.
"""
import logging
from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def send_contact_submission_email(
    *,
    name: str,
    email: str,
    company: str,
    message: str,
    source_path: str = "",
    ip_address: str = "",
    submitted_at: datetime | None = None,
) -> bool:
    """Send a founder-facing email for a new contact submission."""
    submitted_at = submitted_at or datetime.utcnow()
    subject = f"New Contact Us submission from {name}"

    body = "\n".join(
        [
            "New Contact Us submission",
            "",
            f"Name: {name}",
            f"Email: {email}",
            f"Company: {company}",
            f"Source Path: {source_path or '/contact'}",
            f"IP Address: {ip_address or 'Unknown'}",
            f"Submitted At: {submitted_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            "",
            "Message:",
            message,
        ]
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[settings.CONTACT_FORM_TO_EMAIL],
            reply_to=[email],
        )
        msg.send(fail_silently=False)
        logger.info("Sent contact submission email for %s", email)
        return True
    except Exception:
        logger.exception("Failed to send contact submission email for %s", email)
        return False
