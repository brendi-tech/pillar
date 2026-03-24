"""
AgentMCPSource - through table for Agent <-> MCPToolSource.
AgentMCPToolOverride - per-agent, per-tool overrides.
"""
from django.db import models

from common.models.base import BaseModel


class AgentMCPSource(BaseModel):
    """Through table for Agent <-> MCPToolSource."""

    agent = models.ForeignKey(
        'products.Agent',
        on_delete=models.CASCADE,
        related_name='agent_mcp_configs',
    )
    mcp_source = models.ForeignKey(
        'tools.MCPToolSource',
        on_delete=models.CASCADE,
        related_name='agent_configs',
    )

    class Meta:
        verbose_name = 'Agent MCP Source Config'
        verbose_name_plural = 'Agent MCP Source Configs'
        constraints = [
            models.UniqueConstraint(
                fields=['agent', 'mcp_source'],
                name='agent_mcp_src_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['agent'],
                name='agentmcp_agent_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.agent.name} <-> {self.mcp_source.name}"


class AgentMCPToolOverride(BaseModel):
    """Per-agent, per-tool override for an MCP source.

    Nullable fields: None = use source default, True/False = override.
    """

    agent_mcp_source = models.ForeignKey(
        AgentMCPSource,
        on_delete=models.CASCADE,
        related_name='tool_overrides',
    )
    tool_name = models.CharField(max_length=255)
    is_enabled = models.BooleanField(null=True, blank=True)
    requires_confirmation = models.BooleanField(null=True, blank=True)

    class Meta:
        verbose_name = 'Agent MCP Tool Override'
        verbose_name_plural = 'Agent MCP Tool Overrides'
        constraints = [
            models.UniqueConstraint(
                fields=['agent_mcp_source', 'tool_name'],
                name='agent_mcp_tool_override_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['agent_mcp_source'],
                name='agentmcp_override_src_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.agent_mcp_source} / {self.tool_name}"
