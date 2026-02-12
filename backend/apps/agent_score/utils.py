"""
Utility functions for Agent Score — URL validation, origin extraction, token counting.
"""
import ipaddress
import logging
from urllib.parse import urlparse

import tiktoken

logger = logging.getLogger(__name__)

# Lazy-loaded tokenizer
_encoder: tiktoken.Encoding | None = None


def get_encoder() -> tiktoken.Encoding:
    """Get or create the tiktoken encoder (cl100k_base — GPT-4 tokenizer)."""
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def count_tokens(text: str) -> int:
    """Count tokens in text using the cl100k_base tokenizer."""
    if not text:
        return 0
    return len(get_encoder().encode(text))


def get_origin(url: str) -> str:
    """
    Extract the origin (scheme + host + port) from a URL.

    Example: "https://example.com/page" → "https://example.com"
    """
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin


def extract_domain(url: str) -> str:
    """
    Extract the domain (host without port) from a URL.

    Example: "https://www.example.com:443/page" → "www.example.com"
    """
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    return hostname.lower()


def validate_url(url: str) -> tuple[bool, str]:
    """
    Validate that a URL is safe to scan.

    Returns (is_valid, error_message).
    Rejects: private IPs, localhost, non-HTTP schemes, missing host.
    """
    if not url:
        return False, "URL is required."

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format."

    # Must be http or https
    if parsed.scheme not in ("http", "https"):
        return False, "Only HTTP and HTTPS URLs are supported."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must include a hostname."

    # Block localhost variants
    if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return False, "Localhost URLs are not allowed."

    # Block private/reserved IP ranges
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_reserved or ip.is_loopback or ip.is_link_local:
            return False, "Private or reserved IP addresses are not allowed."
    except ValueError:
        # Not an IP — that's fine, it's a hostname
        pass

    return True, ""
