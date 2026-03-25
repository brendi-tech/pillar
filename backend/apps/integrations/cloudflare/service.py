import logging
from typing import Optional

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

def get_cname_target() -> str:
    domain = getattr(settings, 'HELP_CENTER_DOMAIN', 'trypillar.com')
    return f"mcp-proxy.{domain}"


class CloudflareCustomHostnameService:
    """Wraps the Cloudflare Custom Hostnames API for SSL-for-SaaS."""

    def __init__(self):
        self.zone_id = settings.CLOUDFLARE_ZONE_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.base_url = (
            f"https://api.cloudflare.com/client/v4/zones/{self.zone_id}/custom_hostnames"
        )
        if not self.zone_id or not self.api_token:
            raise ValueError(
                "CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN must be configured"
            )

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def create_hostname(self, hostname: str) -> dict:
        """Create a custom hostname in Cloudflare.

        Returns the full CF response result including id, status, and
        ownership_verification records.
        """
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                self.base_url,
                headers=self._headers,
                json={
                    "hostname": hostname,
                    "ssl": {
                        "method": "http",
                        "type": "dv",
                        "settings": {
                            "min_tls_version": "1.2",
                        },
                    },
                },
            )
            data = resp.json()
            if not data.get("success"):
                errors = data.get("errors", [])
                error_msg = errors[0].get("message") if errors else "Unknown error"
                logger.error(
                    "Cloudflare create_hostname failed for %s: %s", hostname, errors
                )
                raise CloudflareAPIError(error_msg)
            return data["result"]

    def delete_hostname(self, cf_hostname_id: str) -> None:
        """Delete a custom hostname from Cloudflare."""
        with httpx.Client(timeout=30) as client:
            resp = client.delete(
                f"{self.base_url}/{cf_hostname_id}",
                headers=self._headers,
            )
            data = resp.json()
            if not data.get("success"):
                errors = data.get("errors", [])
                logger.warning(
                    "Cloudflare delete_hostname failed for %s: %s",
                    cf_hostname_id,
                    errors,
                )

    def get_hostname(self, cf_hostname_id: str) -> Optional[dict]:
        """Get the current status of a custom hostname."""
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{self.base_url}/{cf_hostname_id}",
                headers=self._headers,
            )
            data = resp.json()
            if not data.get("success"):
                return None
            return data["result"]

    def list_hostnames(self, hostname: Optional[str] = None) -> list:
        """List custom hostnames, optionally filtered by hostname string."""
        params: dict = {}
        if hostname:
            params["hostname"] = hostname
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                self.base_url,
                headers=self._headers,
                params=params,
            )
            data = resp.json()
            if not data.get("success"):
                return []
            return data.get("result", [])


class CloudflareAPIError(Exception):
    pass
