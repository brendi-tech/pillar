"""
Discord integration views.

DiscordInstallView    — initiates OAuth bot install flow
DiscordCallbackView   — handles OAuth callback from Discord
DiscordInteractionsView — receives slash-command interaction payloads
DiscordInstallationAdminView — dashboard management (list / disconnect)
"""
import logging
import secrets
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.products.models import Product

from .models import DiscordInstallation

logger = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"
DISCORD_OAUTH_AUTHORIZE = "https://discord.com/oauth2/authorize"

# Bot permissions bitfield
BOT_PERMISSIONS = (
    0x800             # Send Messages
    | 0x4000000000    # Send Messages in Threads
    | 0x800000000     # Create Public Threads
    | 0x10000         # Read Message History
    | 0x40            # Add Reactions
    | 0x40000         # Use External Emojis
    | 0x4000          # Embed Links
    | 0x8000          # Attach Files
)


# ── OAuth helpers ─────────────────────────────────────────────────────

def _build_discord_oauth_url(product, user) -> str:
    """Generate a Discord OAuth authorize URL with CSRF state stored in cache."""
    state = secrets.token_urlsafe(32)
    cache.set(
        f"discord_oauth_state:{state}",
        {"product_id": str(product.id), "user_id": str(user.id)},
        timeout=300,
    )

    redirect_uri = f"{settings.BACKEND_URL}/api/integrations/discord/callback/"
    params = {
        "client_id": settings.DISCORD_CLIENT_ID,
        "permissions": str(BOT_PERMISSIONS),
        "scope": "bot applications.commands",
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"{DISCORD_OAUTH_AUTHORIZE}?{urlencode(params)}"


# ── OAuth install flow ────────────────────────────────────────────────

class DiscordInstallView(APIView):
    """
    Initiates the Discord OAuth bot install flow (legacy browser-redirect).

    GET /api/integrations/discord/install/?product_id=<uuid>
    → 302 redirect to Discord's OAuth authorization page

    Dashboard should use the admin endpoint instead:
    POST /api/admin/products/<id>/integrations/discord/install/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        product_id = request.query_params.get('product_id')
        if not product_id:
            return HttpResponseBadRequest("product_id is required")

        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )

        return redirect(_build_discord_oauth_url(product, request.user))


class DiscordCallbackView(APIView):
    """
    Handles the OAuth callback from Discord.

    GET /api/integrations/discord/callback/?code=...&state=...&guild_id=...
    → Creates DiscordInstallation, redirects to dashboard
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        guild_id = request.query_params.get('guild_id')

        if not code or not state:
            return HttpResponseBadRequest("Missing code or state parameter")

        state_data = cache.get(f"discord_oauth_state:{state}")
        if not state_data:
            return HttpResponseBadRequest("Invalid or expired OAuth state")
        cache.delete(f"discord_oauth_state:{state}")

        product_id = state_data['product_id']
        try:
            product = Product.objects.select_related('organization').get(id=product_id)
        except Product.DoesNotExist:
            return HttpResponseBadRequest("Product not found")

        redirect_uri = f"{settings.BACKEND_URL}/api/integrations/discord/callback/"

        try:
            with httpx.Client(timeout=10) as client:
                token_resp = client.post(
                    f"{DISCORD_API}/oauth2/token",
                    data={
                        "client_id": settings.DISCORD_CLIENT_ID,
                        "client_secret": settings.DISCORD_CLIENT_SECRET,
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": redirect_uri,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                token_resp.raise_for_status()
                token_data = token_resp.json()

                bot_token = token_data.get("access_token", "")
                resolved_guild_id = token_data.get("guild", {}).get("id", guild_id or "")
                guild_name = token_data.get("guild", {}).get("name", "")

                bot_user_id = ""
                if bot_token:
                    me_resp = client.get(
                        f"{DISCORD_API}/users/@me",
                        headers={"Authorization": f"Bot {bot_token}"},
                    )
                    if me_resp.status_code == 200:
                        bot_user_id = me_resp.json().get("id", "")

        except httpx.HTTPStatusError:
            logger.exception("[DISCORD] OAuth token exchange failed")
            return HttpResponseBadRequest("Failed to exchange OAuth code with Discord")
        except Exception:
            logger.exception("[DISCORD] Unexpected error during OAuth")
            return HttpResponseBadRequest("Failed to complete Discord OAuth")

        DiscordInstallation.objects.update_or_create(
            guild_id=resolved_guild_id,
            defaults={
                'organization': product.organization,
                'product': product,
                'guild_name': guild_name,
                'bot_token': bot_token,
                'bot_user_id': bot_user_id,
                'is_active': True,
            },
        )

        dashboard_url = f"{settings.FRONTEND_URL}/integrations?discord=connected"
        return redirect(dashboard_url)


# ── Interactions endpoint (slash commands) ─────────────────────────────

def _verify_discord_signature(request) -> bool:
    """Verify Ed25519 signature on incoming Discord interaction."""
    public_key = settings.DISCORD_PUBLIC_KEY
    if not public_key:
        logger.warning("[DISCORD] No public key configured, skipping verification")
        return True

    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError

    signature = request.headers.get('X-Signature-Ed25519', '')
    timestamp = request.headers.get('X-Signature-Timestamp', '')
    body = request.body.decode('utf-8')

    try:
        vk = VerifyKey(bytes.fromhex(public_key))
        vk.verify(f"{timestamp}{body}".encode(), bytes.fromhex(signature))
        return True
    except (BadSignatureError, Exception):
        return False


class DiscordInteractionsView(APIView):
    """
    Receives Discord slash-command interaction payloads.

    POST /api/integrations/discord/interactions/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not _verify_discord_signature(request):
            return HttpResponse("invalid request signature", status=401)

        payload = request.data
        interaction_type = payload.get('type')

        # Type 1: Ping (URL verification)
        if interaction_type == 1:
            return JsonResponse({"type": 1})

        # Type 2: Application command
        if interaction_type == 2:
            return self._handle_command(payload)

        return HttpResponse(status=200)

    def _handle_command(self, payload: dict) -> JsonResponse:
        data = payload.get('data', {})
        command_name = data.get('name', '')

        if command_name == 'pillar':
            subcommand = ''
            options = data.get('options', [])
            if options:
                subcommand = options[0].get('name', '')

            if subcommand == 'ask':
                question = ''
                sub_options = options[0].get('options', []) if options else []
                for opt in sub_options:
                    if opt.get('name') == 'question':
                        question = opt.get('value', '')

                if question:
                    return JsonResponse({
                        "type": 4,
                        "data": {
                            "content": f"Thinking about: *{question}*...",
                            "flags": 64,
                        },
                    })

            if subcommand == 'connect':
                return JsonResponse({
                    "type": 4,
                    "data": {
                        "content": "Account linking coming soon!",
                        "flags": 64,
                    },
                })

        return JsonResponse({
            "type": 4,
            "data": {
                "content": (
                    "**Pillar Commands**\n"
                    "`/pillar ask <question>` — Ask the AI agent a question\n"
                    "`/pillar connect` — Link your Discord account to your app account\n"
                    "\nYou can also @mention Pillar in any channel or DM directly."
                ),
                "flags": 64,
            },
        })


# ── Dashboard admin API ───────────────────────────────────────────────

class DiscordInstallAdminView(APIView):
    """
    Generate a Discord OAuth URL for the dashboard.

    POST /api/admin/products/<id>/integrations/discord/install/
    → {"authorize_url": "https://discord.com/oauth2/authorize?..."}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        authorize_url = _build_discord_oauth_url(product, request.user)
        return JsonResponse({"authorize_url": authorize_url})


class DiscordInstallationAdminView(APIView):
    """
    Admin API for managing Discord installations.

    GET    /api/admin/products/<id>/integrations/discord/  → installation status
    DELETE /api/admin/products/<id>/integrations/discord/  → disconnect
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        try:
            installation = DiscordInstallation.objects.get(
                product=product, is_active=True,
            )
            from .serializers import DiscordInstallationSerializer
            return JsonResponse(DiscordInstallationSerializer(installation).data)
        except DiscordInstallation.DoesNotExist:
            return JsonResponse(None, safe=False, status=200)

    def delete(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        updated = DiscordInstallation.objects.filter(
            product=product, is_active=True,
        ).update(is_active=False)
        if updated:
            logger.info(
                "[DISCORD] Disconnected installation for product %s", product_id,
            )
        return HttpResponse(status=204)
