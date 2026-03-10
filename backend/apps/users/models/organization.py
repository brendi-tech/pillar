"""
Organization model for multi-tenancy.
"""
from django.db import models
from django.utils import timezone
from common.models import BaseModel


class Organization(BaseModel):
    """
    Organization model for multi-tenancy.
    Each organization represents a separate tenant with isolated data.
    """
    name = models.CharField(max_length=255)
    domain = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Primary domain for this organization (e.g., company.com)."
    )

    # Subscription/plan
    plan = models.CharField(
        max_length=50,
        choices=[
            ('free', 'Free'),
            ('hobby', 'Hobby'),
            ('pro', 'Pro'),
            ('growth', 'Growth'),
            ('enterprise', 'Enterprise'),
        ],
        default='free'
    )
    subscription_status = models.CharField(
        max_length=50,
        choices=[
            ('active', 'Active'),
            ('trialing', 'Trialing'),
            ('past_due', 'Past Due'),
            ('canceled', 'Canceled'),
            ('paused', 'Paused'),
        ],
        default='active'
    )
    trial_ends_at = models.DateTimeField(blank=True, null=True)
    billing_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Email address for billing communications"
    )
    stripe_customer_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text="Stripe Customer ID (cus_...)"
    )
    stripe_subscription_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Active Stripe Subscription ID (sub_...)"
    )
    stripe_price_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Current Stripe Price ID for the active subscription"
    )
    usage_alert_last_threshold = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Last usage threshold percentage notified (80 or 100). Reset each billing period."
    )
    onboarding_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when user completed the onboarding flow"
    )
    onboarding_current_step = models.PositiveSmallIntegerField(
        default=1,
        help_text="Current step in the onboarding wizard (1-7)"
    )

    # Settings
    settings = models.JSONField(default=dict, blank=True)

    # Members relationship
    members = models.ManyToManyField(
        'users.User',
        through='users.OrganizationMembership',
        through_fields=('organization', 'user'),
        related_name='organizations'
    )

    class Meta:
        db_table = 'users_organization'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        """Check if organization subscription is active."""
        return self.subscription_status in ['active', 'trialing']

    @property
    def is_trial(self):
        """Check if organization is in trial period."""
        if self.subscription_status == 'trialing' and self.trial_ends_at:
            return timezone.now() < self.trial_ends_at
        return False

    @property
    def active_bonus_responses(self) -> int:
        """Sum of all unexpired bonus response grants."""
        from apps.billing.models import BonusResponseGrant

        total = (
            BonusResponseGrant.objects.filter(organization=self)
            .active()
            .aggregate(total=models.Sum("amount"))["total"]
        )
        return total or 0
