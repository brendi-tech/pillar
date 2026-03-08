"""
Snippet serializers - convenience wrappers for KnowledgeItem with item_type='snippet'.
"""
import uuid

from rest_framework import serializers
from apps.knowledge.models import KnowledgeItem, KnowledgeSource


class SnippetListSerializer(serializers.ModelSerializer):
    """Serializer for listing snippets."""

    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeItem
        fields = [
            'id',
            'title',
            'raw_content',
            'excerpt',
            'is_active',
            'status',
            'metadata',
            'chunk_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_chunk_count(self, obj) -> int:
        """Get the number of chunks for this item."""
        return obj.chunks.count()


class SnippetSerializer(serializers.ModelSerializer):
    """Serializer for snippet details."""

    content = serializers.CharField(source='raw_content', required=False)
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeItem
        fields = [
            'id',
            'title',
            'raw_content',
            'content',  # Alias for raw_content for backwards compatibility
            'excerpt',
            'is_active',
            'status',
            'metadata',
            'chunk_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'raw_content',
            'content',
            'status',
            'chunk_count',
            'created_at',
            'updated_at',
        ]

    def get_chunk_count(self, obj) -> int:
        """Get the number of chunks for this item."""
        return obj.chunks.count()


class SnippetCreateSerializer(serializers.Serializer):
    """Serializer for creating snippets."""

    title = serializers.CharField(max_length=500)
    content = serializers.CharField()
    excerpt = serializers.CharField(required=False, allow_blank=True, default='')
    is_active = serializers.BooleanField(default=False)  # Snippets start as drafts
    metadata = serializers.JSONField(required=False, default=dict)

    def create(self, validated_data):
        """Create snippet as a KnowledgeItem."""
        from apps.products.models import Product

        request = self.context.get('request')
        organization = request.user.primary_organization

        # Get product from request (required for proper gating)
        product_id = request.query_params.get('product') or request.data.get('product')
        if not product_id:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError({
                'product': 'Product ID is required.'
            })
        try:
            product = Product.objects.get(id=product_id, organization=organization)
        except Product.DoesNotExist:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError({
                'product': 'Invalid product ID or product does not belong to your organization.'
            })

        # Get or create the snippets source for this organization and product
        snippets_source, _ = KnowledgeSource.objects.get_or_create(
            organization=organization,
            product=product,
            source_type=KnowledgeSource.SourceType.SNIPPETS,
            defaults={
                'name': 'Custom Snippets',
                'status': KnowledgeSource.Status.ACTIVE,
            }
        )

        # Create the snippet item
        snippet = KnowledgeItem.objects.create(
            organization=organization,
            product=product,  # Denormalized from source
            source=snippets_source,
            item_type=KnowledgeItem.ItemType.SNIPPET,
            external_id=str(uuid.uuid4()),
            title=validated_data['title'],
            raw_content=validated_data['content'],
            optimized_content=validated_data['content'],  # No LLM processing for snippets
            excerpt=validated_data.get('excerpt', ''),
            is_active=validated_data.get('is_active', False),
            metadata=validated_data.get('metadata', {}),
            status=KnowledgeItem.Status.PENDING,  # Will be processed to create chunks
        )

        return snippet

    def to_representation(self, instance):
        """Return the created snippet using SnippetSerializer."""
        return SnippetSerializer(instance).data
