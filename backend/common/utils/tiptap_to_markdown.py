"""
TipTap JSON to Markdown Converter

Converts TipTap/ProseMirror JSON format to markdown for RAG indexing.

TipTap uses ProseMirror's document model, which represents content as a tree of nodes.
This service traverses the tree and builds equivalent markdown.
"""

from __future__ import annotations

from typing import Any


class TipTapToMarkdownConverter:
    """
    Service for converting TipTap JSON documents to markdown strings.

    Usage:
        converter = TipTapToMarkdownConverter()
        markdown = converter.convert(tiptap_json)
    """

    def convert(self, doc: dict) -> str:
        """
        Convert TipTap JSON document to markdown string.

        Args:
            doc: TipTap JSON document with type="doc" and content array

        Returns:
            Markdown string
        """
        if not doc or doc.get("type") != "doc":
            return ""

        content = doc.get("content", [])
        if not content:
            return ""

        parts = []
        for node in content:
            rendered = self._render_node(node)
            if rendered is not None:
                parts.append(rendered)

        return "\n\n".join(parts)

    def _render_node(self, node: dict) -> str | None:
        """Render a single block node to markdown."""
        node_type = node.get("type")

        if node_type == "paragraph":
            return self._render_paragraph(node)
        elif node_type == "heading":
            return self._render_heading(node)
        elif node_type == "codeBlock":
            return self._render_code_block(node)
        elif node_type == "blockquote":
            return self._render_blockquote(node)
        elif node_type == "bulletList":
            return self._render_bullet_list(node)
        elif node_type == "orderedList":
            return self._render_ordered_list(node)
        elif node_type == "horizontalRule":
            return "---"
        elif node_type == "table":
            return self._render_table(node)
        elif node_type == "image":
            return self._render_image(node)
        elif node_type == "hardBreak":
            return ""

        # Unknown node type - try to extract text content
        return self._extract_text(node)

    def _render_paragraph(self, node: dict) -> str:
        """Render paragraph to markdown."""
        content = node.get("content", [])
        return self._render_inline_content(content)

    def _render_heading(self, node: dict) -> str:
        """Render heading to markdown."""
        level = node.get("attrs", {}).get("level", 1)
        content = node.get("content", [])
        text = self._render_inline_content(content)
        prefix = "#" * level
        return f"{prefix} {text}"

    def _render_code_block(self, node: dict) -> str:
        """Render code block to markdown."""
        language = node.get("attrs", {}).get("language") or ""
        content = node.get("content", [])

        # Extract text from content
        code = ""
        for child in content:
            if child.get("type") == "text":
                code += child.get("text", "")

        return f"```{language}\n{code}\n```"

    def _render_blockquote(self, node: dict) -> str:
        """Render blockquote to markdown."""
        content = node.get("content", [])
        lines = []

        for child in content:
            rendered = self._render_node(child)
            if rendered:
                # Prefix each line with >
                for line in rendered.split("\n"):
                    lines.append(f"> {line}")

        return "\n".join(lines)

    def _render_bullet_list(self, node: dict) -> str:
        """Render bullet list to markdown."""
        content = node.get("content", [])
        items = []

        for item in content:
            if item.get("type") == "listItem":
                rendered = self._render_list_item(item, bullet="- ")
                items.append(rendered)

        return "\n".join(items)

    def _render_ordered_list(self, node: dict) -> str:
        """Render ordered list to markdown."""
        content = node.get("content", [])
        start = node.get("attrs", {}).get("start", 1)
        items = []

        for i, item in enumerate(content):
            if item.get("type") == "listItem":
                num = start + i
                rendered = self._render_list_item(item, bullet=f"{num}. ")
                items.append(rendered)

        return "\n".join(items)

    def _render_list_item(self, node: dict, bullet: str = "- ") -> str:
        """Render list item to markdown."""
        content = node.get("content", [])
        parts = []

        for child in content:
            rendered = self._render_node(child)
            if rendered:
                parts.append(rendered)

        if not parts:
            return bullet.rstrip()

        # First line gets the bullet, subsequent lines get indented
        text = parts[0]
        lines = text.split("\n")
        result = [f"{bullet}{lines[0]}"]

        # Indent continuation lines
        indent = " " * len(bullet)
        for line in lines[1:]:
            result.append(f"{indent}{line}")

        # Handle nested content (multiple block elements in list item)
        for part in parts[1:]:
            for line in part.split("\n"):
                result.append(f"{indent}{line}")

        return "\n".join(result)

    def _render_table(self, node: dict) -> str:
        """Render table to markdown."""
        content = node.get("content", [])
        rows = []
        header_row = None

        for row in content:
            if row.get("type") == "tableRow":
                cells = row.get("content", [])
                cell_texts = []
                is_header = False

                for cell in cells:
                    cell_type = cell.get("type")
                    if cell_type == "tableHeader":
                        is_header = True
                    cell_content = cell.get("content", [])
                    # Extract text from cell (usually wrapped in paragraph)
                    text = ""
                    for block in cell_content:
                        text += self._render_node(block) or ""
                    # Escape pipes in cell content
                    text = text.replace("|", "\\|")
                    cell_texts.append(text.strip())

                row_text = "| " + " | ".join(cell_texts) + " |"
                rows.append(row_text)

                # Add separator after header row
                if is_header and header_row is None:
                    header_row = len(rows) - 1
                    separator = "| " + " | ".join(["---"] * len(cell_texts)) + " |"
                    rows.append(separator)

        return "\n".join(rows)

    def _render_image(self, node: dict) -> str:
        """Render image to markdown."""
        attrs = node.get("attrs", {})
        src = attrs.get("src", "")
        alt = attrs.get("alt", "")
        title = attrs.get("title")

        if title:
            return f'![{alt}]({src} "{title}")'
        return f"![{alt}]({src})"

    def _render_inline_content(self, content: list[dict]) -> str:
        """Render inline content (text nodes with marks) to markdown."""
        parts = []

        for node in content:
            node_type = node.get("type")

            if node_type == "text":
                text = node.get("text", "")
                marks = node.get("marks", [])
                parts.append(self._apply_marks(text, marks))
            elif node_type == "hardBreak":
                parts.append("  \n")  # Two spaces + newline for hard break
            elif node_type == "image":
                parts.append(self._render_image(node))

        return "".join(parts)

    def _apply_marks(self, text: str, marks: list[dict]) -> str:
        """Apply marks (bold, italic, code, link, strike) to text."""
        if not marks:
            return text

        result = text

        # Sort marks to ensure consistent nesting (innermost first)
        # Order: code, then others
        mark_order = {"code": 0, "bold": 1, "italic": 2, "strike": 3, "link": 4}
        sorted_marks = sorted(marks, key=lambda m: mark_order.get(m.get("type"), 99))

        for mark in sorted_marks:
            mark_type = mark.get("type")

            if mark_type == "bold":
                result = f"**{result}**"
            elif mark_type == "italic":
                result = f"*{result}*"
            elif mark_type == "code":
                result = f"`{result}`"
            elif mark_type == "strike":
                result = f"~~{result}~~"
            elif mark_type == "link":
                href = mark.get("attrs", {}).get("href", "")
                title = mark.get("attrs", {}).get("title")
                if title:
                    result = f'[{result}]({href} "{title}")'
                else:
                    result = f"[{result}]({href})"

        return result

    def _extract_text(self, node: dict) -> str | None:
        """Extract plain text from any node (fallback)."""
        if node.get("type") == "text":
            return node.get("text", "")

        content = node.get("content", [])
        if not content:
            return None

        parts = []
        for child in content:
            text = self._extract_text(child)
            if text:
                parts.append(text)

        return " ".join(parts) if parts else None


# Singleton instance for convenience
_converter: TipTapToMarkdownConverter | None = None


def get_converter() -> TipTapToMarkdownConverter:
    """Get or create the singleton converter instance."""
    global _converter
    if _converter is None:
        _converter = TipTapToMarkdownConverter()
    return _converter


def tiptap_to_markdown(doc: dict) -> str:
    """
    Convenience function to convert TipTap JSON to markdown.

    Args:
        doc: TipTap JSON document with type="doc" and content array

    Returns:
        Markdown string
    """
    return get_converter().convert(doc)
