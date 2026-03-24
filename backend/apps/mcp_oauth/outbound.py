"""
Outbound OAuth views: Pillar authenticates with external MCP servers.

When a customer adds an MCP tool source that requires OAuth, these
views handle the authorization code flow:

1. mcp_authorize -- redirects admin to external server's /authorize
2. mcp_callback  -- receives callback, exchanges code, stores tokens
"""
from __future__ import annotations

import json
import logging
import secrets

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseBadRequest, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.mcp_oauth.pkce import generate_pkce_pair

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = 600  # 10 minutes


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mcp_authorize(request):
    """
    Build an outbound OAuth authorize URL for an MCP tool source.

    Returns the full URL so the frontend can open it via window.open().
    Using POST (not GET with redirect) because the browser tab opened by
    window.open doesn't carry the JWT auth header.
    """
    from urllib.parse import urlencode

    from apps.tools.models import MCPToolSource

    source_id = request.data.get('source_id') or request.query_params.get('source_id')
    if not source_id:
        return JsonResponse({'error': 'source_id is required'}, status=400)

    source = (
        MCPToolSource.objects
        .filter(
            id=source_id,
            organization__in=request.user.organizations.all(),
            auth_type=MCPToolSource.AuthType.OAUTH,
        )
        .first()
    )
    if not source:
        return JsonResponse(
            {'error': 'MCP source not found or not OAuth-type'},
            status=404,
        )

    if not source.oauth_authorization_endpoint or not source.oauth_token_endpoint:
        return JsonResponse(
            {'error': 'OAuth endpoints not discovered yet. Refresh the source to trigger discovery.'},
            status=400,
        )

    code_verifier, code_challenge = generate_pkce_pair()
    state = secrets.token_urlsafe(32)

    callback_url = _build_callback_url(request)

    cache.set(
        f'mcp_oauth_state:{state}',
        json.dumps({
            'source_id': str(source.id),
            'code_verifier': code_verifier,
            'redirect_uri': callback_url,
            'product_id': str(source.product_id),
        }),
        OAUTH_STATE_TTL,
    )

    params = {
        'response_type': 'code',
        'client_id': source.oauth_client_id,
        'redirect_uri': callback_url,
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
    }
    if source.oauth_scopes:
        params['scope'] = source.oauth_scopes

    authorize_url = f"{source.oauth_authorization_endpoint}?{urlencode(params)}"

    return JsonResponse({'authorize_url': authorize_url})


@csrf_exempt
async def mcp_callback(request):
    """
    Receive callback from an external MCP server's OAuth flow.

    Exchanges the authorization code for tokens and stores them
    on the MCPToolSource. Plain async Django view (no DRF needed —
    only returns redirects and simple error responses).
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.mcp_oauth.token_client import exchange_code
    from apps.tools.models import MCPToolSource

    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')

    if error:
        logger.warning("OAuth callback error: %s", error)
        return _redirect_to_dashboard(error=error)

    if not code or not state:
        return HttpResponseBadRequest('Missing code or state')

    cached_raw = await cache.aget(f'mcp_oauth_state:{state}')
    if not cached_raw:
        return HttpResponseBadRequest('Invalid or expired state')

    await cache.adelete(f'mcp_oauth_state:{state}')
    state_data = json.loads(cached_raw)

    source = await MCPToolSource.objects.filter(id=state_data['source_id']).afirst()
    if not source:
        return HttpResponseBadRequest('MCP source not found')

    token_resp = await exchange_code(
        token_endpoint=source.oauth_token_endpoint,
        code=code,
        redirect_uri=state_data['redirect_uri'],
        client_id=source.oauth_client_id,
        code_verifier=state_data.get('code_verifier'),
    )

    if not token_resp.is_valid:
        logger.warning(
            "Token exchange failed for source %s: %s",
            source.id, token_resp.raw,
        )
        source.oauth_status = 'error'
        source.discovery_error = f"Token exchange failed: {token_resp.raw.get('error', 'unknown')}"
        await source.asave(update_fields=['oauth_status', 'discovery_error'])
        return _redirect_to_dashboard(error='token_exchange_failed')

    source.auth_credentials = json.dumps({
        'access_token': token_resp.access_token,
        'refresh_token': token_resp.refresh_token,
        'token_type': token_resp.token_type,
    })
    source.oauth_status = 'authorized'
    source.discovery_error = ''
    if token_resp.expires_in:
        source.oauth_token_expires_at = (
            timezone.now() + timedelta(seconds=token_resp.expires_in)
        )
    await source.asave(update_fields=[
        'auth_credentials', 'oauth_status', 'discovery_error',
        'oauth_token_expires_at',
    ])

    logger.info("OAuth authorized for MCP source %s (%s)", source.name, source.id)

    await _trigger_discovery(source)

    return _redirect_to_dashboard(source_id=str(source.id))


def _build_callback_url(request) -> str:
    """Construct the OAuth callback URL for this server."""
    api_base = getattr(settings, 'API_BASE_URL', 'http://localhost:8003')
    return f"{api_base}/api/admin/oauth/mcp-callback/"


def _redirect_to_dashboard(
    source_id: str | None = None,
    error: str | None = None,
) -> HttpResponseRedirect:
    """Redirect the admin back to the dashboard after OAuth."""
    admin_url = getattr(settings, 'HELP_CENTER_URL', 'http://localhost:3001')
    if 'localhost' in admin_url:
        admin_url = admin_url.replace('localhost', 'admin.localhost')
    elif not admin_url.startswith('https://admin.'):
        admin_url = admin_url.replace('https://', 'https://admin.')

    if source_id:
        url = f"{admin_url}/tools/mcp/{source_id}"
    else:
        url = f"{admin_url}/tools"

    if error:
        from urllib.parse import urlencode
        url = f"{url}?{urlencode({'error': error})}"
    return HttpResponseRedirect(url)


async def _trigger_discovery(source) -> None:
    """Trigger tool discovery after successful OAuth."""
    from apps.tools.services.mcp_client import discover_and_store

    try:
        await discover_and_store(source)
    except Exception:
        logger.exception("Post-OAuth discovery failed for %s", source.name)
