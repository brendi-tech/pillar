"""Shared formatting utilities for channel integrations (Discord, Slack, etc.)."""

import json


def extract_confirm_success(result: dict) -> tuple[str, list[dict]]:
    """Extract a human-readable summary and action links from a tool_confirm response.

    Understands the structured ``ToolResult`` format (``summary``,
    ``data``, ``actions``) returned by the customer's handler.
    Falls back to a readable key-value format for raw API responses.

    Returns:
        (summary_text, links) where links is a list of
        ``{"label": str, "url": str}`` dicts.
    """
    raw_result = result.get('result', '')
    summary = None
    links: list[dict] = []

    if isinstance(raw_result, dict):
        summary = raw_result.get('summary')

        for action in raw_result.get('actions') or []:
            if action.get('type') == 'open_url' and action.get('url'):
                links.append({
                    "label": action.get('label', 'View'),
                    "url": action['url'],
                })

    if not summary:
        if isinstance(raw_result, str):
            summary = raw_result
        elif isinstance(raw_result, dict):
            summary = _summarize_dict(raw_result)
        else:
            summary = json.dumps(raw_result, default=str)

    return summary, links


MAX_SUMMARY_LEN = 2800


def _summarize_dict(data: dict) -> str:
    """Turn a raw API response dict into a readable key-value summary."""
    lines: list[str] = []
    for key, value in data.items():
        if key.startswith('_') or value is None:
            continue
        label = key.replace('_', ' ').replace('-', ' ').title()
        formatted = _format_summary_value(value)
        if '\n' in formatted:
            lines.append(f"*{label}:*\n{formatted}")
        else:
            lines.append(f"*{label}:* {formatted}")

    text = '\n'.join(lines)
    if len(text) > MAX_SUMMARY_LEN:
        text = text[:MAX_SUMMARY_LEN] + '\n_…truncated_'
    return text


def _format_summary_value(value: object) -> str:
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        parts = []
        for k, v in value.items():
            if v is None:
                continue
            parts.append(f"{k}: {_format_summary_value(v)}")
        return ', '.join(parts) if parts else '—'
    if isinstance(value, list):
        if not value:
            return '—'
        if all(isinstance(item, dict) for item in value):
            items = []
            for item in value[:10]:
                compact = ', '.join(
                    f"{k}: {_format_summary_value(v)}"
                    for k, v in item.items() if v is not None
                )
                items.append(f"  • {compact}")
            result = '\n'.join(items)
            if len(value) > 10:
                result += f'\n  _…and {len(value) - 10} more_'
            return result
        return ', '.join(_format_summary_value(item) for item in value[:10])
    return str(value)
