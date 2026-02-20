"""
Email content templates for user notifications.

Content is defined once using Markdown-style [text](url) links, then
rendered to both plain text and HTML by _to_plain_text() and _to_html().
"""
import re
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from apps.users.models import User

WELCOME_FROM_EMAIL = "JJ Maxwell <jmaxwell@trypillar.com>"
WELCOME_REPLY_TO = "jmaxwell@trypillar.com"

_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_OL_ITEM_RE = re.compile(r"^\d+\.\s+")

_LINK_COLOR = "hsl(27, 94%, 38%)"
_P_STYLE = 'style="margin: 0 0 16px 0; font-size: 15px;"'
_OL_STYLE = 'style="margin: 0 0 16px 0; padding-left: 20px; font-size: 15px;"'
_LI_STYLE = 'style="margin-bottom: 6px;"'


def _first_name(user: "User") -> str:
    """Extract first name from full_name, falling back to email prefix."""
    if user.full_name:
        return user.full_name.split()[0]
    return user.email.split("@")[0]


def _linkify(text: str) -> str:
    """Convert [text](url) to <a> tags."""
    return _LINK_RE.sub(
        lambda m: (
            f'<a href="{m.group(2)}" style="color: {_LINK_COLOR};'
            f' text-decoration: none;">{m.group(1)}</a>'
        ),
        text,
    )


def _to_plain_text(content: str) -> str:
    """Convert markup to plain text.

    List items: [text](url) -> text: url
    Elsewhere:  [text](url) -> text
    """
    lines = content.split("\n")
    result = []
    for line in lines:
        if _OL_ITEM_RE.match(line):
            result.append(_LINK_RE.sub(r"\1: \2", line))
        else:
            result.append(_LINK_RE.sub(r"\1", line))
    return "\n".join(result)


def _to_html(content: str) -> str:
    """Convert markup to minimal HTML email."""
    blocks = content.split("\n\n")
    html_parts = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.split("\n")

        if all(_OL_ITEM_RE.match(line) for line in lines):
            items = []
            for line in lines:
                text = _OL_ITEM_RE.sub("", line)
                text = _linkify(text)
                items.append(f"        <li {_LI_STYLE}>{text}</li>")
            html_parts.append(
                f"    <ol {_OL_STYLE}>\n" + "\n".join(items) + "\n    </ol>"
            )
        else:
            html_lines = [_linkify(line) for line in lines]
            text = "<br>\n        ".join(html_lines)
            html_parts.append(f"    <p {_P_STYLE}>{text}</p>")

    body = "\n\n".join(html_parts)

    return (
        '<!DOCTYPE html>\n<html>\n<head>\n'
        '    <meta charset="utf-8">\n'
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '</head>\n'
        '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\','
        " Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.7;"
        ' color: #1A1A1A; max-width: 560px; margin: 0 auto; padding: 40px 20px;">\n'
        f"{body}\n"
        "</body>\n</html>"
    )


# ---------------------------------------------------------------------------
# Welcome email
# ---------------------------------------------------------------------------

def _welcome_content(user: "User") -> str:
    """Welcome email body. Edit here — both plain text and HTML are derived."""
    admin_url = getattr(settings, "ADMIN_URL", "https://admin.trypillar.com")
    first_name = _first_name(user)

    return f"""\
Hey {first_name},

I'm JJ, cofounder and CEO of [Pillar](https://trypillar.com).

Pillar is your app's copilot, embedded in your product to execute real tasks for your users.

Here are 3 steps to get going:

1. [Set up your copilot]({admin_url}/setup)
2. [Register your frontend code as tools](https://trypillar.com/docs/guides/tools)
3. [See it working]({admin_url}/analytics/conversations)

What are you hoping to build with Pillar, and what's the first workflow you want to run inside your product?

Hit "Reply" and let me know — I read and reply to every email.

Cheers,
JJ"""


def welcome_email_subject() -> str:
    return "Welcome to Pillar!"


def welcome_email_plain_text(user: "User") -> str:
    return _to_plain_text(_welcome_content(user))


def welcome_email_html(user: "User") -> str:
    return _to_html(_welcome_content(user))
