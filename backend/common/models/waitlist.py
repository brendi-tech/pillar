"""
Waitlist entry model for marketing waitlist signups.

This model stores waitlist signups from the public marketing pages.
It is NOT tenant-aware since it captures pre-signup data before users
have an organization.
"""
from django.db import models

from common.models.base import BaseModel


class WaitlistEntry(BaseModel):
    """
    Stores waitlist signups from the marketing site.
    
    The signup flow is two-step:
    1. Email capture (required) - creates the entry
    2. Additional info (optional) - updates with name, company, use_case
    """
    
    # Step 1: Required field
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Email address of the waitlist signup"
    )
    
    # Step 2: Optional fields (collected on confirmation page)
    name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the person signing up"
    )
    company = models.CharField(
        max_length=255,
        blank=True,
        help_text="Company name"
    )
    use_case = models.TextField(
        blank=True,
        help_text="What they're hoping to accomplish with Pillar"
    )
    
    # How they heard about us
    HEARD_ABOUT_US_CHOICES = [
        ('google_search', 'Google Search'),
        ('linkedin', 'LinkedIn'),
        ('twitter', 'Twitter/X'),
        ('friend_colleague', 'Friend or Colleague'),
        ('blog_article', 'Blog or Article'),
        ('book_face', 'Bookface'),
        ('podcast', 'Podcast'),
        ('youtube', 'YouTube'),
        ('conference_event', 'Conference or Event'),
        ('hacker_news', 'Hacker News'),
        ('reddit', 'Reddit'),
        ('other', 'Other'),
    ]
    heard_about_us = models.CharField(
        max_length=100,
        blank=True,
        help_text="How the user heard about Pillar (from predefined list or custom)"
    )
    heard_about_us_other = models.CharField(
        max_length=255,
        blank=True,
        help_text="Custom text if heard_about_us is 'other'"
    )
    
    # Tracking fields
    referral_source = models.CharField(
        max_length=100,
        blank=True,
        help_text="UTM source or referral tracking"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address at signup time"
    )
    
    # Status tracking
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('invited', 'Invited'),
        ('converted', 'Converted to User'),
    ]
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True,
        help_text="Current status of the waitlist entry"
    )
    
    # Queue position for future referral mechanics
    queue_position = models.PositiveIntegerField(
        default=0,
        help_text="Position in the waitlist queue"
    )
    
    class Meta:
        verbose_name = "Waitlist Entry"
        verbose_name_plural = "Waitlist Entries"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email'], name='waitlist_email_idx'),
            models.Index(fields=['status', '-created_at'], name='waitlist_status_created_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.email} ({self.status})"
    
    def save(self, *args, **kwargs):
        """Auto-assign queue position on first save."""
        if not self.pk and self.queue_position == 0:
            # Get the highest queue position and add 1
            last_entry = WaitlistEntry.objects.order_by('-queue_position').first()
            self.queue_position = (last_entry.queue_position + 1) if last_entry else 1
        super().save(*args, **kwargs)
