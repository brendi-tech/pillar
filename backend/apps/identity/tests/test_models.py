"""
Tests for IdentityMapping and LinkCode models.
"""
import pytest
from datetime import timedelta

from django.db import IntegrityError
from django.utils import timezone

from apps.identity.models import IdentityMapping, LinkCode


@pytest.fixture
def mapping(product, organization):
    return IdentityMapping.objects.create(
        organization=organization,
        product=product,
        channel='slack',
        channel_user_id='U04ABCD1234',
        external_user_id='7842',
        email='sarah@acme.com',
        display_name='Sarah Chen',
        linked_via='slash_command',
        linked_by='self',
    )


@pytest.fixture
def link_code(product, organization):
    return LinkCode.objects.create(
        organization=organization,
        product=product,
        code='A7X9B2',
        channel='slack',
        channel_user_id='U04ABCD1234',
        channel_display_name='Sarah Chen',
        channel_email='sarah@acme.com',
        expires_at=timezone.now() + timedelta(minutes=10),
    )


@pytest.mark.django_db
class TestIdentityMapping:
    def test_create(self, mapping):
        assert mapping.channel == 'slack'
        assert mapping.channel_user_id == 'U04ABCD1234'
        assert mapping.external_user_id == '7842'
        assert mapping.is_active is True
        assert mapping.revoked_at is None
        assert str(mapping) == 'slack:U04ABCD1234 → 7842'

    def test_unique_constraint_active(self, mapping, product, organization):
        """Cannot create two active mappings for the same channel user."""
        with pytest.raises(IntegrityError):
            IdentityMapping.objects.create(
                organization=organization,
                product=product,
                channel='slack',
                channel_user_id='U04ABCD1234',
                external_user_id='9999',
                is_active=True,
            )

    def test_unique_constraint_allows_inactive(self, mapping, product, organization):
        """Deactivating old mapping allows creating a new one."""
        mapping.is_active = False
        mapping.revoked_at = timezone.now()
        mapping.save()

        new_mapping = IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            external_user_id='9999',
            is_active=True,
        )
        assert new_mapping.external_user_id == '9999'

    def test_multiple_channel_users_to_same_external(self, product, organization):
        """Multiple channel users can map to the same external user."""
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            external_user_id='7842',
        )
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U05EFGH5678',
            external_user_id='7842',
        )
        assert IdentityMapping.objects.filter(
            product=product, external_user_id='7842', is_active=True,
        ).count() == 2

    def test_different_channels_same_user_id(self, product, organization):
        """Same channel_user_id on different channels creates separate mappings."""
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='12345',
            external_user_id='7842',
        )
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='discord',
            channel_user_id='12345',
            external_user_id='7842',
        )
        assert IdentityMapping.objects.filter(
            product=product, is_active=True,
        ).count() == 2


@pytest.mark.django_db
class TestLinkCode:
    def test_create(self, link_code):
        assert link_code.code == 'A7X9B2'
        assert link_code.is_used is False
        assert link_code.is_expired is False
        assert link_code.is_valid is True

    def test_expired(self, product, organization):
        code = LinkCode.objects.create(
            organization=organization,
            product=product,
            code='EXPIRED1',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        assert code.is_expired is True
        assert code.is_valid is False

    def test_used(self, link_code):
        link_code.is_used = True
        link_code.used_at = timezone.now()
        link_code.save()
        assert link_code.is_valid is False

    def test_str_active(self, link_code):
        assert 'active' in str(link_code)

    def test_str_used(self, link_code):
        link_code.is_used = True
        link_code.save()
        assert 'used' in str(link_code)

    def test_str_expired(self, product, organization):
        code = LinkCode.objects.create(
            organization=organization,
            product=product,
            code='EXP12345',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        assert 'expired' in str(code)
