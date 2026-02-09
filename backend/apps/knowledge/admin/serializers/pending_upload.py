"""
PendingUpload serializers.
"""
from rest_framework import serializers
from apps.knowledge.models import PendingUpload


class PendingUploadSerializer(serializers.ModelSerializer):
    """Serializer for pending upload responses."""
    
    filename = serializers.CharField(source='original_filename', read_only=True)
    size = serializers.IntegerField(source='file_size', read_only=True)
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = PendingUpload
        fields = [
            'id',
            'filename',
            'size',
            'content_type',
            'status',
            'created_at',
            'expires_at',
        ]
        read_only_fields = fields
    
    def get_status(self, obj) -> str:
        """Return status based on expiry."""
        if obj.is_expired:
            return 'expired'
        return 'staged'
