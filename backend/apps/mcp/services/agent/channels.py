"""
Channel constants for the omnichannel agent system.

Channels represent the communication surface through which a user
interacts with the agent. Each channel has different capabilities
(streaming support, rich formatting, client-side tool execution, etc.)
that are handled by channel-specific ResponseAdapters.
"""


class Channel:
    WEB = "web"
    SLACK = "slack"
    DISCORD = "discord"
    EMAIL = "email"
    API = "api"
    MCP = "mcp"
    WHATSAPP = "whatsapp"
    TEAMS = "teams"
    TELEGRAM = "telegram"
    SMS = "sms"

    ALL = [WEB, SLACK, DISCORD, EMAIL, API, MCP, WHATSAPP, TEAMS, TELEGRAM, SMS]

    CHANNEL_CHOICES = [(c, c.title()) for c in ALL]
