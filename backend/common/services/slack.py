"""
Slack notification service for internal team notifications.

This module provides a simple API for sending notifications to Slack
via Incoming Webhooks. It's designed for internal operational alerts
like new early access requests and important events.

Usage:
    from common.services import slack
    
    # Send a simple message
    slack.send_message("Hello from Pillar!")
    
    # Send an early access notification
    slack.notify_early_access_request(name, email, company, use_case)
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_message(text: str, blocks: Optional[List[Dict[str, Any]]] = None) -> bool:
    """
    Send a message to Slack via Incoming Webhook.
    
    This is the core function that sends messages to Slack. All other
    notification helpers use this under the hood.
    
    Args:
        text: Fallback text for notifications (required by Slack)
        blocks: Optional list of Slack Block Kit blocks for rich formatting
    
    Returns:
        True if message was sent successfully, False otherwise
    
    Note:
        - If SLACK_WEBHOOK_URL is not configured, this silently returns False
        - Disabled during tests (TESTING=True) and development (DEBUG=True)
        - Errors are logged but not raised - Slack failures shouldn't break the app
        - Uses Slack Block Kit for rich formatting: https://api.slack.com/block-kit
    """
    # Silent no-op in test environments
    if getattr(settings, 'TESTING', False):
        logger.debug("Slack notifications disabled during testing")
        return False
    
    if settings.DEBUG and not getattr(settings, 'SLACK_ENABLED_IN_DEBUG', False):
        logger.debug("Slack notifications disabled in DEBUG mode")
        return False
    
    webhook_url = getattr(settings, 'SLACK_WEBHOOK_URL', None)
    
    # Silent no-op if webhook is not configured
    if not webhook_url:
        logger.debug("Slack webhook URL not configured, skipping notification")
        return False
    
    try:
        payload = {"text": text}
        
        if blocks:
            payload["blocks"] = blocks
        
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        
        response.raise_for_status()
        
        logger.info(f"Sent Slack notification: {text[:100]}")
        return True
        
    except requests.exceptions.RequestException as e:
        # Log error but don't raise - Slack failures shouldn't break the app
        logger.error(f"Failed to send Slack notification: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending Slack notification: {e}", exc_info=True)
        return False


def notify_early_access_request(
    name: str,
    email: str,
    company: str,
    use_case: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> bool:
    """
    Send a notification when someone requests early access.
    
    This creates a rich formatted message with the request details.
    
    Args:
        name: Requester's name
        email: Requester's email
        company: Requester's company
        use_case: Optional description of their use case
        ip_address: Optional IP address for tracking
    
    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        text = f"🚀 New Early Access Request from {name} at {company}"
        
        # Build rich blocks for better formatting
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚀 New Early Access Request",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Name:*\n{name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Email:*\n{email}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Company:*\n{company}"
                    }
                ]
            },
        ]
        
        # Add use case if provided
        if use_case:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Use Case:*\n{use_case}"
                }
            })
        
        # Add context (timestamp, IP)
        context_parts = [f"Submitted at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"]
        if ip_address:
            context_parts.append(f"IP: {ip_address}")
        
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": " | ".join(context_parts)
                }
            ]
        })
        
        return send_message(text, blocks)
        
    except Exception as e:
        logger.error(f"Error building early access notification: {e}", exc_info=True)
        # Try to send a simple fallback message
        try:
            return send_message(f"New early access request from {name} <{email}> at {company}")
        except Exception:
            return False


def notify_new_signup(
    email: str,
    full_name: str = "",
    signup_method: str = "email",
) -> bool:
    """
    Send a notification when someone creates a new account.

    Args:
        email: New user's email address
        full_name: New user's full name (if provided)
        signup_method: How they signed up - "email", "github", "google", etc.

    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        display_name = full_name or email.split('@')[0]
        text = f"🎉 New signup: {display_name} ({email})"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🎉 New Account Created",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Name:*\n{display_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Email:*\n{email}"
                    },
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": (
                            f"Signup method: {signup_method} | "
                            f"{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                        )
                    }
                ]
            }
        ]

        return send_message(text, blocks)

    except Exception as e:
        logger.error(f"Error building new signup notification: {e}", exc_info=True)
        try:
            return send_message(f"New signup: {email} via {signup_method}")
        except Exception:
            return False


def notify_actions_synced(
    product_name: str,
    organization_name: str,
    created_count: int,
    updated_count: int,
    deleted_count: int,
    platform: str = "",
    version: str = "",
) -> bool:
    """
    Send a notification when new actions are synced to a product.

    Only sends when created_count > 0 (new actions, not just updates).

    Args:
        product_name: Name of the product being synced
        organization_name: Name of the organization
        created_count: Number of newly created actions
        updated_count: Number of updated actions
        deleted_count: Number of deleted actions
        platform: Deployment platform (e.g. "vercel", "node")
        version: Deployment version string

    Returns:
        True if notification was sent successfully, False otherwise
    """
    if created_count <= 0:
        return False

    try:
        text = (
            f"⚡ {created_count} new action{'s' if created_count != 1 else ''} "
            f"synced for {product_name} ({organization_name})"
        )

        fields = [
            {"type": "mrkdwn", "text": f"*Product:*\n{product_name}"},
            {"type": "mrkdwn", "text": f"*Organization:*\n{organization_name}"},
            {"type": "mrkdwn", "text": f"*New:*\n{created_count}"},
            {"type": "mrkdwn", "text": f"*Updated:*\n{updated_count}"},
        ]

        if deleted_count > 0:
            fields.append(
                {"type": "mrkdwn", "text": f"*Deleted:*\n{deleted_count}"}
            )

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "⚡ New Actions Synced",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": fields,
            },
        ]

        context_parts = [
            datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
        ]
        if platform:
            context_parts.append(f"Platform: {platform}")
        if version:
            context_parts.append(f"Version: {version}")

        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": " | ".join(context_parts)}
            ],
        })

        return send_message(text, blocks)

    except Exception as e:
        logger.error(f"Error building actions synced notification: {e}", exc_info=True)
        try:
            return send_message(
                f"New actions synced: {created_count} created for "
                f"{product_name} ({organization_name})"
            )
        except Exception:
            return False


def notify_payment_completed(
    organization_name: str,
    plan: str,
    amount: int,
    currency: str = "usd",
    customer_email: str = "",
    invoice_url: str = "",
    is_recurring: bool = True,
) -> bool:
    """
    Send a notification when a Stripe payment succeeds.

    Args:
        organization_name: Name of the paying organization
        plan: Current plan name (hobby, pro, growth, etc.)
        amount: Amount paid in cents (Stripe smallest currency unit)
        currency: Three-letter ISO currency code
        customer_email: Email on the Stripe customer
        invoice_url: Hosted invoice URL from Stripe
        is_recurring: Whether this is a recurring vs first payment

    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        amount_display = f"${amount / 100:,.2f} {currency.upper()}"
        payment_type = "Recurring Payment" if is_recurring else "New Subscription Payment"
        text = f"💰 {payment_type}: {amount_display} from {organization_name} ({plan.title()})"

        fields = [
            {"type": "mrkdwn", "text": f"*Organization:*\n{organization_name}"},
            {"type": "mrkdwn", "text": f"*Plan:*\n{plan.title()}"},
            {"type": "mrkdwn", "text": f"*Amount:*\n{amount_display}"},
        ]

        if customer_email:
            fields.append({"type": "mrkdwn", "text": f"*Email:*\n{customer_email}"})

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"💰 {payment_type}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": fields,
            },
        ]

        if invoice_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Invoice",
                            "emoji": True,
                        },
                        "url": invoice_url,
                    }
                ],
            })

        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
                }
            ],
        })

        return send_message(text, blocks)

    except Exception as e:
        logger.error(f"Error building payment notification: {e}", exc_info=True)
        try:
            return send_message(
                f"Payment received: ${amount / 100:,.2f} from {organization_name}"
            )
        except Exception:
            return False


def notify_agent_score_complete(
    domain: str,
    overall_score: int,
    report_url: str,
    email: str = "",
) -> bool:
    """
    Send a notification when an Agent Score report finishes.

    Args:
        domain: The domain that was scanned (e.g. "gusto.com")
        overall_score: Final score 0-100
        report_url: Full URL to view the report
        email: Email of the person who requested the scan (if provided)

    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        text = f"🔍 Agent Score complete: {domain} — {overall_score}/100"

        fields = [
            {
                "type": "mrkdwn",
                "text": f"*Domain:*\n{domain}",
            },
            {
                "type": "mrkdwn",
                "text": f"*Score:*\n{overall_score}/100",
            },
        ]

        if email:
            fields.append({
                "type": "mrkdwn",
                "text": f"*Email:*\n{email}",
            })

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🔍 Agent Score Complete",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": fields,
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Report",
                            "emoji": True,
                        },
                        "url": report_url,
                    }
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
                    }
                ],
            },
        ]

        return send_message(text, blocks)

    except Exception as e:
        logger.error(f"Error building agent score notification: {e}", exc_info=True)
        try:
            return send_message(
                f"Agent Score complete: {domain} — {overall_score}/100"
            )
        except Exception:
            return False


def notify_contact_submission(
    *,
    name: str,
    email: str,
    company: str,
    message: str,
    source_path: str = "",
    ip_address: str = "",
) -> bool:
    """
    Send a notification when someone submits the public contact form.

    Args:
        name: Submitter name
        email: Submitter email
        company: Submitter company
        message: Contact message body
        source_path: Origin path on the marketing site
        ip_address: Submitter IP address when available

    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        text = f"📬 New contact submission from {name} ({company})"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📬 New Contact Submission",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Name:*\n{name}"},
                    {"type": "mrkdwn", "text": f"*Email:*\n{email}"},
                    {"type": "mrkdwn", "text": f"*Company:*\n{company}"},
                    {
                        "type": "mrkdwn",
                        "text": f"*Source:*\n{source_path or '/contact'}",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Message:*\n>{message}",
                },
            },
        ]

        context_parts = [datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')]
        if ip_address:
            context_parts.append(f"IP: {ip_address}")

        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": " | ".join(context_parts),
                }
            ],
        })

        return send_message(text, blocks)

    except Exception as e:
        logger.error(f"Error building contact submission notification: {e}", exc_info=True)
        try:
            return send_message(f"New contact submission from {name} <{email}>")
        except Exception:
            return False
