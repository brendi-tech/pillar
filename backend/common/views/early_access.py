"""
Early access and waitlist form endpoints for marketing site.
No authentication required, rate limited to prevent spam.
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse

from common.throttles import (
    PublicFormMinuteThrottle,
    PublicFormHourThrottle,
    PublicFormDayThrottle,
)
from common.services import slack
from common.models import WaitlistEntry

logger = logging.getLogger(__name__)


def get_client_ip(request) -> str:
    """Extract client IP from request headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# =============================================================================
# Waitlist Endpoints (New Two-Step Flow)
# =============================================================================

@extend_schema(
    operation_id='public_waitlist_signup',
    tags=['Public'],
    summary='Join Waitlist',
    description='Step 1 of waitlist signup - capture email only. Returns entry ID for step 2.',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'email': {'type': 'string', 'format': 'email', 'description': 'Email address'},
                'referral_source': {'type': 'string', 'description': 'UTM source (optional)'},
            },
            'required': ['email']
        }
    },
    responses={
        201: OpenApiResponse(
            response={
                'type': 'object',
                'properties': {
                    'id': {'type': 'string', 'format': 'uuid'},
                    'queue_position': {'type': 'integer'},
                    'detail': {'type': 'string'},
                }
            },
            description='Successfully joined waitlist'
        ),
        400: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Invalid input or email already registered'
        ),
        429: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Rate limit exceeded'
        ),
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([
    PublicFormMinuteThrottle,
    PublicFormHourThrottle,
    PublicFormDayThrottle,
])
def waitlist_signup(request):
    """
    Step 1: Join the waitlist with email only.
    
    Creates a WaitlistEntry and returns the ID for optional step 2.
    
    Rate limits (per IP):
    - 5 requests per minute
    - 15 requests per hour
    - 30 requests per day
    """
    email = request.data.get('email', '').strip().lower()
    referral_source = request.data.get('referral_source', '').strip()
    
    # Validation
    if not email:
        return Response(
            {'detail': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Basic email validation
    if '@' not in email or '.' not in email:
        return Response(
            {'detail': 'Please provide a valid email address'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get client IP for tracking
    client_ip = get_client_ip(request)
    
    # Check if email already exists
    existing = WaitlistEntry.objects.filter(email=email).first()
    if existing:
        # Return existing entry info (idempotent)
        return Response(
            {
                'id': str(existing.id),
                'queue_position': existing.queue_position,
                'detail': 'You\'re already on the waitlist!',
            },
            status=status.HTTP_200_OK
        )
    
    # Create new waitlist entry
    entry = WaitlistEntry.objects.create(
        email=email,
        referral_source=referral_source,
        ip_address=client_ip,
    )
    
    # Log the submission
    logger.info(
        f"Waitlist signup: {email} | Position: #{entry.queue_position} | IP: {client_ip}"
    )
    
    # Send initial Slack notification
    slack.send_message(
        text=f"📝 New waitlist signup: {email} (#{entry.queue_position})",
        blocks=[
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📝 New Waitlist Signup",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Email:*\n{email}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Queue Position:*\n#{entry.queue_position}"
                    },
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"IP: {client_ip} | Source: {referral_source or 'Direct'}"
                    }
                ]
            }
        ]
    )
    
    return Response(
        {
            'id': str(entry.id),
            'queue_position': entry.queue_position,
            'detail': 'You\'re on the list!',
        },
        status=status.HTTP_201_CREATED
    )


@extend_schema(
    operation_id='public_waitlist_update',
    tags=['Public'],
    summary='Update Waitlist Entry',
    description='Step 2 of waitlist signup - add optional details (name, company, use case, referral source).',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string', 'description': 'Full name'},
                'company': {'type': 'string', 'description': 'Company name'},
                'use_case': {'type': 'string', 'description': 'What they hope to accomplish'},
                'heard_about_us': {'type': 'string', 'description': 'How they heard about Pillar'},
                'heard_about_us_other': {'type': 'string', 'description': 'Custom text if heard_about_us is "other"'},
            },
        }
    },
    responses={
        200: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Entry updated successfully'
        ),
        404: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Waitlist entry not found'
        ),
        429: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Rate limit exceeded'
        ),
    }
)
@api_view(['PATCH'])
@permission_classes([AllowAny])
@throttle_classes([
    PublicFormMinuteThrottle,
    PublicFormHourThrottle,
    PublicFormDayThrottle,
])
def waitlist_update(request, entry_id):
    """
    Step 2: Update waitlist entry with additional info.
    
    Accepts optional name, company, and use_case fields.
    Sends enhanced Slack notification when details are provided.
    """
    try:
        entry = WaitlistEntry.objects.get(id=entry_id)
    except WaitlistEntry.DoesNotExist:
        return Response(
            {'detail': 'Waitlist entry not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Extract optional fields
    name = request.data.get('name', '').strip()
    company = request.data.get('company', '').strip()
    use_case = request.data.get('use_case', '').strip()
    heard_about_us = request.data.get('heard_about_us', '').strip()
    heard_about_us_other = request.data.get('heard_about_us_other', '').strip()
    
    # Update entry with provided fields
    updated_fields = []
    if name:
        entry.name = name
        updated_fields.append('name')
    if company:
        entry.company = company
        updated_fields.append('company')
    if use_case:
        entry.use_case = use_case
        updated_fields.append('use_case')
    if heard_about_us:
        entry.heard_about_us = heard_about_us
        updated_fields.append('heard_about_us')
    if heard_about_us_other:
        entry.heard_about_us_other = heard_about_us_other
        updated_fields.append('heard_about_us_other')
    
    if updated_fields:
        entry.save(update_fields=updated_fields + ['updated_at'])
        
        logger.info(
            f"Waitlist entry updated: {entry.email} | "
            f"Fields: {', '.join(updated_fields)}"
        )
        
        # Send enhanced Slack notification with details
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✨ Waitlist Entry Updated with Details",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Email:*\n{entry.email}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Queue Position:*\n#{entry.queue_position}"
                    },
                ]
            },
        ]
        
        if name or company:
            fields = []
            if name:
                fields.append({
                    "type": "mrkdwn",
                    "text": f"*Name:*\n{name}"
                })
            if company:
                fields.append({
                    "type": "mrkdwn",
                    "text": f"*Company:*\n{company}"
                })
            blocks.append({
                "type": "section",
                "fields": fields
            })
        
        if use_case:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*What they want to do:*\n>{use_case}"
                }
            })
        
        if heard_about_us:
            # Format the heard about us value for display
            heard_display = heard_about_us.replace('_', ' ').title()
            if heard_about_us == 'other' and heard_about_us_other:
                heard_display = f"Other: {heard_about_us_other}"
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*How they heard about us:*\n{heard_display}"
                }
            })
        
        slack.send_message(
            text=f"✨ Waitlist entry updated: {entry.email}",
            blocks=blocks
        )
    
    return Response(
        {'detail': 'Thanks for sharing more about yourself!'},
        status=status.HTTP_200_OK
    )


# =============================================================================
# Legacy Early Access Endpoint (Backward Compatibility)
# =============================================================================

@extend_schema(
    operation_id='public_early_access_form',
    tags=['Public'],
    summary='Early Access Request (Legacy)',
    description='Legacy endpoint for early access form. Use /api/public/waitlist/ instead.',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string', 'description': 'Full name'},
                'email': {'type': 'string', 'format': 'email', 'description': 'Email address'},
                'company': {'type': 'string', 'description': 'Company name'},
                'use_case': {'type': 'string', 'description': 'Use case description (optional)'}
            },
            'required': ['name', 'email', 'company']
        }
    },
    responses={
        200: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Request submitted successfully'
        ),
        400: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Invalid input'
        ),
        429: OpenApiResponse(
            response={'type': 'object', 'properties': {'detail': {'type': 'string'}}},
            description='Rate limit exceeded'
        ),
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([
    PublicFormMinuteThrottle,
    PublicFormHourThrottle,
    PublicFormDayThrottle,
])
def early_access_form(request):
    """
    Process early access form submission (legacy endpoint).
    
    Sends a Slack notification to the team with the request details.
    Also stores in the waitlist database for tracking.
    
    Rate limits (per IP):
    - 5 requests per minute
    - 15 requests per hour
    - 30 requests per day
    """
    # Extract and validate form data
    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    company = request.data.get('company', '').strip()
    use_case = request.data.get('use_case', '').strip()
    
    # Validation
    if not name:
        return Response(
            {'detail': 'Name is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not email:
        return Response(
            {'detail': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Basic email validation
    if '@' not in email or '.' not in email:
        return Response(
            {'detail': 'Please provide a valid email address'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not company:
        return Response(
            {'detail': 'Company is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get client IP for tracking
    client_ip = get_client_ip(request)
    
    # Create or update waitlist entry
    entry, created = WaitlistEntry.objects.get_or_create(
        email=email,
        defaults={
            'name': name,
            'company': company,
            'use_case': use_case,
            'ip_address': client_ip,
        }
    )
    
    if not created:
        # Update existing entry with new info
        entry.name = name
        entry.company = company
        if use_case:
            entry.use_case = use_case
        entry.save()
    
    # Log the submission
    logger.info(
        f"Early access request from {name} <{email}> | "
        f"Company: {company} | IP: {client_ip}"
    )
    
    # Send Slack notification
    slack_sent = slack.notify_early_access_request(
        name=name,
        email=email,
        company=company,
        use_case=use_case or None,
        ip_address=client_ip,
    )
    
    if not slack_sent:
        logger.warning(
            f"Slack notification failed for early access request from {name} <{email}>. "
            f"Check SLACK_WEBHOOK_URL configuration."
        )
    
    return Response(
        {'detail': 'Thank you for your interest! We\'ll be in touch soon.'},
        status=status.HTTP_200_OK
    )
