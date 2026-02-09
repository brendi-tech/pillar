"""
Pytest fixtures for users app tests.

These fixtures provide test data for invitation and signup tests.
"""
import pytest
from datetime import timedelta
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    User,
)


# ============================================================================
# Mock TaskRouter for all tests (prevents real Hatchet workflow calls)
# ============================================================================

@pytest.fixture(autouse=True)
def mock_task_router():
    """
    Mock TaskRouter.execute for all tests.

    This prevents tests from calling real Hatchet workflows when
    models are created/updated (signals trigger indexing tasks).
    """
    with patch('common.task_router.TaskRouter.execute') as mock_execute:
        mock_execute.return_value = 'test-workflow-run-id'
        yield mock_execute


# ============================================================================
# Organization and User fixtures
# ============================================================================

@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(
        name="Test Organization",
        plan="pro",
        subscription_status="active"
    )


@pytest.fixture
def other_organization(db):
    """Create a different organization for isolation tests."""
    return Organization.objects.create(
        name="Other Organization",
        plan="free",
        subscription_status="active"
    )


@pytest.fixture
def user(db, organization):
    """Create an authenticated user with organization membership."""
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        full_name="Test User"
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=user,
        role=OrganizationMembership.Role.ADMIN
    )
    # Set current_organization for permission checks
    user.current_organization = organization
    return user


@pytest.fixture
def other_user(db, other_organization):
    """Create a user in the other organization."""
    user = User.objects.create_user(
        email="other@example.com",
        password="testpass123",
        full_name="Other User"
    )
    OrganizationMembership.objects.create(
        organization=other_organization,
        user=user,
        role=OrganizationMembership.Role.ADMIN
    )
    user.current_organization = other_organization
    return user


@pytest.fixture
def authenticated_client(db, user):
    """Create an API client authenticated with the test user."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def unauthenticated_client(db):
    """Create an unauthenticated API client."""
    return APIClient()


# ============================================================================
# Invitation fixtures
# ============================================================================

@pytest.fixture
def invitation(db, organization, user):
    """Create a pending invitation to an existing organization."""
    return OrganizationInvitation.objects.create(
        organization=organization,
        email="invited@example.com",
        role="member",
        invited_by=user,
    )


@pytest.fixture
def admin_invitation(db, organization, user):
    """Create a pending admin invitation."""
    return OrganizationInvitation.objects.create(
        organization=organization,
        email="admin-invite@example.com",
        role="admin",
        invited_by=user,
    )


@pytest.fixture
def expired_invitation(db, organization, user):
    """Create an expired invitation."""
    return OrganizationInvitation.objects.create(
        organization=organization,
        email="expired@example.com",
        role="member",
        invited_by=user,
        expires_at=timezone.now() - timedelta(days=1),
    )


@pytest.fixture
def accepted_invitation(db, organization, user):
    """Create an already-accepted invitation."""
    invitation = OrganizationInvitation.objects.create(
        organization=organization,
        email="accepted@example.com",
        role="member",
        invited_by=user,
    )
    invitation.status = OrganizationInvitation.Status.ACCEPTED
    invitation.accepted_at = timezone.now()
    invitation.save()
    return invitation


@pytest.fixture
def declined_invitation(db, organization, user):
    """Create an already-declined invitation."""
    invitation = OrganizationInvitation.objects.create(
        organization=organization,
        email="declined@example.com",
        role="member",
        invited_by=user,
    )
    invitation.status = OrganizationInvitation.Status.DECLINED
    invitation.declined_at = timezone.now()
    invitation.save()
    return invitation


@pytest.fixture
def invited_user(db):
    """Create a user that matches an invitation email."""
    return User.objects.create_user(
        email="invited@example.com",
        password="testpass123",
        full_name="Invited User",
    )


@pytest.fixture
def invited_user_client(db, invited_user):
    """Create an API client authenticated as the invited user."""
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=invited_user)
    return client
