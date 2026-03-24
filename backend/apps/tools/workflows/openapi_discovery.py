"""
Hatchet workflows for OpenAPI tool source management.

- tools-openapi-embed-descriptions: background embedding of operation descriptions.
- tools-openapi-refresh-tokens: periodic refresh of user OAuth tokens nearing expiry.
"""
import logging
from datetime import timedelta

from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class OpenAPIEmbedDescriptionsInput(BaseModel):
    openapi_source_id: str


@hatchet.task(
    name="tools-openapi-embed-descriptions",
    retries=2,
    execution_timeout=timedelta(minutes=5),
    input_validator=OpenAPIEmbedDescriptionsInput,
)
async def openapi_embed_descriptions_workflow(
    workflow_input: OpenAPIEmbedDescriptionsInput,
    context: Context,
):
    """Embed operation descriptions for an OpenAPI source after discovery."""
    from apps.tools.models import OpenAPIToolSource
    from apps.tools.services.openapi_parser import embed_source_descriptions

    try:
        source = await OpenAPIToolSource.objects.aget(
            id=workflow_input.openapi_source_id,
        )
    except OpenAPIToolSource.DoesNotExist:
        logger.warning(
            "[OpenAPIEmbed] Source %s not found",
            workflow_input.openapi_source_id,
        )
        return {"error": "not_found"}

    try:
        await embed_source_descriptions(source)
        logger.info("[OpenAPIEmbed] Embedded descriptions for %s", source.name)
        return {"embedded": True}
    except Exception as exc:
        logger.exception(
            "[OpenAPIEmbed] Failed to embed descriptions for %s: %s",
            source.name, exc,
        )
        return {"error": str(exc)}


class OpenAPIRefreshTokensInput(BaseModel):
    pass


@hatchet.task(
    name="tools-openapi-refresh-tokens",
    retries=1,
    execution_timeout=timedelta(minutes=10),
    input_validator=OpenAPIRefreshTokensInput,
)
async def openapi_refresh_tokens_workflow(
    workflow_input: OpenAPIRefreshTokensInput,
    context: Context,
):
    """Refresh user OAuth tokens that are expiring within the next 15 minutes."""
    from asgiref.sync import sync_to_async

    from django.utils import timezone

    from apps.tools.models import UserToolCredential
    from apps.tools.services.openapi_executor import _try_refresh_user_token

    threshold = timezone.now() + timedelta(minutes=15)

    credentials = await sync_to_async(list)(
        UserToolCredential.objects.filter(
            is_active=True,
            expires_at__lte=threshold,
            refresh_token__isnull=False,
        ).select_related("openapi_source").exclude(refresh_token='')
    )

    if not credentials:
        logger.info("[OpenAPIRefreshTokens] No tokens need refreshing")
        return {"refreshed": 0, "failed": 0}

    results = {"refreshed": 0, "failed": 0}

    for cred in credentials:
        success = await _try_refresh_user_token(cred.openapi_source, cred)
        if success:
            results["refreshed"] += 1
        else:
            results["failed"] += 1

    logger.info(
        "[OpenAPIRefreshTokens] Refreshed %d tokens, %d failed",
        results["refreshed"], results["failed"],
    )
    return results
