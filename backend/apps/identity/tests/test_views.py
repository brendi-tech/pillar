"""
Tests for identity API endpoints (public and admin).
"""
import pytest
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import IdentityMapping, LinkCode
from apps.products.models import Product

pytestmark = pytest.mark.urls('apps.identity.tests.test_urls')


@pytest.fixture
def product_with_link_url(product):
    product.identity_link_url = 'https://app.acme.com/connect?code={code}'
    product.save()
    return product


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


# ──────────────────────────────────────────────────────────────────────────────
# Public API: link-request
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestLinkRequest:
    URL = '/api/public/identity/link-request/'

    def test_generates_code(self, public_client, product_with_link_url):
        resp = public_client.post(self.URL, {
            'channel': 'slack',
            'channel_user_id': 'U04ABCD1234',
            'channel_display_name': 'Sarah Chen',
            'channel_email': 'sarah@acme.com',
        }, format='json')
        assert resp.status_code == 200
        assert 'code' in resp.data
        assert len(resp.data['code']) == 6
        assert 'app.acme.com/connect?code=' in resp.data['link_url']
        assert 'expires_at' in resp.data

    def test_missing_product_context(self, db):
        client = APIClient()
        resp = client.post(self.URL, {
            'channel': 'slack',
            'channel_user_id': 'U04ABCD1234',
        }, format='json')
        assert resp.status_code == 403

    def test_missing_fields(self, public_client, product):
        resp = public_client.post(self.URL, {}, format='json')
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# Public API: link-confirm
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestLinkConfirm:
    URL = '/api/public/identity/link-confirm/'

    @pytest.fixture
    def active_code(self, product, organization):
        return LinkCode.objects.create(
            organization=organization,
            product=product,
            code='CNFRM1',
            channel='slack',
            channel_user_id='U04ABCD1234',
            channel_display_name='Sarah Chen',
            channel_email='sarah@acme.com',
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def test_confirm_creates_mapping(self, public_client, active_code):
        resp = public_client.post(self.URL, {
            'code': 'CNFRM1',
            'external_user_id': '7842',
        }, format='json')
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert resp.data['mapping']['external_user_id'] == '7842'
        assert resp.data['mapping']['channel'] == 'slack'

        mapping = IdentityMapping.objects.get(
            channel='slack', channel_user_id='U04ABCD1234', is_active=True,
        )
        assert mapping.external_user_id == '7842'

    def test_expired_code(self, public_client, product, organization):
        LinkCode.objects.create(
            organization=organization,
            product=product,
            code='EXPRD2',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        resp = public_client.post(self.URL, {
            'code': 'EXPRD2',
            'external_user_id': '7842',
        }, format='json')
        assert resp.status_code == 400
        assert resp.data['error'] == 'code_expired'

    def test_used_code(self, public_client, product, organization):
        LinkCode.objects.create(
            organization=organization,
            product=product,
            code='USEDC3',
            channel='slack',
            channel_user_id='U04ABCD1234',
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=True,
            used_at=timezone.now(),
        )
        resp = public_client.post(self.URL, {
            'code': 'USEDC3',
            'external_user_id': '7842',
        }, format='json')
        assert resp.status_code == 400
        assert resp.data['error'] == 'code_already_used'

    def test_nonexistent_code(self, public_client, product):
        resp = public_client.post(self.URL, {
            'code': 'NOPE00',
            'external_user_id': '7842',
        }, format='json')
        assert resp.status_code == 400
        assert resp.data['error'] == 'code_not_found'


# ──────────────────────────────────────────────────────────────────────────────
# Public API: resolve
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestResolve:
    URL = '/api/public/identity/resolve/'

    def test_linked_user(self, public_client, mapping):
        resp = public_client.get(
            self.URL, {'channel': 'slack', 'channel_user_id': 'U04ABCD1234'},
        )
        assert resp.status_code == 200
        assert resp.data['is_linked'] is True
        assert resp.data['external_user_id'] == '7842'

    def test_unlinked_user(self, public_client, product):
        resp = public_client.get(
            self.URL, {'channel': 'slack', 'channel_user_id': 'U99UNKNOWN'},
        )
        assert resp.status_code == 200
        assert resp.data['is_linked'] is False
        assert resp.data['external_user_id'] is None


# ──────────────────────────────────────────────────────────────────────────────
# Admin API: identity mappings CRUD
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestAdminMappings:
    LIST_URL = '/api/admin/identity/mappings/'

    def test_list_empty(self, authenticated_client, product):
        resp = authenticated_client.get(self.LIST_URL)
        assert resp.status_code == 200
        assert resp.data['results'] == []

    def test_list_returns_own_org_only(self, authenticated_client, product, organization, mapping, other_product, other_organization):
        IdentityMapping.objects.create(
            organization=other_organization,
            product=other_product,
            channel='slack',
            channel_user_id='U99OTHER',
            external_user_id='other_user',
        )
        resp = authenticated_client.get(self.LIST_URL)
        assert resp.status_code == 200
        assert len(resp.data['results']) == 1
        assert resp.data['results'][0]['external_user_id'] == '7842'

    def test_create_mapping(self, authenticated_client, product):
        resp = authenticated_client.post(self.LIST_URL, {
            'product_id': str(product.id),
            'channel': 'discord',
            'channel_user_id': '123456789',
            'external_user_id': '9999',
            'email': 'user@test.com',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['channel'] == 'discord'
        assert resp.data['external_user_id'] == '9999'
        assert resp.data['linked_via'] == 'dashboard'

    def test_create_requires_product_id(self, authenticated_client):
        resp = authenticated_client.post(self.LIST_URL, {
            'channel': 'slack',
            'channel_user_id': 'U04ABCD1234',
            'external_user_id': '7842',
        }, format='json')
        assert resp.status_code == 400

    def test_soft_delete(self, authenticated_client, mapping):
        resp = authenticated_client.delete(f'{self.LIST_URL}{mapping.id}/')
        assert resp.status_code == 200
        mapping.refresh_from_db()
        assert mapping.is_active is False
        assert mapping.revoked_at is not None

    def test_unauthenticated_returns_401(self, unauthenticated_client):
        resp = unauthenticated_client.get(self.LIST_URL)
        assert resp.status_code in (401, 403)

    def test_filter_by_channel(self, authenticated_client, mapping, product, organization):
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='discord',
            channel_user_id='123456',
            external_user_id='1111',
        )
        resp = authenticated_client.get(self.LIST_URL, {'channel': 'slack'})
        assert resp.status_code == 200
        assert len(resp.data['results']) == 1
        assert resp.data['results'][0]['channel'] == 'slack'


@pytest.mark.django_db
class TestAdminBulkCreate:
    URL = '/api/admin/identity/mappings/bulk/'

    def test_bulk_create(self, authenticated_client, product):
        resp = authenticated_client.post(self.URL, {
            'product_id': str(product.id),
            'mappings': [
                {'channel': 'slack', 'channel_user_id': 'U001', 'external_user_id': '1001'},
                {'channel': 'slack', 'channel_user_id': 'U002', 'external_user_id': '1002'},
            ],
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['created'] == 2
        assert resp.data['skipped'] == 0

    def test_bulk_skips_existing(self, authenticated_client, product, organization):
        IdentityMapping.objects.create(
            organization=organization,
            product=product,
            channel='slack',
            channel_user_id='U001',
            external_user_id='existing',
        )
        resp = authenticated_client.post(self.URL, {
            'product_id': str(product.id),
            'mappings': [
                {'channel': 'slack', 'channel_user_id': 'U001', 'external_user_id': '1001'},
                {'channel': 'slack', 'channel_user_id': 'U002', 'external_user_id': '1002'},
            ],
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['created'] == 1
        assert resp.data['skipped'] == 1
