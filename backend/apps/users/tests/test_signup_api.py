"""
API tests for user signup endpoint.

Tests the POST /api/users/users/ endpoint including:
- Basic signup (creates user and organization)
- Signup with invitation token (auto-accepts, skips org creation)
"""
import pytest
from rest_framework import status

from apps.users.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    User,
)


SIGNUP_URL = "/api/users/users/"


@pytest.mark.django_db
class TestBasicSignup:
    """Tests for basic user signup without invitation."""

    def test_signup_creates_user(self, unauthenticated_client):
        """Signup should create a new user."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(email="newuser@example.com").exists()

    def test_signup_creates_organization(self, unauthenticated_client):
        """Signup should create a new organization for the user."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_201_CREATED

        user = User.objects.get(email="newuser@example.com")
        memberships = OrganizationMembership.objects.filter(user=user)

        assert memberships.exists()
        assert memberships.first().role == OrganizationMembership.Role.ADMIN

    def test_signup_returns_tokens(self, unauthenticated_client):
        """Signup should return access and refresh tokens."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert "token" in response.data
        assert "refresh" in response.data
        assert response.data["token"] is not None
        assert response.data["refresh"] is not None

    def test_signup_returns_user_data(self, unauthenticated_client):
        """Signup should return user data."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert "user" in response.data
        assert response.data["user"]["email"] == "newuser@example.com"
        assert response.data["user"]["full_name"] == "New User"

    def test_signup_with_existing_email_fails(self, unauthenticated_client, user):
        """Signup with existing email should fail."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": user.email,
            "email": user.email,  # "test@example.com" from fixture
            "password": "SecurePass123!",
            "full_name": "Duplicate User",
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_signup_with_weak_password_fails(self, unauthenticated_client):
        """Signup with weak password should fail."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "123",  # Too short/weak
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_signup_without_email_fails(self, unauthenticated_client):
        """Signup without email should fail."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "noemail",
            "password": "SecurePass123!",
            "full_name": "No Email User",
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_signup_without_password_fails(self, unauthenticated_client):
        """Signup without password should fail."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "full_name": "No Password User",
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSignupWithInvitation:
    """Tests for signup with invitation token."""

    def test_signup_with_valid_invitation_auto_accepts(
        self, unauthenticated_client, invitation
    ):
        """Signup with valid invitation token should auto-accept."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": invitation.email,
            "email": invitation.email,  # "invited@example.com"
            "password": "SecurePass123!",
            "full_name": "Invited User",
            "invitation_token": str(invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        # Verify invitation is now accepted
        invitation.refresh_from_db()
        assert invitation.status == OrganizationInvitation.Status.ACCEPTED

    def test_signup_with_valid_invitation_creates_membership(
        self, unauthenticated_client, invitation
    ):
        """Signup with invitation should create membership in invited org."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": invitation.email,
            "email": invitation.email,
            "password": "SecurePass123!",
            "full_name": "Invited User",
            "invitation_token": str(invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        user = User.objects.get(email=invitation.email)
        membership = OrganizationMembership.objects.filter(
            user=user,
            organization=invitation.organization
        )
        assert membership.exists()

    def test_signup_with_valid_invitation_no_new_org_created(
        self, unauthenticated_client, invitation
    ):
        """Signup with invitation should NOT create a new organization."""
        # Count organizations before
        org_count_before = Organization.objects.count()

        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": invitation.email,
            "email": invitation.email,
            "password": "SecurePass123!",
            "full_name": "Invited User",
            "invitation_token": str(invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        # Org count should be the same (no new org created)
        org_count_after = Organization.objects.count()
        assert org_count_after == org_count_before

    def test_signup_with_valid_invitation_returns_joined_flag(
        self, unauthenticated_client, invitation
    ):
        """Signup with invitation should return joined_via_invitation=True."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": invitation.email,
            "email": invitation.email,
            "password": "SecurePass123!",
            "full_name": "Invited User",
            "invitation_token": str(invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data.get("joined_via_invitation") is True

    def test_signup_without_invitation_returns_joined_flag_false(
        self, unauthenticated_client
    ):
        """Signup without invitation should return joined_via_invitation=False."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data.get("joined_via_invitation") is False

    def test_signup_with_invalid_invitation_token_creates_new_org(
        self, unauthenticated_client
    ):
        """Signup with invalid token should create new org instead."""
        org_count_before = Organization.objects.count()

        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "newuser@example.com",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
            "invitation_token": "00000000-0000-0000-0000-000000000000",
        })

        assert response.status_code == status.HTTP_201_CREATED

        # New org should be created
        org_count_after = Organization.objects.count()
        assert org_count_after == org_count_before + 1

        # Should NOT be marked as joined via invitation
        assert response.data.get("joined_via_invitation") is False

    def test_signup_with_expired_invitation_token_creates_new_org(
        self, unauthenticated_client, expired_invitation
    ):
        """Signup with expired token should create new org."""
        org_count_before = Organization.objects.count()

        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": expired_invitation.email,
            "email": expired_invitation.email,
            "password": "SecurePass123!",
            "full_name": "Expired User",
            "invitation_token": str(expired_invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        # New org should be created
        org_count_after = Organization.objects.count()
        assert org_count_after == org_count_before + 1

        # Should NOT be marked as joined via invitation
        assert response.data.get("joined_via_invitation") is False

    def test_signup_with_email_mismatch_token_creates_new_org(
        self, unauthenticated_client, invitation
    ):
        """Signup with token for different email should create new org."""
        org_count_before = Organization.objects.count()

        # invitation is for "invited@example.com", but we're signing up with different email
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": "different@example.com",
            "email": "different@example.com",
            "password": "SecurePass123!",
            "full_name": "Different User",
            "invitation_token": str(invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        # New org should be created
        org_count_after = Organization.objects.count()
        assert org_count_after == org_count_before + 1

        # Should NOT be marked as joined via invitation
        assert response.data.get("joined_via_invitation") is False

    def test_signup_with_admin_invitation_gets_admin_role(
        self, unauthenticated_client, admin_invitation
    ):
        """Signup with admin invitation should get admin role."""
        response = unauthenticated_client.post(SIGNUP_URL, {
            "username": admin_invitation.email,
            "email": admin_invitation.email,
            "password": "SecurePass123!",
            "full_name": "Admin User",
            "invitation_token": str(admin_invitation.token),
        })

        assert response.status_code == status.HTTP_201_CREATED

        user = User.objects.get(email=admin_invitation.email)
        membership = OrganizationMembership.objects.get(
            user=user,
            organization=admin_invitation.organization
        )
        assert membership.role == "admin"
