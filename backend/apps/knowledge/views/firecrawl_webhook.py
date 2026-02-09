"""
Webhook endpoint for receiving Firecrawl crawl events.

This endpoint receives real-time notifications from Firecrawl when crawl events occur
for KnowledgeSource syncs.
"""
import logging
import json
import hmac
import hashlib
from typing import Dict, Any

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from apps.knowledge.services.webhook_processor import (
    webhook_processor,
    WebhookProcessorError,
)

logger = logging.getLogger(__name__)


def validate_webhook_signature(request) -> bool:
    """
    Validate the webhook signature from Firecrawl using HMAC-SHA256.
    
    Firecrawl v2 uses X-Firecrawl-Signature header with format: sha256=<hash>
    
    Args:
        request: Django request object
        
    Returns:
        True if signature is valid, False otherwise
    """
    webhook_secret = getattr(settings, 'FIRECRAWL_WEBHOOK_SECRET', '')
    
    if not webhook_secret:
        logger.warning("FIRECRAWL_WEBHOOK_SECRET not configured")
        return False
    
    # Get signature from header
    signature_header = request.headers.get('X-Firecrawl-Signature', '')
    
    if not signature_header:
        logger.warning("Missing X-Firecrawl-Signature header")
        return False
    
    # Extract hash from signature header (format: sha256=<hash>)
    try:
        algorithm, provided_hash = signature_header.split('=', 1)
        if algorithm != 'sha256':
            logger.warning(f"Invalid signature algorithm: {algorithm}")
            return False
    except ValueError:
        logger.warning(f"Invalid signature format: {signature_header}")
        return False
    
    # Compute expected signature
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        request.body,
        hashlib.sha256
    ).hexdigest()
    
    # Verify signature using timing-safe comparison
    is_valid = hmac.compare_digest(provided_hash, expected_signature)
    
    if not is_valid:
        logger.warning(
            f"Webhook signature verification failed - "
            f"provided: {provided_hash[:16]}..., expected: {expected_signature[:16]}..."
        )
    else:
        logger.debug("Webhook signature verified successfully")
    
    return is_valid


@csrf_exempt
@require_http_methods(["POST"])
def firecrawl_webhook_view(request):
    """
    Handle incoming webhook POST requests from Firecrawl.
    
    Expected payload format (Firecrawl v2):
    {
        "success": true,
        "type": "crawl.started|crawl.page|crawl.completed|crawl.failed",
        "id": "crawl_id",
        "data": {...},
        "metadata": {
            "crawl_uuid": "...",
            "source_uuid": "...",
            "crawl_type": "knowledge_source"
        }
    }
    
    Returns:
        200 OK: Event processed successfully
        400 Bad Request: Invalid payload
        401 Unauthorized: Invalid webhook secret
        500 Internal Server Error: Processing failed
    """
    # Validate webhook signature
    if not validate_webhook_signature(request):
        logger.warning(f"Invalid webhook signature from IP: {request.META.get('REMOTE_ADDR')}")
        return JsonResponse(
            {'error': 'Invalid webhook signature'},
            status=401
        )
    
    # Parse request body
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON payload: {e}")
        return JsonResponse(
            {'error': 'Invalid JSON payload'},
            status=400
        )
    
    # Log payload for debugging
    logger.info(f"Received Firecrawl webhook: {payload.get('type')}")
    logger.debug(f"Full webhook payload: {json.dumps(payload, indent=2)}")
    
    # Extract event type from 'type' field (Firecrawl v2 format)
    event_type_raw = payload.get('type')
    event_data = payload.get('data', {})
    metadata = payload.get('metadata', {})
    
    if not event_type_raw:
        logger.error(f"Missing 'type' field in webhook payload")
        return JsonResponse(
            {'error': "Missing 'type' field"},
            status=400
        )
    
    # Map Firecrawl event types to internal format
    # Firecrawl v2 uses prefixed types like "crawl.started", "crawl.page", etc.
    # We extract the last part (started, page, completed, failed)
    event_parts = event_type_raw.split('.')
    event_type = event_parts[-1] if event_parts else event_type_raw
    
    if not event_type:
        logger.error(f"Invalid event type: {event_type_raw}")
        return JsonResponse(
            {'error': f"Invalid event type: {event_type_raw}"},
            status=400
        )
    
    logger.info(f"Processing Firecrawl webhook: event={event_type}, metadata={metadata}")
    
    # Process the event
    try:
        result = webhook_processor.process_event(
            event_type=event_type,
            event_data=event_data,
            metadata=metadata
        )
        
        logger.info(f"Webhook processed successfully: {result}")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Webhook processed',
            'result': result
        })
        
    except WebhookProcessorError as e:
        logger.error(f"Webhook processing error: {e}")
        return JsonResponse(
            {'error': str(e)},
            status=400
        )
    except Exception as e:
        logger.error(f"Unexpected error processing webhook: {e}", exc_info=True)
        return JsonResponse(
            {'error': 'Internal server error'},
            status=500
        )
