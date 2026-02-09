"""
Base provider interface for knowledge source providers.

All providers inherit from BaseProvider and implement:
- validate_config(): Verify source configuration is valid
- fetch_items(): Fetch content from the source
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from apps.knowledge.models import KnowledgeSource, KnowledgeItem


@dataclass
class RawItem:
    """
    Raw content fetched from a provider before processing.

    This is the common format that all providers output.
    The sync workflow converts RawItems to KnowledgeItems.
    """

    external_id: str
    """Unique identifier in the source system (URL hash, article ID, etag, etc.)"""

    title: str
    """Content title"""

    raw_content: str
    """Raw content as markdown/text"""

    url: Optional[str] = None
    """Source URL if applicable (None for uploaded documents)"""

    metadata: dict = field(default_factory=dict)
    """Provider-specific metadata (platform, categories, file info, etc.)"""


@dataclass
class ValidationResult:
    """Result of validating source configuration."""

    valid: bool
    """Whether the configuration is valid and usable"""

    error: Optional[str] = None
    """Error message if validation failed"""


class BaseProvider(ABC):
    """
    Abstract base class for knowledge source providers.

    Each provider handles:
    1. Validating source configuration (credentials, URLs, etc.)
    2. Fetching items from the source
    3. Converting to RawItem format for the sync workflow

    The sync workflow handles:
    - Creating/updating KnowledgeItems from RawItems
    - Change detection (content hash comparison)
    - Queuing items for processing

    Usage:
        provider = get_provider(source)
        validation = await provider.validate_config(source)
        if validation.valid:
            items = await provider.fetch_items(source)
    """

    @property
    @abstractmethod
    def source_type(self) -> str:
        """
        Return the SourceType this provider handles.

        Must match a value from KnowledgeSource.SourceType choices.
        """
        ...

    @abstractmethod
    async def validate_config(self, source: "KnowledgeSource") -> ValidationResult:
        """
        Validate source configuration before sync.

        Called:
        - Before creating a new source (to verify credentials)
        - Before each sync (to verify access is still valid)

        Args:
            source: KnowledgeSource with configuration to validate

        Returns:
            ValidationResult with valid=True if config is usable,
            or valid=False with error message if not.

        Examples:
            - Check API credentials are valid
            - Verify bucket access
            - Test OAuth connection is not expired
        """
        ...

    @abstractmethod
    async def fetch_items(self, source: "KnowledgeSource") -> list[RawItem]:
        """
        Fetch all items from the source.

        This is the main method that retrieves content. It should:
        - Handle pagination internally
        - Handle rate limiting
        - Convert source-specific format to RawItem

        Args:
            source: KnowledgeSource to fetch from

        Returns:
            List of RawItem objects, one per piece of content.

        Note:
            For large sources, this may return hundreds or thousands
            of items. The sync workflow handles batching and processing.
        """
        ...

    async def on_item_created(
        self, source: "KnowledgeSource", item: "KnowledgeItem"
    ) -> None:
        """
        Hook called after a KnowledgeItem is created from a RawItem.

        Optional override for provider-specific post-creation logic.
        Default implementation does nothing.

        Args:
            source: Parent KnowledgeSource
            item: The newly created KnowledgeItem
        """
        pass

    async def on_item_updated(
        self, source: "KnowledgeSource", item: "KnowledgeItem"
    ) -> None:
        """
        Hook called after a KnowledgeItem is updated.

        Optional override for provider-specific post-update logic.
        Default implementation does nothing.

        Args:
            source: Parent KnowledgeSource
            item: The updated KnowledgeItem
        """
        pass

    async def on_sync_complete(
        self, source: "KnowledgeSource", stats: dict
    ) -> None:
        """
        Hook called after sync completes successfully.

        Optional override for provider-specific cleanup or logging.
        Default implementation does nothing.

        Args:
            source: KnowledgeSource that was synced
            stats: Dict with sync statistics:
                - created: Number of items created
                - updated: Number of items updated
                - unchanged: Number of items unchanged
                - deleted: Number of items deleted/deactivated
        """
        pass
