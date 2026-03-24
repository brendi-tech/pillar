"""
Discord message formatting utilities.

Handles embed construction, message splitting for Discord's limits,
confirmation button rendering, and markdown conversion.
"""
import json
import logging
import uuid as _uuid

from django.core.cache import cache

logger = logging.getLogger(__name__)

EMBED_DESCRIPTION_LIMIT = 4096
EMBED_TOTAL_LIMIT = 6000
EMBED_FIELDS_LIMIT = 25
PILLAR_BLURPLE = 0x5865F2
CONFIRM_PAYLOAD_REDIS_TTL = 3600


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


def build_confirmation_embed(
    tool_name: str,
    call_id: str,
    title: str,
    message: str,
    details: dict | None,
    confirm_payload: dict,
    conversation_id: str | None = None,
    thread_id: str = '',
    source_meta: dict | None = None,
) -> tuple[dict, list[dict]]:
    """
    Build a Discord embed + Action Row for tool confirmation.

    Returns (embed_dict, components_list).  The confirm payload is always
    stored in Redis because Discord's custom_id is limited to 100 chars
    (compared to Slack's 2000-char button value).
    """
    value_data = {
        "tool_name": tool_name,
        "call_id": call_id,
        "confirm_payload": confirm_payload,
    }
    if conversation_id:
        value_data["conversation_id"] = conversation_id
    if thread_id:
        value_data["thread_id"] = thread_id
    if source_meta:
        value_data["source_meta"] = source_meta

    ref_key = f"discord_confirm:{_uuid.uuid4().hex[:16]}"
    cache.set(ref_key, value_data, timeout=CONFIRM_PAYLOAD_REDIS_TTL)

    desc = f"➡️ **{title}**"
    if message:
        desc += f"\n{message}"
    embed: dict = {
        "description": desc[:EMBED_DESCRIPTION_LIMIT],
        "color": 0xFEE75C,
        "footer": {"text": "Powered by Pillar"},
    }

    if details and isinstance(details, dict):
        if 'method' in details and 'path' in details:
            method = str(details.get('method', '')).upper()
            path = str(details.get('path', ''))
            fields = [{"name": "Endpoint", "value": f"`{method} {path}`", "inline": False}]
            args = details.get('arguments')
            if args and isinstance(args, dict):
                arg_lines = [f"**{k}:** {v}" for k, v in args.items()]
                fields.append({
                    "name": "Arguments",
                    "value": '\n'.join(arg_lines)[:1024],
                    "inline": False,
                })
        else:
            fields = [
                {"name": str(k), "value": str(v)[:1024], "inline": True}
                for k, v in list(details.items())[:EMBED_FIELDS_LIMIT]
            ]
        embed["fields"] = fields

    components = [{
        "type": 1,
        "components": [
            {
                "type": 2,
                "style": 3,
                "label": "Confirm",
                "custom_id": f"pillar_confirm:{ref_key}",
            },
            {
                "type": 2,
                "style": 4,
                "label": "Cancel",
                "custom_id": f"pillar_cancel:{ref_key}",
            },
        ],
    }]

    return embed, components
