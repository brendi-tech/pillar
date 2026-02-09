"""
Unit tests for OrganizationInvitation model.

Tests the model methods: is_valid(), accept(), and decline().
"""
import pytest
from datetime import timedelta
from django.utils import timezone

from apps.users.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    User,
)


@pytest.mark.django_db
class TestOrganizationInvitationIsValid:
    """Tests for OrganizationInvitation.is_valid() method."""

    def test_is_valid_pending_not_expired(self, invitation):
        """Pending invitation that hasn't expired should be valid."""
        assert invitation.is_valid() is True

    def test_is_valid_expired(self, expired_invitation):
        """Expired invitation should not be valid."""
        assert expired_invitation.is_valid() is False

    def test_is_valid_already_accepted(self, accepted_invitation):
        """Already accepted invitation should not be valid."""
        assert accepted_invitation.is_valid() is False

    def test_is_valid_already_declined(self, declined_invitation):
        """Already declined invitation should not be valid."""
        assert declined_invitation.is_valid() is False

    def test_is_valid_about_to_expire(self, organization, user):
        """Invitation expiring in 1 minute should still be valid."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email="abouttoexpire@example.com",
            role="member",
            invited_by=user,
            expires_at=timezone.now() + timedelta(minutes=1),
        )
        assert invitation.is_valid() is True


@pytest.mark.django_db
class TestOrganizationInvitationAccept:
    """Tests for OrganizationInvitation.accept() method."""

    def test_accept_creates_membership(self, invitation, invited_user):
        """Accepting invitation should create organization membership."""
        membership = invitation.accept(invited_user)

        assert membership is not None
        assert membership.organization == invitation.organization
        assert membership.user == invited_user
        assert membership.role == invitation.role

    def test_accept_marks_invitation_accepted(self, invitation, invited_user):
        """Accepting invitation should update status to ACCEPTED."""
        invitation.accept(invited_user)

        invitation.refresh_from_db()
        assert invitation.status == OrganizationInvitation.Status.ACCEPTED
        assert invitation.accepted_at is not None

    def test_accept_sets_invitation_metadata_on_membership(self, invitation, invited_user):
        """Accepting should set invited_by and invitation_accepted_at on membership."""
        membership = invitation.accept(invited_user)

        assert membership.invited_by == invitation.invited_by
        assert membership.invitation_accepted_at is not None

    def test_accept_invalid_invitation_raises(self, expired_invitation, db):
        """Accepting an expired invitation should raise ValueError."""
        # Create a user with the expired invitation's email
        expired_user = User.objects.create_user(
            email=expired_invitation.email,
            password="testpass123",
            full_name="Expired User",
        )

        with pytest.raises(ValueError, match="not valid"):
            expired_invitation.accept(expired_user)

    def test_accept_already_accepted_raises(self, accepted_invitation, db):
        """Accepting an already-accepted invitation should raise ValueError."""
        user = User.objects.create_user(
            email=accepted_invitation.email,
            password="testpass123",
            full_name="Accepted User",
        )

        with pytest.raises(ValueError, match="not valid"):
            accepted_invitation.accept(user)

    def test_accept_email_mismatch_raises(self, invitation, user):
        """Accepting with mismatched email should raise ValueError."""
        # user fixture has email "test@example.com", invitation is for "invited@example.com"
        with pytest.raises(ValueError, match="email doesn't match"):
            invitation.accept(user)

    def test_accept_already_member_returns_existing(self, invitation, invited_user, organization):
        """If user is already a member, accept should return existing membership."""
        # Create existing membership
        existing_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=invited_user,
            role=OrganizationMembership.Role.MEMBER,
        )

        # Accept the invitation - should not fail, should return existing
        returned_membership = invitation.accept(invited_user)

        assert returned_membership == existing_membership

        # Invitation should still be marked as accepted
        invitation.refresh_from_db()
        assert invitation.status == OrganizationInvitation.Status.ACCEPTED

    def test_accept_admin_role(self, admin_invitation, db):
        """Accepting admin invitation should create admin membership."""
        admin_user = User.objects.create_user(
            email=admin_invitation.email,
            password="testpass123",
            full_name="Admin User",
        )

        membership = admin_invitation.accept(admin_user)

        assert membership.role == "admin"


@pytest.mark.django_db
class TestOrganizationInvitationDecline:
    """Tests for OrganizationInvitation.decline() method."""

    def test_decline_marks_declined(self, invitation):
        """Declining should update status to DECLINED."""
        invitation.decline()

        invitation.refresh_from_db()
        assert invitation.status == OrganizationInvitation.Status.DECLINED
        assert invitation.declined_at is not None

    def test_decline_already_accepted_raises(self, accepted_invitation):
        """Cannot decline an already-accepted invitation."""
        with pytest.raises(ValueError, match="pending"):
            accepted_invitation.decline()

    def test_decline_already_declined_raises(self, declined_invitation):
        """Cannot decline an already-declined invitation."""
        with pytest.raises(ValueError, match="pending"):
            declined_invitation.decline()

    def test_decline_expired_still_works(self, expired_invitation):
        """Can decline an expired invitation (it's still pending status)."""
        # Note: expired_invitation has PENDING status, just past expiration
        expired_invitation.decline()

        expired_invitation.refresh_from_db()
        assert expired_invitation.status == OrganizationInvitation.Status.DECLINED


@pytest.mark.django_db
class TestOrganizationInvitationSave:
    """Tests for OrganizationInvitation.save() method."""

    def test_save_sets_default_expiration(self, organization, user):
        """Saving without expires_at should set default (28 days)."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email="newuser@example.com",
            role="member",
            invited_by=user,
        )

        # Should be approximately 28 days from now
        expected_min = timezone.now() + timedelta(days=27)
        expected_max = timezone.now() + timedelta(days=29)

        assert invitation.expires_at >= expected_min
        assert invitation.expires_at <= expected_max

    def test_save_preserves_custom_expiration(self, organization, user):
        """Saving with custom expires_at should preserve it."""
        custom_expires = timezone.now() + timedelta(days=7)

        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email="customexpiry@example.com",
            role="member",
            invited_by=user,
            expires_at=custom_expires,
        )

        # Should be within 1 second of our custom time
        assert abs((invitation.expires_at - custom_expires).total_seconds()) < 1

    def test_token_is_auto_generated(self, organization, user):
        """Token should be automatically generated on create."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email="tokentest@example.com",
            role="member",
            invited_by=user,
        )

        assert invitation.token is not None
        assert len(str(invitation.token)) == 36  # UUID format

    def test_token_is_unique(self, organization, user):
        """Each invitation should have a unique token."""
        invitation1 = OrganizationInvitation.objects.create(
            organization=organization,
            email="unique1@example.com",
            role="member",
            invited_by=user,
        )
        invitation2 = OrganizationInvitation.objects.create(
            organization=organization,
            email="unique2@example.com",
            role="member",
            invited_by=user,
        )

        assert invitation1.token != invitation2.token
