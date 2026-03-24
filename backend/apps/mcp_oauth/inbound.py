"""
Inbound OAuth views: MCP clients authenticate with Pillar's MCP server.

Pillar acts as the OAuth authorization server. When a customer has
configured an OAuthProvider (IdP), MCP clients go through:

1. Discovery: /.well-known/oauth-protected-resource
                /.well-known/oauth-authorization-server
2. Registration: POST /register (DCR)
3. Authorization: GET /authorize → redirect to customer IdP
4. Callback: GET /oauth/callback → exchange IdP code, create grant
5. Token: POST /token → exchange grant for Pillar access token
"""
from __future__ import annotations

import json
import logging
import secrets
import uuid

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseBadRequest, HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.mcp_oauth.pkce import generate_pkce_pair, verify_pkce

logger = logging.getLogger(__name__)

OAUTH_STATE_TTL = 600  # 10 minutes


# ---------------------------------------------------------------------------
# Discovery endpoints (RFC 8414 + RFC 9728)
# ---------------------------------------------------------------------------


@require_GET
async def protected_resource_metadata(request):
    """Serve OAuth 2.0 Protected Resource Metadata (RFC 9728)."""
    base_url = _request_base_url(request)
    return JsonResponse({
        'resource': f"{base_url}/mcp/",
        'authorization_servers': [base_url],
        'bearer_methods_supported': ['header'],
    })


@require_GET
async def authorization_server_metadata(request):
    """Serve OAuth 2.0 Authorization Server Metadata (RFC 8414)."""
    base_url = _request_base_url(request)
    return JsonResponse({
        'issuer': base_url,
        'authorization_endpoint': f"{base_url}/authorize",
        'token_endpoint': f"{base_url}/token",
        'registration_endpoint': f"{base_url}/register",
        'response_types_supported': ['code'],
        'grant_types_supported': ['authorization_code', 'refresh_token'],
        'code_challenge_methods_supported': ['S256'],
        'token_endpoint_auth_methods_supported': ['none'],
    })


# ---------------------------------------------------------------------------
# Dynamic Client Registration (RFC 7591)
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(['POST'])
async def register_client(request):
    """
    Register a new MCP OAuth client (DCR).

    MCP clients (Cursor, Claude Desktop) call this to get a client_id
    before starting the authorization flow.
    """
    from apps.mcp_oauth.models import MCPApplication

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'invalid_request'}, status=400)

    product = await _resolve_product_from_host(request)
    if not product:
        return JsonResponse(
            {'error': 'Could not resolve product from host'}, status=400,
        )

    client_name = body.get('client_name', 'MCP Client')
    redirect_uris = body.get('redirect_uris', [])
    grant_types = body.get('grant_types', ['authorization_code'])

    if not redirect_uris:
        return JsonResponse(
            {'error': 'redirect_uris is required'}, status=400,
        )

    from oauth2_provider.generators import generate_client_id

    client_id = generate_client_id()

    app = await MCPApplication.objects.acreate(
        product=product,
        client_id=client_id,
        client_type=MCPApplication.CLIENT_PUBLIC,
        authorization_grant_type=MCPApplication.GRANT_AUTHORIZATION_CODE,
        redirect_uris=' '.join(redirect_uris),
        name=client_name,
        skip_authorization=True,
    )

    return JsonResponse({
        'client_id': app.client_id,
        'client_name': app.name,
        'redirect_uris': redirect_uris,
        'grant_types': grant_types,
        'response_types': ['code'],
        'token_endpoint_auth_method': 'none',
    }, status=201)


# ---------------------------------------------------------------------------
# Authorization endpoint
# ---------------------------------------------------------------------------


@require_GET
async def authorize(request):
    """
    MCP client authorization endpoint.

    Validates the request, then redirects to the customer's IdP.
    The IdP authenticates the user and redirects back to idp_callback.
    """
    from apps.mcp_oauth.models import MCPApplication, OAuthProvider

    client_id = request.GET.get('client_id')
    redirect_uri = request.GET.get('redirect_uri')
    code_challenge = request.GET.get('code_challenge')
    code_challenge_method = request.GET.get('code_challenge_method', 'S256')
    mcp_state = request.GET.get('state', '')
    scope = request.GET.get('scope', '')

    if not client_id or not redirect_uri or not code_challenge:
        return HttpResponseBadRequest('client_id, redirect_uri, and code_challenge are required')

    if code_challenge_method != 'S256':
        return HttpResponseBadRequest('Only S256 code_challenge_method is supported')

    app = await (
        MCPApplication.objects
        .select_related('product')
        .filter(client_id=client_id, product__isnull=False)
        .afirst()
    )
    if not app:
        return HttpResponseBadRequest('Unknown client_id')

    if redirect_uri not in app.redirect_uris.split():
        return HttpResponseBadRequest('Invalid redirect_uri')

    provider = await (
        OAuthProvider.objects
        .filter(product=app.product, is_active=True)
        .afirst()
    )
    if not provider:
        return HttpResponseBadRequest(
            'OAuth not configured for this product. '
            'The product owner must set up an identity provider.'
        )

    internal_state = secrets.token_urlsafe(32)
    pillar_verifier, pillar_challenge = generate_pkce_pair()

    cache.set(
        f'mcp_inbound_state:{internal_state}',
        json.dumps({
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'code_challenge': code_challenge,
            'mcp_state': mcp_state,
            'scope': scope,
            'product_id': str(app.product_id),
            'provider_id': str(provider.id),
            'pillar_verifier': pillar_verifier,
        }),
        OAUTH_STATE_TTL,
    )

    callback_url = _idp_callback_url(request)

    from urllib.parse import urlencode
    idp_params = {
        'response_type': 'code',
        'client_id': provider.client_id,
        'redirect_uri': callback_url,
        'state': internal_state,
        'scope': provider.scopes,
    }

    authorize_url = f"{provider.authorization_endpoint}?{urlencode(idp_params)}"
    return HttpResponseRedirect(authorize_url)


# ---------------------------------------------------------------------------
# IdP callback (receives redirect from customer's identity provider)
# ---------------------------------------------------------------------------


@csrf_exempt
@require_GET
async def idp_callback(request):
    """
    Receive callback from the customer's IdP after user authenticates.

    1. Exchange the IdP code for IdP tokens
    2. Fetch user info from IdP
    3. Create an MCPGrant with the user's identity
    4. Redirect back to the MCP client with Pillar's authorization code
    """
    from apps.mcp_oauth.models import MCPGrant, OAuthProvider
    from apps.mcp_oauth.token_client import exchange_code, fetch_userinfo

    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')

    if error:
        return HttpResponseBadRequest(f'IdP error: {error}')
    if not code or not state:
        return HttpResponseBadRequest('Missing code or state')

    cached_raw = cache.get(f'mcp_inbound_state:{state}')
    if not cached_raw:
        return HttpResponseBadRequest('Invalid or expired state')

    cache.delete(f'mcp_inbound_state:{state}')
    state_data = json.loads(cached_raw)

    provider = await (
        OAuthProvider.objects
        .filter(id=state_data['provider_id'], is_active=True)
        .afirst()
    )
    if not provider:
        return HttpResponseBadRequest('OAuth provider not found')

    callback_url = _idp_callback_url(request)

    token_resp = await exchange_code(
        token_endpoint=provider.token_endpoint,
        code=code,
        redirect_uri=callback_url,
        client_id=provider.client_id,
        client_secret=provider.client_secret or None,
    )

    if not token_resp.is_valid:
        logger.warning("IdP token exchange failed: %s", token_resp.raw)
        return HttpResponseBadRequest('Failed to exchange code with identity provider')

    user_info: dict = {}
    if provider.userinfo_endpoint:
        user_info = await fetch_userinfo(
            provider.userinfo_endpoint, token_resp.access_token
        )

    from apps.mcp_oauth.models import MCPApplication
    from oauth2_provider.models import get_application_model

    app = await (
        MCPApplication.objects
        .filter(client_id=state_data['client_id'])
        .afirst()
    )
    if not app:
        return HttpResponseBadRequest('MCP application not found')

    from datetime import timedelta
    grant_code = secrets.token_urlsafe(48)

    grant = await MCPGrant.objects.acreate(
        user=None,
        code=grant_code,
        application=app,
        expires=timezone.now() + timedelta(seconds=120),
        redirect_uri=state_data['redirect_uri'],
        scope=state_data.get('scope', ''),
        code_challenge=state_data['code_challenge'],
        code_challenge_method='S256',
        external_user_info={
            **user_info,
            'sub': user_info.get(provider.user_id_claim, ''),
            'email': user_info.get(provider.email_claim, ''),
            'name': user_info.get(provider.name_claim, ''),
        },
    )

    from urllib.parse import urlencode, urlparse, urlunparse, parse_qs

    redirect_params = {'code': grant_code}
    if state_data.get('mcp_state'):
        redirect_params['state'] = state_data['mcp_state']

    parsed = urlparse(state_data['redirect_uri'])
    existing_params = parse_qs(parsed.query)
    existing_params.update({k: [v] for k, v in redirect_params.items()})

    flat_params = {k: v[0] if isinstance(v, list) and len(v) == 1 else v
                   for k, v in existing_params.items()}
    new_query = urlencode(flat_params, doseq=True)
    redirect_url = urlunparse(parsed._replace(query=new_query))

    return HttpResponseRedirect(redirect_url)


# ---------------------------------------------------------------------------
# Token endpoint
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(['POST'])
async def token(request):
    """
    Exchange an authorization code for access + refresh tokens.

    Validates PKCE, creates MCPAccessToken, returns standard OAuth response.
    """
    from datetime import timedelta

    from apps.mcp_oauth.models import MCPAccessToken, MCPGrant, MCPRefreshToken

    content_type = request.content_type or ''
    if 'application/x-www-form-urlencoded' in content_type:
        params = request.POST
    elif 'application/json' in content_type:
        try:
            params = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'invalid_request'}, status=400)
    else:
        params = request.POST

    grant_type = params.get('grant_type')

    if grant_type == 'authorization_code':
        return await _handle_authorization_code(params)
    elif grant_type == 'refresh_token':
        return await _handle_refresh_token(params)
    else:
        return JsonResponse(
            {'error': 'unsupported_grant_type'}, status=400,
        )


async def _handle_authorization_code(params) -> JsonResponse:
    """Handle authorization_code grant type."""
    from datetime import timedelta

    from apps.mcp_oauth.models import MCPAccessToken, MCPGrant, MCPRefreshToken

    code = params.get('code')
    client_id = params.get('client_id')
    redirect_uri = params.get('redirect_uri')
    code_verifier = params.get('code_verifier')

    if not code or not client_id or not code_verifier:
        return JsonResponse(
            {'error': 'invalid_request',
             'error_description': 'code, client_id, and code_verifier are required'},
            status=400,
        )

    grant = await (
        MCPGrant.objects
        .select_related('application')
        .filter(code=code, application__client_id=client_id)
        .afirst()
    )

    if not grant:
        return JsonResponse({'error': 'invalid_grant'}, status=400)

    if grant.expires < timezone.now():
        await grant.adelete()
        return JsonResponse(
            {'error': 'invalid_grant', 'error_description': 'Code expired'},
            status=400,
        )

    if redirect_uri and grant.redirect_uri and redirect_uri != grant.redirect_uri:
        return JsonResponse(
            {'error': 'invalid_grant', 'error_description': 'redirect_uri mismatch'},
            status=400,
        )

    if not verify_pkce(code_verifier, grant.code_challenge):
        return JsonResponse(
            {'error': 'invalid_grant', 'error_description': 'PKCE verification failed'},
            status=400,
        )

    from oauth2_provider.generators import generate_client_id as gen_token

    access_token_value = secrets.token_urlsafe(48)
    refresh_token_value = secrets.token_urlsafe(48)
    expires_in = 3600

    product_id = getattr(grant.application, 'product_id', None)
    user_info = grant.external_user_info or {}

    access_token = await MCPAccessToken.objects.acreate(
        user=None,
        token=access_token_value,
        application=grant.application,
        expires=timezone.now() + timedelta(seconds=expires_in),
        scope=grant.scope or '',
        product_id=product_id,
        external_user_id=user_info.get('sub', ''),
        external_email=user_info.get('email', ''),
        external_display_name=user_info.get('name', ''),
        external_user_info=user_info,
    )

    refresh_token = await MCPRefreshToken.objects.acreate(
        user=None,
        token=refresh_token_value,
        application=grant.application,
        access_token=access_token,
    )

    await grant.adelete()

    return JsonResponse({
        'access_token': access_token_value,
        'token_type': 'bearer',
        'expires_in': expires_in,
        'refresh_token': refresh_token_value,
        'scope': grant.scope or '',
    })


async def _handle_refresh_token(params) -> JsonResponse:
    """Handle refresh_token grant type."""
    from datetime import timedelta

    from apps.mcp_oauth.models import MCPAccessToken, MCPRefreshToken

    refresh_token_value = params.get('refresh_token')
    client_id = params.get('client_id')

    if not refresh_token_value or not client_id:
        return JsonResponse(
            {'error': 'invalid_request'}, status=400,
        )

    rt = await (
        MCPRefreshToken.objects
        .select_related('application', 'access_token')
        .filter(
            token=refresh_token_value,
            application__client_id=client_id,
            revoked__isnull=True,
        )
        .afirst()
    )

    if not rt:
        return JsonResponse({'error': 'invalid_grant'}, status=400)

    old_access_token = rt.access_token
    product_id = getattr(old_access_token, 'product_id', None)
    user_info = getattr(old_access_token, 'external_user_info', {})

    expires_in = 3600
    new_access_value = secrets.token_urlsafe(48)
    new_refresh_value = secrets.token_urlsafe(48)

    new_access = await MCPAccessToken.objects.acreate(
        user=None,
        token=new_access_value,
        application=rt.application,
        expires=timezone.now() + timedelta(seconds=expires_in),
        scope=old_access_token.scope if old_access_token else '',
        product_id=product_id,
        external_user_id=getattr(old_access_token, 'external_user_id', ''),
        external_email=getattr(old_access_token, 'external_email', ''),
        external_display_name=getattr(old_access_token, 'external_display_name', ''),
        external_user_info=user_info,
    )

    rt.revoked = timezone.now()
    await rt.asave(update_fields=['revoked'])

    new_rt = await MCPRefreshToken.objects.acreate(
        user=None,
        token=new_refresh_value,
        application=rt.application,
        access_token=new_access,
    )

    if old_access_token:
        await old_access_token.adelete()

    return JsonResponse({
        'access_token': new_access_value,
        'token_type': 'bearer',
        'expires_in': expires_in,
        'refresh_token': new_refresh_value,
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _request_base_url(request) -> str:
    """Get the base URL (scheme + host) from the request."""
    scheme = 'https' if request.is_secure() else 'http'
    host = request.get_host()
    return f"{scheme}://{host}"


def _idp_callback_url(request) -> str:
    """Build the IdP callback URL that points back to Pillar."""
    base = _request_base_url(request)
    return f"{base}/oauth/callback"


async def _resolve_product_from_host(request):
    """Resolve product from the request host (subdomain or custom domain)."""
    from apps.products.models import Product

    host = request.get_host().split(':')[0].lower()
    help_center_domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'help.pillar.io')

    if host.endswith(f'.{help_center_domain}'):
        subdomain = host.replace(f'.{help_center_domain}', '')
        return await (
            Product.objects
            .select_related('organization')
            .filter(subdomain=subdomain)
            .afirst()
        )

    from apps.products.models.agent import Agent
    agent = await (
        Agent.objects
        .select_related('product__organization')
        .filter(mcp_domain=host, is_active=True)
        .afirst()
    )
    if agent:
        return agent.product

    return None
