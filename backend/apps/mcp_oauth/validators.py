"""
Custom OAuth2 validator for MCP OAuth.

Extends django-oauth-toolkit's validator to handle:
- Nullable user (MCP end-users aren't Django users)
- Copying external identity from grant to access token
- Loading product context during token validation
"""
from __future__ import annotations

import logging

from oauth2_provider.oauth2_validators import OAuth2Validator

logger = logging.getLogger(__name__)


class MCPOAuth2Validator(OAuth2Validator):
    """
    MCP-specific OAuth2 validator.

    Key overrides:
    - save_bearer_token: propagates external identity from grant to token
    - validate_bearer_token: attaches product context to the request
    """

    def save_bearer_token(self, token, request, *args, **kwargs):
        super().save_bearer_token(token, request, *args, **kwargs)

        from oauth2_provider.models import get_access_token_model

        AccessToken = get_access_token_model()

        try:
            access_token = AccessToken.objects.get(token=token['access_token'])
        except AccessToken.DoesNotExist:
            return

        grant_info = getattr(request, '_mcp_grant_info', None)
        if grant_info:
            access_token.product_id = grant_info.get('product_id')
            access_token.external_user_id = grant_info.get('external_user_id', '')
            access_token.external_email = grant_info.get('external_email', '')
            access_token.external_display_name = grant_info.get(
                'external_display_name', ''
            )
            access_token.external_user_info = grant_info.get(
                'external_user_info', {}
            )
            access_token.save(
                update_fields=[
                    'product_id',
                    'external_user_id',
                    'external_email',
                    'external_display_name',
                    'external_user_info',
                ]
            )

    def validate_code(self, client_id, code, client, request, *args, **kwargs):
        result = super().validate_code(
            client_id, code, client, request, *args, **kwargs
        )
        if result:
            from oauth2_provider.models import get_grant_model

            Grant = get_grant_model()
            try:
                grant = Grant.objects.get(code=code, application=request.client)
                request._mcp_grant_info = {
                    'product_id': getattr(grant.application, 'product_id', None),
                    'external_user_info': getattr(
                        grant, 'external_user_info', {}
                    ),
                    'external_user_id': grant.external_user_info.get('sub', ''),
                    'external_email': grant.external_user_info.get('email', ''),
                    'external_display_name': grant.external_user_info.get(
                        'name', ''
                    ),
                }
            except Grant.DoesNotExist:
                pass
        return result
