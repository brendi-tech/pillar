"""
Visitor service for resolving and managing visitors.

Handles visitor lookup, creation, and merging when anonymous users authenticate.
"""
import logging
from typing import Optional

from django.utils import timezone

from apps.analytics.models import Visitor, ChatConversation

logger = logging.getLogger(__name__)


class VisitorService:
    """
    Service for visitor resolution and merging.

    Handles the lookup/creation of visitors and the merging of anonymous
    visitor records when users authenticate.
    """

    async def get_or_create_visitor(
        self,
        organization_id: str,
        visitor_id: str,
        *,
        external_user_id: Optional[str] = None,
        name: str = '',
        email: str = '',
        metadata: Optional[dict] = None,
    ) -> Visitor:
        """
        Get or create a visitor, handling authentication transitions.

        Resolution logic:
        1. If external_user_id provided, look for existing authenticated visitor
        2. If found, update profile and return (cross-device case)
        3. If not found, look for anonymous visitor by visitor_id
        4. If anonymous visitor exists and external_user_id provided, upgrade it
        5. Otherwise, create new visitor

        Args:
            organization_id: Organization UUID
            visitor_id: Persistent browser ID from SDK localStorage
            external_user_id: Client's authenticated user ID (optional)
            name: User's display name
            email: User's email address
            metadata: Additional metadata from client

        Returns:
            Visitor instance (created or existing)
        """
        metadata = metadata or {}

        # Case 1: Authenticated user - try to find by external_user_id first
        if external_user_id:
            try:
                visitor = await Visitor.objects.aget(
                    organization_id=organization_id,
                    external_user_id=external_user_id,
                )
                # Update profile if provided
                updated = False
                if name and visitor.name != name:
                    visitor.name = name
                    updated = True
                if email and visitor.email != email:
                    visitor.email = email
                    updated = True
                if metadata and visitor.metadata != metadata:
                    visitor.metadata = {**visitor.metadata, **metadata}
                    updated = True

                if updated:
                    await visitor.asave(update_fields=['name', 'email', 'metadata', 'last_seen_at'])
                    logger.debug(f"[VisitorService] Updated authenticated visitor {visitor.id}")
                else:
                    # Just touch last_seen_at
                    visitor.last_seen_at = timezone.now()
                    await visitor.asave(update_fields=['last_seen_at'])

                return visitor
            except Visitor.DoesNotExist:
                # No authenticated visitor yet - check for anonymous to upgrade
                pass

        # Case 2: Look for anonymous visitor by visitor_id
        try:
            visitor = await Visitor.objects.aget(
                organization_id=organization_id,
                visitor_id=visitor_id,
            )

            # If we have external_user_id, upgrade this anonymous visitor
            if external_user_id and not visitor.external_user_id:
                visitor.external_user_id = external_user_id
                if name:
                    visitor.name = name
                if email:
                    visitor.email = email
                if metadata:
                    visitor.metadata = {**visitor.metadata, **metadata}
                await visitor.asave(update_fields=[
                    'external_user_id', 'name', 'email', 'metadata', 'last_seen_at'
                ])
                logger.info(
                    f"[VisitorService] Upgraded anonymous visitor {visitor.id} "
                    f"to authenticated user {external_user_id}"
                )
            else:
                # Update profile for anonymous visitor
                updated = False
                if name and visitor.name != name:
                    visitor.name = name
                    updated = True
                if email and visitor.email != email:
                    visitor.email = email
                    updated = True
                if metadata:
                    visitor.metadata = {**visitor.metadata, **metadata}
                    updated = True

                if updated:
                    await visitor.asave(update_fields=['name', 'email', 'metadata', 'last_seen_at'])
                else:
                    visitor.last_seen_at = timezone.now()
                    await visitor.asave(update_fields=['last_seen_at'])

            return visitor
        except Visitor.DoesNotExist:
            pass

        # Case 3: Create new visitor
        visitor = await Visitor.objects.acreate(
            organization_id=organization_id,
            visitor_id=visitor_id,
            external_user_id=external_user_id,
            name=name,
            email=email,
            metadata=metadata,
        )
        logger.info(
            f"[VisitorService] Created new visitor {visitor.id} "
            f"(anonymous={not external_user_id})"
        )
        return visitor

    async def merge_visitors(
        self,
        organization_id: str,
        visitor_id: str,
        external_user_id: str,
        *,
        name: str = '',
        email: str = '',
        metadata: Optional[dict] = None,
    ) -> Visitor:
        """
        Merge an anonymous visitor into an authenticated visitor.

        This handles the case where:
        - User was browsing anonymously (has conversations under visitor_id)
        - User logs in (we now have external_user_id)
        - User may have existing history under external_user_id from another device

        The merge:
        1. Finds or creates the authenticated visitor record
        2. Transfers conversations from any anonymous visitor record
        3. Deletes the now-empty anonymous record

        Args:
            organization_id: Organization UUID
            visitor_id: Persistent browser ID from SDK localStorage
            external_user_id: Client's authenticated user ID
            name: User's display name
            email: User's email address
            metadata: Additional metadata from client

        Returns:
            The authenticated visitor record
        """
        metadata = metadata or {}

        # Get or create the authenticated visitor
        auth_visitor, created = await Visitor.objects.aget_or_create(
            organization_id=organization_id,
            external_user_id=external_user_id,
            defaults={
                'visitor_id': visitor_id,
                'name': name,
                'email': email,
                'metadata': metadata,
            }
        )

        if not created:
            # Update profile if changed
            updated = False
            if name and auth_visitor.name != name:
                auth_visitor.name = name
                updated = True
            if email and auth_visitor.email != email:
                auth_visitor.email = email
                updated = True
            if metadata:
                auth_visitor.metadata = {**auth_visitor.metadata, **metadata}
                updated = True

            if updated:
                await auth_visitor.asave(update_fields=['name', 'email', 'metadata', 'last_seen_at'])

        # Find anonymous visitor with this visitor_id (if different from auth visitor)
        try:
            anon_visitor = await Visitor.objects.aget(
                organization_id=organization_id,
                visitor_id=visitor_id,
                external_user_id__isnull=True,
            )

            # Only proceed if this is a different visitor record
            if anon_visitor.id != auth_visitor.id:
                # Transfer conversations from anonymous to authenticated visitor
                transferred_count = await ChatConversation.objects.filter(
                    visitor=anon_visitor
                ).aupdate(visitor=auth_visitor)

                if transferred_count > 0:
                    logger.info(
                        f"[VisitorService] Transferred {transferred_count} conversations "
                        f"from anonymous visitor {anon_visitor.id} to {auth_visitor.id}"
                    )

                # Delete the anonymous visitor record
                await anon_visitor.adelete()
                logger.info(f"[VisitorService] Deleted merged anonymous visitor {anon_visitor.id}")

        except Visitor.DoesNotExist:
            # No anonymous visitor to merge
            pass

        return auth_visitor


# Singleton instance for easy access
_service_instance: Optional[VisitorService] = None


def get_visitor_service() -> VisitorService:
    """Get the singleton VisitorService instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = VisitorService()
    return _service_instance
