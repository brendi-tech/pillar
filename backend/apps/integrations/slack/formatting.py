"""
Slack mrkdwn formatting utilities.

Converts standard Markdown (as produced by LLMs) to Slack's mrkdwn format,
splits long text into Block Kit sections that respect the 3000-char limit,
and builds source citation blocks and confirmation action blocks.
"""
import json
import logging
import re

from django.core.cache import cache

logger = logging.getLogger(__name__)

CONFIRM_PAYLOAD_REDIS_TTL = 3600  # 1 hour
SLACK_BUTTON_VALUE_LIMIT = 2000


def markdown_to_mrkdwn(text: str) -> str:
    """
    Convert standard Markdown to Slack's mrkdwn format.

    Handles: bold, italic, links, headings, lists, escaping.
    Preserves: code blocks (inline and fenced), blockquotes.
    """
    # Protect code blocks from conversion
    code_blocks: list[str] = []

    def _preserve_code(match: re.Match) -> str:
        code_blocks.append(match.group(0))
        return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

    text = re.sub(r'```[\s\S]*?```', _preserve_code, text)
    text = re.sub(r'`[^`]+`', _preserve_code, text)

    # Escape special characters (outside code blocks)
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')

    # Restore blockquote > (must come after escaping)
    text = re.sub(r'^&gt; ', '> ', text, flags=re.MULTILINE)

    # Links: [text](url) → <url|text>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<\2|\1>', text)

    # Bold: **text** → *text*  (must come before heading conversion)
    text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', text)

    # Headings: # Heading → *Heading* (bold as fallback, Slack has no native headings in section blocks)
    text = re.sub(r'^#{1,6}\s+(.+)$', r'*\1*', text, flags=re.MULTILINE)

    # Unordered lists: - item or * item → • item
    text = re.sub(r'^(\s*)[-*]\s+', r'\1• ', text, flags=re.MULTILINE)

    # Strikethrough: ~~text~~ → ~text~
    text = re.sub(r'~~(.+?)~~', r'~\1~', text)

    # Restore code blocks
    for i, block in enumerate(code_blocks):
        text = text.replace(f"__CODE_BLOCK_{i}__", block)

    return text


def split_text_into_blocks(mrkdwn_text: str, max_chars: int = 2900) -> list[dict]:
    """
    Split long mrkdwn text into multiple Block Kit section blocks.
    Each block has a 3000-char limit; we use 2900 to leave margin.

    Splits at paragraph boundaries when possible, falling back to
    line breaks, then word boundaries.
    """
    if len(mrkdwn_text) <= max_chars:
        return [{
            "type": "section",
            "text": {"type": "mrkdwn", "text": mrkdwn_text},
        }]

    blocks: list[dict] = []
    remaining = mrkdwn_text

    while remaining:
        if len(remaining) <= max_chars:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": remaining},
            })
            break

        split_at = remaining.rfind('\n\n', 0, max_chars)
        if split_at == -1 or split_at < max_chars // 2:
            split_at = remaining.rfind('\n', 0, max_chars)
        if split_at == -1 or split_at < max_chars // 2:
            split_at = remaining.rfind(' ', 0, max_chars)
        if split_at == -1:
            split_at = max_chars

        chunk = remaining[:split_at].rstrip()
        remaining = remaining[split_at:].lstrip()

        if chunk:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": chunk},
            })

    return blocks


def build_sources_block(sources: list[dict]) -> dict:
    """
    Build a Block Kit context block with source links.

    Sources from the agentic loop have {title, url, content} format.
    Context blocks support up to 10 elements.
    """
    source_parts: list[str] = []
    for source in sources[:10]:
        title = source.get('title', 'Source')
        url = source.get('url')
        if url:
            source_parts.append(f"<{url}|{title}>")
        else:
            source_parts.append(title)

    if not source_parts:
        return {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": " "}],
        }

    return {
        "type": "context",
        "elements": [
            {"type": "mrkdwn", "text": f":book: *Sources:* {' · '.join(source_parts)}"},
        ],
    }


def build_confirmation_blocks(
    tool_name: str,
    call_id: str,
    title: str,
    message: str,
    details: dict | None,
    confirm_payload: dict,
    conversation_id: str | None = None,
) -> list[dict]:
    """
    Build Block Kit blocks with Confirm/Cancel action buttons.

    Renders an optional title, message, key-value detail fields, and
    confirm/cancel buttons.  If the serialized payload exceeds Slack's
    2000-char button value limit, it is stored in Redis and referenced by key.
    """
    value_data = {
        "tool_name": tool_name,
        "call_id": call_id,
        "confirm_payload": confirm_payload,
    }
    if conversation_id:
        value_data["conversation_id"] = conversation_id
    serialized = json.dumps(value_data, separators=(",", ":"), default=str)

    if len(serialized) > SLACK_BUTTON_VALUE_LIMIT:
        import uuid as _uuid

        ref_key = f"slack_confirm:{_uuid.uuid4().hex}"
        cache.set(ref_key, value_data, timeout=CONFIRM_PAYLOAD_REDIS_TTL)
        serialized = json.dumps({"ref": ref_key}, separators=(",", ":"))
        logger.info(
            "[SLACK] Confirm payload too large (%d chars), stored as %s",
            len(serialized), ref_key,
        )

    blocks: list[dict] = [{"type": "divider"}]

    header_text = f":arrow_right: *{title}*"
    if message:
        header_text += f"\n{markdown_to_mrkdwn(message)}"
    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": header_text},
    })

    if details and isinstance(details, dict):
        fields = [
            {"type": "mrkdwn", "text": f"*{k}*\n{markdown_to_mrkdwn(str(v))}"}
            for k, v in details.items()
        ]
        for i in range(0, len(fields), 10):
            blocks.append({
                "type": "section",
                "fields": fields[i:i + 10],
            })

    blocks.append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Confirm"},
                "style": "primary",
                "action_id": f"confirm_tool:{call_id}",
                "value": serialized,
            },
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Cancel"},
                "style": "danger",
                "action_id": f"cancel_tool:{call_id}",
                "value": serialized,
            },
        ],
    })

    return blocks
