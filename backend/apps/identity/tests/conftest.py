"""
Fixtures for identity app tests.

Re-exports common fixtures from the root conftest. These tests run from
backend/apps/identity/tests/ so they don't automatically pick up the root
backend/tests/conftest.py.
"""
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient

from apps.users.models import Organization, User, OrganizationMembership
from apps.products.models import Product


@pytest.fixture(autouse=True)
def mock_task_router():
    with patch('common.task_router.TaskRouter.execute') as mock_execute:
        mock_execute.return_value = 'test-workflow-run-id'
        yield mock_execute


@pytest.fixture
def organization(db):
    return Organization.objects.create(
        name="Test Organization",
        plan="pro",
        subscription_status="active",
    )


@pytest.fixture
def product(db, organization):
    return Product.objects.create(
        organization=organization,
        name="Test Product",
        subdomain="test-product",
        is_default=True,
    )


@pytest.fixture
def other_organization(db):
    return Organization.objects.create(
        name="Other Organization",
        plan="free",
        subscription_status="active",
    )


@pytest.fixture
def other_product(db, other_organization):
    return Product.objects.create(
        organization=other_organization,
        name="Other Product",
        subdomain="other-product",
        is_default=True,
    )


@pytest.fixture
def user(db, organization):
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        full_name="Test User",
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=user,
        role=OrganizationMembership.Role.ADMIN,
    )
    user.current_organization = organization
    return user


@pytest.fixture
def authenticated_client(db, user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def unauthenticated_client(db):
    return APIClient()


@pytest.fixture
def public_client(db, organization):
    client = APIClient()
    client.credentials(HTTP_X_CUSTOMER_ID=str(organization.id))
    return client
