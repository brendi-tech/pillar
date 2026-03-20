"""
Tests for identity resolution and account linking services.
"""
import pytest
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from apps.identity.models import IdentityMapping, LinkCode
from apps.identity.services import (
    CodeAlreadyUsedError,
    CodeExpiredError,
    CodeNotFoundError,
    confirm_link,
    generate_link_code,
    resolve_identity,
    revoke_mapping,
)


@pytest.fixture
def slack_mapping(product, organization):
    return IdentityMapping.objects.create(
        organization=organization,
        product=product,
        channel='slack',
        channel_user_id='U04ABCD1234',
        external_user_id='7842',
        email='sarah@acme.com',
        display_name='Sarah Chen',
    )


@pytest.fixture
def email_mapping(product, organization):
    return IdentityMapping.objects.create(
        organization=organization,
        product=product,
        channel='email',
        channel_user_id='sarah@acme.com',
        external_user_id='7842',
        email='sarah@acme.com',
    )


@pytest.mark.django_db(transaction=True)
class TestResolveIdentity:
    @pytest.mark.asyncio
    async def test_explicit_external_user_id_short_circuits(self, product):
        """When external_user_id is provided, skip IdentityMapping lookup."""
        result = await resolve_identity(
            product=product,
            channel='web',
            channel_user_id='visitor-abc',
            external_user_id='7842',
            email='sarah@acme.com',
        )
        assert result.external_user_id == '7842'
        assert result.channel_user_id == 'visitor-abc'
        assert result.email == 'sarah@acme.com'

    @pytest.mark.asyncio
    async def test_mapping_lookup(self, product, slack_mapping):
        """Resolves identity from IdentityMapping."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
        )
        assert result.external_user_id == '7842'
        assert result.email == 'sarah@acme.com'
        assert result.display_name == 'Sarah Chen'

    @pytest.mark.asyncio
    async def test_mapping_not_found(self, product):
        """Unlinked user gets CallerContext with no external_user_id."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U99UNKNOWN',
            email='unknown@acme.com',
        )
        assert result.external_user_id is None
        assert result.channel_user_id == 'U99UNKNOWN'
        assert result.email == 'unknown@acme.com'

    @pytest.mark.asyncio
    async def test_inactive_mapping_ignored(self, product, slack_mapping):
        """Deactivated mappings are not resolved."""
        slack_mapping.is_active = False
        await slack_mapping.asave()

        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
        )
        assert result.external_user_id is None

    @pytest.mark.asyncio
    async def test_auto_link_by_email(self, product, email_mapping):
        """Email-based auto-linking resolves identity across channels."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U99NEWUSER',
            email='sarah@acme.com',
            auto_link_by_email=True,
        )
        assert result.external_user_id == '7842'

    @pytest.mark.asyncio
    async def test_auto_link_by_email_disabled(self, product, email_mapping):
        """Without auto_link_by_email, email matching is skipped."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U99NEWUSER',
            email='sarah@acme.com',
            auto_link_by_email=False,
        )
        assert result.external_user_id is None

    @pytest.mark.asyncio
    async def test_auto_link_case_insensitive(self, product, email_mapping):
        """Email matching is case-insensitive."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U99NEWUSER',
            email='SARAH@ACME.COM',
            auto_link_by_email=True,
        )
        assert result.external_user_id == '7842'

    @pytest.mark.asyncio
    async def test_no_channel_user_id(self, product):
        """Gracefully handles missing channel_user_id."""
        result = await resolve_identity(
            product=product,
            channel='api',
            email='someone@acme.com',
        )
        assert result.external_user_id is None
        assert result.channel_user_id is None

    @pytest.mark.asyncio
    async def test_mapping_preferred_over_email(self, product, slack_mapping, email_mapping):
        """Direct mapping lookup takes priority over email-based matching."""
        result = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            email='sarah@acme.com',
            auto_link_by_email=True,
        )
        assert result.external_user_id == '7842'
        assert result.display_name == 'Sarah Chen'

    @pytest.mark.asyncio
    async def test_is_identified_property(self, product, slack_mapping):
        """CallerContext.is_identified reflects external_user_id presence."""
        linked = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
        )
        assert linked.is_identified is True

        unlinked = await resolve_identity(
            product=product,
            channel='slack',
            channel_user_id='U99UNKNOWN',
        )
        assert unlinked.is_identified is False


@pytest.mark.django_db(transaction=True)
class TestGenerateLinkCode:
    @pytest.mark.asyncio
    async def test_generates_code(self, product):
        code = await generate_link_code(
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            channel_display_name='Sarah Chen',
            channel_email='sarah@acme.com',
        )
        assert len(code.code) == 6
        assert code.channel == 'slack'
        assert code.channel_user_id == 'U04ABCD1234'
        assert code.is_valid is True

    @pytest.mark.asyncio
    async def test_invalidates_previous_codes(self, product):
        code1 = await generate_link_code(
            product=product, channel='slack', channel_user_id='U04ABCD1234',
        )
        code2 = await generate_link_code(
            product=product, channel='slack', channel_user_id='U04ABCD1234',
        )
        await code1.arefresh_from_db()
        assert code1.is_used is True
        assert code2.is_valid is True

    @pytest.mark.asyncio
    async def test_different_users_get_independent_codes(self, product):
        code1 = await generate_link_code(
            product=product, channel='slack', channel_user_id='U04ABCD1234',
        )
        code2 = await generate_link_code(
            product=product, channel='slack', channel_user_id='U05EFGH5678',
        )
        assert code1.is_valid is True
        assert code2.is_valid is True
        assert code1.code != code2.code


@pytest.mark.django_db(transaction=True)
class TestConfirmLink:
    @pytest.fixture
    def active_code(self, product, organization):
        return LinkCode.objects.create(
            organization=organization,
            product=product,
            code='TESTAB',
            channel='slack',
            channel_user_id='U04ABCD1234',
            channel_display_name='Sarah Chen',
            channel_email='sarah@acme.com',
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def test_creates_mapping(self, active_code):
        mapping = confirm_link('TESTAB', '7842')
        assert mapping.channel == 'slack'
        assert mapping.channel_user_id == 'U04ABCD1234'
        assert mapping.external_user_id == '7842'
        assert mapping.email == 'sarah@acme.com'
        assert mapping.linked_via == 'slash_command'
        assert mapping.is_active is True

    def test_marks_code_used(self, active_code):
        confirm_link('TESTAB', '7842')
        active_code.refresh_from_db()
        assert active_code.is_used is True
        assert active_code.used_at is not None
        assert active_code.used_by_external_user_id == '7842'

    def test_deactivates_existing_mapping(self, active_code, product, organization):
        old_mapping = IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            external_user_id='OLD_USER',
        )
        new_mapping = confirm_link('TESTAB', '7842')
        old_mapping.refresh_from_db()
        assert old_mapping.is_active is False
        assert old_mapping.revoked_at is not None
        assert new_mapping.external_user_id == '7842'

    def test_expired_code_raises(self, product, organization):
        LinkCode.objects.create(
            organization=organization,
            product=product,
            code='EXPIRD',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        with pytest.raises(CodeExpiredError):
            confirm_link('EXPIRD', '7842')

    def test_used_code_raises(self, product, organization):
        LinkCode.objects.create(
            organization=organization,
            product=product,
            code='USEDCD',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=True,
            used_at=timezone.now(),
        )
        with pytest.raises(CodeAlreadyUsedError):
            confirm_link('USEDCD', '7842')

    def test_nonexistent_code_raises(self):
        with pytest.raises(CodeNotFoundError):
            confirm_link('NOCODE', '7842')


@pytest.mark.django_db(transaction=True)
class TestRevokeMapping:
    @pytest.mark.asyncio
    async def test_revoke(self, product, organization):
        mapping = await IdentityMapping.objects.acreate(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U04ABCD1234',
            external_user_id='7842',
        )
        await revoke_mapping(mapping)
        await mapping.arefresh_from_db()
        assert mapping.is_active is False
        assert mapping.revoked_at is not None
