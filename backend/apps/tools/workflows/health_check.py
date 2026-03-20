"""
Hatchet workflow: periodic health checks for tool endpoints and MCP sources.

Pings all active endpoints every 5 minutes. After 3 consecutive failures,
marks the endpoint as unhealthy so server-side tools are excluded from the
agentic loop.
"""
import logging
from datetime import timedelta

import httpx
from asgiref.sync import sync_to_async
from django.utils import timezone
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()

CONSECUTIVE_FAILURE_THRESHOLD = 3


class EndpointHealthCheckInput(BaseModel):
    """Empty input — this is a cron-triggered workflow."""
    pass


@hatchet.task(
    name="tools-endpoint-health-check",
    retries=1,
    execution_timeout=timedelta(minutes=5),
    input_validator=EndpointHealthCheckInput,
)
async def endpoint_health_check_workflow(
    workflow_input: EndpointHealthCheckInput,
    context: Context,
):
    """Ping all active tool endpoints and update health status."""
    from apps.tools.models import ToolEndpoint

    endpoints = await sync_to_async(list)(
        ToolEndpoint.objects.filter(is_active=True)
    )

    if not endpoints:
        logger.info("[HealthCheck] No active endpoints to check")
        return {"checked": 0}

    results = {"checked": len(endpoints), "healthy": 0, "unhealthy": 0}

    for endpoint in endpoints:
        success = await _ping_endpoint(endpoint.endpoint_url)
        now = timezone.now()

        if success:
            endpoint.last_ping_at = now
            endpoint.last_ping_success = True
            endpoint.consecutive_failures = 0
            await sync_to_async(endpoint.save)(
                update_fields=["last_ping_at", "last_ping_success", "consecutive_failures"]
            )
            results["healthy"] += 1
        else:
            endpoint.last_ping_at = now
            endpoint.consecutive_failures += 1

            if endpoint.consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
                endpoint.last_ping_success = False

            await sync_to_async(endpoint.save)(
                update_fields=["last_ping_at", "last_ping_success", "consecutive_failures"]
            )
            results["unhealthy"] += 1
            logger.warning(
                "[HealthCheck] Endpoint %s failed ping (%d consecutive)",
                endpoint.endpoint_url,
                endpoint.consecutive_failures,
            )

    logger.info("[HealthCheck] Checked %d endpoints: %s", results["checked"], results)
    return results


async def _ping_endpoint(url: str) -> bool:
    """Send a ping POST to the endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json={"action": "ping"})
            return response.status_code == 200
    except Exception:
        return False
