"""
Canonical input models for the agentic loop.

AgentMessage normalizes input from any channel (web, Slack, Discord, etc.)
into a single dataclass that the agentic loop consumes. This replaces the
bag of kwargs that previously bloated the loop signature.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CallerContext:
    """Identity of the person asking, regardless of channel."""

    channel_user_id: str | None = None
    external_user_id: str | None = None
    email: str | None = None
    display_name: str | None = None
    user_profile: dict[str, Any] = field(default_factory=dict)

    @property
    def is_identified(self) -> bool:
        """Whether we have a customer-provided user ID for this caller."""
        return self.external_user_id is not None


@dataclass
class AgentMessage:
    """Canonical input to the agentic loop from any channel."""

    # Required
    text: str
    channel: str
    conversation_id: str
    product_id: str
    organization_id: str

    # Identity
    caller: CallerContext = field(default_factory=CallerContext)

    # Conversation context
    conversation_history: list[dict] = field(default_factory=list)
    registered_tools: list[dict] = field(default_factory=list)

    # Content
    images: list[dict[str, str]] = field(default_factory=list)
    language: str = "en"

    # Channel-specific context (web: page_url, DOM; Slack: thread_ts; etc.)
    channel_context: dict[str, Any] = field(default_factory=dict)

    # Agent execution metadata
    assistant_message_id: str | None = None
    session_id: str | None = None
    cancel_event: Any = None
    top_k: int = 10

    # SDK filtering
    platform: str | None = None
    version: str | None = None

    @property
    def page_url(self) -> str:
        """Convenience accessor for web channel."""
        return self.channel_context.get("page_url", "")

    @property
    def user_context(self) -> list[dict]:
        """Convenience accessor for web channel (DOM snapshots, highlighted text)."""
        return self.channel_context.get("user_context", [])

    @property
    def sdk_context(self) -> dict:
        """Convenience accessor for web channel (Pillar.setContext() data)."""
        return self.channel_context.get("sdk_context", {})
