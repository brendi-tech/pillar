"""
Tests for TipTap JSON to markdown converter.
"""

import pytest

from common.services.tiptap_to_markdown import (
    TipTapToMarkdownConverter,
    tiptap_to_markdown,
)


class TestTipTapToMarkdownConverter:
    """Tests for TipTapToMarkdownConverter class."""

    @pytest.fixture
    def converter(self):
        return TipTapToMarkdownConverter()

    def test_empty_doc(self, converter):
        """Empty doc should return empty string."""
        result = converter.convert({"type": "doc", "content": []})
        assert result == ""

    def test_none_input(self, converter):
        """None input should return empty string."""
        result = converter.convert(None)
        assert result == ""

    def test_invalid_type(self, converter):
        """Non-doc type should return empty string."""
        result = converter.convert({"type": "paragraph", "content": []})
        assert result == ""

    def test_simple_paragraph(self, converter):
        """Simple paragraph should render as text."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Hello world"}],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "Hello world"

    def test_multiple_paragraphs(self, converter):
        """Multiple paragraphs should be separated by double newlines."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "First paragraph"}],
                },
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Second paragraph"}],
                },
            ],
        }
        result = converter.convert(doc)
        assert result == "First paragraph\n\nSecond paragraph"

    def test_heading_levels(self, converter):
        """Test all heading levels."""
        for level in range(1, 7):
            doc = {
                "type": "doc",
                "content": [
                    {
                        "type": "heading",
                        "attrs": {"level": level},
                        "content": [{"type": "text", "text": f"Heading {level}"}],
                    }
                ],
            }
            result = converter.convert(doc)
            expected = f"{'#' * level} Heading {level}"
            assert result == expected

    def test_bold_text(self, converter):
        """Bold text should be wrapped in **."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "This is "},
                        {"type": "text", "text": "bold", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " text"},
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "This is **bold** text"

    def test_italic_text(self, converter):
        """Italic text should be wrapped in *."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "This is "},
                        {"type": "text", "text": "italic", "marks": [{"type": "italic"}]},
                        {"type": "text", "text": " text"},
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "This is *italic* text"

    def test_inline_code(self, converter):
        """Inline code should be wrapped in `."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Use "},
                        {"type": "text", "text": "console.log()", "marks": [{"type": "code"}]},
                        {"type": "text", "text": " for debugging"},
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "Use `console.log()` for debugging"

    def test_strikethrough(self, converter):
        """Strikethrough text should be wrapped in ~~."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "This is "},
                        {"type": "text", "text": "deleted", "marks": [{"type": "strike"}]},
                        {"type": "text", "text": " text"},
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "This is ~~deleted~~ text"

    def test_link(self, converter):
        """Links should render as markdown links."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "Click here",
                            "marks": [{"type": "link", "attrs": {"href": "https://example.com"}}],
                        }
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "[Click here](https://example.com)"

    def test_link_with_title(self, converter):
        """Links with titles should include the title."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "Click here",
                            "marks": [
                                {
                                    "type": "link",
                                    "attrs": {"href": "https://example.com", "title": "Example Site"},
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == '[Click here](https://example.com "Example Site")'

    def test_code_block(self, converter):
        """Code block should render with fenced code."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "codeBlock",
                    "attrs": {"language": "python"},
                    "content": [{"type": "text", "text": "print('hello')"}],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "```python\nprint('hello')\n```"

    def test_code_block_no_language(self, converter):
        """Code block without language should have empty language."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "codeBlock",
                    "attrs": {"language": None},
                    "content": [{"type": "text", "text": "some code"}],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "```\nsome code\n```"

    def test_bullet_list(self, converter):
        """Bullet list should render with - prefix."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "bulletList",
                    "content": [
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Item 1"}],
                                }
                            ],
                        },
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Item 2"}],
                                }
                            ],
                        },
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "- Item 1\n- Item 2"

    def test_ordered_list(self, converter):
        """Ordered list should render with numbered prefix."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "orderedList",
                    "content": [
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "First"}],
                                }
                            ],
                        },
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Second"}],
                                }
                            ],
                        },
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "1. First\n2. Second"

    def test_blockquote(self, converter):
        """Blockquote should render with > prefix."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "blockquote",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "This is a quote"}],
                        }
                    ],
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "> This is a quote"

    def test_horizontal_rule(self, converter):
        """Horizontal rule should render as ---."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Above"}],
                },
                {"type": "horizontalRule"},
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Below"}],
                },
            ],
        }
        result = converter.convert(doc)
        assert result == "Above\n\n---\n\nBelow"

    def test_image(self, converter):
        """Image should render as markdown image."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "image",
                    "attrs": {"src": "https://example.com/image.png", "alt": "Alt text"},
                }
            ],
        }
        result = converter.convert(doc)
        assert result == "![Alt text](https://example.com/image.png)"


class TestConvenienceFunction:
    """Tests for module-level convenience function."""

    def test_tiptap_to_markdown(self):
        """Test the convenience function."""
        doc = {
            "type": "doc",
            "content": [
                {
                    "type": "heading",
                    "attrs": {"level": 1},
                    "content": [{"type": "text", "text": "Hello"}],
                }
            ],
        }
        result = tiptap_to_markdown(doc)
        assert result == "# Hello"


class TestRoundTrip:
    """Test round-trip conversion markdown -> tiptap -> markdown."""

    def test_simple_roundtrip(self):
        """Test that simple content survives round-trip."""
        from common.services.markdown_to_tiptap import markdown_to_tiptap

        original = "# Hello World\n\nThis is a paragraph."
        tiptap = markdown_to_tiptap(original)
        back = tiptap_to_markdown(tiptap)

        # Should have the same structure (may differ in whitespace)
        assert "# Hello World" in back
        assert "This is a paragraph" in back
