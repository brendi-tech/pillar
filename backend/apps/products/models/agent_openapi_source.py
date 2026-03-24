"""
AgentOpenAPISource - through table for Agent <-> OpenAPIToolSource.
AgentOpenAPIOperationOverride - per-agent, per-operation overrides.
"""
from django.db import models

from common.models.base import BaseModel


class AgentOpenAPISource(BaseModel):
    """Through table for Agent <-> OpenAPIToolSource."""

    agent = models.ForeignKey(
        'products.Agent',
        on_delete=models.CASCADE,
        related_name='agent_openapi_configs',
    )
    openapi_source = models.ForeignKey(
        'tools.OpenAPIToolSource',
        on_delete=models.CASCADE,
        related_name='agent_configs',
    )

    class Meta:
        verbose_name = 'Agent OpenAPI Source Config'
        verbose_name_plural = 'Agent OpenAPI Source Configs'
        constraints = [
            models.UniqueConstraint(
                fields=['agent', 'openapi_source'],
                name='agent_openapi_src_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['agent'],
                name='agentopenapi_agent_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.agent.name} <-> {self.openapi_source.name}"


class AgentOpenAPIOperationOverride(BaseModel):
    """Per-agent, per-operation override for an OpenAPI source.

    Nullable fields: None = use source default, True/False = override.
    """

    agent_openapi_source = models.ForeignKey(
        AgentOpenAPISource,
        on_delete=models.CASCADE,
        related_name='operation_overrides',
    )
    tool_name = models.CharField(max_length=255)
    is_enabled = models.BooleanField(null=True, blank=True)
    requires_confirmation = models.BooleanField(null=True, blank=True)

    class Meta:
        verbose_name = 'Agent OpenAPI Operation Override'
        verbose_name_plural = 'Agent OpenAPI Operation Overrides'
        constraints = [
            models.UniqueConstraint(
                fields=['agent_openapi_source', 'tool_name'],
                name='agent_openapi_op_override_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['agent_openapi_source'],
                name='agentopapi_override_src_idx',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.agent_openapi_source} / {self.tool_name}"
