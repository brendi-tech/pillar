"""
Pytest fixtures for knowledge app tests.

Re-exports shared fixtures from the top-level conftest so they are
available when running tests from this directory.
"""
import pytest
from unittest.mock import patch

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
