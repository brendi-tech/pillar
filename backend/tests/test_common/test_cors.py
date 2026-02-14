"""
Tests for CORS utilities and per-product domain restriction enforcement.

Verifies:
- Domain matching patterns (exact, wildcard subdomain, port, localhost wildcard)
- CORS header addition with and without restrictions
- Origin blocking when restrictions are enabled
"""
import pytest
from unittest.mock import MagicMock
from django.http import HttpResponse
from django.test import RequestFactory

from common.utils.cors import (
    is_origin_allowed,
    check_origin_allowed,
    add_cors_headers,
    CORS_ALLOW_HEADERS,
    CORS_EXPOSE_HEADERS,
)


class TestIsOriginAllowed:
    """Unit tests for the is_origin_allowed domain matching function."""

    # --- Exact domain matching ---

    def test_exact_domain_https(self):
        assert is_origin_allowed("https://example.com", ["example.com"]) is True

    def test_exact_domain_http(self):
        assert is_origin_allowed("http://example.com", ["example.com"]) is True

    def test_exact_domain_no_match(self):
        assert is_origin_allowed("https://other.com", ["example.com"]) is False

    def test_exact_domain_with_port(self):
        assert is_origin_allowed("https://example.com:8080", ["example.com:8080"]) is True

    def test_exact_domain_port_mismatch(self):
        assert is_origin_allowed("https://example.com:8080", ["example.com:9090"]) is False

    # --- Subdomain wildcard matching ---

    def test_wildcard_subdomain(self):
        assert is_origin_allowed("https://app.example.com", ["*.example.com"]) is True

    def test_wildcard_deep_subdomain(self):
        assert is_origin_allowed("https://deep.sub.example.com", ["*.example.com"]) is True

    def test_wildcard_base_domain(self):
        """Wildcard should also match the base domain itself."""
        assert is_origin_allowed("https://example.com", ["*.example.com"]) is True

    def test_wildcard_no_match(self):
        assert is_origin_allowed("https://example.org", ["*.example.com"]) is False

    def test_wildcard_partial_match_not_allowed(self):
        """fooexample.com should NOT match *.example.com."""
        assert is_origin_allowed("https://fooexample.com", ["*.example.com"]) is False

    # --- Localhost with specific port ---

    def test_localhost_specific_port(self):
        assert is_origin_allowed("http://localhost:3000", ["localhost:3000"]) is True

    def test_localhost_wrong_port(self):
        assert is_origin_allowed("http://localhost:3000", ["localhost:8080"]) is False

    # --- Localhost wildcard port ---

    def test_localhost_wildcard_any_port(self):
        assert is_origin_allowed("http://localhost:3000", ["localhost:*"]) is True

    def test_localhost_wildcard_different_port(self):
        assert is_origin_allowed("http://localhost:8080", ["localhost:*"]) is True

    def test_localhost_wildcard_no_port(self):
        """localhost without port should match localhost:*."""
        assert is_origin_allowed("http://localhost", ["localhost:*"]) is True

    def test_localhost_wildcard_does_not_match_other_hosts(self):
        assert is_origin_allowed("http://example.com:3000", ["localhost:*"]) is False

    # --- Multiple patterns ---

    def test_multiple_patterns_first_match(self):
        domains = ["localhost:3000", "*.example.com", "app.other.com"]
        assert is_origin_allowed("http://localhost:3000", domains) is True

    def test_multiple_patterns_last_match(self):
        domains = ["localhost:3000", "*.example.com", "app.other.com"]
        assert is_origin_allowed("https://app.other.com", domains) is True

    def test_multiple_patterns_no_match(self):
        domains = ["localhost:3000", "*.example.com"]
        assert is_origin_allowed("https://evil.com", domains) is False

    # --- Edge cases ---

    def test_empty_origin(self):
        assert is_origin_allowed("", ["example.com"]) is False

    def test_empty_domains_list(self):
        assert is_origin_allowed("https://example.com", []) is False

    def test_whitespace_in_pattern(self):
        """Patterns should be trimmed."""
        assert is_origin_allowed("https://example.com", ["  example.com  "]) is True

    def test_case_insensitive_pattern(self):
        assert is_origin_allowed("https://Example.COM", ["example.com"]) is True

    def test_malformed_origin(self):
        assert is_origin_allowed("not-a-url", ["example.com"]) is False


class TestCheckOriginAllowed:
    """Tests for check_origin_allowed which reads product config from request."""

    def _make_request(self, origin=None, product=None):
        """Create a mock request with optional origin and product."""
        factory = RequestFactory()
        request = factory.get("/")
        if origin:
            request.META["HTTP_ORIGIN"] = origin
        if product:
            request.product = product
        else:
            request.product = None
        request.help_center_config = None
        return request

    def _make_product(self, restrict=False, domains=None):
        """Create a mock product with config."""
        product = MagicMock()
        product.config = {
            "embed": {
                "security": {
                    "restrictToAllowedDomains": restrict,
                    "allowedDomains": domains or [],
                }
            }
        }
        return product

    def test_no_product_returns_none(self):
        request = self._make_request(origin="https://example.com")
        assert check_origin_allowed(request) is None

    def test_restrictions_disabled_returns_none(self):
        product = self._make_product(restrict=False)
        request = self._make_request(origin="https://example.com", product=product)
        assert check_origin_allowed(request) is None

    def test_restrictions_enabled_no_origin_returns_true(self):
        """Lenient mode: no Origin header = allow."""
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(product=product)
        assert check_origin_allowed(request) is True

    def test_restrictions_enabled_allowed_origin(self):
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(origin="https://example.com", product=product)
        assert check_origin_allowed(request) is True

    def test_restrictions_enabled_blocked_origin(self):
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(origin="https://evil.com", product=product)
        assert check_origin_allowed(request) is False

    def test_empty_config(self):
        """Product with empty config should not restrict."""
        product = MagicMock()
        product.config = {}
        request = self._make_request(origin="https://example.com", product=product)
        assert check_origin_allowed(request) is None


class TestAddCorsHeaders:
    """Tests for add_cors_headers which sets CORS headers on responses."""

    def _make_request(self, origin=None, product=None):
        factory = RequestFactory()
        request = factory.get("/")
        if origin:
            request.META["HTTP_ORIGIN"] = origin
        request.product = product
        request.help_center_config = None
        return request

    def _make_product(self, restrict=False, domains=None):
        product = MagicMock()
        product.config = {
            "embed": {
                "security": {
                    "restrictToAllowedDomains": restrict,
                    "allowedDomains": domains or [],
                }
            }
        }
        return product

    def test_sets_cors_headers_no_restrictions(self):
        request = self._make_request(origin="https://example.com")
        response = HttpResponse()
        add_cors_headers(response, request)

        assert response["Access-Control-Allow-Origin"] == "https://example.com"
        assert response["Access-Control-Allow-Credentials"] == "true"
        assert "Mcp-Session-Id" in response["Access-Control-Allow-Headers"]
        assert "X-Run-Id" in response["Access-Control-Expose-Headers"]
        assert "Mcp-Session-Id" in response["Access-Control-Expose-Headers"]

    def test_sets_wildcard_when_no_origin(self):
        request = self._make_request()
        response = HttpResponse()
        add_cors_headers(response, request)

        assert response["Access-Control-Allow-Origin"] == "*"

    def test_blocks_disallowed_origin(self):
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(origin="https://evil.com", product=product)
        response = HttpResponse()
        add_cors_headers(response, request)

        assert "Access-Control-Allow-Origin" not in response

    def test_allows_matching_origin(self):
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(origin="https://example.com", product=product)
        response = HttpResponse()
        add_cors_headers(response, request)

        assert response["Access-Control-Allow-Origin"] == "https://example.com"

    def test_skip_origin_check_always_allows(self):
        product = self._make_product(restrict=True, domains=["example.com"])
        request = self._make_request(origin="https://evil.com", product=product)
        response = HttpResponse()
        add_cors_headers(response, request, skip_origin_check=True)

        assert response["Access-Control-Allow-Origin"] == "https://evil.com"

    def test_localhost_wildcard_in_restrictions(self):
        product = self._make_product(restrict=True, domains=["localhost:*"])
        request = self._make_request(origin="http://localhost:5173", product=product)
        response = HttpResponse()
        add_cors_headers(response, request)

        assert response["Access-Control-Allow-Origin"] == "http://localhost:5173"

    def test_subdomain_wildcard_in_restrictions(self):
        product = self._make_product(restrict=True, domains=["*.myapp.com"])
        request = self._make_request(origin="https://staging.myapp.com", product=product)
        response = HttpResponse()
        add_cors_headers(response, request)

        assert response["Access-Control-Allow-Origin"] == "https://staging.myapp.com"
