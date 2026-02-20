"""
Email service for user notifications.
"""
import logging
from typing import TYPE_CHECKING

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, send_mail
from django.utils import timezone

if TYPE_CHECKING:
    from apps.users.models import User

logger = logging.getLogger(__name__)


def send_welcome_email(user: "User") -> bool:
    """
    Send a personal welcome email from the CEO to a new user.

    Returns:
        True if the email was sent, False otherwise.
    """
    from apps.users.services.email_templates import (
        WELCOME_FROM_EMAIL,
        WELCOME_REPLY_TO,
        welcome_email_html,
        welcome_email_plain_text,
        welcome_email_subject,
    )

    try:
        msg = EmailMultiAlternatives(
            subject=welcome_email_subject(),
            body=welcome_email_plain_text(user),
            from_email=WELCOME_FROM_EMAIL,
            to=[user.email],
            reply_to=[WELCOME_REPLY_TO],
        )
        msg.attach_alternative(welcome_email_html(user), "text/html")
        msg.send(fail_silently=False)

        user.welcome_email_sent_at = timezone.now()
        user.save(update_fields=["welcome_email_sent_at"])

        logger.info("Sent welcome email to %s", user.email)
        return True

    except Exception:
        logger.exception("Failed to send welcome email to %s", user.email)
        return False


def send_organization_invitation_email(
    email: str,
    token: str,
    organization_name: str,
    invited_by_name: str,
    role: str = 'member'
) -> bool:
    """
    Send organization invitation email.

    Args:
        email: Recipient email address
        token: Invitation token for the accept link
        organization_name: Name of the organization
        invited_by_name: Name of the person who sent the invitation
        role: Role being invited to (admin, member)

    Returns:
        True if email was sent successfully, False otherwise
    """
    try:
        subject = f"You've been invited to join {organization_name}"
        invitation_link = f"{settings.ADMIN_URL}/accept-invite?token={token}"

        # Plain text version
        message = f"""
Hi,

{invited_by_name} has invited you to join {organization_name} as a {role}.

Click the link below to accept the invitation:
{invitation_link}

This invitation expires in 28 days.

If you didn't expect this invitation, you can safely ignore this email.

Thanks,
The Pillar Team
        """.strip()

        # HTML version
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 0; background-color: #F3EFE8;">
    <div style="background-color: #F3EFE8; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto;">
            <!-- Header -->
            <div style="background-color: #1A1A1A; padding: 32px 36px; border-radius: 12px 12px 0 0;">
                <img src="https://storage.googleapis.com/pillar-prod-marketing/email/pillar-logo-white.png?v=2"
                     alt="Pillar"
                     width="99"
                     height="34"
                     style="display: block; border: 0; outline: none;">
            </div>

            <!-- Body -->
            <div style="background-color: #FFFFFF; padding: 36px; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4;">
                <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 600; color: #1A1A1A;">You're invited</h2>

                <p style="margin: 0 0 16px 0; color: #1A1A1A; font-size: 15px; line-height: 1.6;">
                    <strong>{invited_by_name}</strong> has invited you to join <strong>{organization_name}</strong> as a <strong>{role}</strong>.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="{invitation_link}"
                       style="display: inline-block; background-color: #FF6E00; color: #FFFFFF; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.01em;">
                        Accept Invitation
                    </a>
                </div>

                <p style="color: #6B6B6B; font-size: 13px; margin: 0;">This invitation expires in 28 days.</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #FFFFFF; padding: 24px 36px; border-top: 1px solid #E8E4DC; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4; border-radius: 0 0 12px 12px;">
                <p style="color: #6B6B6B; font-size: 12px; margin: 0; line-height: 1.5;">
                    If you didn't expect this invitation, you can safely ignore this email.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Sent invitation email to {email} for organization '{organization_name}'")
        return True

    except Exception as e:
        logger.error(f"Failed to send invitation email to {email}: {e}")
        return False


def send_password_reset_email(email: str, uid: str, token: str) -> bool:
    """
    Send password reset email with a secure reset link.

    Args:
        email: Recipient email address
        uid: URL-safe base64-encoded user PK
        token: Password reset token from Django's token generator

    Returns:
        True if email was sent successfully, False otherwise
    """
    try:
        subject = "Reset your Pillar password"
        reset_link = f"{settings.ADMIN_URL}/reset-password?uid={uid}&token={token}"

        message = f"""
Hi,

We received a request to reset the password for your Pillar account.

Click the link below to set a new password:
{reset_link}

This link expires in 3 days. If you didn't request a password reset, you can safely ignore this email.

Thanks,
The Pillar Team
        """.strip()

        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 0; background-color: #F3EFE8;">
    <div style="background-color: #F3EFE8; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto;">
            <!-- Header -->
            <div style="background-color: #1A1A1A; padding: 32px 36px; border-radius: 12px 12px 0 0;">
                <img src="https://storage.googleapis.com/pillar-prod-marketing/email/pillar-logo-white.png?v=2"
                     alt="Pillar"
                     width="99"
                     height="34"
                     style="display: block; border: 0; outline: none;">
            </div>

            <!-- Body -->
            <div style="background-color: #FFFFFF; padding: 36px; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4;">
                <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 600; color: #1A1A1A;">Reset your password</h2>

                <p style="margin: 0 0 16px 0; color: #1A1A1A; font-size: 15px; line-height: 1.6;">
                    We received a request to reset the password for your Pillar account. Click the button below to choose a new password.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="{reset_link}"
                       style="display: inline-block; background-color: #FF6E00; color: #FFFFFF; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.01em;">
                        Reset Password
                    </a>
                </div>

                <p style="color: #6B6B6B; font-size: 13px; margin: 0;">This link expires in 3 days.</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #FFFFFF; padding: 24px 36px; border-top: 1px solid #E8E4DC; border-left: 1px solid #D4D4D4; border-right: 1px solid #D4D4D4; border-radius: 0 0 12px 12px;">
                <p style="color: #6B6B6B; font-size: 12px; margin: 0; line-height: 1.5;">
                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Sent password reset email to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")
        return False
