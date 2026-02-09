"""
KnowledgeSource serializers.
"""
from rest_framework import serializers
from apps.knowledge.models import KnowledgeSource


class KnowledgeSourceListSerializer(serializers.ModelSerializer):
    """Serializer for listing knowledge sources."""

    # Use live counts from annotation if available
    item_count = serializers.SerializerMethodField()
    pages_indexed = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSource
        fields = [
            'id',
            'name',
            'source_type',
            'url',
            'status',
            'last_synced_at',
            'item_count',
            'pages_indexed',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_item_count(self, obj) -> int:
        """Return live item count (pages crawled) from annotation."""
        if hasattr(obj, 'live_item_count'):
            return obj.live_item_count
        return obj.item_count

    def get_pages_indexed(self, obj) -> int:
        """Return count of indexed items (pages with embeddings)."""
        if hasattr(obj, 'live_indexed_count'):
            return obj.live_indexed_count
        # Fallback: query directly (slower, used when annotation not present)
        return obj.items.filter(status='indexed').count()


class KnowledgeSourceSerializer(serializers.ModelSerializer):
    """Serializer for knowledge source details."""

    # Use live counts from annotation if available
    item_count = serializers.SerializerMethodField()
    pages_indexed = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSource
        fields = [
            'id',
            'name',
            'source_type',
            'url',
            'crawl_config',
            'connection_config',
            'status',
            'last_synced_at',
            'error_message',
            'item_count',
            'pages_indexed',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'last_synced_at',
            'error_message',
            'item_count',
            'pages_indexed',
            'created_at',
            'updated_at',
        ]

    def get_item_count(self, obj) -> int:
        """Return live item count (pages crawled) from annotation."""
        if hasattr(obj, 'live_item_count'):
            return obj.live_item_count
        return obj.item_count

    def get_pages_indexed(self, obj) -> int:
        """Return count of indexed items (pages with embeddings)."""
        if hasattr(obj, 'live_indexed_count'):
            return obj.live_indexed_count
        # Fallback: query directly (slower, used when annotation not present)
        return obj.items.filter(status='indexed').count()


class KnowledgeSourceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating knowledge sources."""
    
    # Optional list of pending upload IDs to attach when creating a document_upload source
    pending_upload_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        help_text="List of pending upload IDs to attach to this source (for document_upload type)"
    )

    class Meta:
        model = KnowledgeSource
        fields = [
            'id',
            'name',
            'source_type',
            'url',
            'crawl_config',
            'connection_config',
            'pending_upload_ids',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        """Validate source configuration based on source type."""
        source_type = attrs.get('source_type')
        url = attrs.get('url', '')
        connection_config = attrs.get('connection_config', {})

        # URL required for crawl-based sources
        if source_type in [
            KnowledgeSource.SourceType.HELP_CENTER,
            KnowledgeSource.SourceType.MARKETING_SITE,
            KnowledgeSource.SourceType.WEBSITE_CRAWL,
        ]:
            if not url:
                raise serializers.ValidationError({
                    'url': 'URL is required for website crawl sources.'
                })
            
            # Normalize URL: prepend https:// if no protocol specified
            url = url.strip()
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'
            
            # Basic validation: must have at least one dot (e.g., example.com)
            # Extract host part for validation
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                if not parsed.netloc or '.' not in parsed.netloc:
                    raise serializers.ValidationError({
                        'url': 'Please enter a valid domain (e.g., example.com)'
                    })
            except Exception:
                raise serializers.ValidationError({
                    'url': 'Please enter a valid URL'
                })
            
            attrs['url'] = url

        # URL should be empty for snippets
        if source_type == KnowledgeSource.SourceType.SNIPPETS and url:
            raise serializers.ValidationError({
                'url': 'URL should be empty for snippet sources.'
            })

        # Validate cloud_storage connection_config
        if source_type == KnowledgeSource.SourceType.CLOUD_STORAGE:
            if not connection_config:
                raise serializers.ValidationError({
                    'connection_config': 'Connection config is required for cloud storage sources.'
                })
            provider = connection_config.get('provider')
            if provider not in ('s3', 'gcs'):
                raise serializers.ValidationError({
                    'connection_config': 'Provider must be "s3" or "gcs".'
                })
            if not connection_config.get('bucket'):
                raise serializers.ValidationError({
                    'connection_config': 'Bucket name is required.'
                })
            # Validate provider-specific fields
            if provider == 's3':
                if not connection_config.get('access_key') or not connection_config.get('secret_key'):
                    raise serializers.ValidationError({
                        'connection_config': 'Access key and secret key are required for S3.'
                    })
            elif provider == 'gcs':
                if not connection_config.get('credentials_json'):
                    raise serializers.ValidationError({
                        'connection_config': 'Service account JSON is required for GCS.'
                    })

        # Validate pending_upload_ids only for document_upload sources
        pending_upload_ids = attrs.get('pending_upload_ids', [])
        if pending_upload_ids:
            if source_type != KnowledgeSource.SourceType.DOCUMENT_UPLOAD:
                raise serializers.ValidationError({
                    'pending_upload_ids': 'Pending uploads can only be attached to document_upload sources.'
                })

        return attrs

    def create(self, validated_data):
        """Create the source with organization and product from request."""
        import hashlib
        import logging
        from pathlib import Path
        from django.core.files.storage import default_storage
        from django.utils import timezone
        from apps.knowledge.models import KnowledgeItem, PendingUpload
        from apps.products.models import Product
        
        logger = logging.getLogger(__name__)
        
        request = self.context.get('request')
        organization = request.user.primary_organization

        if not organization:
            # Fallback to first organization if no primary set
            organization = request.user.organizations.first()

        if not organization:
            raise serializers.ValidationError({
                'organization': 'User must belong to an organization to create sources.'
            })

        # Get product from request (required for proper gating)
        product_id = request.query_params.get('product') or request.data.get('product')
        if not product_id:
            raise serializers.ValidationError({
                'product': 'Product ID is required.'
            })
        try:
            product = Product.objects.get(id=product_id, organization=organization)
        except Product.DoesNotExist:
            raise serializers.ValidationError({
                'product': 'Invalid product ID or product does not belong to your organization.'
            })

        # Extract pending_upload_ids before creating source
        pending_upload_ids = validated_data.pop('pending_upload_ids', [])
        
        validated_data['organization'] = organization
        validated_data['product'] = product

        # Encrypt cloud storage credentials before saving
        source_type = validated_data.get('source_type')
        connection_config = validated_data.get('connection_config', {})

        if source_type == KnowledgeSource.SourceType.CLOUD_STORAGE and connection_config:
            from common.services.credential_encryption import encrypt_value

            provider = connection_config.get('provider')
            if provider == 's3':
                # Encrypt S3 credentials
                if connection_config.get('access_key'):
                    connection_config['access_key'] = encrypt_value(connection_config['access_key'])
                if connection_config.get('secret_key'):
                    connection_config['secret_key'] = encrypt_value(connection_config['secret_key'])
            elif provider == 'gcs':
                # Encrypt GCS credentials
                if connection_config.get('credentials_json'):
                    connection_config['credentials_json'] = encrypt_value(connection_config['credentials_json'])

            validated_data['connection_config'] = connection_config

        # Create the source
        source = super().create(validated_data)
        
        # Process pending uploads for document_upload sources
        if source_type == KnowledgeSource.SourceType.DOCUMENT_UPLOAD and pending_upload_ids:
            from common.task_router import TaskRouter
            
            # Get pending uploads owned by this organization
            pending_uploads = PendingUpload.objects.filter(
                id__in=pending_upload_ids,
                organization=organization,
            )
            
            created_items = []
            
            for pending_upload in pending_uploads:
                try:
                    # Read file from staging
                    if not default_storage.exists(pending_upload.file_path):
                        logger.warning(f"Pending upload file not found: {pending_upload.file_path}")
                        continue
                    
                    # Generate new permanent path
                    new_path = f"documents/{organization.id}/{source.id}/{pending_upload.original_filename}"
                    
                    # Copy file to new location (GCS doesn't have rename, so we copy)
                    with default_storage.open(pending_upload.file_path, 'rb') as f:
                        saved_path = default_storage.save(new_path, f)
                    
                    # Delete old file
                    try:
                        default_storage.delete(pending_upload.file_path)
                    except Exception as e:
                        logger.warning(f"Failed to delete staging file: {e}")
                    
                    # Generate external_id from saved path
                    external_id = hashlib.md5(saved_path.encode()).hexdigest()
                    
                    # Create KnowledgeItem (status=pending, will be processed by worker)
                    item = KnowledgeItem.objects.create(
                        organization=organization,
                        product=product,  # Denormalized from source
                        source=source,
                        item_type=KnowledgeItem.ItemType.PAGE,
                        external_id=external_id,
                        title=Path(pending_upload.original_filename).stem,
                        url="",  # No external URL
                        raw_content="",  # Will be extracted by worker
                        status=KnowledgeItem.Status.PENDING,
                        is_active=True,
                        metadata={
                            "file_path": saved_path,
                            "original_filename": pending_upload.original_filename,
                            "file_size_bytes": pending_upload.file_size,
                            "file_type": Path(pending_upload.original_filename).suffix.lstrip("."),
                            "uploaded_at": timezone.now().isoformat(),
                        },
                    )
                    created_items.append(item)
                    
                    logger.info(f"Created KnowledgeItem {item.id} from pending upload {pending_upload.id}")
                    
                    # Delete pending upload record
                    pending_upload.delete()
                    
                except Exception as e:
                    logger.error(f"Failed to process pending upload {pending_upload.id}: {e}")
                    continue
            
            # Queue all items for processing
            for item in created_items:
                TaskRouter.execute("knowledge-process-item", item_id=str(item.id))
            
            logger.info(f"Created {len(created_items)} items from pending uploads for source {source.id}")
        
        return source
