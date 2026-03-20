"""
Discord message formatting utilities.

Handles embed construction, message splitting for Discord's limits,
and markdown conversion.
"""

EMBED_DESCRIPTION_LIMIT = 4096
EMBED_TOTAL_LIMIT = 6000
EMBED_FIELDS_LIMIT = 25
PILLAR_BLURPLE = 0x5865F2


def build_response_embed(
    text: str,
    sources: list[dict] | None = None,
    color: int = PILLAR_BLURPLE,
) -> dict:
    """Build a Discord embed dict for an agent response."""
    description = text[:EMBED_DESCRIPTION_LIMIT]

    embed: dict = {
        "description": description,
        "color": color,
        "footer": {"text": "Powered by Pillar"},
    }

    if sources:
        source_lines = []
        for s in sources:
            title = s.get("title", "Source")
            url = s.get("url", "")
            if url:
                source_lines.append(f"[{title}]({url})")
            else:
                source_lines.append(title)

        embed["fields"] = [{
            "name": "Sources",
            "value": "\n".join(source_lines),
            "inline": False,
        }]

    return embed


def split_long_response(text: str, limit: int = 2000) -> list[str]:
    """Split a long message into chunks that fit Discord's message limit."""
    if len(text) <= limit:
        return [text]

    chunks = []
    while text:
        if len(text) <= limit:
            chunks.append(text)
            break

        split_at = text.rfind('\n', 0, limit)
        if split_at == -1:
            split_at = text.rfind(' ', 0, limit)
        if split_at == -1:
            split_at = limit

        chunks.append(text[:split_at])
        text = text[split_at:].lstrip()

    return chunks


def build_error_embed(message: str) -> dict:
    """Build an error embed."""
    return {
        "description": f"⚠️ {message}",
        "color": 0xED4245,
        "footer": {"text": "Powered by Pillar"},
    }
