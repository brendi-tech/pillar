"""
PKCE (Proof Key for Code Exchange) helpers for OAuth 2.1.

Implements S256 code challenge method per RFC 7636.
"""
import base64
import hashlib
import secrets


def generate_pkce_pair() -> tuple[str, str]:
    """
    Generate a PKCE code_verifier and code_challenge pair.

    Returns:
        (code_verifier, code_challenge) using S256 method.
    """
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = _compute_s256_challenge(code_verifier)
    return code_verifier, code_challenge


def verify_pkce(code_verifier: str, stored_code_challenge: str) -> bool:
    """Verify that code_verifier matches the stored code_challenge (S256)."""
    computed = _compute_s256_challenge(code_verifier)
    return secrets.compare_digest(computed, stored_code_challenge)


def _compute_s256_challenge(code_verifier: str) -> str:
    """Compute S256 code_challenge from a code_verifier."""
    digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
