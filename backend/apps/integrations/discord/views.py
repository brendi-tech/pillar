"""
Discord integration views.

DiscordInstallView    — initiates OAuth bot install flow
DiscordCallbackView   — handles OAuth callback from Discord
DiscordInteractionsView — receives slash-command interaction payloads
DiscordInstallationAdminView — dashboard management (list / disconnect)
"""
import logging
import re
import secrets
import threading
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.integrations.common.urls import get_api_base
from apps.products.models import Product
from common.task_router import TaskRouter

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

DEFAULT_SLASH_COMMAND_NAME = "pillar"


def _get_slash_command_name(installation: DiscordInstallation) -> str:
    return (installation.config or {}).get(
        "slash_command_name", DEFAULT_SLASH_COMMAND_NAME
    )


def _build_slash_command_payload(name: str) -> dict:
    return {
        "name": name,
        "description": f"{name.capitalize()} AI assistant",
        "type": 1,
        "options": [
            {
                "name": "ask",
                "description": "Ask the AI agent a question",
                "type": 1,
                "options": [
                    {"name": "question", "description": "Your question", "type": 3, "required": True}
                ],
            },
            {
                "name": "connect",
                "description": "Link your Discord account to your app account",
                "type": 1,
            },
        ],
    }


def _build_invite_url(application_id: str) -> str:
    return (
        f"{DISCORD_OAUTH_AUTHORIZE}?client_id={application_id}"
        f"&permissions={BOT_PERMISSIONS}"
        f"&scope=bot%20applications.commands"
    )


def _register_slash_commands(
    bot_token: str, application_id: str, guild_id: str,
    command_name: str = DEFAULT_SLASH_COMMAND_NAME,
) -> bool:
    """Register slash commands as a guild command via POST (upsert)."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"{DISCORD_API}/applications/{application_id}/guilds/{guild_id}/commands",
                headers={
                    "Authorization": f"Bot {bot_token}",
                    "Content-Type": "application/json",
                },
                json=_build_slash_command_payload(command_name),
            )
            resp.raise_for_status()
            return True
    except httpx.HTTPStatusError as e:
        logger.warning(
            "[DISCORD] Failed to register /%s for guild %s: %s %s",
            command_name, guild_id, e.response.status_code, e.response.text[:200],
        )
        return False
    except Exception:
        logger.exception("[DISCORD] Failed to register /%s for guild %s", command_name, guild_id)
        return False


def _deregister_slash_commands(
    bot_token: str, application_id: str, guild_id: str,
    command_name: str = DEFAULT_SLASH_COMMAND_NAME,
) -> bool:
    """Remove a named slash command from the guild. Leaves other commands intact."""
    headers = {
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{DISCORD_API}/applications/{application_id}/guilds/{guild_id}/commands",
                headers=headers,
            )
            resp.raise_for_status()
            commands = resp.json()

            for cmd in commands:
                if cmd.get("name") == command_name:
                    del_resp = client.delete(
                        f"{DISCORD_API}/applications/{application_id}"
                        f"/guilds/{guild_id}/commands/{cmd['id']}",
                        headers=headers,
                    )
                    del_resp.raise_for_status()
                    logger.info(
                        "[DISCORD] Deleted /%s command %s from guild %s",
                        command_name, cmd["id"], guild_id,
                    )
                    return True

            logger.info("[DISCORD] No /%s command found in guild %s, nothing to delete", command_name, guild_id)
            return True
    except httpx.HTTPStatusError as e:
        logger.warning(
            "[DISCORD] Failed to deregister /%s for guild %s: %s %s",
            command_name, guild_id, e.response.status_code, e.response.text[:200],
        )
        return False
    except Exception:
        logger.exception("[DISCORD] Failed to deregister /%s for guild %s", command_name, guild_id)
        return False


def _leave_guild(bot_token: str, guild_id: str) -> bool:
    """Make the bot leave the guild, removing it from the server member list."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.delete(
                f"{DISCORD_API}/users/@me/guilds/{guild_id}",
                headers={"Authorization": f"Bot {bot_token}"},
            )
            resp.raise_for_status()
            logger.info("[DISCORD] Bot left guild %s", guild_id)
            return True
    except Exception:
        logger.warning(
            "[DISCORD] Failed to leave guild %s", guild_id, exc_info=True,
        )
        return False


# ── OAuth helpers ─────────────────────────────────────────────────────

def _build_discord_oauth_url(product, user) -> str:
    """Generate a Discord OAuth authorize URL with CSRF state stored in cache."""
    state = secrets.token_urlsafe(32)
    cache.set(
        f"discord_oauth_state:{state}",
        {"product_id": str(product.id), "user_id": str(user.id)},
        timeout=300,
    )

    redirect_uri = f"{get_api_base(request)}/api/integrations/discord/callback/"
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

        redirect_uri = f"{get_api_base(request)}/api/integrations/discord/callback/"

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

def _verify_discord_signature(request) -> tuple[bool, 'DiscordInstallation | None']:
    """
    Verify Ed25519 signature on incoming Discord interaction.

    For BYOB installations, looks up the per-installation public key by
    application_id from the payload body. Falls back to the global
    DISCORD_PUBLIC_KEY setting for Pillar-managed apps.
    """
    import json as json_mod

    body_str = request.body.decode('utf-8')

    application_id = ''
    try:
        payload = json_mod.loads(body_str)
        application_id = payload.get('application_id', '')
    except (json_mod.JSONDecodeError, AttributeError):
        pass

    installation = None
    public_key = ''

    if application_id:
        try:
            installation = DiscordInstallation.objects.get(
                application_id=application_id, is_active=True,
            )
            public_key = installation.app_public_key or ''
        except DiscordInstallation.DoesNotExist:
            public_key = cache.get(f"discord_pending_key:{application_id}") or ''
        except DiscordInstallation.MultipleObjectsReturned:
            installation = DiscordInstallation.objects.filter(
                application_id=application_id, is_active=True,
            ).first()
            public_key = (installation.app_public_key or '') if installation else ''

    if not public_key:
        public_key = getattr(settings, 'DISCORD_PUBLIC_KEY', '')

    if not public_key:
        logger.warning("[DISCORD] No public key found for application_id=%s, skipping verification", application_id)
        return True, installation

    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError

    signature = request.headers.get('X-Signature-Ed25519', '')
    timestamp = request.headers.get('X-Signature-Timestamp', '')

    try:
        vk = VerifyKey(bytes.fromhex(public_key))
        vk.verify(f"{timestamp}{body_str}".encode(), bytes.fromhex(signature))
        return True, installation
    except (BadSignatureError, Exception):
        return False, installation


class DiscordInteractionsView(APIView):
    """
    Receives Discord slash-command interaction payloads.

    POST /api/integrations/discord/interactions/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        verified, installation = _verify_discord_signature(request)
        if not verified:
            return HttpResponse("invalid request signature", status=401)

        payload = request.data
        interaction_type = payload.get('type')

        # Type 1: Ping (URL verification)
        if interaction_type == 1:
            return JsonResponse({"type": 1})

        # Type 2: Application command
        if interaction_type == 2:
            return self._handle_command(payload, installation=installation)

        # Type 3: Message component (button click)
        if interaction_type == 3:
            return self._handle_component(payload)

        return HttpResponse(status=200)

    @staticmethod
    def _fire_and_forget(workflow_name: str, **kwargs) -> None:
        """Trigger a Hatchet workflow in a background thread.

        Discord requires the interaction response within 3 seconds.
        TaskRouter.execute blocks while connecting to Hatchet (~1-2s),
        so we dispatch it off the request thread.
        """
        thread = threading.Thread(
            target=TaskRouter.execute,
            args=(workflow_name,),
            kwargs=kwargs,
            daemon=True,
        )
        thread.start()

    def _handle_command(self, payload: dict, installation=None) -> JsonResponse:
        data = payload.get('data', {})
        command_name = data.get('name', '')
        expected_name = _get_slash_command_name(installation) if installation else DEFAULT_SLASH_COMMAND_NAME

        if command_name == expected_name:
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
                    guild_id = payload.get('guild_id', '')
                    channel_id = payload.get('channel_id', '')
                    member = payload.get('member', {})
                    user = member.get('user', {}) or payload.get('user', {})
                    interaction_token = payload.get('token', '')
                    application_id = payload.get('application_id', '')

                    self._fire_and_forget(
                        'discord-handle-message',
                        guild_id=guild_id,
                        channel_id=channel_id,
                        author_id=user.get('id', ''),
                        author_username=user.get('username', ''),
                        content=question,
                        message_id='',
                        thread_id='',
                        interaction_token=interaction_token,
                        application_id=application_id,
                    )

                    return JsonResponse({"type": 5})

            if subcommand == 'connect':
                guild_id = payload.get('guild_id', '')
                member = payload.get('member', {})
                user = member.get('user', {}) or payload.get('user', {})
                interaction_token = payload.get('token', '')
                application_id = payload.get('application_id', '')

                self._fire_and_forget(
                    'discord-account-link',
                    guild_id=guild_id,
                    user_id=user.get('id', ''),
                    interaction_token=interaction_token,
                    application_id=application_id,
                )

                return JsonResponse({"type": 5})

        cmd_display = expected_name
        return JsonResponse({
            "type": 4,
            "data": {
                "content": (
                    f"**Commands**\n"
                    f"`/{cmd_display} ask <question>` — Ask the AI agent a question\n"
                    f"`/{cmd_display} connect` — Link your Discord account to your app account\n"
                    f"\nYou can also @mention the bot in any channel or DM directly."
                ),
                "flags": 64,
            },
        })

    def _handle_component(self, payload: dict) -> JsonResponse:
        """Handle type 3 (MESSAGE_COMPONENT) interactions — button clicks."""
        data = payload.get('data', {})
        custom_id = data.get('custom_id', '')
        guild_id = payload.get('guild_id', '')
        channel_id = payload.get('channel_id', '')
        member = payload.get('member', {})
        user = member.get('user', {}) or payload.get('user', {})

        if not (custom_id.startswith('pillar_confirm:') or custom_id.startswith('pillar_cancel:')):
            return JsonResponse({"type": 4, "data": {"content": "Unknown action.", "flags": 64}})

        ref_key = custom_id.split(':', 1)[1]
        confirm_data = cache.get(ref_key)
        if not confirm_data:
            return JsonResponse({
                "type": 4,
                "data": {"content": "This confirmation has expired.", "flags": 64},
            })

        if custom_id.startswith('pillar_cancel:'):
            cache.delete(ref_key)
            return JsonResponse({
                "type": 4,
                "data": {"content": "Action cancelled.", "flags": 64},
            })

        self._fire_and_forget(
            'discord-handle-message',
            guild_id=guild_id,
            channel_id=channel_id,
            author_id=user.get('id', ''),
            author_username=user.get('username', ''),
            content='',
            message_id='',
            thread_id=confirm_data.get('thread_id', ''),
            tool_confirm=confirm_data,
            interaction_token=payload.get('token', ''),
            application_id=payload.get('application_id', ''),
        )
        cache.delete(ref_key)

        return JsonResponse({"type": 5})


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


class DiscordBYOBAdminView(APIView):
    """
    Set up a BYOB (Bring Your Own Bot) Discord installation.

    POST /api/admin/products/<id>/integrations/discord/byob/
    Accepts bot_token + public_key, validates via GET /users/@me,
    creates a DiscordInstallation with is_byob=True.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        from .serializers import DiscordBYOBSetupSerializer, DiscordInstallationSerializer

        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )

        serializer = DiscordBYOBSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bot_token = serializer.validated_data['bot_token']
        public_key = serializer.validated_data['public_key']
        guild_id = serializer.validated_data.get('guild_id', '')

        try:
            with httpx.Client(timeout=10) as client:
                me_resp = client.get(
                    f"{DISCORD_API}/users/@me",
                    headers={"Authorization": f"Bot {bot_token}"},
                )
                me_resp.raise_for_status()
                bot_data = me_resp.json()
                bot_user_id = bot_data.get('id', '')

                app_resp = client.get(
                    f"{DISCORD_API}/applications/@me",
                    headers={"Authorization": f"Bot {bot_token}"},
                )
                app_resp.raise_for_status()
                app_data = app_resp.json()
                application_id = app_data.get('id', '')
                auto_public_key = app_data.get('verify_key', '')

                app_flags = app_data.get('flags', 0)
                has_message_content = bool(app_flags & ((1 << 18) | (1 << 19)))
                message_content_intent = 'enabled' if has_message_content else 'not_enabled'

                if not has_message_content:
                    try:
                        patch_resp = client.patch(
                            f"{DISCORD_API}/applications/@me",
                            headers={"Authorization": f"Bot {bot_token}"},
                            json={"flags": app_flags | (1 << 19)},
                        )
                        if patch_resp.status_code == 200:
                            message_content_intent = 'auto_enabled'
                            logger.info(
                                "[DISCORD] Auto-enabled Message Content intent for app %s",
                                application_id,
                            )
                    except Exception:
                        logger.warning(
                            "[DISCORD] Failed to auto-enable Message Content intent for app %s",
                            application_id,
                        )

                if not guild_id:
                    guilds_resp = client.get(
                        f"{DISCORD_API}/users/@me/guilds",
                        headers={"Authorization": f"Bot {bot_token}"},
                    )
                    guilds_resp.raise_for_status()
                    guilds = guilds_resp.json()
                    if len(guilds) == 1:
                        guild_id = guilds[0]['id']
                    elif not guilds:
                        cache.set(f"discord_pending_key:{application_id}", auto_public_key, timeout=86400)
                        api_base = get_api_base(request)
                        return JsonResponse({
                            'status': 'needs_guild',
                            'invite_url': _build_invite_url(application_id),
                            'interactions_url': f'{api_base}/api/integrations/discord/interactions/',
                            'application_id': application_id,
                            'bot_user_id': bot_user_id,
                            'message_content_intent': message_content_intent,
                        })
                    else:
                        cache.set(f"discord_pending_key:{application_id}", auto_public_key, timeout=86400)
                        api_base = get_api_base(request)
                        return JsonResponse({
                            'status': 'select_guild',
                            'guilds': [{'id': g['id'], 'name': g['name']} for g in guilds],
                            'interactions_url': f'{api_base}/api/integrations/discord/interactions/',
                            'application_id': application_id,
                            'message_content_intent': message_content_intent,
                        })

                guild_name = ''
                guild_resp = client.get(
                    f"{DISCORD_API}/guilds/{guild_id}",
                    headers={"Authorization": f"Bot {bot_token}"},
                )
                if guild_resp.status_code == 200:
                    guild_name = guild_resp.json().get('name', '')

        except httpx.HTTPStatusError:
            logger.exception("[DISCORD] BYOB token validation failed")
            return JsonResponse(
                {'error': 'Invalid bot token. Could not authenticate with Discord.'},
                status=400,
            )
        except Exception:
            logger.exception("[DISCORD] BYOB unexpected error")
            return JsonResponse(
                {'error': 'Failed to validate Discord bot token.'},
                status=400,
            )

        cmd_name = serializer.validated_data.get('slash_command_name', DEFAULT_SLASH_COMMAND_NAME)

        installation, _created = DiscordInstallation.objects.update_or_create(
            guild_id=guild_id,
            defaults={
                'organization': product.organization,
                'product': product,
                'guild_name': guild_name or f"Guild {guild_id}",
                'bot_token': bot_token,
                'bot_user_id': bot_user_id,
                'app_public_key': public_key or auto_public_key,
                'application_id': application_id,
                'is_active': True,
                'is_byob': True,
            },
        )
        config = installation.config or {}
        config['slash_command_name'] = cmd_name
        installation.config = config
        installation.save(update_fields=['config'])

        api_base = get_api_base(request)

        return JsonResponse({
            'installation': DiscordInstallationSerializer(installation).data,
            'interactions_url': f'{api_base}/api/integrations/discord/interactions/',
            'invite_url': _build_invite_url(application_id),
            'slash_commands_registered': False,
            'message_content_intent': message_content_intent,
        })


class DiscordVerifyAdminView(APIView):
    """
    POST /api/admin/products/<id>/integrations/discord/verify/
    Checks the health of the Discord integration.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        product = get_object_or_404(
            Product, id=product_id,
            organization__in=request.user.organizations.all(),
        )
        try:
            installation = DiscordInstallation.objects.get(
                product=product, is_active=True,
            )
        except DiscordInstallation.DoesNotExist:
            return JsonResponse({'error': 'No active installation'}, status=404)

        checks = {}

        with httpx.Client(timeout=10) as client:
            try:
                me_resp = client.get(
                    f"{DISCORD_API}/users/@me",
                    headers={"Authorization": f"Bot {installation.bot_token}"},
                )
                checks['bot_token_valid'] = me_resp.status_code == 200
            except Exception:
                checks['bot_token_valid'] = False

            try:
                app_resp = client.get(
                    f"{DISCORD_API}/applications/@me",
                    headers={"Authorization": f"Bot {installation.bot_token}"},
                )
                if app_resp.status_code == 200:
                    flags = app_resp.json().get('flags', 0)
                    checks['message_content_intent'] = bool(
                        flags & ((1 << 18) | (1 << 19))
                    )
                else:
                    checks['message_content_intent'] = False
            except Exception:
                checks['message_content_intent'] = False

            try:
                guild_resp = client.get(
                    f"{DISCORD_API}/guilds/{installation.guild_id}",
                    headers={"Authorization": f"Bot {installation.bot_token}"},
                )
                checks['guild_accessible'] = guild_resp.status_code == 200
            except Exception:
                checks['guild_accessible'] = False

            if installation.application_id and installation.guild_id:
                try:
                    cmd_resp = client.get(
                        f"{DISCORD_API}/applications/{installation.application_id}"
                        f"/guilds/{installation.guild_id}/commands",
                        headers={"Authorization": f"Bot {installation.bot_token}"},
                    )
                    if cmd_resp.status_code == 200:
                        commands = cmd_resp.json()
                        expected_cmd = _get_slash_command_name(installation)
                        checks['slash_commands_registered'] = any(
                            c.get('name') == expected_cmd for c in commands
                        )
                    else:
                        checks['slash_commands_registered'] = False
                except Exception:
                    checks['slash_commands_registered'] = False

        checks['all_ok'] = all(checks.values())
        return JsonResponse(checks)


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
            data = DiscordInstallationSerializer(installation).data
            api_base = get_api_base(request)
            data['interactions_url'] = f'{api_base}/api/integrations/discord/interactions/'
            return JsonResponse(data)
        except DiscordInstallation.DoesNotExist:
            return JsonResponse(None, safe=False, status=200)

    def patch(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        installation = get_object_or_404(
            DiscordInstallation, product=product, is_active=True,
        )
        new_name = request.data.get("slash_command_name", "").strip().lower()
        if not new_name or not re.match(r'^[-_a-z0-9]{1,32}$', new_name):
            return JsonResponse({"error": "Invalid command name"}, status=400)

        old_name = _get_slash_command_name(installation)
        registered = False
        if installation.bot_token and installation.application_id and installation.guild_id:
            if new_name != old_name:
                _deregister_slash_commands(
                    installation.bot_token, installation.application_id, installation.guild_id,
                    command_name=old_name,
                )
            registered = _register_slash_commands(
                installation.bot_token, installation.application_id, installation.guild_id,
                command_name=new_name,
            )

        config = installation.config or {}
        config['slash_command_name'] = new_name
        installation.config = config
        installation.save(update_fields=['config'])

        from .serializers import DiscordInstallationSerializer
        data = DiscordInstallationSerializer(installation).data
        data['slash_commands_registered'] = registered
        return JsonResponse(data)

    def delete(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        leave_guild = request.query_params.get(
            "leave_guild", "",
        ).lower() in ("true", "1")

        installations = DiscordInstallation.objects.filter(
            product=product, is_active=True,
        )
        for inst in installations:
            if inst.bot_token and inst.application_id and inst.guild_id:
                cmd_name = _get_slash_command_name(inst)
                _deregister_slash_commands(
                    inst.bot_token, inst.application_id, inst.guild_id,
                    command_name=cmd_name,
                )
            if leave_guild and inst.bot_token and inst.guild_id:
                _leave_guild(inst.bot_token, inst.guild_id)
        updated = installations.update(is_active=False)
        if updated:
            logger.info(
                "[DISCORD] Disconnected installation for product %s", product_id,
            )
        return HttpResponse(status=204)
