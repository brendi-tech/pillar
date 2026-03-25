"""
PendingUpload ViewSet for staging file uploads before source creation.
"""
import logging
from pathlib import Path

from django.core.files.storage import default_storage
from rest_framework import viewsets, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.knowledge.models import PendingUpload
from apps.knowledge.admin.serializers.pending_upload import PendingUploadSerializer
from apps.knowledge.services.providers.document_upload_provider import (
    SUPPORTED_EXTENSIONS,
    MAX_FILE_SIZE,
)

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(summary="List pending uploads"),
    retrieve=extend_schema(summary="Get pending upload details"),
    destroy=extend_schema(summary="Delete pending upload"),
)
class PendingUploadViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing pending uploads.
    
    Pending uploads are files staged before a source is created.
    They expire after 24 hours if not attached to a source.
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = PendingUploadSerializer
    parser_classes = [MultiPartParser]
    http_method_names = ['get', 'post', 'delete']
    
    def get_queryset(self):
        """Filter by user's organization, exclude expired."""
        return PendingUpload.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-created_at')
    
    @extend_schema(
        summary="Upload file to staging",
        description="Upload a file to staging storage before creating a source.",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'file': {'type': 'string', 'format': 'binary'},
                },
                'required': ['file'],
            }
        },
        responses={
            201: PendingUploadSerializer,
            400: {'description': 'Invalid file'},
        }
    )
    def create(self, request, *args, **kwargs):
        """Upload a file to staging storage."""
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file extension
        ext = Path(file.name).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return Response(
                {'error': f'Unsupported file type: {ext}. Supported: {", ".join(SUPPORTED_EXTENSIONS)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size
        if file.size > MAX_FILE_SIZE:
            return Response(
                {'error': f'File too large: {file.size / 1024 / 1024:.1f}MB (max 100MB)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get organization
        from common.utils.organization import resolve_organization_from_request
        organization = resolve_organization_from_request(request)
        
        if not organization:
            return Response(
                {'error': 'User must belong to an organization'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Create pending upload record first to get ID
            pending_upload = PendingUpload.objects.create(
                organization=organization,
                original_filename=file.name,
                file_path='',  # Will be set after saving file
                file_size=file.size,
                content_type=file.content_type or '',
            )
            
            # Generate storage path: pending/{org_id}/{upload_id}/{filename}
            file_path = f"pending/{organization.id}/{pending_upload.id}/{file.name}"
            
            # Save file to storage
            saved_path = default_storage.save(file_path, file)
            
            # Update pending upload with actual path
            pending_upload.file_path = saved_path
            pending_upload.save(update_fields=['file_path'])
            
            logger.info(f"Staged file upload: {file.name} -> {saved_path}")
            
            serializer = self.get_serializer(pending_upload)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to stage upload: {e}")
            # Clean up if pending upload was created
            if 'pending_upload' in locals():
                pending_upload.delete()
            return Response(
                {'error': f'Upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """Delete a pending upload and its file."""
        pending_upload = self.get_object()
        
        # Delete file from storage
        if pending_upload.file_path:
            try:
                default_storage.delete(pending_upload.file_path)
                logger.info(f"Deleted staged file: {pending_upload.file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete staged file: {e}")
        
        # Delete record
        pending_upload.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
