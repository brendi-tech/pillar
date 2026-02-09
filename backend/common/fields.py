"""
Custom Django model fields.

Includes encrypted fields for secure storage of sensitive data.
"""
import base64
import hashlib
import json
import logging
from typing import Any, Dict, Optional

from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)


def get_encryption_key() -> bytes:
    """
    Derive Fernet-compatible encryption key from Django SECRET_KEY.

    Uses SHA256 hash of SECRET_KEY to get a consistent 32-byte key,
    then base64-encodes it for Fernet compatibility.

    Returns:
        bytes: Base64-encoded 32-byte key suitable for Fernet
    """
    key_hash = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key_hash)


class EncryptedTextField(models.TextField):
    """
    A Django field that stores text encrypted at rest.

    Uses Fernet symmetric encryption (AES-128-CBC) with a key derived
    from Django's SECRET_KEY. Data is automatically encrypted on save
    and decrypted on read.

    Usage:
        class MyModel(models.Model):
            password = EncryptedTextField(
                blank=True,
                help_text="Encrypted password"
            )

        # Set data (will be encrypted)
        obj.password = 'secret123'
        obj.save()

        # Get data (automatically decrypted)
        print(obj.password)  # 'secret123'

    Note:
        - If decryption fails (e.g., key changed), returns empty string
        - Stores encrypted data as base64-encoded string in database
    """

    description = "A field that stores text encrypted at rest"

    def get_prep_value(self, value: Optional[str]) -> Optional[str]:
        """
        Encrypt value before saving to database.

        Args:
            value: Python string to encrypt

        Returns:
            Encrypted string or None
        """
        if value is None or value == '':
            return None

        try:
            from cryptography.fernet import Fernet

            fernet = Fernet(get_encryption_key())
            encrypted = fernet.encrypt(value.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Failed to encrypt text field: {e}")
            raise ValueError(f"Failed to encrypt data: {e}")

    def from_db_value(
        self,
        value: Optional[str],
        expression,
        connection
    ) -> str:
        """
        Decrypt value when reading from database.

        Args:
            value: Encrypted string from database
            expression: SQL expression
            connection: Database connection

        Returns:
            Decrypted string, or empty string on failure
        """
        if value is None:
            return ''

        try:
            from cryptography.fernet import Fernet

            fernet = Fernet(get_encryption_key())
            decrypted = fernet.decrypt(value.encode())
            return decrypted.decode()
        except Exception as e:
            logger.warning(f"Failed to decrypt text field (returning empty string): {e}")
            return ''

    def to_python(self, value: Any) -> str:
        """
        Convert value to Python string.

        Called during deserialization and when setting field value.

        Args:
            value: Input value (str or None)

        Returns:
            Python string
        """
        if value is None:
            return ''
        if isinstance(value, str):
            return value
        return str(value)


class EncryptedJSONField(models.TextField):
    """
    A Django field that stores JSON data encrypted at rest.

    Uses Fernet symmetric encryption (AES-128-CBC) with a key derived
    from Django's SECRET_KEY. Data is automatically encrypted on save
    and decrypted on read.

    Usage:
        class MyModel(models.Model):
            credentials = EncryptedJSONField(
                default=dict,
                help_text="Encrypted credential data"
            )

        # Set data (will be encrypted)
        obj.credentials = {'api_key': 'secret123', 'endpoint': 'https://...'}
        obj.save()

        # Get data (automatically decrypted)
        print(obj.credentials)  # {'api_key': 'secret123', 'endpoint': 'https://...'}

    Note:
        - If decryption fails (e.g., key changed), returns empty dict
        - Stores encrypted data as base64-encoded string in database
    """

    description = "A field that stores JSON data encrypted at rest"

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('default', dict)
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        """Return enough information to recreate the field."""
        name, path, args, kwargs = super().deconstruct()
        # Remove default if it's the standard empty dict
        if kwargs.get('default') == dict:
            del kwargs['default']
        return name, path, args, kwargs

    def get_prep_value(self, value: Optional[Dict]) -> Optional[str]:
        """
        Encrypt value before saving to database.

        Args:
            value: Python dict to encrypt

        Returns:
            Encrypted string or None
        """
        if value is None:
            return None

        try:
            from cryptography.fernet import Fernet

            json_str = json.dumps(value)
            fernet = Fernet(get_encryption_key())
            encrypted = fernet.encrypt(json_str.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Failed to encrypt JSON field: {e}")
            raise ValueError(f"Failed to encrypt data: {e}")

    def from_db_value(
        self,
        value: Optional[str],
        expression,
        connection
    ) -> Dict[str, Any]:
        """
        Decrypt value when reading from database.

        Args:
            value: Encrypted string from database
            expression: SQL expression
            connection: Database connection

        Returns:
            Decrypted dict, or empty dict on failure
        """
        if value is None:
            return {}

        try:
            from cryptography.fernet import Fernet

            fernet = Fernet(get_encryption_key())
            decrypted = fernet.decrypt(value.encode())
            return json.loads(decrypted.decode())
        except Exception as e:
            logger.warning(f"Failed to decrypt JSON field (returning empty dict): {e}")
            return {}

    def to_python(self, value: Any) -> Dict[str, Any]:
        """
        Convert value to Python dict.

        Called during deserialization and when setting field value.

        Args:
            value: Input value (dict, str, or None)

        Returns:
            Python dict
        """
        if isinstance(value, dict):
            return value
        if value is None:
            return {}
        # If it's a string, it might be encrypted data being loaded
        # Let from_db_value handle actual decryption
        if isinstance(value, str):
            try:
                # Try to parse as JSON first (for form input)
                return json.loads(value)
            except json.JSONDecodeError:
                # Might be encrypted data, return empty for now
                return {}
        return {}

    def value_to_string(self, obj) -> str:
        """
        Convert field value to string for serialization.

        Used by Django's serialization framework.
        """
        value = self.value_from_object(obj)
        return json.dumps(value) if value else '{}'
