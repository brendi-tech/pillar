"""
Usage threshold notifications for billing.

Checks whether an organization has crossed a usage threshold (80% or 100%)
and sends email alerts. Designed to be called after each completed response
via report_usage().
"""
import logging
from datetime import datetime, timezone as tz
from decimal import Decimal

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from apps.billing.constants import aget_weighted_usage, get_effective_limit, get_plan_limits

logger = logging.getLogger(__name__)

THRESHOLDS = [80, 100]

NOREPLY_FROM = settings.DEFAULT_FROM_EMAIL


def _get_billing_recipients(org) -> list[str]:
    """Resolve who should receive billing alerts."""
    if org.billing_email:
        return [org.billing_email]

    from apps.users.models import OrganizationMembership

    admin_emails = list(
        OrganizationMembership.objects.filter(
            organization=org,
            role=OrganizationMembership.Role.ADMIN,
        ).values_list("user__email", flat=True)
    )
    return admin_emails


async def _get_billing_recipients_async(org) -> list[str]:
    if org.billing_email:
        return [org.billing_email]

    from apps.users.models import OrganizationMembership

    admin_emails = []
    async for email in (
        OrganizationMembership.objects.filter(
            organization=org,
            role=OrganizationMembership.Role.ADMIN,
        ).values_list("user__email", flat=True)
    ):
        admin_emails.append(email)
    return admin_emails


def _build_80_email(
    org_name: str, used: int, limit: int, plan_label: str, billing_url: str
) -> tuple[str, str, str]:
    """Return (subject, plain_text, html) for the 80% threshold email."""
    subject = f"You're approaching your response limit — {org_name}"
    body = (
        f"Hi,\n\n"
        f"Your organization \"{org_name}\" has used {used} of {limit} included "
        f"responses on the {plan_label} plan this billing period.\n\n"
        f"After {limit} responses, additional usage is billed per-response "
        f"on your next invoice.\n\n"
        f"View your usage and manage your plan:\n{billing_url}\n\n"
        f"— Pillar"
    )
    html = (
        f'<p>Hi,</p>'
        f'<p>Your organization <strong>{org_name}</strong> has used '
        f'<strong>{used}</strong> of <strong>{limit}</strong> included '
        f'responses on the <strong>{plan_label}</strong> plan this billing period.</p>'
        f'<p>After {limit} responses, additional usage is billed per-response '
        f'on your next invoice.</p>'
        f'<p><a href="{billing_url}">View usage &amp; manage plan</a></p>'
        f'<p>— Pillar</p>'
    )
    return subject, body, html


def _build_100_email(
    org_name: str,
    used: int,
    limit: int,
    plan_label: str,
    payg_rate: Decimal | None,
    billing_url: str,
) -> tuple[str, str, str]:
    """Return (subject, plain_text, html) for the 100% threshold email."""
    overage = used - limit
    subject = f"Action required: You've exceeded your included responses — {org_name}"

    rate_text = f"${payg_rate}/response" if payg_rate else "your plan's per-response rate"
    overage_line = (
        f"You currently have {overage} overage response{'s' if overage != 1 else ''}"
        if overage > 0
        else "Additional responses from this point will be billed"
    )

    body = (
        f"Hi,\n\n"
        f"Your organization \"{org_name}\" has used all {limit} included responses "
        f"on the {plan_label} plan for this billing period.\n\n"
        f"{overage_line}, billed at {rate_text}.\n\n"
        f"To avoid unexpected charges, consider upgrading your plan.\n\n"
        f"Manage your plan:\n{billing_url}\n\n"
        f"— Pillar"
    )
    html = (
        f'<p>Hi,</p>'
        f'<p>Your organization <strong>{org_name}</strong> has used all '
        f'<strong>{limit}</strong> included responses on the '
        f'<strong>{plan_label}</strong> plan for this billing period.</p>'
        f'<p>{overage_line}, billed at <strong>{rate_text}</strong>.</p>'
        f'<p>To avoid unexpected charges, consider upgrading your plan.</p>'
        f'<p><a href="{billing_url}">Manage plan</a></p>'
        f'<p>— Pillar</p>'
    )
    return subject, body, html


def _send_threshold_email(
    org, threshold: int, used: int, limit: int
) -> None:
    """Send the appropriate threshold email."""
    plan_limits = get_plan_limits(org.plan)
    billing_url = f"{getattr(settings, 'ADMIN_URL', 'https://admin.trypillar.com')}/billing"
    plan_label = org.plan.title()

    if threshold == 80:
        subject, body, html = _build_80_email(
            org.name, used, limit, plan_label, billing_url
        )
    else:
        subject, body, html = _build_100_email(
            org.name, used, limit, plan_label, plan_limits.payg_rate, billing_url
        )

    recipients = _get_billing_recipients(org)
    if not recipients:
        logger.warning(
            "No billing recipients for org %s — skipping %d%% usage alert",
            org.id,
            threshold,
        )
        return

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=NOREPLY_FROM,
            to=recipients,
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
        logger.info(
            "Sent %d%% usage alert for org %s to %s",
            threshold,
            org.id,
            recipients,
        )
    except Exception:
        logger.exception(
            "Failed to send %d%% usage alert for org %s",
            threshold,
            org.id,
        )


async def check_and_notify_threshold(org, message_id: str) -> None:
    """
    Check if org just crossed a usage threshold and send an email if so.

    Called after each completed response. The threshold check is a single
    DB read + comparison, so overhead is negligible.
    """
    from apps.analytics.models import ChatMessage

    if not org:
        return

    plan_limits = get_plan_limits(org.plan)

    # Enterprise has unlimited usage — no notifications
    if plan_limits.monthly_responses is None:
        return

    limit = await sync_to_async(get_effective_limit)(org)

    # Count current usage
    base_filter = {
        "organization": org,
        "role": "assistant",
        "streaming_status": "completed",
    }

    if plan_limits.is_one_time:
        used = await aget_weighted_usage(ChatMessage.objects.filter(**base_filter))
    else:
        now = datetime.now(tz.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = await aget_weighted_usage(
            ChatMessage.objects.filter(
                **base_filter,
                created_at__gte=period_start,
            )
        )

    pct = (used / limit) * 100 if limit > 0 else 0

    # Find the highest crossed threshold
    crossed = None
    for t in THRESHOLDS:
        if pct >= t:
            crossed = t

    if crossed is None:
        return

    # Already notified at this level?
    last = org.usage_alert_last_threshold
    if last is not None and last >= crossed:
        return

    # New threshold crossed — send email and update org
    from asgiref.sync import sync_to_async

    await sync_to_async(_send_threshold_email)(org, crossed, used, limit)

    org.usage_alert_last_threshold = crossed
    await org.asave(update_fields=["usage_alert_last_threshold"])

    logger.info(
        "Org %s crossed %d%% usage threshold (used=%d, limit=%d)",
        org.id,
        crossed,
        used,
        limit,
    )
