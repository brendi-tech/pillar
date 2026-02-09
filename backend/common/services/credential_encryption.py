"""
Credential encryption service for secure storage of cloud provider credentials.
"""
import base64
import hashlib
import json

from cryptography.fernet import Fernet
from django.conf import settings


class CredentialEncryptionService:
    """
    Service for encrypting and decrypting cloud storage credentials.
    Uses Fernet symmetric encryption with a key derived from Django's SECRET_KEY.
    """

    @staticmethod
    def _get_encryption_key() -> bytes:
        """
        Derive an encryption key from Django's SECRET_KEY.

        Returns:
            bytes: 32-byte key suitable for Fernet encryption
        """
        # Hash the SECRET_KEY to get a consistent 32-byte key
        key_hash = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        # Fernet requires base64-encoded 32-byte key
        return base64.urlsafe_b64encode(key_hash)

    @staticmethod
    def encrypt_credentials(credentials: dict) -> str:
        """
        Encrypt credentials dictionary to a string.

        Args:
            credentials: Dictionary containing credentials
                For S3: {'access_key_id': '...', 'secret_access_key': '...'}
                For GCS: {'service_account_json': '...'}

        Returns:
            str: Encrypted credentials as a string
        """
        key = CredentialEncryptionService._get_encryption_key()
        f = Fernet(key)

        # Convert dict to JSON string
        credentials_json = json.dumps(credentials)

        # Encrypt
        encrypted_bytes = f.encrypt(credentials_json.encode())

        # Return as string
        return encrypted_bytes.decode()

    @staticmethod
    def decrypt_credentials(encrypted_str: str) -> dict:
        """
        Decrypt credentials string to a dictionary.

        Args:
            encrypted_str: Encrypted credentials string

        Returns:
            Dict: Decrypted credentials dictionary

        Raises:
            ValueError: If decryption fails (invalid key or corrupted data)
        """
        try:
            key = CredentialEncryptionService._get_encryption_key()
            f = Fernet(key)

            # Decrypt
            decrypted_bytes = f.decrypt(encrypted_str.encode())

            # Parse JSON
            credentials = json.loads(decrypted_bytes.decode())

            return credentials
        except Exception as e:
            raise ValueError(f"Failed to decrypt credentials: {str(e)}")


# =============================================================================
# Convenience functions for single value encryption/decryption
# =============================================================================


def encrypt_value(value: str) -> str:
    """
    Encrypt a single string value.

    Args:
        value: Plain text string to encrypt

    Returns:
        Encrypted string with 'encrypted:' prefix
    """
    if not value:
        return ""
    encrypted = CredentialEncryptionService.encrypt_credentials({"value": value})
    return f"encrypted:{encrypted}"


def decrypt_value(encrypted: str) -> str:
    """
    Decrypt a single string value.

    Args:
        encrypted: Encrypted string (with or without 'encrypted:' prefix)

    Returns:
        Decrypted plain text string
    """
    if not encrypted:
        return ""

    # Handle both prefixed and non-prefixed values
    if encrypted.startswith("encrypted:"):
        encrypted = encrypted[len("encrypted:"):]

    try:
        data = CredentialEncryptionService.decrypt_credentials(encrypted)
        return data.get("value", "")
    except ValueError:
        # If decryption fails, it might be unencrypted (legacy) - return as is
        return encrypted
