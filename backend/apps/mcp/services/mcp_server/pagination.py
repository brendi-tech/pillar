"""
Cursor-based pagination for MCP list endpoints.

Implements opaque cursor encoding per the MCP pagination spec:
https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
"""
from __future__ import annotations

import base64
import json

DEFAULT_PAGE_SIZE = 200


def decode_cursor(cursor: str | None) -> int:
    """Decode an opaque cursor string to an integer offset.

    Returns 0 when cursor is None (first page).
    Raises ValueError for malformed cursors so the JSON-RPC handler
    maps it to error code -32602 (Invalid params).
    """
    if cursor is None:
        return 0
    try:
        payload = json.loads(base64.b64decode(cursor))
        offset = int(payload["o"])
        if offset < 0:
            raise ValueError("Cursor offset must be non-negative")
        return offset
    except Exception as exc:
        raise ValueError(f"Invalid pagination cursor: {exc}") from exc


def encode_cursor(offset: int) -> str:
    """Encode an integer offset as an opaque base64 cursor string."""
    return base64.b64encode(json.dumps({"o": offset}).encode()).decode()


def paginate_list(
    items: list,
    cursor: str | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list, str | None]:
    """Apply cursor-based pagination to an in-memory list.

    Returns (page_items, next_cursor). next_cursor is None when
    there are no more items.
    """
    offset = decode_cursor(cursor)
    page = items[offset: offset + page_size]
    next_cursor = encode_cursor(offset + page_size) if offset + page_size < len(items) else None
    return page, next_cursor
