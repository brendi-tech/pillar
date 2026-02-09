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




