"""
Service for generating unique subdomains for help centers.

Adapted from the MCP subdomain generator for help center use.
"""
import re
from typing import Optional


class SubdomainGeneratorService:
    """
    Service to generate unique subdomains for help centers.
    """

    @staticmethod
    def sanitize_subdomain(text: str, max_length: int = 50) -> str:
        """
        Sanitize text to be a valid subdomain.

        Rules:
        - Lowercase only
        - Alphanumeric and hyphens only
        - No leading/trailing hyphens
        - Max length enforced

        Args:
            text: Text to sanitize
            max_length: Maximum length of subdomain

        Returns:
            Sanitized subdomain string
        """
        # Lowercase
        text = text.lower()

        # Replace spaces and underscores with hyphens
        text = text.replace(' ', '-').replace('_', '-')

        # Remove any characters that aren't alphanumeric or hyphens
        text = re.sub(r'[^a-z0-9-]', '', text)

        # Remove consecutive hyphens
        text = re.sub(r'-+', '-', text)

        # Remove leading/trailing hyphens
        text = text.strip('-')

        # Truncate to max length
        if len(text) > max_length:
            text = text[:max_length].rstrip('-')

        return text

    @staticmethod
    def generate_subdomain(org_name: str, site_name: str, max_length: int = 50) -> str:
        """
        Generate a subdomain from organization and site names.

        Args:
            org_name: Organization name
            site_name: Site name
            max_length: Maximum length of subdomain

        Returns:
            Generated subdomain (not guaranteed to be unique, call ensure_unique)
        """
        # Sanitize both parts
        org_part = SubdomainGeneratorService.sanitize_subdomain(org_name, max_length // 2)
        site_part = SubdomainGeneratorService.sanitize_subdomain(site_name, max_length // 2)

        # Combine with hyphen
        if org_part and site_part:
            combined = f"{org_part}-{site_part}"
        elif org_part:
            combined = org_part
        elif site_part:
            combined = site_part
        else:
            # Fallback to generic name
            combined = "site"

        # Ensure it doesn't exceed max length
        if len(combined) > max_length:
            combined = combined[:max_length].rstrip('-')

        return combined

    @staticmethod
    def ensure_unique_subdomain(base_subdomain: str, existing_subdomains: set) -> str:
        """
        Ensure subdomain is unique by adding suffix if needed.

        Strategy:
        1. Try base subdomain
        2. Try with 3-char random suffix (e.g., acme-x7k)
        3. Try with incrementing numbers (acme-2, acme-3)
        4. Fallback to UUID

        Args:
            base_subdomain: Base subdomain to make unique
            existing_subdomains: Set of existing subdomains to check against

        Returns:
            Unique subdomain (globally unique across all organizations)
        """
        import random
        import string

        if base_subdomain not in existing_subdomains:
            return base_subdomain

        # Try adding a short random suffix (3 chars: letters + numbers)
        # This gives us 36^3 = 46,656 possibilities per base name
        for _ in range(10):  # Try up to 10 random suffixes
            chars = string.ascii_lowercase + string.digits
            random_suffix = ''.join(random.choices(chars, k=3))
            candidate = f"{base_subdomain}-{random_suffix}"
            if candidate not in existing_subdomains:
                return candidate

        # If random didn't work, try numeric suffixes
        counter = 2
        while counter <= 100:
            candidate = f"{base_subdomain}-{counter}"
            if candidate not in existing_subdomains:
                return candidate
            counter += 1

        # Last resort: UUID-based suffix
        import uuid
        uuid_suffix = uuid.uuid4().hex[:6]
        return f"{base_subdomain[:40]}-{uuid_suffix}"

    @classmethod
    def extract_subdomain_from_domain(cls, domain: str) -> str:
        """
        Extract base domain name from a full domain, stripping ALL subdomains and protocol.

        Examples:
        - "https://www.acme.com" -> "acme"
        - "www.acme.com" -> "acme"
        - "docs.acme.com" -> "acme"
        - "api.staging.acme.com" -> "acme"
        - "acme.co.uk" -> "acme"
        - "acme.com" -> "acme"

        Args:
            domain: Full domain string (may include protocol, subdomain, etc.)

        Returns:
            Base domain name without subdomains or TLD
        """
        # Remove protocol if present
        if '://' in domain:
            domain = domain.split('://', 1)[1]

        # Remove path if present
        if '/' in domain:
            domain = domain.split('/', 1)[0]

        # Remove port if present
        if ':' in domain:
            domain = domain.split(':', 1)[0]

        # Split by dots
        parts = domain.split('.')

        # Common TLDs that are two parts
        two_part_tlds = {'co.uk', 'co.za', 'com.au', 'co.nz', 'com.br', 'co.jp'}

        if len(parts) >= 3:
            # Check if last two parts form a two-part TLD
            potential_tld = f"{parts[-2]}.{parts[-1]}"
            if potential_tld in two_part_tlds:
                # e.g., ["www", "acme", "co", "uk"] -> "acme"
                # The base domain is the part before the two-part TLD
                if len(parts) > 2:
                    base_domain = parts[-3]
                else:
                    base_domain = parts[0]
            else:
                # Regular TLD, get the second-to-last part
                # e.g., ["www", "acme", "com"] -> "acme"
                # e.g., ["api", "staging", "acme", "com"] -> "acme"
                base_domain = parts[-2]
        elif len(parts) == 2:
            # e.g., ["acme", "com"] -> "acme"
            base_domain = parts[0]
        else:
            # Single part, no TLD
            base_domain = parts[0] if parts else domain

        # Sanitize and return
        return cls.sanitize_subdomain(base_domain)
