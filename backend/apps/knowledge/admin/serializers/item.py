"""
KnowledgeItem serializers.
"""
from rest_framework import serializers
from apps.knowledge.models import KnowledgeItem, KnowledgeSource


class KnowledgeItemListSerializer(serializers.ModelSerializer):
    """Serializer for listing knowledge items."""

    source_name = serializers.CharField(source='source.name', read_only=True)
    has_optimized_content = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeItem
        fields = [
            'id',
            'source',
            'source_name',
            'item_type',
            'title',
            'url',
            'status',
            'is_active',
            'excerpt',
            'has_optimized_content',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_has_optimized_content(self, obj) -> bool:
        """Check if the item has optimized content."""
        return bool(obj.optimized_content)


class KnowledgeItemSerializer(serializers.ModelSerializer):
    """Serializer for knowledge item details."""

    source_name = serializers.CharField(source='source.name', read_only=True)
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeItem
        fields = [
            'id',
            'source',
            'source_name',
            'item_type',
            'external_id',
            'url',
            'title',
            'raw_content',
            'optimized_content',
            'excerpt',
            'status',
            'content_hash',
            'last_indexed_at',
            'processing_error',
            'is_active',
            'metadata',
            'chunk_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'source',
            'source_name',
            'item_type',
            'external_id',
            'url',
            'raw_content',
            'optimized_content',
            'status',
            'content_hash',
            'last_indexed_at',
            'processing_error',
            'created_at',
            'updated_at',
            'chunk_count',
        ]

    def get_chunk_count(self, obj) -> int:
        """Get the number of chunks for this item."""
        return obj.chunks.count()


class KnowledgeItemUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating knowledge items (limited fields)."""

    class Meta:
        model = KnowledgeItem
        fields = [
            'title',
            'excerpt',
            'is_active',
            'metadata',
        ]
