"""
Pytest fixtures for analytics views tests.

Provides fixtures for:
- API clients
- Test data for conversations
"""
import pytest

from rest_framework.test import APIClient

# Import fixtures from global conftest
from tests.conftest import (
    organization,
    other_organization,
    user,
    other_user,
    authenticated_client,
    other_authenticated_client,
    unauthenticated_client,
)

from apps.analytics.models import ChatConversation


# =============================================================================
# Conversation Fixtures
# =============================================================================


@pytest.fixture
def conversation(organization):
    """Create a resolved conversation."""
    return ChatConversation.objects.create(
        organization=organization,
        status=ChatConversation.Status.RESOLVED,
        logging_enabled=True,
        title="Test Conversation",
        page_url="https://example.com/test",
    )


@pytest.fixture
def other_conversation(organization):
    """Create another conversation for testing multiple conversations."""
    return ChatConversation.objects.create(
        organization=organization,
        status=ChatConversation.Status.RESOLVED,
        logging_enabled=True,
        title="Other Test Conversation",
        page_url="https://example.com/other",
    )
