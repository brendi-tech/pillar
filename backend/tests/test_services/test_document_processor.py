"""
Tests for DocumentProcessor service.
"""
import json

import pytest

from common.services.document_processor import (
    DocumentProcessor,
    ShopifyProductFormatter,
    SUPPORTED_FILE_TYPES,
)


class TestDocumentProcessor:
    """Tests for DocumentProcessor."""

    def test_process_text(self):
        """Test plain text processing."""
        content = "  Hello world  "
        result = DocumentProcessor.process_text(content)
        assert result == "Hello world"

    def test_process_markdown_bytes(self):
        """Test markdown bytes processing."""
        content = b"# Header\n\nParagraph text"
        result = DocumentProcessor.process_markdown_bytes(content)
        assert "# Header" in result
        assert "Paragraph text" in result

    def test_process_markdown_bytes_empty(self):
        """Test markdown bytes processing with empty content."""
        with pytest.raises(ValueError, match="empty"):
            DocumentProcessor.process_markdown_bytes(b"   ")

    def test_process_txt_bytes(self):
        """Test text bytes processing."""
        content = b"Plain text content"
        result = DocumentProcessor.process_txt_bytes(content)
        assert result == "Plain text content"

    def test_process_txt_bytes_empty(self):
        """Test text bytes processing with empty content."""
        with pytest.raises(ValueError, match="empty"):
            DocumentProcessor.process_txt_bytes(b"")

    def test_calculate_content_hash(self):
        """Test content hash calculation."""
        content = "Test content"
        hash1 = DocumentProcessor.calculate_content_hash(content)
        hash2 = DocumentProcessor.calculate_content_hash(content)
        hash3 = DocumentProcessor.calculate_content_hash("Different content")
        
        assert hash1 == hash2
        assert hash1 != hash3
        assert len(hash1) == 32  # MD5 hex digest length

    def test_supported_file_types(self):
        """Test that all expected file types are supported."""
        expected_types = {'pdf', 'docx', 'txt', 'md', 'json'}
        assert expected_types.issubset(SUPPORTED_FILE_TYPES)


class TestJsonProcessing:
    """Tests for JSON document processing."""

    def test_process_json_bytes_generic(self):
        """Test generic JSON processing."""
        data = {"key": "value", "number": 42}
        json_bytes = json.dumps(data).encode('utf-8')
        
        result = DocumentProcessor.process_json_bytes(json_bytes, "test")
        
        assert "# JSON Document: test" in result
        assert "key" in result
        assert "value" in result

    def test_process_json_bytes_list(self):
        """Test JSON list processing."""
        data = [1, 2, 3, "four"]
        json_bytes = json.dumps(data).encode('utf-8')
        
        result = DocumentProcessor.process_json_bytes(json_bytes, "list_doc")
        
        assert "Array" in result
        assert "Total Items: 4" in result

    def test_process_json_bytes_invalid(self):
        """Test invalid JSON handling."""
        with pytest.raises(ValueError, match="Invalid JSON"):
            DocumentProcessor.process_json_bytes(b"not valid json", "test")

    def test_is_shopify_product_true(self):
        """Test Shopify product detection - positive case."""
        product = {
            "id": "gid://shopify/Product/123",
            "title": "Test Product",
            "variants": [],
            "handle": "test-product",
        }
        assert DocumentProcessor._is_shopify_product(product) is True

    def test_is_shopify_product_false_no_id(self):
        """Test Shopify product detection - missing id."""
        product = {
            "title": "Test Product",
            "variants": [],
        }
        assert DocumentProcessor._is_shopify_product(product) is False

    def test_is_shopify_product_false_not_dict(self):
        """Test Shopify product detection - not a dict."""
        assert DocumentProcessor._is_shopify_product([]) is False
        assert DocumentProcessor._is_shopify_product("string") is False


class TestShopifyProductFormatter:
    """Tests for Shopify product markdown formatting."""

    def test_format_basic_product(self):
        """Test basic product formatting."""
        product = {
            "id": "gid://shopify/Product/123",
            "title": "Test Product",
            "description": "A great product",
        }
        
        result = ShopifyProductFormatter.format(product)
        
        assert "# Test Product" in result
        assert "Product ID" in result
        assert "A great product" in result

    def test_format_product_with_variants(self):
        """Test product with variants formatting."""
        product = {
            "id": "gid://shopify/Product/123",
            "title": "Test Product",
            "variants": [
                {"title": "Small", "price": "19.99", "sku": "SKU-S"},
                {"title": "Large", "price": "29.99", "sku": "SKU-L"},
            ],
        }
        
        result = ShopifyProductFormatter.format(product)
        
        assert "## Variants" in result
        assert "Small" in result
        assert "Large" in result
        assert "$19.99" in result
        assert "$29.99" in result
        assert "SKU-S" in result

    def test_format_product_with_pricing(self):
        """Test product pricing formatting."""
        product = {
            "id": "gid://shopify/Product/123",
            "title": "Test Product",
            "variants": [
                {"price": "10.00"},
                {"price": "20.00"},
            ],
        }
        
        result = ShopifyProductFormatter.format(product)
        
        assert "## Pricing" in result
        assert "$10.00 - $20.00" in result

    def test_format_product_strips_html(self):
        """Test that HTML is stripped from description."""
        product = {
            "id": "gid://shopify/Product/123",
            "title": "Test Product",
            "description": "<p>Bold <strong>text</strong></p>",
        }
        
        result = ShopifyProductFormatter.format(product)
        
        assert "<p>" not in result
        assert "<strong>" not in result
        assert "Bold text" in result

