"""
KnowledgeSyncHistory serializers.
"""
from rest_framework import serializers
from apps.knowledge.models import KnowledgeSyncHistory


class KnowledgeSyncHistorySerializer(serializers.ModelSerializer):
    """Serializer for sync history entries."""

    class Meta:
        model = KnowledgeSyncHistory
        fields = [
            'id',
            'sync_type',
            'status',
            'started_at',
            'completed_at',
            'items_synced',
            'items_created',
            'items_updated',
            'items_failed',
            'items_deleted',
            'error_message',
            'created_at',
        ]
        read_only_fields = fields
