"""
Document processing service for converting various formats to markdown.
Processes files entirely in-memory without temporary file storage.
"""
import hashlib
import io
import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# Maximum file size to process (100 MB)
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

# Supported file types
SUPPORTED_FILE_TYPES = {
    'pdf', 'docx', 'doc', 'md', 'markdown', 'txt',
    'json', 'pptx', 'ppt', 'xlsx', 'xls', 'csv',
    'html', 'htm', 'epub',
}


class DocumentProcessor:
    """
    Process various document types into markdown for indexing.
    All processing is done in-memory for efficiency and simplicity.
    """

    @staticmethod
    def _read_file_content(file_path: str) -> bytes:
        """
        Read file content from storage (local or cloud) into memory.

        Args:
            file_path: File path in Django storage

        Returns:
            bytes: File content

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is too large
        """
        # Check if file exists locally (for local development)
        if Path(file_path).exists():
            file_size = Path(file_path).stat().st_size
            if file_size > MAX_FILE_SIZE_BYTES:
                raise ValueError(
                    f"File too large: {file_size / (1024*1024):.1f} MB "
                    f"(max: {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB)"
                )
            with open(file_path, 'rb') as f:
                return f.read()

        # Read from Django storage (could be local or cloud)
        if not default_storage.exists(file_path):
            raise FileNotFoundError(f"File not found in storage: {file_path}")

        # Check file size in storage
        file_size = default_storage.size(file_path)
        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File too large: {file_size / (1024*1024):.1f} MB "
                f"(max: {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB)"
            )

        with default_storage.open(file_path, 'rb') as f:
            content = f.read()

        logger.debug(f"Read {len(content)} bytes from storage: {file_path}")
        return content

    @staticmethod
    def _read_bytes(file_bytes: bytes) -> bytes:
        """
        Validate and return file bytes.

        Args:
            file_bytes: Raw file bytes

        Returns:
            bytes: Validated file content

        Raises:
            ValueError: If file is too large or empty
        """
        if not file_bytes:
            raise ValueError("Empty file content provided")

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File too large: {len(file_bytes) / (1024*1024):.1f} MB "
                f"(max: {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB)"
            )

        return file_bytes

    @staticmethod
    def process_text(content: str) -> str:
        """Process plain text or markdown - already ready to index."""
        return content.strip()

    @staticmethod
    def process_pdf_bytes(file_bytes: bytes) -> str:
        """
        Extract text from PDF bytes using pypdf (in-memory processing).

        Args:
            file_bytes: PDF file content as bytes

        Returns:
            Extracted text content
        """
        try:
            import pypdf

            logger.info(f"Processing PDF bytes: {len(file_bytes)} bytes")

            # Create in-memory file object
            pdf_file = io.BytesIO(file_bytes)

            # Extract text from PDF
            pdf_reader = pypdf.PdfReader(pdf_file)
            text_parts = []

            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                if page_text.strip():
                    text_parts.append(f"## Page {i + 1}\n\n{page_text}")

            content = "\n\n".join(text_parts)

            if not content.strip():
                raise ValueError("No text could be extracted from PDF")

            logger.info(f"Successfully extracted {len(content)} chars from PDF")
            return content

        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")

    @staticmethod
    def process_pdf(file_path: str) -> str:
        """
        Extract text from PDF using pypdf (in-memory processing).

        Args:
            file_path: Path to PDF file (local or in storage)

        Returns:
            Extracted text content
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        return DocumentProcessor.process_pdf_bytes(file_content)

    @staticmethod
    def process_docx_bytes(file_bytes: bytes) -> str:
        """
        Extract text from Word document bytes using python-docx.

        Args:
            file_bytes: DOCX file content as bytes

        Returns:
            Extracted text content
        """
        try:
            import docx

            logger.info(f"Processing DOCX bytes: {len(file_bytes)} bytes")

            # Create in-memory file object
            docx_file = io.BytesIO(file_bytes)

            # Extract text from DOCX
            doc = docx.Document(docx_file)
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            content = "\n\n".join(paragraphs)

            if not content.strip():
                raise ValueError("No text could be extracted from DOCX")

            logger.info(f"Successfully extracted {len(content)} chars from DOCX")
            return content

        except Exception as e:
            logger.error(f"DOCX extraction failed: {e}")
            raise ValueError(f"Failed to extract text from Word document: {str(e)}")

    @staticmethod
    def process_docx(file_path: str) -> str:
        """
        Extract text from Word document using python-docx (in-memory processing).

        Args:
            file_path: Path to DOCX file (local or in storage)

        Returns:
            Extracted text content
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        return DocumentProcessor.process_docx_bytes(file_content)

    @staticmethod
    def process_markdown_bytes(file_bytes: bytes) -> str:
        """
        Process markdown file bytes.

        Args:
            file_bytes: Markdown file content as bytes

        Returns:
            File contents
        """
        try:
            content = file_bytes.decode('utf-8')

            if not content.strip():
                raise ValueError("Markdown file is empty")

            logger.info(f"Read {len(content)} chars from markdown bytes")
            return content

        except Exception as e:
            logger.error(f"Markdown file reading failed: {e}")
            raise ValueError(f"Failed to read markdown file: {str(e)}")

    @staticmethod
    def process_markdown(file_path: str) -> str:
        """
        Read markdown file (in-memory processing).

        Args:
            file_path: Path to markdown file (local or in storage)

        Returns:
            File contents
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        return DocumentProcessor.process_markdown_bytes(file_content)

    @staticmethod
    def process_txt_bytes(file_bytes: bytes) -> str:
        """
        Process plain text file bytes.

        Args:
            file_bytes: Text file content as bytes

        Returns:
            File contents
        """
        try:
            content = file_bytes.decode('utf-8')

            if not content.strip():
                raise ValueError("Text file is empty")

            logger.info(f"Read {len(content)} chars from text bytes")
            return content

        except Exception as e:
            logger.error(f"Text file reading failed: {e}")
            raise ValueError(f"Failed to read text file: {str(e)}")

    @staticmethod
    def process_txt(file_path: str) -> str:
        """
        Read plain text file (in-memory processing).

        Args:
            file_path: Path to text file (local or in storage)

        Returns:
            File contents
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        return DocumentProcessor.process_txt_bytes(file_content)

    @staticmethod
    def process_json_bytes(file_bytes: bytes, filename: str = "document") -> str:
        """
        Process JSON bytes and convert to RAG-optimized markdown.

        Args:
            file_bytes: JSON file content as bytes
            filename: Original filename for title

        Returns:
            Markdown-formatted content
        """
        try:
            logger.info(f"Processing JSON bytes: {len(file_bytes)} bytes")

            # Parse JSON
            try:
                data = json.loads(file_bytes.decode('utf-8'))
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON: {str(e)}")

            # Detect format and apply appropriate formatter
            if DocumentProcessor._is_shopify_product(data):
                logger.info("Detected Shopify product format")
                markdown_content = ShopifyProductFormatter.format(data)
            else:
                logger.info("Using generic JSON formatter")
                markdown_content = DocumentProcessor._format_generic_json(data, filename)

            if not markdown_content.strip():
                raise ValueError("JSON conversion resulted in empty content")

            logger.info(f"Successfully converted JSON to {len(markdown_content)} chars")
            return markdown_content

        except Exception as e:
            logger.error(f"JSON processing failed: {e}")
            raise ValueError(f"Failed to process JSON file: {str(e)}")

    @staticmethod
    def process_json(file_path: str) -> str:
        """
        Process JSON file and convert to RAG-optimized markdown.

        Args:
            file_path: Path to JSON file (local or in storage)

        Returns:
            Markdown-formatted content
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        filename = Path(file_path).stem
        return DocumentProcessor.process_json_bytes(file_content, filename)

    @staticmethod
    def _is_shopify_product(data: dict[str, Any]) -> bool:
        """
        Check if JSON data represents a Shopify product.

        Args:
            data: Parsed JSON data

        Returns:
            True if data matches Shopify product schema
        """
        if not isinstance(data, dict):
            return False

        # Check for Shopify product signature fields
        required_fields = {'id', 'title'}
        shopify_indicators = {'variants', 'handle', 'vendor', 'product_type'}

        has_required = all(field in data for field in required_fields)
        has_shopify_id = 'id' in data and isinstance(data.get('id'), str) and 'gid://shopify/Product/' in data.get('id', '')
        has_indicators = any(field in data for field in shopify_indicators)

        return has_required and (has_shopify_id or has_indicators)

    @staticmethod
    def _format_generic_json(data: Any, filename: str = "document") -> str:
        """
        Format generic JSON data as markdown.

        Args:
            data: Parsed JSON data (dict, list, or primitive)
            filename: Original filename for title

        Returns:
            Markdown-formatted content
        """
        lines = [f"# JSON Document: {filename}", ""]

        # Add summary
        lines.append("## Summary")
        if isinstance(data, dict):
            lines.append("- Document Type: Object")
            lines.append(f"- Total Keys: {len(data)}")
        elif isinstance(data, list):
            lines.append("- Document Type: Array")
            lines.append(f"- Total Items: {len(data)}")
        else:
            lines.append(f"- Document Type: {type(data).__name__}")
        lines.append("")

        # Format content
        lines.append("## Content")
        lines.append("")
        lines.extend(DocumentProcessor._format_json_value(data, level=0))

        return "\n".join(lines)

    @staticmethod
    def _format_json_value(value: Any, level: int = 0, key: str = None) -> list:
        """
        Recursively format JSON value as markdown lines.

        Args:
            value: JSON value to format
            level: Indentation level
            key: Key name (for dict items)

        Returns:
            List of markdown lines
        """
        lines = []
        indent = "  " * level

        if isinstance(value, dict):
            if key:
                lines.append(f"{indent}- **{key}**:")
            for k, v in value.items():
                lines.extend(DocumentProcessor._format_json_value(v, level + 1, k))
        elif isinstance(value, list):
            if key:
                lines.append(f"{indent}- **{key}**: ({len(value)} items)")
            for i, item in enumerate(value[:50]):  # Limit to first 50 items
                if isinstance(item, (dict, list)):
                    lines.append(f"{indent}  - Item {i + 1}:")
                    lines.extend(DocumentProcessor._format_json_value(item, level + 2))
                else:
                    lines.append(f"{indent}  - {item}")
            if len(value) > 50:
                lines.append(f"{indent}  - ... ({len(value) - 50} more items)")
        else:
            # Primitive value
            if key:
                lines.append(f"{indent}- **{key}**: {value}")
            else:
                lines.append(f"{indent}- {value}")

        return lines

    @staticmethod
    def process_with_docling_bytes(file_bytes: bytes, file_type: str) -> str:
        """
        Use LlamaIndex Docling for advanced document parsing.
        Handles: PDF, DOCX with better table/layout extraction.

        Args:
            file_bytes: File content as bytes
            file_type: File extension

        Returns:
            Extracted markdown content
        """
        try:
            # Try Docling first (better quality, but requires torch)
            try:
                from llama_index.readers.docling import DoclingReader

                logger.info(f"Processing {file_type} bytes with Docling")

                file_obj = io.BytesIO(file_bytes)

                reader = DoclingReader()
                documents = reader.load_data(file=file_obj, file_name=f"document.{file_type}")

                markdown_content = "\n\n".join([doc.text for doc in documents])
                logger.info(f"Successfully extracted {len(markdown_content)} chars with Docling")
                return markdown_content

            except ImportError:
                # Docling not available (likely due to torch), fall back to basic processor
                logger.warning("Docling not available, falling back to basic processor")
                if file_type == 'pdf':
                    return DocumentProcessor.process_pdf_bytes(file_bytes)
                elif file_type in ('docx', 'doc'):
                    return DocumentProcessor.process_docx_bytes(file_bytes)
                else:
                    raise ValueError(f"No fallback processor for {file_type}")

        except Exception as e:
            logger.error(f"Docling processing failed: {e}")
            raise ValueError(f"Failed to process with Docling: {str(e)}")

    @staticmethod
    def process_with_docling(file_path: str, file_type: str) -> str:
        """
        Use LlamaIndex Docling for advanced document parsing.

        Args:
            file_path: Path to file (local or in storage)
            file_type: File extension

        Returns:
            Extracted markdown content
        """
        file_content = DocumentProcessor._read_file_content(file_path)
        return DocumentProcessor.process_with_docling_bytes(file_content, file_type)

    @staticmethod
    def process_with_llamaindex(file_path: str) -> str:
        """
        Use SimpleDirectoryReader for document parsing.
        Handles: PDF, DOCX, PPTX, XLSX, CSV, EPUB, HTML, etc.

        Args:
            file_path: Path to file (local or in storage)

        Returns:
            Extracted text content
        """
        try:
            from llama_index.core import SimpleDirectoryReader

            logger.info(f"Processing with SimpleDirectoryReader: {file_path}")

            # SimpleDirectoryReader needs actual file path
            # For cloud storage, we need to save temporarily
            if not Path(file_path).exists():
                # File is in cloud storage, read and save temporarily
                file_content = DocumentProcessor._read_file_content(file_path)
                temp_path = f"/tmp/{Path(file_path).name}"
                with open(temp_path, 'wb') as f:
                    f.write(file_content)
                file_path = temp_path

            documents = SimpleDirectoryReader(input_files=[file_path]).load_data()
            markdown_content = "\n\n".join([doc.text for doc in documents])

            if not markdown_content.strip():
                raise ValueError("No content could be extracted from document")

            logger.info(f"Successfully extracted {len(markdown_content)} chars")
            return markdown_content

        except Exception as e:
            logger.error(f"LlamaIndex processing failed: {e}")
            raise ValueError(f"Failed to process file: {str(e)}")

    @classmethod
    def process_file(
        cls,
        file_path: str,
        file_type: Optional[str] = None
    ) -> tuple[str, int]:
        """
        Process a file and return (markdown_content, word_count).

        Args:
            file_path: Path to file to process
            file_type: File extension (pdf, docx, txt, md) or None to auto-detect

        Returns:
            Tuple of (markdown_content, word_count)

        Raises:
            ValueError: If file type unsupported or processing fails
        """
        # Auto-detect file type from extension if not provided
        if not file_type:
            file_type = Path(file_path).suffix.lower().lstrip('.')

        # Route to appropriate processor
        processors = {
            # Advanced parsing for PDFs and DOCX (tries Docling, falls back to basic)
            'pdf': lambda path: cls.process_with_docling(path, 'pdf'),
            'docx': lambda path: cls.process_with_docling(path, 'docx'),
            'doc': lambda path: cls.process_with_docling(path, 'doc'),

            # Simple text formats (keep existing lightweight processors)
            'md': cls.process_markdown,
            'markdown': cls.process_markdown,
            'txt': cls.process_txt,

            # JSON files (Shopify products and generic JSON)
            'json': cls.process_json,

            # Office formats via LlamaIndex
            'pptx': cls.process_with_llamaindex,
            'ppt': cls.process_with_llamaindex,
            'xlsx': cls.process_with_llamaindex,
            'xls': cls.process_with_llamaindex,
            'csv': cls.process_with_llamaindex,

            # Web and ebook formats
            'html': cls.process_with_llamaindex,
            'htm': cls.process_with_llamaindex,
            'epub': cls.process_with_llamaindex,
        }

        processor = processors.get(file_type)
        if not processor:
            raise ValueError(
                f"Unsupported file type: {file_type}. "
                f"Supported types: {', '.join(processors.keys())}"
            )

        # Process document
        markdown_content = processor(file_path)

        # Calculate word count
        word_count = len(markdown_content.split())

        logger.info(f"Processed {file_type} file: {word_count} words")
        return markdown_content, word_count

    @classmethod
    def process_bytes(
        cls,
        file_bytes: bytes,
        file_type: str,
        filename: str = "document"
    ) -> tuple[str, int]:
        """
        Process file bytes and return (markdown_content, word_count).

        Args:
            file_bytes: File content as bytes
            file_type: File extension (pdf, docx, txt, md)
            filename: Original filename (for JSON title)

        Returns:
            Tuple of (markdown_content, word_count)

        Raises:
            ValueError: If file type unsupported or processing fails
        """
        # Validate bytes
        cls._read_bytes(file_bytes)

        # Route to appropriate processor
        processors = {
            'pdf': lambda b: cls.process_with_docling_bytes(b, 'pdf'),
            'docx': lambda b: cls.process_with_docling_bytes(b, 'docx'),
            'doc': lambda b: cls.process_with_docling_bytes(b, 'doc'),
            'md': cls.process_markdown_bytes,
            'markdown': cls.process_markdown_bytes,
            'txt': cls.process_txt_bytes,
            'json': lambda b: cls.process_json_bytes(b, filename),
        }

        processor = processors.get(file_type)
        if not processor:
            raise ValueError(
                f"Unsupported file type for bytes processing: {file_type}. "
                f"Supported types: {', '.join(processors.keys())}"
            )

        # Process document
        markdown_content = processor(file_bytes)

        # Calculate word count
        word_count = len(markdown_content.split())

        logger.info(f"Processed {file_type} bytes: {word_count} words")
        return markdown_content, word_count

    @staticmethod
    def calculate_content_hash(content: str) -> str:
        """
        Calculate MD5 hash of content for change detection.

        Args:
            content: Text content to hash

        Returns:
            MD5 hash as hex string
        """
        return hashlib.md5(content.encode('utf-8')).hexdigest()


class ShopifyProductFormatter:
    """Formatter for Shopify product JSON to RAG-optimized markdown."""

    @staticmethod
    def format(product: dict[str, Any]) -> str:
        """
        Convert Shopify product JSON to semantic markdown.

        Args:
            product: Shopify product data

        Returns:
            Markdown-formatted product content
        """
        lines = []

        # Title
        title = product.get('title', 'Untitled Product')
        lines.append(f"# {title}")
        lines.append("")

        # Product metadata
        if product.get('id'):
            lines.append(f"**Product ID**: {product['id']}")
        if product.get('vendor'):
            lines.append(f"**Vendor**: {product['vendor']}")
        if product.get('product_type'):
            lines.append(f"**Type**: {product['product_type']}")
        if product.get('status'):
            lines.append(f"**Status**: {product['status']}")
        if product.get('tags'):
            tags = product['tags'] if isinstance(product['tags'], list) else []
            if tags:
                lines.append(f"**Tags**: {', '.join(tags)}")
        lines.append("")

        # Description
        description = product.get('description') or product.get('description_html', '')
        if description:
            lines.append("## Description")
            lines.append("")
            # Strip HTML tags if present
            description = re.sub(r'<[^>]+>', '', description)
            lines.append(description.strip())
            lines.append("")

        # Pricing
        variants = product.get('variants', [])
        if variants:
            lines.append("## Pricing")
            lines.append("")

            prices = []
            for variant in variants:
                if isinstance(variant, dict) and 'price' in variant:
                    try:
                        prices.append(float(variant['price']))
                    except (ValueError, TypeError):
                        pass

            if prices:
                min_price = min(prices)
                max_price = max(prices)
                if min_price == max_price:
                    lines.append(f"- Price: ${min_price:.2f}")
                else:
                    lines.append(f"- Price Range: ${min_price:.2f} - ${max_price:.2f}")
            lines.append("")

        # Variants
        if variants:
            lines.append("## Variants")
            lines.append("")

            for i, variant in enumerate(variants[:20], 1):  # Limit to 20 variants
                if not isinstance(variant, dict):
                    continue

                variant_title = variant.get('title', f'Variant {i}')
                sku = variant.get('sku', '')
                price = variant.get('price', '')
                inventory = variant.get('inventoryQuantity', '')
                available = variant.get('availableForSale', True)

                parts = [f"**{variant_title}**"]
                if sku:
                    parts.append(f"SKU: {sku}")
                if price:
                    parts.append(f"Price: ${price}")
                if inventory != '':
                    parts.append(f"Stock: {inventory} units")
                if not available:
                    parts.append("(Out of Stock)")

                lines.append(f"{i}. {' - '.join(parts)}")

            if len(variants) > 20:
                lines.append(f"... and {len(variants) - 20} more variants")
            lines.append("")

        # Product Options
        options = product.get('options', [])
        if options:
            lines.append("## Product Options")
            lines.append("")
            for option in options:
                if isinstance(option, dict):
                    name = option.get('name', '')
                    values = option.get('values', [])
                    if name and values:
                        lines.append(f"- **{name}**: {', '.join(map(str, values))}")
            lines.append("")

        # Images
        images = product.get('images', [])
        if images:
            lines.append("## Images")
            lines.append("")
            for i, image in enumerate(images[:10], 1):  # Limit to 10 images
                if isinstance(image, dict):
                    url = image.get('url', '')
                    alt_text = image.get('altText', '')
                    if url:
                        if alt_text:
                            lines.append(f"{i}. {alt_text}: {url}")
                        else:
                            lines.append(f"{i}. {url}")
            if len(images) > 10:
                lines.append(f"... and {len(images) - 10} more images")
            lines.append("")

        # Metadata
        lines.append("## Metadata")
        lines.append("")
        if product.get('handle'):
            lines.append(f"- Handle: {product['handle']}")
        if product.get('online_store_url'):
            lines.append(f"- Store URL: {product['online_store_url']}")
        if product.get('created_at'):
            lines.append(f"- Created: {product['created_at']}")
        if product.get('updated_at'):
            lines.append(f"- Updated: {product['updated_at']}")
        if product.get('published_at'):
            lines.append(f"- Published: {product['published_at']}")

        return "\n".join(lines)

