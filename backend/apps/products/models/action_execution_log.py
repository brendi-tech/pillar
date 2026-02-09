"""
ActionExecutionLog model - tracks action execution confirmations from SDK.

Logs individual execution attempts for debugging and analytics,
tracking whether customer implementations are working correctly.
"""
from django.db import models
from common.models.base import TenantAwareModel


class ActionExecutionLog(TenantAwareModel):
    """
    Log of action execution confirmations.

    Tracks individual execution attempts for debugging and analytics.
    Created when the SDK's confirmActionExecution() is called.
    """

    action = models.ForeignKey(
        'products.Action',
        on_delete=models.CASCADE,
        related_name='execution_logs',
        help_text="The action that was executed"
    )

    # Execution context
    session_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Widget session ID"
    )
    conversation_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Conversation where action was suggested"
    )

    # Result
    status = models.CharField(
        max_length=20,
        choices=[('success', 'Success'), ('failure', 'Failure')],
        help_text="Execution result status"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if failed"
    )
    duration_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Execution duration in milliseconds"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional execution metadata from SDK"
    )

    class Meta:
        # NO db_table - Django creates 'products_actionexecutionlog'
        verbose_name = 'Action Execution Log'
        verbose_name_plural = 'Action Execution Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.action.name} - {self.status} at {self.created_at}"
