"""
Slack integration views.

SlackInstallView      — initiates OAuth install flow
SlackCallbackView     — handles OAuth callback from Slack
SlackEventsView       — receives Events API webhooks
SlackCommandView      — receives slash command payloads
SlackInteractionsView — receives Block Kit interaction payloads
"""
import json
import logging
import secrets

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from slack_sdk import WebClient
from slack_sdk.oauth import AuthorizeUrlGenerator
from slack_sdk.signature import SignatureVerifier
from slack_sdk.webhook import WebhookClient

from apps.products.models import Product
from apps.products.models.agent import Agent
from common.task_router import TaskRouter

from .models import SlackInstallation

logger = logging.getLogger(__name__)

def _extract_team_and_app_id(request) -> tuple[str, str]:
    """
    Extract team_id and app_id from a Slack request before verification.

    Handles all three Slack payload formats:
    - Events (JSON body): top-level team_id + api_app_id
    - Commands (form-encoded): team_id + api_app_id in POST data
    - Interactions (form-encoded with JSON payload field): nested team.id
    """
    try:
        content_type = request.content_type or ''
        if 'json' in content_type:
            data = json.loads(request.body)
            return data.get('team_id', ''), data.get('api_app_id', '')

        raw_payload = request.POST.get('payload')
        if raw_payload:
            payload = json.loads(raw_payload)
            team_id = payload.get('team', {}).get('id', '')
            app_id = payload.get('api_app_id', '')
            return team_id, app_id

        return request.POST.get('team_id', ''), request.POST.get('api_app_id', '')
    except (json.JSONDecodeError, TypeError, AttributeError):
        return '', ''


def _verify_slack_request(
    request,
) -> tuple[bool, SlackInstallation | None]:
    """
    Verify HMAC-SHA256 signature on an incoming Slack request.

    For BYOB installations, uses the per-installation signing_secret.
    Falls back to the global SLACK_SIGNING_SECRET for Pillar's own app.

    Returns (is_valid, matched_installation). The installation is returned
    as a side-effect to avoid a duplicate DB lookup in dispatch logic.
    """
    body_str = request.body.decode('utf-8')
    team_id, app_id = _extract_team_and_app_id(request)

    installation: SlackInstallation | None = None
    signing_secret = ''

    if team_id:
        lookup = {'team_id': team_id, 'is_active': True}
        if app_id:
            lookup['app_id'] = app_id
        try:
            installation = SlackInstallation.objects.get(**lookup)
            signing_secret = installation.signing_secret or ''
        except SlackInstallation.DoesNotExist:
            pass
        except SlackInstallation.MultipleObjectsReturned:
            installation = SlackInstallation.objects.filter(**lookup).first()
            signing_secret = (installation.signing_secret or '') if installation else ''

    if not signing_secret:
        signing_secret = settings.SLACK_SIGNING_SECRET

    if not signing_secret:
        logger.warning("[SLACK] No signing secret configured, skipping verification")
        return True, installation

    verifier = SignatureVerifier(signing_secret=signing_secret)
    is_valid = verifier.is_valid_request(body=body_str, headers=request.headers)
    return is_valid, installation if is_valid else None


# ── OAuth helpers ─────────────────────────────────────────────────────

def _build_slack_oauth_url(product, user, agent_id: str | None = None) -> str:
    """Generate a Slack OAuth authorize URL with CSRF state stored in cache."""
    state = secrets.token_urlsafe(32)
    state_data = {"product_id": str(product.id), "user_id": str(user.id)}
    if agent_id:
        state_data["agent_id"] = str(agent_id)
    cache.set(
        f"slack_oauth_state:{state}",
        state_data,
        timeout=300,
    )
    return AuthorizeUrlGenerator(
        client_id=settings.SLACK_CLIENT_ID,
        scopes=[
            "app_mentions:read", "chat:write", "commands",
            "im:history", "im:read", "im:write",
            "reactions:read", "reactions:write",
            "users:read", "users:read.email",
        ],
    ).generate(state=state)


# ── OAuth install flow ────────────────────────────────────────────────

class SlackInstallView(APIView):
    """
    Initiates the Slack OAuth install flow (legacy browser-redirect endpoint).

    GET /api/integrations/slack/install/?product_id=<uuid>
    → 302 redirect to Slack's OAuth authorization page

    Dashboard should use the admin endpoint instead:
    POST /api/admin/products/<id>/integrations/slack/install/
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

        return redirect(_build_slack_oauth_url(product, request.user))


class SlackCallbackView(APIView):
    """
    Handles the OAuth callback from Slack.

    GET /api/integrations/slack/callback/?code=...&state=...
    → Creates SlackInstallation, redirects to dashboard
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state')

        if not code or not state:
            return HttpResponseBadRequest("Missing code or state parameter")

        state_data = cache.get(f"slack_oauth_state:{state}")
        if not state_data:
            return HttpResponseBadRequest("Invalid or expired OAuth state")
        cache.delete(f"slack_oauth_state:{state}")

        product_id = state_data['product_id']
        try:
            product = Product.objects.select_related('organization').get(id=product_id)
        except Product.DoesNotExist:
            return HttpResponseBadRequest("Product not found")

        client = WebClient()
        try:
            oauth_response = client.oauth_v2_access(
                client_id=settings.SLACK_CLIENT_ID,
                client_secret=settings.SLACK_CLIENT_SECRET,
                code=code,
            )
        except Exception:
            logger.exception("[SLACK] OAuth token exchange failed")
            return HttpResponseBadRequest("Failed to exchange OAuth code")

        agent_id = state_data.get('agent_id')
        agent = None
        if agent_id:
            agent = Agent.objects.filter(id=agent_id, product=product).first()

        app_id = oauth_response.get('app_id', '')
        SlackInstallation.objects.update_or_create(
            team_id=oauth_response['team']['id'],
            app_id=app_id,
            defaults={
                'organization': product.organization,
                'product': product,
                'team_name': oauth_response['team']['name'],
                'bot_token': oauth_response['access_token'],
                'bot_user_id': oauth_response['bot_user_id'],
                'installing_user_id': oauth_response['authed_user']['id'],
                'is_active': True,
                'scopes': oauth_response.get('scope', '').split(','),
                'is_byob': False,
                'signing_secret': '',
                'agent': agent,
            },
        )

        if agent_id:
            dashboard_url = f"{settings.FRONTEND_URL}/agents/{agent_id}?slack=connected"
        else:
            dashboard_url = f"{settings.FRONTEND_URL}/integrations?slack=connected"
        return redirect(dashboard_url)


# ── Events API webhook ────────────────────────────────────────────────

class SlackEventsView(APIView):
    """
    Receives Slack Events API payloads.

    POST /api/integrations/slack/events/
    Handles url_verification challenges, app_mention, and message.im events.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        is_valid, installation = _verify_slack_request(request)
        if not is_valid:
            return HttpResponse(status=403)

        payload = request.data

        # URL verification challenge (one-time during app setup)
        if payload.get('type') == 'url_verification':
            return JsonResponse({'challenge': payload['challenge']})

        # Event callback
        if payload.get('type') == 'event_callback':
            event = payload.get('event', {})
            self._dispatch_event(payload, event, installation)
            return HttpResponse(status=200)

        return HttpResponse(status=200)

    def _dispatch_event(
        self,
        payload: dict,
        event: dict,
        pre_fetched_installation: SlackInstallation | None = None,
    ) -> None:
        event_type = event.get('type')
        team_id = payload.get('team_id')
        app_id = payload.get('api_app_id', '')
        event_id = payload.get('event_id')

        if self._is_duplicate_event(event_id):
            logger.info("[SLACK] Duplicate event %s, skipping", event_id)
            return

        # Handle app_uninstalled
        if event_type == 'app_uninstalled':
            self._handle_uninstall(team_id, app_id)
            return

        # Filter irrelevant message subtypes
        if event_type == 'message':
            subtype = event.get('subtype')
            if subtype in ('message_changed', 'message_deleted', 'bot_message'):
                return
            if event.get('bot_id'):
                return

        # Filter bot's own messages
        if event_type in ('message', 'app_mention'):
            installation = pre_fetched_installation
            if not installation:
                lookup = {'team_id': team_id, 'is_active': True}
                if app_id:
                    lookup['app_id'] = app_id
                try:
                    installation = SlackInstallation.objects.get(**lookup)
                except SlackInstallation.DoesNotExist:
                    logger.warning("[SLACK] No active installation for team %s", team_id)
                    return
            if event.get('user') == installation.bot_user_id:
                return

        raw_thread_ts = event.get('thread_ts', '')
        raw_ts = event.get('ts', '')
        logger.info(
            "[SLACK] Dispatching %s: channel=%s, ts=%s, thread_ts=%r, user=%s",
            event_type, event.get('channel', ''), raw_ts,
            raw_thread_ts, event.get('user', ''),
        )
        TaskRouter.execute(
            'slack-handle-message',
            team_id=team_id,
            app_id=app_id,
            channel_id=event.get('channel', ''),
            user_id=event.get('user', ''),
            text=event.get('text', ''),
            ts=raw_ts,
            thread_ts=raw_thread_ts,
            event_type=event_type or '',
            event_id=event_id or '',
        )

    def _is_duplicate_event(self, event_id: str) -> bool:
        if not event_id:
            return False
        key = f"slack_event_seen:{event_id}"
        was_new = cache.add(key, "1", timeout=3600)
        return not was_new

    def _handle_uninstall(self, team_id: str, app_id: str = '') -> None:
        lookup = {'team_id': team_id}
        if app_id:
            lookup['app_id'] = app_id
        SlackInstallation.objects.filter(**lookup).update(is_active=False)
        logger.info("[SLACK] Workspace %s (app %s) uninstalled", team_id, app_id or 'default')


# ── Slash commands ────────────────────────────────────────────────────

class SlackCommandView(APIView):
    """
    Handles /pillar slash commands.

    POST /api/integrations/slack/commands/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        is_valid, _ = _verify_slack_request(request)
        if not is_valid:
            return HttpResponse(status=403)

        command = request.data.get('command', '')
        text = request.data.get('text', '').strip()
        user_id = request.data.get('user_id', '')
        team_id = request.data.get('team_id', '')
        app_id = request.data.get('api_app_id', '')
        response_url = request.data.get('response_url', '')

        if command == '/pillar':
            subcommand = text.split()[0] if text else 'help'

            if subcommand == 'connect':
                TaskRouter.execute(
                    'slack-account-link',
                    team_id=team_id,
                    user_id=user_id,
                    response_url=response_url,
                )
                return JsonResponse({
                    'response_type': 'ephemeral',
                    'text': 'Generating your account link... one moment.',
                })

            if subcommand == 'status':
                lookup = {'team_id': team_id, 'is_active': True}
                if app_id:
                    lookup['app_id'] = app_id
                try:
                    inst = SlackInstallation.objects.get(**lookup)
                    return JsonResponse({
                        'response_type': 'ephemeral',
                        'text': (
                            f'Pillar is connected and active.\n'
                            f'Workspace: {inst.team_name}\n'
                            f'Product: {inst.product.name}'
                        ),
                    })
                except SlackInstallation.DoesNotExist:
                    return JsonResponse({
                        'response_type': 'ephemeral',
                        'text': 'Pillar is not connected to this workspace.',
                    })

            return JsonResponse({
                'response_type': 'ephemeral',
                'text': (
                    '*Pillar Commands*\n'
                    '`/pillar connect` — Link your Slack account to your app account\n'
                    '`/pillar status` — Check connection status\n'
                    '`/pillar help` — Show this help message\n'
                    '\nYou can also @mention Pillar in any channel or DM directly.'
                ),
            })

        return HttpResponse(status=200)


# ── Dashboard API ─────────────────────────────────────────────────────

class SlackInstallationAdminView(APIView):
    """
    Admin API for managing Slack installations.

    GET    /api/admin/products/<id>/integrations/slack/          → installation status
    POST   /api/admin/products/<id>/integrations/slack/install/  → get OAuth URL
    DELETE /api/admin/products/<id>/integrations/slack/          → disconnect
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        try:
            installation = SlackInstallation.objects.get(
                product=product, is_active=True,
            )
            from .serializers import SlackInstallationSerializer
            return JsonResponse(SlackInstallationSerializer(installation).data)
        except SlackInstallation.DoesNotExist:
            return JsonResponse(None, safe=False, status=200)

    def delete(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        updated = SlackInstallation.objects.filter(
            product=product, is_active=True,
        ).update(is_active=False)
        if updated:
            logger.info(
                "[SLACK] Disconnected installation for product %s", product_id,
            )
        return HttpResponse(status=204)


class SlackInstallAdminView(APIView):
    """
    Generate a Slack OAuth URL for the dashboard.

    POST /api/admin/products/<id>/integrations/slack/install/
    Body (optional): {"agent_id": "<uuid>"}
    → {"authorize_url": "https://slack.com/oauth/v2/authorize?..."}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        agent_id = request.data.get('agent_id')
        authorize_url = _build_slack_oauth_url(product, request.user, agent_id=agent_id)
        return JsonResponse({"authorize_url": authorize_url})


# ── Manifest generation ──────────────────────────────────────────────

REQUIRED_BOT_SCOPES = [
    "app_mentions:read", "chat:write", "commands",
    "im:history", "im:read", "im:write",
    "reactions:read", "reactions:write",
    "users:read", "users:read.email",
]

BOT_EVENTS = ["app_mention", "message.im", "app_uninstalled"]


def _build_slack_manifest(product: Product, api_base: str) -> dict:
    """Build a Slack app manifest dict pre-filled with product name and webhook URLs."""
    name = product.name[:35]
    return {
        "display_information": {
            "name": name,
            "description": f"{product.name} AI assistant — powered by Pillar",
        },
        "features": {
            "app_home": {
                "home_tab_enabled": False,
                "messages_tab_enabled": True,
                "messages_tab_read_only_enabled": False,
            },
            "bot_user": {
                "display_name": name,
                "always_online": True,
            },
            "slash_commands": [
                {
                    "command": "/ask",
                    "url": f"{api_base}/api/integrations/slack/commands/",
                    "description": f"Ask {product.name} a question",
                    "usage_hint": "[your question]",
                    "should_escape": False,
                }
            ],
        },
        "oauth_config": {
            "scopes": {
                "bot": REQUIRED_BOT_SCOPES,
            },
        },
        "settings": {
            "event_subscriptions": {
                "request_url": f"{api_base}/api/integrations/slack/events/",
                "bot_events": BOT_EVENTS,
            },
            "interactivity": {
                "is_enabled": True,
                "request_url": f"{api_base}/api/integrations/slack/interactions/",
            },
            "org_deploy_enabled": False,
            "socket_mode_enabled": False,
            "token_rotation_enabled": False,
        },
    }


class SlackManifestAdminView(APIView):
    """
    Generate a pre-filled Slack app manifest for BYOB setup.

    GET /api/admin/products/<id>/integrations/slack/manifest/
    Returns a JSON manifest the user can paste into Slack's "From a manifest" flow.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )
        api_base = (settings.BACKEND_URL or request.build_absolute_uri('/').rstrip('/')).rstrip('/')
        manifest = _build_slack_manifest(product, api_base)
        return JsonResponse({"manifest": manifest})


# ── BYOB Setup ───────────────────────────────────────────────────────

class SlackBYOBAdminView(APIView):
    """
    Set up a BYOB (Bring Your Own Bot) Slack installation.

    POST /api/admin/products/<id>/integrations/slack/byob/
    Accepts bot_token + signing_secret, validates via auth.test,
    creates a SlackInstallation, and returns webhook URLs.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        from .serializers import SlackBYOBSetupSerializer, SlackInstallationSerializer

        product = get_object_or_404(
            Product,
            id=product_id,
            organization__in=request.user.organizations.all(),
        )

        serializer = SlackBYOBSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bot_token = serializer.validated_data['bot_token']
        signing_secret = serializer.validated_data['signing_secret']
        agent_id = request.data.get('agent_id')

        client = WebClient(token=bot_token)
        try:
            auth_response = client.auth_test()
        except Exception:
            logger.exception("[SLACK] BYOB auth.test failed")
            return JsonResponse(
                {'error': 'Invalid bot token. Could not authenticate with Slack.'},
                status=400,
            )

        agent = None
        if agent_id:
            agent = Agent.objects.filter(id=agent_id, product=product).first()

        team_id = auth_response['team_id']
        team_name = auth_response.get('team', '')
        bot_user_id = auth_response.get('user_id', '')
        app_id = auth_response.get('app_id', '')

        installation, created = SlackInstallation.objects.update_or_create(
            team_id=team_id,
            app_id=app_id,
            defaults={
                'organization': product.organization,
                'product': product,
                'team_name': team_name,
                'bot_token': bot_token,
                'bot_user_id': bot_user_id,
                'signing_secret': signing_secret,
                'is_active': True,
                'is_byob': True,
                'agent': agent,
            },
        )

        api_base = settings.BACKEND_URL or request.build_absolute_uri('/').rstrip('/')

        return JsonResponse({
            'installation': SlackInstallationSerializer(installation).data,
            'webhook_urls': {
                'events': f'{api_base}/api/integrations/slack/events/',
                'commands': f'{api_base}/api/integrations/slack/commands/',
                'interactions': f'{api_base}/api/integrations/slack/interactions/',
            },
            'created': created,
        })


# ── Block Kit interactions ────────────────────────────────────────────

class SlackInteractionsView(APIView):
    """
    Handles Block Kit interaction callbacks (confirm/cancel buttons).

    POST /api/integrations/slack/interactions/

    Slack sends interactions as application/x-www-form-urlencoded with a
    JSON ``payload`` field.  Confirm calls the customer's endpoint inline
    (2.5 s timeout); cancel returns a replacement message immediately.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        is_valid, _ = _verify_slack_request(request)
        if not is_valid:
            return HttpResponse(status=403)

        raw_payload = request.POST.get('payload') or request.data.get('payload')
        if not raw_payload:
            return HttpResponse(status=200)

        try:
            payload = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
        except (json.JSONDecodeError, TypeError):
            return HttpResponse(status=200)

        if payload.get('type') != 'block_actions':
            return HttpResponse(status=200)

        actions = payload.get('actions', [])
        if not actions:
            return HttpResponse(status=200)

        action = actions[0]
        action_id: str = action.get('action_id', '')
        raw_value: str = action.get('value', '{}')

        try:
            value_data = json.loads(raw_value)
        except (json.JSONDecodeError, TypeError):
            return HttpResponse(status=200)

        # Resolve Redis-stored payloads for large confirmations
        if 'ref' in value_data:
            stored = cache.get(value_data['ref'])
            if not stored:
                response_url = payload.get('response_url', '')
                self._replace_via_response_url(
                    payload, response_url,
                    ":warning: This confirmation has expired. Please try again.",
                )
                return HttpResponse(status=200)
            value_data = stored

        team_id = payload.get('team', {}).get('id', '')
        app_id = payload.get('api_app_id', '')

        response_url = payload.get('response_url', '')

        if action_id.startswith('cancel_tool:'):
            self._replace_via_response_url(payload, response_url, "~Cancelled.~")
            return HttpResponse(status=200)

        if action_id.startswith('confirm_tool:'):
            call_id = value_data.get('call_id', '')
            if call_id:
                dedup_key = f"slack_confirm:{call_id}"
                if not cache.add(dedup_key, "1", timeout=300):
                    return HttpResponse(status=200)

            self._replace_via_response_url(
                payload, response_url, ":hourglass_flowing_sand: Running...",
            )
            self._dispatch_confirm(payload, value_data, team_id, app_id)
            return HttpResponse(status=200)

        return HttpResponse(status=200)

    def _dispatch_confirm(
        self, payload: dict, value_data: dict, team_id: str, app_id: str = '',
    ) -> None:
        channel_info = payload.get('channel', {})
        message_info = payload.get('message', {})
        user_info = payload.get('user', {})

        message_ts = message_info.get('ts', '')
        thread_ts = message_info.get('thread_ts', message_ts)

        TaskRouter.execute(
            'slack-handle-message',
            team_id=team_id,
            app_id=app_id,
            channel_id=channel_info.get('id', ''),
            user_id=user_info.get('id', ''),
            text='',
            ts=message_ts,
            thread_ts=thread_ts,
            event_type='confirmation',
            event_id='',
            tool_confirm=value_data,
        )

    @staticmethod
    def _replace_via_response_url(
        payload: dict, response_url: str, text: str,
    ) -> None:
        """
        POST to response_url to replace the original message.

        Slack ignores the HTTP response body for block_actions; the only
        way to update the source message is via the response_url webhook.
        """
        original_blocks = payload.get('message', {}).get('blocks', [])

        kept_blocks = [
            b for b in original_blocks
            if b.get('type') not in ('actions', 'divider')
            or not any(
                el.get('action_id', '').startswith(('confirm_tool:', 'cancel_tool:'))
                for el in b.get('elements', [])
            )
        ]

        kept_blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        })

        if not response_url:
            logger.warning("[SLACK] No response_url in interaction payload, cannot replace message")
            return

        try:
            webhook = WebhookClient(response_url)
            webhook.send(
                replace_original=True,
                blocks=kept_blocks,
                text=text,
            )
        except Exception:
            logger.exception("[SLACK] Failed to replace message via response_url")
