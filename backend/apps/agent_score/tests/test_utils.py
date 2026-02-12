"""Tests for Agent Score utility functions."""

from apps.agent_score.utils import count_tokens, extract_domain, get_origin, validate_url


class TestValidateUrl:
    """Tests for URL validation and safety checks."""

    def test_valid_https_url(self):
        is_valid, error = validate_url("https://example.com/page")
        assert is_valid is True
        assert error == ""

    def test_valid_http_url(self):
        is_valid, error = validate_url("http://example.com")
        assert is_valid is True

    def test_empty_url(self):
        is_valid, error = validate_url("")
        assert is_valid is False
        assert "required" in error.lower()

    def test_ftp_rejected(self):
        is_valid, error = validate_url("ftp://files.example.com/data")
        assert is_valid is False
        assert "HTTP" in error

    def test_javascript_rejected(self):
        is_valid, error = validate_url("javascript:alert(1)")
        assert is_valid is False

    def test_no_hostname(self):
        is_valid, error = validate_url("https://")
        assert is_valid is False
        assert "hostname" in error.lower()

    def test_localhost_rejected(self):
        is_valid, error = validate_url("http://localhost:8000")
        assert is_valid is False
        assert "Localhost" in error

    def test_127_0_0_1_rejected(self):
        is_valid, error = validate_url("http://127.0.0.1:8080")
        assert is_valid is False

    def test_ipv6_loopback_rejected(self):
        is_valid, error = validate_url("http://[::1]/admin")
        assert is_valid is False

    def test_private_ip_10_rejected(self):
        is_valid, error = validate_url("http://10.0.0.5/internal")
        assert is_valid is False
        assert "Private" in error

    def test_private_ip_192_rejected(self):
        is_valid, error = validate_url("http://192.168.1.100/api")
        assert is_valid is False

    def test_private_ip_172_rejected(self):
        is_valid, error = validate_url("http://172.16.0.1/")
        assert is_valid is False

    def test_regular_hostname_accepted(self):
        is_valid, _ = validate_url("https://www.cloudflare.com/blog")
        assert is_valid is True

    def test_url_with_path_and_query(self):
        is_valid, _ = validate_url("https://example.com/path?q=search&lang=en")
        assert is_valid is True


class TestGetOrigin:
    """Tests for origin extraction."""

    def test_simple_https(self):
        assert get_origin("https://example.com/page") == "https://example.com"

    def test_with_port(self):
        assert get_origin("https://example.com:8443/api") == "https://example.com:8443"

    def test_http_with_path(self):
        assert get_origin("http://blog.example.com/2026/post") == "http://blog.example.com"

    def test_subdomain(self):
        assert get_origin("https://api.v2.example.com/") == "https://api.v2.example.com"


class TestExtractDomain:
    """Tests for domain extraction."""

    def test_simple_domain(self):
        assert extract_domain("https://example.com/page") == "example.com"

    def test_www_subdomain(self):
        assert extract_domain("https://www.example.com/") == "www.example.com"

    def test_with_port(self):
        assert extract_domain("https://example.com:443/") == "example.com"

    def test_uppercase_normalized(self):
        assert extract_domain("https://EXAMPLE.COM/") == "example.com"


class TestCountTokens:
    """Tests for token counting."""

    def test_empty_string(self):
        assert count_tokens("") == 0

    def test_simple_text(self):
        tokens = count_tokens("Hello world")
        assert tokens > 0
        assert tokens < 10  # "Hello world" is 2-3 tokens

    def test_html_more_tokens_than_text(self):
        html_tokens = count_tokens("<h2 class='section-title'>About Us</h2>")
        text_tokens = count_tokens("About Us")
        assert html_tokens > text_tokens

    def test_markdown_fewer_tokens_than_html(self):
        md_tokens = count_tokens("## About Us")
        html_tokens = count_tokens("<h2 class='section-title' id='about'>About Us</h2>")
        assert md_tokens < html_tokens
