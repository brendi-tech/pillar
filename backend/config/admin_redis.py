"""
Redis Key Manager — custom Django admin view for inspecting and deleting Redis keys.

Accessible at /admin/redis/ for superusers only.
"""

import logging

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import user_passes_test
from django.http import JsonResponse
from django.template.response import TemplateResponse
from django.views.decorators.http import require_http_methods
from django_redis import get_redis_connection

logger = logging.getLogger(__name__)


def _superuser_check(user):
    return user.is_authenticated and user.is_superuser


def _get_redis():
    return get_redis_connection("default")


@user_passes_test(_superuser_check, login_url="/admin/login/")
@require_http_methods(["GET"])
def redis_manager_view(request):
    """Render the Redis key manager page."""
    results = None
    pattern = request.GET.get("pattern", "")
    error = None

    if pattern:
        try:
            redis = _get_redis()
            # Always search with help_center prefix if not already included
            search_pattern = pattern
            if not pattern.startswith("help_center:"):
                search_pattern = f"help_center:*{pattern}*"

            raw_keys = redis.keys(search_pattern)
            # Cap at 200 to avoid blowing up the page
            keys = sorted([k.decode() if isinstance(k, bytes) else k for k in raw_keys])[:200]

            results = []
            for key in keys:
                ttl = redis.ttl(key)
                key_type = redis.type(key)
                key_type = key_type.decode() if isinstance(key_type, bytes) else key_type
                results.append({
                    "key": key,
                    "type": key_type,
                    "ttl": ttl if ttl >= 0 else "no expiry",
                })
        except Exception as e:
            logger.error(f"Redis manager search error: {e}")
            error = str(e)

    context = {
        **_admin_context(),
        "pattern": pattern,
        "results": results,
        "error": error,
        "result_count": len(results) if results else 0,
    }
    return TemplateResponse(request, "admin/redis_manager.html", context)


@user_passes_test(_superuser_check, login_url="/admin/login/")
@require_http_methods(["POST"])
def redis_delete_key(request):
    """Delete a single Redis key. Returns JSON."""
    key = request.POST.get("key", "")
    if not key:
        return JsonResponse({"error": "No key provided"}, status=400)

    # Safety: only allow deleting keys with our prefix
    if not key.startswith("help_center:"):
        return JsonResponse({"error": "Can only delete help_center:* keys"}, status=403)

    try:
        redis = _get_redis()
        deleted = redis.delete(key)
        logger.info(f"[Redis Manager] Deleted key: {key} (by {request.user.email})")
        return JsonResponse({"deleted": bool(deleted), "key": key})
    except Exception as e:
        logger.error(f"Redis manager delete error: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@user_passes_test(_superuser_check, login_url="/admin/login/")
@require_http_methods(["POST"])
def redis_delete_pattern(request):
    """Delete all keys matching a pattern. Returns JSON."""
    pattern = request.POST.get("pattern", "")
    if not pattern:
        return JsonResponse({"error": "No pattern provided"}, status=400)

    # Safety: only allow deleting keys with our prefix
    search_pattern = pattern
    if not pattern.startswith("help_center:"):
        search_pattern = f"help_center:*{pattern}*"

    try:
        redis = _get_redis()
        keys = redis.keys(search_pattern)
        if keys:
            deleted = redis.delete(*keys)
            logger.info(
                f"[Redis Manager] Deleted {deleted} keys matching '{search_pattern}' "
                f"(by {request.user.email})"
            )
            return JsonResponse({"deleted": deleted, "pattern": search_pattern})
        return JsonResponse({"deleted": 0, "pattern": search_pattern})
    except Exception as e:
        logger.error(f"Redis manager bulk delete error: {e}")
        return JsonResponse({"error": str(e)}, status=500)


def _admin_context():
    """Base context for admin templates."""
    from django.contrib import admin
    return {
        "site_header": admin.site.site_header,
        "site_title": admin.site.site_title,
        "has_permission": True,
        "title": "Redis Key Manager",
    }
