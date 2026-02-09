"""
ActionDeployment model - versioned snapshots of actions for specific platforms.

This model enables code-first action definitions by linking a platform/version
combination to a set of actions. The MCP server queries actions through this
model to ensure version compatibility between the client SDK and available actions.
"""
from django.db import models
from common.models.base import TenantAwareModel


class DeploymentPlatform(models.TextChoices):
    """Platforms that can have action deployments."""
    WEB = 'web', 'Web'
    IOS = 'ios', 'iOS'
    ANDROID = 'android', 'Android'
    DESKTOP = 'desktop', 'Desktop'


class ActionDeployment(TenantAwareModel):
    """
    A versioned snapshot of actions for a specific platform.

    Each deployment represents a specific version of the client app
    and the actions it supports. The MCP server queries actions
    through this model to ensure version compatibility.

    Flow:
    1. Client app defines actions in code
    2. CI/CD extracts action manifest and syncs to server
    3. Server creates ActionDeployment linking platform+version to actions
    4. At runtime, SDK sends platform/version headers
    5. MCP server queries actions through matching deployment
    """

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='action_deployments',
        help_text="Product this deployment belongs to"
    )

    # === Platform & Version ===
    platform = models.CharField(
        max_length=20,
        choices=DeploymentPlatform.choices,
        db_index=True,
        help_text="Platform this deployment is for (web, ios, android, desktop)"
    )
    version = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Semantic version or git SHA (e.g., '1.2.3' or 'abc123')"
    )

    # === Actions ===
    actions = models.ManyToManyField(
        'products.Action',
        related_name='deployments',
        blank=True,
        help_text="Actions available in this deployment"
    )

    # === Status ===
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this deployment is accepting requests"
    )

    # === Metadata ===
    deployed_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this deployment was created"
    )
    deployed_by = models.CharField(
        max_length=100,
        blank=True,
        help_text="CI/CD pipeline or user that created this deployment"
    )

    # === Source Tracking ===
    git_sha = models.CharField(
        max_length=40,
        blank=True,
        help_text="Git commit SHA for this deployment"
    )
    manifest_hash = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="SHA256 hash of the action manifest for deduplication"
    )

    class Meta:
        # NO db_table - Django creates 'products_actiondeployment'
        verbose_name = 'Action Deployment'
        verbose_name_plural = 'Action Deployments'
        unique_together = [['product', 'platform', 'version']]
        ordering = ['-deployed_at']
        indexes = [
            models.Index(fields=['product', 'platform', 'is_active']),
            models.Index(fields=['organization', 'platform', 'is_active']),
        ]

    def __str__(self):
        return f"{self.platform}@{self.version} ({self.product.subdomain})"

    @property
    def action_count(self) -> int:
        """Get the number of actions in this deployment."""
        return self.actions.count()
