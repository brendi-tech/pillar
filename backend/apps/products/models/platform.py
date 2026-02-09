"""
Platform model - product platforms for screenshot capture and content tagging.
"""
from django.db import models
from common.models.base import TenantAwareModel


class PlatformType(models.TextChoices):
    """Types of product platforms."""
    DESKTOP_WEB = 'desktop_web', 'Desktop Web'
    MOBILE_WEB = 'mobile_web', 'Mobile Web'
    IOS_APP = 'ios_app', 'iOS App'
    ANDROID_APP = 'android_app', 'Android App'
    DESKTOP_APP = 'desktop_app', 'Desktop App'


# Default viewport configurations for each platform type
DEFAULT_PLATFORM_VIEWPORTS = {
    'desktop_web': {'width': 1280, 'height': 720},
    'mobile_web': {'width': 390, 'height': 844},  # iPhone 14 Pro
    'ios_app': {'width': 390, 'height': 844},
    'android_app': {'width': 412, 'height': 915},  # Pixel 7
    'desktop_app': {'width': 1280, 'height': 720},
}


class Platform(TenantAwareModel):
    """
    Product platform for screenshot capture and content tagging.

    Each platform can have different scrape configurations and viewports.
    Follows the same pattern as Persona for future article tagging.
    """

    # Link to product instead of deprecated data_source
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='platforms',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Product this platform belongs to"
    )

    platform_type = models.CharField(
        max_length=20,
        choices=PlatformType.choices,
        help_text="Type of platform"
    )

    name = models.CharField(
        max_length=100,
        help_text="Display name (e.g., 'Desktop Web', 'Mobile App')"
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Is this platform active?"
    )

    # Platform-specific configuration
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Platform-specific configuration (viewport, user_agent, etc.)"
    )

    # Scrape settings (can override source defaults)
    scrape_cadence_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="How often to scrape this platform (hours). Null uses source default."
    )

    class Meta:
        # NO db_table - Django creates 'products_platform'
        verbose_name = 'Platform'
        verbose_name_plural = 'Platforms'
        unique_together = [['product', 'platform_type']]
        ordering = ['platform_type']
        indexes = [
            # Explicit name matching migration 0010 rename
            models.Index(fields=['product', 'is_active'], name='products_pl_product_00089a_idx'),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_platform_type_display()})"
    
    def get_viewport(self):
        """Get viewport for this platform, from config or defaults."""
        if self.config.get('viewport'):
            return self.config['viewport']
        return DEFAULT_PLATFORM_VIEWPORTS.get(self.platform_type, {'width': 1280, 'height': 720})
