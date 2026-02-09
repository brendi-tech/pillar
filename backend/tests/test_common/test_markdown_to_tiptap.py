"""
Tests for markdown to TipTap JSON converter.
"""

import pytest

from common.services.markdown_to_tiptap import (
    MarkdownToTipTapConverter,
    markdown_to_tiptap,
    markdown_to_tiptap_with_frontmatter,
)


class TestMarkdownToTipTapConverter:
    """Tests for MarkdownToTipTapConverter class."""

    @pytest.fixture
    def converter(self):
        return MarkdownToTipTapConverter()

    def test_empty_markdown(self, converter):
        """Empty markdown should return empty doc."""
        result = converter.convert("")
        assert result == {"type": "doc", "content": []}

    def test_whitespace_only(self, converter):
        """Whitespace-only markdown should return empty doc."""
        result = converter.convert("   \n\n   ")
        assert result == {"type": "doc", "content": []}

    def test_simple_paragraph(self, converter):
        """Simple text should become a paragraph."""
        result = converter.convert("Hello world")
        assert result["type"] == "doc"
        assert len(result["content"]) == 1
        assert result["content"][0]["type"] == "paragraph"
        assert result["content"][0]["content"][0]["text"] == "Hello world"

    def test_heading_levels(self, converter):
        """Test all heading levels."""
        for level in range(1, 7):
            result = converter.convert(f"{'#' * level} Heading {level}")
            assert result["content"][0]["type"] == "heading"
            assert result["content"][0]["attrs"]["level"] == level
            assert result["content"][0]["content"][0]["text"] == f"Heading {level}"

    def test_bold_text(self, converter):
        """Bold text should have bold mark."""
        result = converter.convert("This is **bold** text")
        paragraph = result["content"][0]
        # Find the bold text node
        bold_node = next(
            (n for n in paragraph["content"] if n.get("marks") and n["marks"][0]["type"] == "bold"),
            None,
        )
        assert bold_node is not None
        assert bold_node["text"] == "bold"

    def test_italic_text(self, converter):
        """Italic text should have italic mark."""
        result = converter.convert("This is *italic* text")
        paragraph = result["content"][0]
        italic_node = next(
            (
                n
                for n in paragraph["content"]
                if n.get("marks") and n["marks"][0]["type"] == "italic"
            ),
            None,
        )
        assert italic_node is not None
        assert italic_node["text"] == "italic"

    def test_inline_code(self, converter):
        """Inline code should have code mark."""
        result = converter.convert("Use `console.log()` for debugging")
        paragraph = result["content"][0]
        code_node = next(
            (n for n in paragraph["content"] if n.get("marks") and n["marks"][0]["type"] == "code"),
            None,
        )
        assert code_node is not None
        assert code_node["text"] == "console.log()"

    def test_code_block(self, converter):
        """Code block should become codeBlock node."""
        result = converter.convert("```python\nprint('hello')\n```")
        code_block = result["content"][0]
        assert code_block["type"] == "codeBlock"
        assert code_block["attrs"]["language"] == "python"
        assert code_block["content"][0]["text"] == "print('hello')"

    def test_code_block_no_language(self, converter):
        """Code block without language should have null language."""
        result = converter.convert("```\nsome code\n```")
        code_block = result["content"][0]
        assert code_block["type"] == "codeBlock"
        assert code_block["attrs"]["language"] is None

    def test_bullet_list(self, converter):
        """Bullet list should become bulletList node."""
        result = converter.convert("- Item 1\n- Item 2\n- Item 3")
        bullet_list = result["content"][0]
        assert bullet_list["type"] == "bulletList"
        assert len(bullet_list["content"]) == 3
        assert bullet_list["content"][0]["type"] == "listItem"

    def test_ordered_list(self, converter):
        """Ordered list should become orderedList node."""
        result = converter.convert("1. First\n2. Second\n3. Third")
        ordered_list = result["content"][0]
        assert ordered_list["type"] == "orderedList"
        assert len(ordered_list["content"]) == 3

    def test_blockquote(self, converter):
        """Blockquote should become blockquote node."""
        result = converter.convert("> This is a quote")
        blockquote = result["content"][0]
        assert blockquote["type"] == "blockquote"
        assert blockquote["content"][0]["type"] == "paragraph"

    def test_link(self, converter):
        """Links should have link mark with href."""
        result = converter.convert("[Click here](https://example.com)")
        paragraph = result["content"][0]
        link_node = next(
            (n for n in paragraph["content"] if n.get("marks") and n["marks"][0]["type"] == "link"),
            None,
        )
        assert link_node is not None
        assert link_node["text"] == "Click here"
        assert link_node["marks"][0]["attrs"]["href"] == "https://example.com"

    def test_image(self, converter):
        """Images should become image nodes."""
        result = converter.convert("![Alt text](https://example.com/image.png)")
        paragraph = result["content"][0]
        image_node = next((n for n in paragraph["content"] if n["type"] == "image"), None)
        assert image_node is not None
        assert image_node["attrs"]["src"] == "https://example.com/image.png"
        assert image_node["attrs"]["alt"] == "Alt text"

    def test_horizontal_rule(self, converter):
        """Horizontal rule should become horizontalRule node."""
        result = converter.convert("Above\n\n---\n\nBelow")
        hr_node = next((n for n in result["content"] if n["type"] == "horizontalRule"), None)
        assert hr_node is not None

    def test_strikethrough(self, converter):
        """Strikethrough should have strike mark."""
        result = converter.convert("This is ~~deleted~~ text")
        paragraph = result["content"][0]
        strike_node = next(
            (
                n
                for n in paragraph["content"]
                if n.get("marks") and n["marks"][0]["type"] == "strike"
            ),
            None,
        )
        assert strike_node is not None
        assert strike_node["text"] == "deleted"

    def test_nested_marks(self, converter):
        """Nested formatting should have multiple marks."""
        result = converter.convert("This is ***bold and italic***")
        paragraph = result["content"][0]
        nested_node = next(
            (n for n in paragraph["content"] if n.get("marks") and len(n["marks"]) == 2), None
        )
        assert nested_node is not None
        mark_types = {m["type"] for m in nested_node["marks"]}
        assert "bold" in mark_types
        assert "italic" in mark_types

    def test_table(self, converter):
        """Tables should become table nodes."""
        markdown = """| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |"""
        result = converter.convert(markdown)
        table = result["content"][0]
        assert table["type"] == "table"
        # Should have 3 rows (1 header + 2 body)
        assert len(table["content"]) == 3

    def test_complex_document(self, converter):
        """Test a complex document with multiple elements."""
        markdown = """# Welcome

This is a **paragraph** with *formatting*.

## Features

- Feature one
- Feature two
- Feature three

```javascript
const x = 1;
```

> A quote for wisdom

[Learn more](https://example.com)
"""
        result = converter.convert(markdown)
        assert result["type"] == "doc"
        # Should have multiple content nodes
        assert len(result["content"]) > 5

        # Check we have various node types
        node_types = {n["type"] for n in result["content"]}
        assert "heading" in node_types
        assert "paragraph" in node_types
        assert "bulletList" in node_types
        assert "codeBlock" in node_types
        assert "blockquote" in node_types


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""

    def test_markdown_to_tiptap(self):
        """Test the convenience function."""
        result = markdown_to_tiptap("# Hello")
        assert result["type"] == "doc"
        assert result["content"][0]["type"] == "heading"

    def test_markdown_to_tiptap_with_frontmatter(self):
        """Test conversion with YAML frontmatter."""
        markdown = """---
title: My Article
author: Test User
tags:
  - python
  - testing
---

# Article Content

This is the body.
"""
        tiptap_json, frontmatter = markdown_to_tiptap_with_frontmatter(markdown)

        # Check frontmatter was extracted
        assert frontmatter is not None
        assert frontmatter["title"] == "My Article"
        assert frontmatter["author"] == "Test User"
        assert "python" in frontmatter["tags"]

        # Check content was converted (frontmatter excluded)
        assert tiptap_json["type"] == "doc"
        assert tiptap_json["content"][0]["type"] == "heading"
        assert tiptap_json["content"][0]["content"][0]["text"] == "Article Content"

    def test_markdown_without_frontmatter(self):
        """Test that documents without frontmatter work correctly."""
        markdown = "# Just a heading\n\nAnd some text."
        tiptap_json, frontmatter = markdown_to_tiptap_with_frontmatter(markdown)

        assert frontmatter is None
        assert tiptap_json["type"] == "doc"
        assert tiptap_json["content"][0]["type"] == "heading"
