"""Shared formatting utilities for channel integrations (Discord, Slack, etc.)."""

import json


def extract_confirm_success(result: dict) -> tuple[str, list[dict]]:
    """Extract a human-readable summary and action links from a tool_confirm response.

    Understands the structured ``ToolResult`` format (``summary``,
    ``data``, ``actions``) returned by the customer's handler.
    Falls back to a raw JSON dump when none of these fields are present.

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
        summary = raw_result if isinstance(raw_result, str) else json.dumps(raw_result, default=str)

    return summary, links
