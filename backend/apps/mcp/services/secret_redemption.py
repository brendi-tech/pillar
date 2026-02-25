"""
Redis-backed store for one-time secret redemption tokens.

Sensitive tool outputs are encrypted, stored in Redis with a short TTL,
and redeemable once via a token. After redemption, a 30-second grace
window allows a single re-fetch (handles lost HTTP responses).
"""
import json
import logging
import secrets
import time

logger = logging.getLogger(__name__)

_REDIS_PREFIX = "mcp:secret_redeem:"
_DEFAULT_TTL = 300  # 5 minutes
_GRACE_TTL = 30  # 30 seconds after first redemption


def _get_redis():
    try:
        from django_redis import get_redis_connection
        return get_redis_connection("default")
    except Exception as e:
        logger.error(f"[SecretRedemption] Redis unavailable: {e}")
        return None


class SecretRedemptionStore:

    @staticmethod
    def store_secret(
        value: str,
        session_id: str,
        user_id: str,
        field_name: str = "secret",
        ttl: int = _DEFAULT_TTL,
    ) -> str:
        """Encrypt *value* and store in Redis. Returns a redemption token."""
        from common.services.credential_encryption import encrypt_value

        token = f"rdm_{secrets.token_hex(16)}"
        encrypted = encrypt_value(value)

        payload = json.dumps({
            "encrypted_value": encrypted,
            "session_id": session_id,
            "user_id": str(user_id),
            "field_name": field_name,
            "created_at": time.time(),
            "redeemed_at": None,
        })

        redis = _get_redis()
        if redis is None:
            raise RuntimeError("Redis unavailable — cannot store secret")

        redis.setex(f"{_REDIS_PREFIX}{token}", ttl, payload)
        logger.info(
            f"[SecretRedemption] Stored token={token[:12]}… "
            f"field={field_name} ttl={ttl}s"
        )
        return token

    @staticmethod
    def redeem_secret(token: str, user_id: str | None = None) -> str | None:
        """Fetch, decrypt, and burn. Returns plaintext or None."""
        from common.services.credential_encryption import decrypt_value

        redis = _get_redis()
        if redis is None:
            return None

        key = f"{_REDIS_PREFIX}{token}"
        raw = redis.get(key)
        if raw is None:
            logger.info(f"[SecretRedemption] Token not found or expired: {token[:12]}…")
            return None

        data = json.loads(raw)

        if user_id and data.get("user_id") and str(data["user_id"]) != str(user_id):
            logger.warning(f"[SecretRedemption] User mismatch for token {token[:12]}…")
            return None

        redeemed_at = data.get("redeemed_at")
        if redeemed_at is not None:
            if time.time() - redeemed_at > _GRACE_TTL:
                logger.info(f"[SecretRedemption] Grace window expired for {token[:12]}…")
                redis.delete(key)
                return None
            # Within grace window — allow re-fetch but don't reset timer
        else:
            # First redemption — mark and set short TTL
            data["redeemed_at"] = time.time()
            redis.setex(key, _GRACE_TTL, json.dumps(data))

        plaintext = decrypt_value(data["encrypted_value"])
        logger.info(f"[SecretRedemption] Redeemed token={token[:12]}…")
        return plaintext
