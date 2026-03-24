"""
OAuth linking views for OpenAPI tool sources.

Handles the per-user OAuth consent flow:
1. Agent generates a link token and returns an authorize URL to the user
2. User clicks the link → GET /authorize/<token>/ → redirect to OAuth provider
3. Provider redirects back → GET /callback/?code=...&state=... → exchange and store tokens
"""
from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tools.models import OAuthLinkToken, OpenAPIToolSource, UserToolCredential

logger = logging.getLogger(__name__)

OAUTH_CALLBACK_PATH = "/api/tools/oauth/callback/"


class OAuthAuthorizeView(APIView):
    """
    GET /api/tools/oauth/authorize/<link_token>/

    Validates the link token and redirects to the OAuth provider's
    authorization endpoint.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request, link_token: str) -> Response:
        now = timezone.now()

        try:
            token_obj = OAuthLinkToken.objects.select_related("openapi_source").get(
                token=link_token,
            )
        except OAuthLinkToken.DoesNotExist:
            return Response(
                {"error": "Invalid or expired link."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if token_obj.is_used:
            return Response(
                {"error": "This link has already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if token_obj.is_expired:
            return Response(
                {"error": "This link has expired. Please try the action again to get a new link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source = token_obj.openapi_source
        if not source.oauth_authorization_endpoint:
            return Response(
                {"error": "OAuth is not configured for this API source."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        callback_url = f"{settings.API_BASE_URL}{OAUTH_CALLBACK_PATH}"

        code_verifier = secrets.token_urlsafe(32)
        code_challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode("ascii")).digest())
            .rstrip(b"=")
            .decode("ascii")
        )

        token_obj.code_verifier = code_verifier
        token_obj.save(update_fields=["code_verifier"])

        params = {
            "response_type": "code",
            "client_id": source.oauth_client_id,
            "redirect_uri": callback_url,
            "state": link_token,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        base_scopes = source.oauth_scopes or ""
        env_scope = ""
        for env in (source.oauth_environments or []):
            if env.get("name", "").lower() == token_obj.oauth_environment.lower() and token_obj.oauth_environment:
                env_scope = env.get("extra_scope", "")
                break
        if env_scope:
            base_scopes = f"{base_scopes} {env_scope}".strip()
        if base_scopes:
            params["scope"] = base_scopes

        auth_url = f"{source.oauth_authorization_endpoint}?{urlencode(params)}"
        return HttpResponseRedirect(auth_url)


class OAuthCallbackView(APIView):
    """
    GET /api/tools/oauth/callback/?code=...&state=...

    Exchanges the authorization code for tokens, creates a UserToolCredential,
    and redirects to a success page.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def _redirect_or_json(self, *, success: bool, error_msg: str = "", http_status=None):
        frontend_url = getattr(settings, "HELP_CENTER_URL", "")
        if frontend_url:
            if success:
                return HttpResponseRedirect(f"{frontend_url}/oauth-callback/tools?status=success")
            params = urlencode({"status": "error", "error": error_msg})
            return HttpResponseRedirect(f"{frontend_url}/oauth-callback/tools?{params}")
        if success:
            return Response({"status": "success", "message": "Account connected successfully."})
        return Response({"error": error_msg}, status=http_status or status.HTTP_400_BAD_REQUEST)

    def get(self, request: Request) -> Response:
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        error = request.query_params.get("error")

        if error:
            logger.warning("OAuth callback error: %s", error)
            return self._redirect_or_json(success=False, error_msg=f"Authorization failed: {error}")

        if not code or not state:
            return self._redirect_or_json(success=False, error_msg="Missing code or state parameter.")

        now = timezone.now()

        try:
            token_obj = OAuthLinkToken.objects.select_related(
                "openapi_source", "product",
            ).get(token=state)
        except OAuthLinkToken.DoesNotExist:
            return self._redirect_or_json(success=False, error_msg="Invalid state token.")

        if token_obj.is_used:
            return self._redirect_or_json(success=False, error_msg="This authorization link has already been used.")

        if token_obj.is_expired:
            return self._redirect_or_json(success=False, error_msg="This authorization link has expired.")

        source = token_obj.openapi_source
        callback_url = f"{settings.API_BASE_URL}{OAUTH_CALLBACK_PATH}"

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": callback_url,
            "client_id": source.oauth_client_id,
        }
        if token_obj.code_verifier:
            token_data["code_verifier"] = token_obj.code_verifier
        if source.oauth_client_secret:
            token_data["client_secret"] = source.oauth_client_secret

        try:
            resp = httpx.post(
                source.oauth_token_endpoint,
                data=token_data,
                timeout=15,
            )
        except Exception as exc:
            logger.exception("Token exchange failed for %s", source.name)
            return self._redirect_or_json(success=False, error_msg="Failed to exchange authorization code.")

        if resp.status_code != 200:
            logger.warning(
                "Token exchange returned %s for %s: %s",
                resp.status_code, source.name, resp.text[:500],
            )
            return self._redirect_or_json(success=False, error_msg="Token exchange failed.")

        token_resp = resp.json()

        if source.oauth_token_exchange_url:
            exchange_url = source.oauth_token_exchange_url
            if not exchange_url.startswith("http"):
                exchange_url = f"{source.base_url.rstrip('/')}/{exchange_url.lstrip('/')}"

            try:
                exchange_resp = httpx.post(
                    exchange_url,
                    headers={"Authorization": f"Bearer {token_resp['access_token']}"},
                    timeout=15,
                )
                if exchange_resp.status_code == 200:
                    exchange_data = exchange_resp.json()
                    credential_key = ""
                    for env in (source.oauth_environments or []):
                        if env.get("name", "").lower() == token_obj.oauth_environment.lower():
                            credential_key = env.get("credential_key", "")
                            break

                    if credential_key and credential_key in exchange_data:
                        token_resp["access_token"] = exchange_data[credential_key]
                        token_resp["token_type"] = "Bearer"
                        if "refresh_token" in exchange_data:
                            token_resp["refresh_token"] = exchange_data["refresh_token"]
                        else:
                            token_resp.pop("refresh_token", None)
                        if "expires_in" in exchange_data:
                            token_resp["expires_in"] = exchange_data["expires_in"]
                        else:
                            token_resp.pop("expires_in", None)
                else:
                    logger.warning(
                        "Token exchange POST to %s returned %s: %s",
                        exchange_url, exchange_resp.status_code, exchange_resp.text[:500],
                    )
            except Exception:
                logger.exception("Token exchange POST to %s failed", exchange_url)

        token_obj.is_used = True
        token_obj.used_at = now
        token_obj.save(update_fields=["is_used", "used_at"])

        expires_at = None
        if token_resp.get("expires_in"):
            expires_at = now + timedelta(seconds=token_resp["expires_in"])

        UserToolCredential.objects.update_or_create(
            openapi_source=source,
            channel=token_obj.channel,
            channel_user_id=token_obj.channel_user_id,
            oauth_environment=token_obj.oauth_environment,
            defaults={
                "organization_id": source.organization_id,
                "product": token_obj.product,
                "access_token": token_resp["access_token"],
                "refresh_token": token_resp.get("refresh_token", ""),
                "token_type": token_resp.get("token_type", "Bearer"),
                "expires_at": expires_at,
                "scopes": token_resp.get("scope", source.oauth_scopes),
                "is_active": True,
            },
        )

        logger.info(
            "OAuth linked %s:%s to %s",
            token_obj.channel, token_obj.channel_user_id, source.name,
        )

        return self._redirect_or_json(success=True)
