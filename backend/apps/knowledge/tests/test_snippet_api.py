"""
Tests for the Snippet API (POST /api/admin/knowledge/snippets/).

Focuses on external_id uniqueness — the source of a production IntegrityError
when snippets were created without an external_id, hitting the
(source_id, external_id) unique constraint.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.knowledge.models import KnowledgeItem, KnowledgeSource
from apps.products.models import Product
from apps.users.models import Organization, OrganizationMembership, User


URL = "/api/admin/knowledge/snippets/"


# ── Fixtures ────────────────────────────────────────────────────────────


@pytest.fixture
def organization(db):
    return Organization.objects.create(
        name="Snippet Test Org",
        plan="pro",
        subscription_status="active",
    )


@pytest.fixture
def product(organization):
    return Product.objects.create(
        organization=organization,
        name="Snippet Product",
        subdomain="snippet-product",
        is_default=True,
    )


@pytest.fixture
def user(organization):
    u = User.objects.create_user(
        email="snippet-tester@example.com",
        password="testpass123",
        full_name="Snippet Tester",
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=u,
        role=OrganizationMembership.Role.ADMIN,
    )
    u.current_organization = organization
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def snippet_payload():
    """Minimal valid payload for snippet creation."""
    return {
        "title": "How to reset your password",
        "content": "Go to Settings > Security > Reset Password.",
    }


# ── Tests ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSnippetCreation:
    """Creating snippets via the API."""

    def test_create_snippet_returns_201(self, client, product, snippet_payload):
        resp = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        assert resp.status_code == status.HTTP_201_CREATED

    def test_created_snippet_has_uuid_external_id(self, client, product, snippet_payload):
        resp = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        item = KnowledgeItem.objects.get(id=resp.data["id"])
        assert item.external_id, "external_id must not be empty"
        # UUID4 format: 8-4-4-4-12 hex chars
        parts = item.external_id.split("-")
        assert len(parts) == 5
        assert [len(p) for p in parts] == [8, 4, 4, 4, 12]

    def test_two_snippets_get_different_external_ids(
        self, client, product, snippet_payload
    ):
        """The bug: without uuid generation, two snippets would share an
        empty external_id and violate the (source, external_id) unique
        constraint."""
        resp1 = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        resp2 = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        assert resp1.status_code == status.HTTP_201_CREATED
        assert resp2.status_code == status.HTTP_201_CREATED

        item1 = KnowledgeItem.objects.get(id=resp1.data["id"])
        item2 = KnowledgeItem.objects.get(id=resp2.data["id"])
        assert item1.external_id != item2.external_id

    def test_many_snippets_all_unique_external_ids(self, client, product):
        """Bulk-create several snippets and verify every external_id is unique."""
        ids = []
        for i in range(10):
            resp = client.post(
                f"{URL}?product={product.id}",
                {"title": f"Snippet #{i}", "content": f"Body for snippet {i}"},
                format="json",
            )
            assert resp.status_code == status.HTTP_201_CREATED
            ids.append(resp.data["id"])

        external_ids = list(
            KnowledgeItem.objects.filter(id__in=ids).values_list(
                "external_id", flat=True
            )
        )
        assert len(external_ids) == 10
        assert len(set(external_ids)) == 10, "All external_ids must be unique"

    def test_snippet_shares_source_but_not_external_id(self, client, product):
        """All snippets for a product share the same KnowledgeSource but have
        distinct external_ids, satisfying the (source, external_id) unique
        constraint."""
        resp1 = client.post(
            f"{URL}?product={product.id}",
            {"title": "First", "content": "First body"},
            format="json",
        )
        resp2 = client.post(
            f"{URL}?product={product.id}",
            {"title": "Second", "content": "Second body"},
            format="json",
        )
        item1 = KnowledgeItem.objects.get(id=resp1.data["id"])
        item2 = KnowledgeItem.objects.get(id=resp2.data["id"])

        assert item1.source_id == item2.source_id, "Both should use the same snippets source"
        assert item1.external_id != item2.external_id

    def test_snippet_item_type_is_snippet(self, client, product, snippet_payload):
        resp = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        item = KnowledgeItem.objects.get(id=resp.data["id"])
        assert item.item_type == KnowledgeItem.ItemType.SNIPPET

    def test_snippet_content_stored_correctly(self, client, product):
        payload = {
            "title": "API Keys",
            "content": "Go to Dashboard > API Keys to generate a new key.",
            "excerpt": "Managing API keys",
        }
        resp = client.post(
            f"{URL}?product={product.id}", payload, format="json"
        )
        item = KnowledgeItem.objects.get(id=resp.data["id"])
        assert item.title == payload["title"]
        assert item.raw_content == payload["content"]
        assert item.optimized_content == payload["content"]
        assert item.excerpt == payload["excerpt"]

    def test_snippet_defaults_to_inactive(self, client, product, snippet_payload):
        resp = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        item = KnowledgeItem.objects.get(id=resp.data["id"])
        assert item.is_active is False

    def test_snippet_starts_in_pending_status(self, client, product, snippet_payload):
        resp = client.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        item = KnowledgeItem.objects.get(id=resp.data["id"])
        assert item.status == KnowledgeItem.Status.PENDING


@pytest.mark.django_db
class TestSnippetCreationValidation:
    """Edge cases and validation for snippet creation."""

    def test_missing_product_returns_400(self, client, snippet_payload):
        resp = client.post(URL, snippet_payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_product_returns_400(self, client, snippet_payload):
        resp = client.post(
            f"{URL}?product=00000000-0000-0000-0000-000000000000",
            snippet_payload,
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_title_returns_400(self, client, product):
        resp = client.post(
            f"{URL}?product={product.id}",
            {"content": "Body without title"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_content_returns_400(self, client, product):
        resp = client.post(
            f"{URL}?product={product.id}",
            {"title": "Title without body"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_returns_401_or_403(self, product, snippet_payload):
        anon = APIClient()
        resp = anon.post(
            f"{URL}?product={product.id}", snippet_payload, format="json"
        )
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestSnippetExternalIdIsolation:
    """External IDs are per-source, so snippets across different products
    should each get their own source and independent external_id space."""

    def test_different_products_get_different_sources(self, client, organization, user):
        prod_a = Product.objects.create(
            organization=organization,
            name="Product A",
            subdomain="product-a",
        )
        prod_b = Product.objects.create(
            organization=organization,
            name="Product B",
            subdomain="product-b",
        )

        payload = {"title": "Shared title", "content": "Shared content"}

        resp_a = client.post(f"{URL}?product={prod_a.id}", payload, format="json")
        resp_b = client.post(f"{URL}?product={prod_b.id}", payload, format="json")

        assert resp_a.status_code == status.HTTP_201_CREATED
        assert resp_b.status_code == status.HTTP_201_CREATED

        item_a = KnowledgeItem.objects.get(id=resp_a.data["id"])
        item_b = KnowledgeItem.objects.get(id=resp_b.data["id"])

        assert item_a.source_id != item_b.source_id
        # Both still have unique external_ids
        assert item_a.external_id != item_b.external_id

    def test_snippet_source_created_once_per_product(self, client, product):
        """get_or_create should reuse the same source for multiple snippets."""
        for i in range(3):
            client.post(
                f"{URL}?product={product.id}",
                {"title": f"Snippet {i}", "content": f"Content {i}"},
                format="json",
            )

        sources = KnowledgeSource.objects.filter(
            product=product,
            source_type=KnowledgeSource.SourceType.SNIPPETS,
        )
        assert sources.count() == 1
