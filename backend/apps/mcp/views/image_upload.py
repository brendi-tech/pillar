"""
Image upload endpoint for conversation images.
Returns signed GCS URLs for use in ask requests.

Copyright (C) 2025 Pillar Team
"""
import asyncio
import concurrent.futures
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image

from common.utils.cors import add_cors_headers

logger = logging.getLogger(__name__)


def _validate_image_file(file) -> tuple[bool, str]:
    """Validate uploaded file is a real image."""
    max_size = getattr(settings, 'MAX_CONVERSATION_IMAGE_UPLOAD_SIZE', 10 * 1024 * 1024)
    allowed_types = getattr(
        settings,
        'ALLOWED_CONVERSATION_IMAGE_TYPES',
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']
    )

    if file.size > max_size:
        return False, f"File too large. Max: {max_size / 1024 / 1024:.0f}MB"

    ext = Path(file.name).suffix.lower().lstrip('.')
    if ext not in allowed_types:
        return False, f"Invalid type. Allowed: {', '.join(allowed_types)}"

    try:
        img = Image.open(file)
        img.verify()
        file.seek(0)  # Reset file pointer after verify
        return True, ""
    except Exception as e:
        return False, f"Invalid image: {str(e)}"


# Use shared CORS utility
_add_cors_headers = add_cors_headers


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def upload_image(request):
    """
    Upload image for conversation, return signed GCS URL.

    Uses help_center_config from middleware for authentication.
    Storage path: conversations/images/{org_id}/{help_center_id}/{uuid}.{ext}
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=200)
        return _add_cors_headers(response, request)

    # Get help center context from middleware
    help_center_config = getattr(request, 'help_center_config', None)
    organization = getattr(request, 'organization', None)

    if not help_center_config or not organization:
        response = JsonResponse(
            {'error': 'Help center context not available'},
            status=403
        )
        return _add_cors_headers(response, request)

    # Check for image in request
    if 'image' not in request.FILES:
        response = JsonResponse({'error': 'No image provided'}, status=400)
        return _add_cors_headers(response, request)

    uploaded_file = request.FILES['image']
    is_valid, error_msg = _validate_image_file(uploaded_file)
    if not is_valid:
        response = JsonResponse({'error': error_msg}, status=400)
        return _add_cors_headers(response, request)

    # Generate storage path
    file_extension = Path(uploaded_file.name).suffix.lower().lstrip('.')
    file_path = (
        f"conversations/images/{organization.id}/"
        f"{help_center_config.id}/{uuid.uuid4()}.{file_extension}"
    )

    try:
        # Save file to storage
        saved_path = default_storage.save(file_path, uploaded_file)

        # Generate signed URL
        # django-storages generates signed URLs via url() when querystring_auth=True
        signed_url = default_storage.url(saved_path)

        # For local development, convert relative URL to absolute URL
        # Vision models need full URLs to fetch images
        if signed_url.startswith('/'):
            # Build absolute URL from request
            scheme = 'https' if request.is_secure() else 'http'
            host = request.get_host()
            signed_url = f"{scheme}://{host}{signed_url}"

        # Calculate expiration (default 24 hours)
        storage_expiration = getattr(
            settings, 'STORAGES', {}
        ).get('default', {}).get('OPTIONS', {}).get('expiration', 86400)
        expires_at = datetime.utcnow() + timedelta(seconds=storage_expiration)

        logger.info(f"Image uploaded: {saved_path} for help_center={help_center_config.id}")

        # Kick off background summary generation
        # This runs async - response returns immediately
        try:
            from apps.mcp.services.image_summary_service import generate_image_summary

            try:
                loop = asyncio.get_running_loop()
                # We're in an async context (ASGI)
                asyncio.create_task(generate_image_summary(signed_url, detail='low'))
            except RuntimeError:
                # No running loop - sync context, run in thread
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                executor.submit(
                    asyncio.run,
                    generate_image_summary(signed_url, detail='low')
                )
        except Exception as e:
            # Don't fail upload if summary generation fails to start
            logger.warning(f"[ImageUpload] Failed to start summary generation: {e}")

        response = JsonResponse({
            'url': signed_url,
            'path': saved_path,
            'expires_at': expires_at.isoformat() + 'Z'
        })
        return _add_cors_headers(response, request)

    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        response = JsonResponse({'error': 'Upload failed'}, status=500)
        return _add_cors_headers(response, request)
