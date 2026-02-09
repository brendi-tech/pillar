"""
Email service for user notifications.
"""
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


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
The Help Center Team
        """.strip()

        # HTML version
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
    </div>

    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="margin-top: 0;">Hi,</p>

        <p><strong>{invited_by_name}</strong> has invited you to join <strong>{organization_name}</strong> as a <strong>{role}</strong>.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{invitation_link}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
            </a>
        </div>

        <p style="color: #666; font-size: 14px;">This invitation expires in 28 days.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

        <p style="color: #999; font-size: 12px; margin-bottom: 0;">
            If you didn't expect this invitation, you can safely ignore this email.
        </p>
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
