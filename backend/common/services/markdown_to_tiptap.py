"""
Markdown to TipTap JSON Converter

Converts markdown content to TipTap/ProseMirror JSON format for storage in ArticleVersion.body_json.

TipTap uses ProseMirror's document model, which represents content as a tree of nodes.
This service parses markdown and builds the equivalent TipTap JSON structure.
"""

from __future__ import annotations

import re
from typing import Any

import mistune
from mistune import BaseRenderer, Markdown
from mistune.plugins.formatting import strikethrough
from mistune.plugins.table import table


class TipTapJSONRenderer(BaseRenderer):
    """
    Custom mistune renderer that outputs TipTap/ProseMirror JSON structure.
    """

    NAME = "tiptap"

    def __call__(self, tokens: list[dict], state: Any) -> dict:
        """Render tokens to TipTap document structure."""
        content = []
        for tok in tokens:
            node = self.render_token(tok, state)
            if node:
                if isinstance(node, list):
                    content.extend(node)
                else:
                    content.append(node)

        return {"type": "doc", "content": content}

    def render_token(self, token: dict, state: Any) -> dict | list | None:
        """Render a single token to TipTap node(s)."""
        func = self._get_method(token["type"])
        if func:
            return func(token, state)
        return None

    def _get_method(self, name: str):
        """Get renderer method by token type."""
        return getattr(self, name, None)

    # Block-level tokens

    def paragraph(self, token: dict, state: Any) -> dict:
        """Render paragraph node."""
        children = token.get("children", [])
        content = self._render_inline_children(children, state)
        return {"type": "paragraph", "content": content} if content else {"type": "paragraph"}

    def heading(self, token: dict, state: Any) -> dict:
        """Render heading node."""
        level = token.get("attrs", {}).get("level", 1)
        children = token.get("children", [])
        content = self._render_inline_children(children, state)
        node = {"type": "heading", "attrs": {"level": level}}
        if content:
            node["content"] = content
        return node

    def block_code(self, token: dict, state: Any) -> dict:
        """Render code block node."""
        raw = token.get("raw", "")
        info = token.get("attrs", {}).get("info", "")
        # Remove trailing newline if present
        if raw.endswith("\n"):
            raw = raw[:-1]
        node = {"type": "codeBlock", "attrs": {"language": info or None}}
        if raw:
            node["content"] = [{"type": "text", "text": raw}]
        return node

    def block_quote(self, token: dict, state: Any) -> dict:
        """Render blockquote node."""
        children = token.get("children", [])
        content = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                if isinstance(node, list):
                    content.extend(node)
                else:
                    content.append(node)
        return {"type": "blockquote", "content": content} if content else {"type": "blockquote"}

    def list(self, token: dict, state: Any) -> dict:
        """Render list node (ordered or bullet)."""
        ordered = token.get("attrs", {}).get("ordered", False)
        start = token.get("attrs", {}).get("start", 1)
        children = token.get("children", [])

        list_type = "orderedList" if ordered else "bulletList"
        content = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                content.append(node)

        result = {"type": list_type, "content": content}
        if ordered and start != 1:
            result["attrs"] = {"start": start}
        return result

    def list_item(self, token: dict, state: Any) -> dict:
        """Render list item node."""
        children = token.get("children", [])
        content = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                if isinstance(node, list):
                    content.extend(node)
                else:
                    content.append(node)
        return {"type": "listItem", "content": content} if content else {"type": "listItem"}

    def thematic_break(self, token: dict, state: Any) -> dict:
        """Render horizontal rule node."""
        return {"type": "horizontalRule"}

    def block_html(self, token: dict, state: Any) -> dict | None:
        """Handle raw HTML blocks - convert to paragraph with text."""
        raw = token.get("raw", "").strip()
        if not raw:
            return None
        # Store raw HTML as a paragraph (TipTap doesn't have native HTML block support)
        return {"type": "paragraph", "content": [{"type": "text", "text": raw}]}

    def block_text(self, token: dict, state: Any) -> dict:
        """Render block text (used in loose lists)."""
        children = token.get("children", [])
        content = self._render_inline_children(children, state)
        return {"type": "paragraph", "content": content} if content else {"type": "paragraph"}

    # Table support

    def table(self, token: dict, state: Any) -> dict:
        """Render table node."""
        children = token.get("children", [])
        content = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                if isinstance(node, list):
                    content.extend(node)
                else:
                    content.append(node)
        return {"type": "table", "content": content}

    def table_head(self, token: dict, state: Any) -> dict:
        """Render table head - wraps header cells in a tableRow."""
        children = token.get("children", [])
        cells = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                cells.append(node)
        # Wrap header cells in a single row
        return {"type": "tableRow", "content": cells} if cells else {"type": "tableRow"}

    def table_body(self, token: dict, state: Any) -> list[dict]:
        """Render table body - returns rows."""
        children = token.get("children", [])
        rows = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                rows.append(node)
        return rows

    def table_row(self, token: dict, state: Any) -> dict:
        """Render table row node."""
        children = token.get("children", [])
        content = []
        for child in children:
            node = self.render_token(child, state)
            if node:
                content.append(node)
        return {"type": "tableRow", "content": content}

    def table_cell(self, token: dict, state: Any) -> dict:
        """Render table cell node."""
        # mistune 3.x uses 'head' attribute, not 'is_head'
        is_head = token.get("attrs", {}).get("head", False)
        children = token.get("children", [])
        inline_content = self._render_inline_children(children, state)

        cell_type = "tableHeader" if is_head else "tableCell"
        # Wrap inline content in a paragraph (TipTap table cells contain block content)
        paragraph = (
            {"type": "paragraph", "content": inline_content}
            if inline_content
            else {"type": "paragraph"}
        )
        return {"type": cell_type, "content": [paragraph]}

    # Inline rendering helpers

    def _render_inline_children(self, children: list[dict], state: Any) -> list[dict]:
        """Render inline children to TipTap text nodes with marks."""
        result = []
        for child in children:
            nodes = self._render_inline(child, state)
            if nodes:
                result.extend(nodes)
        return result

    def _render_inline(self, token: dict, state: Any) -> list[dict]:
        """Render a single inline token."""
        token_type = token.get("type")

        if token_type == "text":
            raw = token.get("raw", "")
            if not raw:
                return []
            return [{"type": "text", "text": raw}]

        elif token_type == "emphasis":
            children = token.get("children", [])
            nodes = self._render_inline_children(children, state)
            return self._add_mark_to_nodes(nodes, {"type": "italic"})

        elif token_type == "strong":
            children = token.get("children", [])
            nodes = self._render_inline_children(children, state)
            return self._add_mark_to_nodes(nodes, {"type": "bold"})

        elif token_type == "codespan":
            raw = token.get("raw", "")
            if not raw:
                return []
            return [{"type": "text", "text": raw, "marks": [{"type": "code"}]}]

        elif token_type == "link":
            href = token.get("attrs", {}).get("url", "")
            title = token.get("attrs", {}).get("title")
            children = token.get("children", [])
            nodes = self._render_inline_children(children, state)
            mark = {"type": "link", "attrs": {"href": href}}
            if title:
                mark["attrs"]["title"] = title
            return self._add_mark_to_nodes(nodes, mark)

        elif token_type == "image":
            attrs = token.get("attrs", {})
            src = attrs.get("url", "")
            title = attrs.get("title")
            # Alt text is in children, not attrs in mistune 3.x
            children = token.get("children", [])
            alt = ""
            if children:
                alt_parts = []
                for child in children:
                    if child.get("type") == "text":
                        alt_parts.append(child.get("raw", ""))
                alt = "".join(alt_parts)
            node = {"type": "image", "attrs": {"src": src, "alt": alt}}
            if title:
                node["attrs"]["title"] = title
            return [node]

        elif token_type == "strikethrough":
            children = token.get("children", [])
            nodes = self._render_inline_children(children, state)
            return self._add_mark_to_nodes(nodes, {"type": "strike"})

        elif token_type == "linebreak":
            return [{"type": "hardBreak"}]

        elif token_type == "softbreak":
            # Soft breaks are typically just spaces or ignored
            return [{"type": "text", "text": " "}]

        elif token_type == "inline_html":
            raw = token.get("raw", "")
            if not raw:
                return []
            return [{"type": "text", "text": raw}]

        return []

    def _add_mark_to_nodes(self, nodes: list[dict], mark: dict) -> list[dict]:
        """Add a mark to all text nodes in the list."""
        result = []
        for node in nodes:
            if node.get("type") == "text":
                new_node = node.copy()
                existing_marks = new_node.get("marks", [])
                new_node["marks"] = existing_marks + [mark]
                result.append(new_node)
            else:
                # Non-text nodes (like images) pass through unchanged
                result.append(node)
        return result


class MarkdownToTipTapConverter:
    """
    Service for converting markdown strings to TipTap JSON documents.

    Usage:
        converter = MarkdownToTipTapConverter()
        tiptap_json = converter.convert("# Hello World")
    """

    def __init__(self):
        """Initialize the converter with mistune parser and TipTap renderer."""
        self.renderer = TipTapJSONRenderer()
        # Enable common extensions: strikethrough, tables, etc.
        self.parser = Markdown(renderer=self.renderer, plugins=[strikethrough, table])

    def convert(self, markdown: str) -> dict:
        """
        Convert markdown string to TipTap JSON document.

        Args:
            markdown: Markdown string to convert

        Returns:
            TipTap JSON document structure with type="doc" and content array
        """
        if not markdown or not markdown.strip():
            return {"type": "doc", "content": []}

        # Normalize line endings
        markdown = markdown.replace("\r\n", "\n").replace("\r", "\n")

        result = self.parser(markdown)
        return result

    def convert_with_frontmatter(self, markdown: str) -> tuple[dict, dict | None]:
        """
        Convert markdown with optional YAML frontmatter.

        Args:
            markdown: Markdown string potentially containing YAML frontmatter

        Returns:
            Tuple of (tiptap_json, frontmatter_dict or None)
        """
        frontmatter = None
        content = markdown

        # Check for YAML frontmatter (--- delimited)
        frontmatter_pattern = r"^---\s*\n(.*?)\n---\s*\n"
        match = re.match(frontmatter_pattern, markdown, re.DOTALL)

        if match:
            try:
                import yaml

                frontmatter_text = match.group(1)
                frontmatter = yaml.safe_load(frontmatter_text)
                content = markdown[match.end() :]
            except Exception:
                # If YAML parsing fails, treat as regular content
                pass

        return self.convert(content), frontmatter


# Singleton instance for convenience
_converter: MarkdownToTipTapConverter | None = None


def get_converter() -> MarkdownToTipTapConverter:
    """Get or create the singleton converter instance."""
    global _converter
    if _converter is None:
        _converter = MarkdownToTipTapConverter()
    return _converter


def markdown_to_tiptap(markdown: str) -> dict:
    """
    Convenience function to convert markdown to TipTap JSON.

    Args:
        markdown: Markdown string to convert

    Returns:
        TipTap JSON document structure
    """
    return get_converter().convert(markdown)


def markdown_to_tiptap_with_frontmatter(markdown: str) -> tuple[dict, dict | None]:
    """
    Convenience function to convert markdown with frontmatter to TipTap JSON.

    Args:
        markdown: Markdown string with optional YAML frontmatter

    Returns:
        Tuple of (tiptap_json, frontmatter_dict or None)
    """
    return get_converter().convert_with_frontmatter(markdown)
