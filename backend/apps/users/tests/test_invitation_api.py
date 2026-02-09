"""
API tests for organization invitation endpoints.

Tests the invitation-related endpoints:
- GET /api/users/organizations/preview_invitation/ (unauthenticated)
- POST /api/users/organizations/accept_invitation/ (authenticated)
- POST /api/users/organizations/decline_invitation/ (authenticated)
- POST /api/users/organizations/{id}/invite_member/ (authenticated admin)
- GET /api/users/organizations/my_invitations/ (authenticated)
"""
import pytest
from unittest.mock import patch
from rest_framework import status

from apps.users.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    User,
)


# ============================================================================
# Preview Invitation Tests (Unauthenticated)
# ============================================================================

@pytest.mark.django_db
class TestPreviewInvitation:
    """Tests for GET /api/users/organizations/preview_invitation/"""

    def test_preview_invitation_returns_details(
        self, unauthenticated_client, invitation
    ):
        """Preview should return invitation details without auth."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == invitation.email
        assert response.data["role"] == invitation.role
        assert "organization" in response.data
        assert response.data["organization"]["name"] == invitation.organization.name
        assert "invited_by" in response.data

    def test_preview_invitation_includes_user_exists_flag_false(
        self, unauthenticated_client, invitation
    ):
        """Preview should indicate user_exists=False for new user."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user_exists"] is False

    def test_preview_invitation_includes_user_exists_flag_true(
        self, unauthenticated_client, invitation, invited_user
    ):
        """Preview should indicate user_exists=True for existing user."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user_exists"] is True

    def test_preview_invitation_includes_is_valid_flag(
        self, unauthenticated_client, invitation
    ):
        """Preview should include is_valid flag."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_valid"] is True

    def test_preview_invitation_invalid_token_404(self, unauthenticated_client):
        """Preview with invalid token should return 404."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": "00000000-0000-0000-0000-000000000000"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_preview_invitation_expired_token_404(
        self, unauthenticated_client, expired_invitation
    ):
        """Preview with expired token should return 404."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/",
            {"token": str(expired_invitation.token)}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_preview_invitation_missing_token_400(self, unauthenticated_client):
        """Preview without token should return 400."""
        response = unauthenticated_client.get(
            "/api/users/organizations/preview_invitation/"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# Accept Invitation Tests (Authenticated)
# ============================================================================

@pytest.mark.django_db
class TestAcceptInvitation:
    """Tests for POST /api/users/organizations/accept_invitation/"""

    def test_accept_invitation_creates_membership(
        self, invited_user_client, invitation, invited_user
    ):
        """Accepting invitation should create organization membership."""
        response = invited_user_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK

        membership = OrganizationMembership.objects.filter(
            user=invited_user,
            organization=invitation.organization
        )
        assert membership.exists()

    def test_accept_invitation_returns_membership_data(
        self, invited_user_client, invitation
    ):
        """Accepting should return the created membership."""
        response = invited_user_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "organization" in response.data
        assert "role" in response.data

    def test_accept_invitation_requires_auth(self, unauthenticated_client, invitation):
        """Accepting invitation requires authentication."""
        response = unauthenticated_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_accept_invitation_email_mismatch_fails(
        self, authenticated_client, invitation
    ):
        """Cannot accept invitation for different email."""
        # authenticated_client uses user with "test@example.com"
        # invitation is for "invited@example.com"
        response = authenticated_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_accept_invitation_invalid_token_404(self, invited_user_client):
        """Accepting with invalid token should return 404."""
        response = invited_user_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": "00000000-0000-0000-0000-000000000000"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_accept_invitation_expired_fails(
        self, unauthenticated_client, expired_invitation, db
    ):
        """Cannot accept expired invitation."""
        # Create user with the expired invitation email
        expired_user = User.objects.create_user(
            email=expired_invitation.email,
            password="testpass123",
            full_name="Expired User",
        )
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=expired_user)

        response = client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(expired_invitation.token)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_accept_invitation_already_accepted_fails(
        self, db, accepted_invitation
    ):
        """Cannot accept already-accepted invitation."""
        # Create user with the accepted invitation email
        user = User.objects.create_user(
            email=accepted_invitation.email,
            password="testpass123",
            full_name="Accepted User",
        )
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(accepted_invitation.token)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_accept_invitation_already_member_succeeds(
        self, invited_user_client, invitation, invited_user, organization
    ):
        """If already a member, accepting should still succeed (idempotent)."""
        # Create existing membership
        OrganizationMembership.objects.create(
            organization=organization,
            user=invited_user,
            role=OrganizationMembership.Role.MEMBER,
        )

        response = invited_user_client.post(
            "/api/users/organizations/accept_invitation/",
            {"token": str(invitation.token)}
        )

        # Should succeed and return the existing membership
        assert response.status_code == status.HTTP_200_OK


# ============================================================================
# Decline Invitation Tests (Authenticated)
# ============================================================================

@pytest.mark.django_db
class TestDeclineInvitation:
    """Tests for POST /api/users/organizations/decline_invitation/"""

    def test_decline_invitation_marks_declined(
        self, invited_user_client, invitation
    ):
        """Declining should mark invitation as declined."""
        response = invited_user_client.post(
            "/api/users/organizations/decline_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_200_OK

        invitation.refresh_from_db()
        assert invitation.status == OrganizationInvitation.Status.DECLINED

    def test_decline_invitation_requires_auth(
        self, unauthenticated_client, invitation
    ):
        """Declining invitation requires authentication."""
        response = unauthenticated_client.post(
            "/api/users/organizations/decline_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_decline_invitation_email_mismatch_fails(
        self, authenticated_client, invitation
    ):
        """Cannot decline invitation for different email."""
        response = authenticated_client.post(
            "/api/users/organizations/decline_invitation/",
            {"token": str(invitation.token)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# Invite Member Tests (Authenticated Admin)
# ============================================================================

@pytest.mark.django_db
class TestInviteMember:
    """Tests for POST /api/users/organizations/{id}/invite_member/"""

    @patch("apps.users.services.email_service.send_organization_invitation_email")
    def test_invite_member_creates_invitation(
        self, mock_send_email, authenticated_client, organization
    ):
        """Admin can invite a new member."""
        mock_send_email.return_value = True

        response = authenticated_client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": "newinvite@example.com", "role": "member"}
        )

        assert response.status_code == status.HTTP_201_CREATED

        invitation = OrganizationInvitation.objects.filter(
            organization=organization,
            email="newinvite@example.com"
        )
        assert invitation.exists()

    @patch("apps.users.services.email_service.send_organization_invitation_email")
    def test_invite_member_sends_email(
        self, mock_send_email, authenticated_client, organization
    ):
        """Inviting should send invitation email."""
        mock_send_email.return_value = True

        response = authenticated_client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": "newinvite@example.com", "role": "member"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        mock_send_email.assert_called_once()

    @patch("apps.users.services.email_service.send_organization_invitation_email")
    def test_invite_member_already_member_fails(
        self, mock_send_email, authenticated_client, organization, other_user
    ):
        """Cannot invite someone who is already a member."""
        # Add other_user to organization first
        OrganizationMembership.objects.create(
            organization=organization,
            user=other_user,
            role=OrganizationMembership.Role.MEMBER,
        )

        response = authenticated_client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": other_user.email, "role": "member"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch("apps.users.services.email_service.send_organization_invitation_email")
    def test_invite_member_pending_invitation_fails(
        self, mock_send_email, authenticated_client, organization, invitation
    ):
        """Cannot invite someone with pending invitation."""
        response = authenticated_client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": invitation.email, "role": "member"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invite_member_non_admin_forbidden(
        self, db, organization
    ):
        """Non-admin members cannot invite."""
        # Create a member (not admin)
        member_user = User.objects.create_user(
            email="member@example.com",
            password="testpass123",
            full_name="Member User",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        member_user.current_organization = organization

        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=member_user)

        response = client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": "newinvite@example.com", "role": "member"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_invite_member_unauthenticated_fails(
        self, unauthenticated_client, organization
    ):
        """Unauthenticated users cannot invite."""
        response = unauthenticated_client.post(
            f"/api/users/organizations/{organization.id}/invite_member/",
            {"email": "newinvite@example.com", "role": "member"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# My Invitations Tests (Authenticated)
# ============================================================================

@pytest.mark.django_db
class TestMyInvitations:
    """Tests for GET /api/users/organizations/my_invitations/"""

    def test_my_invitations_returns_pending_for_user(
        self, invited_user_client, invitation
    ):
        """Should return pending invitations for authenticated user's email."""
        response = invited_user_client.get(
            "/api/users/organizations/my_invitations/"
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["email"] == invitation.email

    def test_my_invitations_excludes_expired(
        self, db, expired_invitation
    ):
        """Should exclude expired invitations."""
        # Create user with expired invitation email
        expired_user = User.objects.create_user(
            email=expired_invitation.email,
            password="testpass123",
            full_name="Expired User",
        )
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=expired_user)

        response = client.get("/api/users/organizations/my_invitations/")

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_my_invitations_excludes_other_emails(
        self, authenticated_client, invitation
    ):
        """Should not return invitations for other emails."""
        # authenticated_client uses "test@example.com"
        # invitation is for "invited@example.com"
        response = authenticated_client.get(
            "/api/users/organizations/my_invitations/"
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_my_invitations_requires_auth(self, unauthenticated_client):
        """My invitations requires authentication."""
        response = unauthenticated_client.get(
            "/api/users/organizations/my_invitations/"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
