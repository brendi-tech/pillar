"""
Pytest fixtures for hc-backend tests.

These fixtures provide test data for model, API, middleware, and permission tests.
"""
import os
import django

# Setup Django BEFORE any model imports
# For E2E tests, DJANGO_SETTINGS_MODULE may already be set to development
if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.test'

# Only setup if not already done
if not django.apps.apps.ready:
    django.setup()

import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from apps.users.models import Organization, User, OrganizationMembership
from apps.products.models import Product


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


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(
        name="Test Organization",
        plan="pro",
        subscription_status="active"
    )


@pytest.fixture
def product(db, organization):
    """Create a test product for the organization."""
    return Product.objects.create(
        organization=organization,
        name="Test Product",
        subdomain="test-product",
        is_default=True,
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
def other_product(db, other_organization):
    """Create a test product for the other organization."""
    return Product.objects.create(
        organization=other_organization,
        name="Other Product",
        subdomain="other-product",
        is_default=True,
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
def user_no_org(db):
    """Create a user without organization membership."""
    user = User.objects.create_user(
        email="noorg@example.com",
        password="testpass123",
        full_name="No Org User"
    )
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
def other_authenticated_client(db, other_user):
    """Create an API client authenticated with a user from different org."""
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def unauthenticated_client(db):
    """Create an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def public_client(db, organization):
    """Create an API client with x-customer-id header for public API."""
    client = APIClient()
    client.credentials(HTTP_X_CUSTOMER_ID=str(organization.id))
    return client


@pytest.fixture
def public_client_invalid_org(db):
    """Create an API client with invalid x-customer-id header."""
    client = APIClient()
    client.credentials(HTTP_X_CUSTOMER_ID="00000000-0000-0000-0000-000000000000")
    return client
