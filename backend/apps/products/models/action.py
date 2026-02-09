"""
Action model - publishable actions for the AI assistant to suggest.

This is NOT the same as InternalTask, which is for imported project management
tasks (Jira, Asana, etc.). Action represents actions that customers define
for the AI assistant to suggest to end users (e.g., "Invite Team Member",
"Open Billing Page", etc.).

Simplified model:
- Server defines: name, description, action_type, data payload
- SDK derives: presentation (label from name, icon from action_type)
- AI matching: semantic similarity via description_embedding
"""
from django.db import models
from pgvector.django import VectorField
from common.models.base import TenantAwareModel


class Action(TenantAwareModel):
    """
    Published action that the AI can suggest and the widget can execute.

    Actions are essentially custom MCP tools that the customer defines.
    The server stores the tool definition, the AI uses semantic matching
    on the description to determine when to suggest it, and the SDK
    handles execution and presentation.

    Example flow:
    1. User asks: "How do I invite a team member?"
    2. AI finds matching action via semantic similarity to description
    3. AI returns answer + action data: {name, action_type, data}
    4. SDK renders button (derives label from name, icon from action_type)
    5. User clicks, widget emits event: Pillar.on('action:execute', handler)
    6. Host app handles the action
    """

    class ActionType(models.TextChoices):
        """Types of actions an action can perform."""
        NAVIGATE = 'navigate', 'Navigate to Page'
        OPEN_MODAL = 'open_modal', 'Open Modal/Dialog'
        FILL_FORM = 'fill_form', 'Fill Form Fields'
        TRIGGER_ACTION = 'trigger_action', 'Trigger Custom Action'
        COPY_TEXT = 'copy_text', 'Copy to Clipboard'
        EXTERNAL_LINK = 'external_link', 'Open External Link'
        START_TUTORIAL = 'start_tutorial', 'Start Tutorial/Walkthrough'
        INLINE_UI = 'inline_ui', 'Inline UI Card'
        QUERY = 'query', 'Query Data'  # Fetch data from client and return to agent

    class Status(models.TextChoices):
        """Action publishing status."""
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    # === Relationships ===
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='actions',
        help_text="Product this action belongs to"
    )

    # === Identification ===
    name = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Unique action identifier (e.g., 'open_invite_flow'). "
                  "Used by SDK to identify the action and derive button label."
    )
    description = models.TextField(
        help_text="Description for AI to understand when to suggest this action. "
                  "Be specific about use cases. Used for semantic matching."
    )

    # === Semantic Matching ===
    description_embedding = VectorField(
        dimensions=1536,
        null=True,
        blank=True,
        help_text="Embedding vector for semantic matching against user queries"
    )

    examples = models.JSONField(
        default=list,
        blank=True,
        help_text="Example user queries that trigger this action (e.g., 'open settings', 'go to billing')"
    )

    example_embeddings = models.JSONField(
        default=list,
        blank=True,
        help_text="Embedding vectors for each example (list of 1536-dim vectors)"
    )

    # === Type & Configuration ===
    action_type = models.CharField(
        max_length=50,
        choices=ActionType.choices,
        default=ActionType.TRIGGER_ACTION,
        help_text="Type of action this action performs"
    )

    # For 'navigate' type
    path_template = models.CharField(
        max_length=500,
        blank=True,
        help_text="URL path template with {param} placeholders. "
                  "Example: /settings/team?action={action}"
    )

    # For 'external_link' type
    external_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text="External URL to open"
    )

    # === Data Payload ===
    data_schema = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON Schema defining the action's data payload"
    )
    default_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Default values for data payload"
    )
    parameter_examples = models.JSONField(
        default=list,
        blank=True,
        help_text="Examples of valid parameter objects for the LLM to reference. "
                  "Each example should have 'description' and 'parameters' fields."
    )

    # === Context Requirements ===
    required_context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Required context values (e.g., {'userRole': 'admin'})"
    )

    # === Execution Behavior ===
    auto_run = models.BooleanField(
        default=False,
        help_text="If True, action executes immediately when suggested by AI without requiring "
                  "user to click a button. Use for safe, reversible actions like navigation."
    )
    auto_complete = models.BooleanField(
        default=False,
        help_text="If True, action completes immediately after execution without waiting for "
                  "host app confirmation. Use for simple navigations and clipboard operations."
    )
    returns_data = models.BooleanField(
        default=False,
        help_text="If True, action returns data for the agent to use in further reasoning. "
                  "Handler must return a JSON-serializable object. Use for query/lookup actions."
    )

    # === Publishing ===
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    # === Analytics ===
    execution_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this action was executed"
    )
    last_executed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this action was last executed"
    )

    # === Implementation Tracking ===
    class ImplementationStatus(models.TextChoices):
        """Implementation verification status."""
        UNKNOWN = 'unknown', 'Unknown'
        VERIFIED = 'verified', 'Verified Working'
        FAILING = 'failing', 'Failing'
        STALE = 'stale', 'Stale (no recent confirmations)'

    implementation_status = models.CharField(
        max_length=20,
        choices=ImplementationStatus.choices,
        default=ImplementationStatus.UNKNOWN,
        db_index=True,
        help_text="Whether the client implementation is verified working"
    )
    confirmation_success_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of successful execution confirmations"
    )
    confirmation_failure_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of failed execution confirmations"
    )
    last_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When we last received an execution confirmation"
    )
    last_confirmation_status = models.CharField(
        max_length=20,
        blank=True,
        help_text="Status of last confirmation: 'success' or 'failure'"
    )
    last_confirmation_error = models.TextField(
        blank=True,
        help_text="Error message from last failed confirmation"
    )

    class Meta:
        # NO db_table - Django creates 'products_action'
        verbose_name = 'Action'
        verbose_name_plural = 'Actions'
        unique_together = [['organization', 'name']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['product', 'status']),
            models.Index(fields=['organization', 'name']),
            models.Index(fields=['organization', 'implementation_status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    def matches_context(self, context: dict) -> bool:
        """
        Check if user context matches required context for this action.

        Args:
            context: User's current product context

        Returns:
            True if context matches requirements or no requirements set
        """
        if not self.required_context:
            return True

        for key, required_value in self.required_context.items():
            actual_value = context.get(key)
            if isinstance(required_value, list):
                # Value must be in the list of allowed values
                if actual_value not in required_value:
                    return False
            elif actual_value != required_value:
                return False

        return True

    def get_execution_behavior(self) -> dict:
        """
        Get execution behavior for workflow steps, using smart defaults based on action_type.

        Returns:
            dict with 'auto_run' and 'auto_complete' booleans

        Smart defaults by action_type:
        - navigate, external_link, copy_text: auto_run=True, auto_complete=True (instant actions)
        - trigger_action: auto_run=False (potentially destructive, require user click)
        - open_modal, fill_form, start_tutorial: auto_run=False, wait for host confirmation
        """
        # Action types that auto-run (safe, instant actions)
        auto_run_types = {
            self.ActionType.NAVIGATE,
            self.ActionType.EXTERNAL_LINK,
            self.ActionType.COPY_TEXT,
        }

        # Action types that complete immediately (no host confirmation needed)
        auto_complete_types = {
            self.ActionType.NAVIGATE,
            self.ActionType.EXTERNAL_LINK,
            self.ActionType.COPY_TEXT,
        }

        # Use explicit field value if set to True, otherwise fall back to smart defaults
        effective_auto_run = (
            self.auto_run or self.action_type in auto_run_types
        )
        effective_auto_complete = (
            self.auto_complete or self.action_type in auto_complete_types
        )

        return {
            'auto_run': effective_auto_run,
            'auto_complete': effective_auto_complete,
        }

    def record_execution(self):
        """Record that this action was executed."""
        from django.utils import timezone
        self.execution_count += 1
        self.last_executed_at = timezone.now()
        self.save(update_fields=['execution_count', 'last_executed_at', 'updated_at'])

    def update_implementation_status(self):
        """Update implementation_status based on confirmation history."""
        from django.utils import timezone
        from datetime import timedelta

        if not self.last_confirmed_at:
            self.implementation_status = self.ImplementationStatus.UNKNOWN
        elif self.last_confirmed_at < timezone.now() - timedelta(days=30):
            self.implementation_status = self.ImplementationStatus.STALE
        elif self.last_confirmation_status == 'failure':
            self.implementation_status = self.ImplementationStatus.FAILING
        else:
            self.implementation_status = self.ImplementationStatus.VERIFIED

    def save(self, *args, **kwargs):
        """
        Override save to generate embeddings when description or examples change.

        The embeddings are used for semantic matching of user queries to actions.
        Uses sync embedding to work with Django's sync save() method.
        """
        import logging
        logger = logging.getLogger(__name__)

        # Check what changed (for existing objects)
        description_changed = True
        examples_changed = True
        if self.pk:
            try:
                old_instance = Action.objects.get(pk=self.pk)
                description_changed = old_instance.description != self.description
                examples_changed = old_instance.examples != self.examples
            except Action.DoesNotExist:
                pass

        try:
            from common.services.embedding_service import get_embedding_service
            service = get_embedding_service()

            # Generate description embedding if changed
            if description_changed and self.description:
                self.description_embedding = service.embed_document(self.description)

            # Generate example embeddings if changed
            if examples_changed and self.examples:
                self.example_embeddings = [
                    service.embed_document(ex) for ex in self.examples
                ]
            elif examples_changed and not self.examples:
                # Clear embeddings if examples were removed
                self.example_embeddings = []

        except Exception as e:
            # Log but don't fail the save - embeddings can be regenerated later
            logger.warning(f"Failed to generate embeddings for action {self.name}: {e}")

        super().save(*args, **kwargs)

    async def asave(self, *args, **kwargs):
        """
        Async save that generates embeddings when description or examples change.

        Uses async embedding service for better performance in async contexts.
        """
        import asyncio
        import logging
        logger = logging.getLogger(__name__)

        # Check what changed (for existing objects)
        description_changed = True
        examples_changed = True
        if self.pk:
            try:
                old_instance = await Action.objects.aget(pk=self.pk)
                description_changed = old_instance.description != self.description
                examples_changed = old_instance.examples != self.examples
            except Action.DoesNotExist:
                pass

        try:
            from common.services.embedding_service import get_embedding_service
            service = get_embedding_service()

            # Generate description embedding if changed
            if description_changed and self.description:
                self.description_embedding = await service.embed_document_async(
                    self.description
                )

            # Generate example embeddings if changed
            if examples_changed and self.examples:
                # Embed all examples in parallel
                self.example_embeddings = await asyncio.gather(*[
                    service.embed_document_async(ex) for ex in self.examples
                ])
            elif examples_changed and not self.examples:
                # Clear embeddings if examples were removed
                self.example_embeddings = []

        except Exception as e:
            # Log but don't fail the save - embeddings can be regenerated later
            logger.warning(f"Failed to generate embeddings for action {self.name}: {e}")

        await super().asave(*args, **kwargs)
