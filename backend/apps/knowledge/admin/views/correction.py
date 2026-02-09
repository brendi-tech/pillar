"""
Correction admin API views.

Provides endpoints for creating and managing corrections from conversation reviews.
"""
import logging
from uuid import UUID

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.decorators import action

from apps.analytics.models import ChatMessage, ChatConversation
from apps.knowledge.models import Correction
from apps.knowledge.services.correction_service import get_correction_service
from apps.users.permissions import IsAuthenticatedAdmin

logger = logging.getLogger(__name__)


class CreateCorrectionView(APIView):
    """
    POST /api/admin/corrections/create/
    
    Creates a correction from a conversation message.
    Processes through LLM and creates a knowledge snippet.
    
    Supports two modes:
    1. New mode: context_quotes + correction_notes (type is inferred)
    2. Legacy mode: correction_type + specific fields
    """
    
    permission_classes = [IsAuthenticatedAdmin]
    
    def post(self, request):
        """
        Create a correction from user feedback.
        
        Request body (new mode):
        {
            "message_id": "uuid",
            "correction_notes": "What should happen instead...",
            "context_quotes": [
                {"text": "...", "source": "message"|"reasoning", "step_index": 0, "step_type": "search"}
            ]
        }
        
        Request body (legacy mode):
        {
            "message_id": "uuid",
            "correction_notes": "The AI said X but it should be Y because...",
            "correction_type": "response" | "reasoning" | "source" | "search",
            "reasoning_step_index": 2,
            ...
        }
        
        Returns:
        {
            "id": "uuid",
            "status": "processed",
            "correction_type": "response",
            "processed_title": "...",
            "processed_content": "...",
            "knowledge_item_id": "uuid"
        }
        """
        # Use serializer for validation
        from apps.knowledge.admin.serializers.correction import CreateCorrectionSerializer
        
        serializer = CreateCorrectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        message_id = data['message_id']
        correction_notes = data['correction_notes']
        correction_type = data.get('correction_type', 'response')
        context_quotes = data.get('context_quotes', [])
        
        # Fetch the message and conversation
        try:
            message = ChatMessage.objects.select_related('conversation').get(
                id=message_id,
                conversation__organization__in=request.user.organizations.all(),
            )
        except ChatMessage.DoesNotExist:
            return Response(
                {'error': 'Message not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify it's an assistant message
        if message.role != ChatMessage.Role.ASSISTANT:
            return Response(
                {'error': 'Corrections can only be created for assistant messages'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        conversation = message.conversation
        organization = conversation.organization
        
        # Find the preceding user message for context
        user_message = ChatMessage.objects.filter(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            timestamp__lt=message.timestamp,
        ).order_by('-timestamp').first()
        
        # Capture the full display trace from the message
        full_reasoning_trace = message.display_trace or []
        
        # Build formatted correction notes with context quotes
        formatted_notes = self._format_correction_notes(correction_notes, context_quotes)
        
        # Extract reasoning step data if correcting a specific step
        reasoning_step_index = data.get('reasoning_step_index')
        original_reasoning_step = {}
        reasoning_step_type = ''
        
        if reasoning_step_index is not None:
            try:
                reasoning_step_index = int(reasoning_step_index)
                if 0 <= reasoning_step_index < len(full_reasoning_trace):
                    original_reasoning_step = full_reasoning_trace[reasoning_step_index]
                    reasoning_step_type = original_reasoning_step.get('step_type', '')
            except (ValueError, TypeError):
                reasoning_step_index = None
        
        # Create the Correction record with all fields
        correction = Correction.objects.create(
            organization=organization,
            source_message=message,
            source_conversation=conversation,
            original_question=user_message.content if user_message else '',
            original_response=message.content,
            user_correction_notes=formatted_notes,
            created_by=request.user,
            status=Correction.Status.PENDING,
            # Type and reasoning fields
            correction_type=correction_type,
            reasoning_step_index=reasoning_step_index,
            reasoning_step_type=reasoning_step_type,
            full_reasoning_trace=full_reasoning_trace,
            original_reasoning_step=original_reasoning_step,
            correct_reasoning=data.get('correct_reasoning', ''),
            correct_search_query=data.get('correct_search_query', ''),
            correct_sources=data.get('correct_sources', []),
        )
        
        # Process through LLM
        service = get_correction_service()
        result = service.process_correction(correction)
        
        # Refresh from DB
        correction.refresh_from_db()
        
        if result.success:
            return Response({
                'id': str(correction.id),
                'status': correction.status,
                'correction_type': correction.correction_type,
                'processed_title': correction.processed_title,
                'processed_content': correction.processed_content,
                'knowledge_item_id': str(correction.knowledge_item_id) if correction.knowledge_item_id else None,
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'id': str(correction.id),
                'status': correction.status,
                'correction_type': correction.correction_type,
                'error': result.error,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _format_correction_notes(self, notes: str, context_quotes: list) -> str:
        """
        Format correction notes with context quotes.
        
        If context quotes are provided, prepend them to the notes
        in a structured format for the LLM to understand.
        """
        if not context_quotes:
            return notes.strip()
        
        parts = []
        
        # Add context section
        parts.append("## Context being corrected:\n")
        for i, quote in enumerate(context_quotes, 1):
            source = quote.get('source', 'unknown')
            text = quote.get('text', '')
            step_type = quote.get('step_type', '')
            
            if source == 'reasoning' and step_type:
                parts.append(f"{i}. [{step_type.upper()}] \"{text}\"")
            else:
                parts.append(f"{i}. \"{text}\"")
        
        parts.append("")
        parts.append("## What should happen instead:\n")
        parts.append(notes.strip())
        
        return "\n".join(parts)


class CorrectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing corrections.
    
    GET /api/admin/corrections/ - list corrections
    GET /api/admin/corrections/{id}/ - get correction detail
    """
    
    permission_classes = [IsAuthenticatedAdmin]
    
    def get_queryset(self):
        return Correction.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).select_related(
            'knowledge_item',
            'source_conversation',
            'created_by',
        ).order_by('-created_at')
    
    def get_serializer_class(self):
        # Import here to avoid circular imports
        from apps.knowledge.admin.serializers.correction import CorrectionSerializer
        return CorrectionSerializer
    
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        """
        Reprocess a failed correction through the LLM again.
        """
        correction = self.get_object()
        
        if correction.status not in [Correction.Status.FAILED, Correction.Status.PENDING]:
            return Response(
                {'error': 'Only failed or pending corrections can be reprocessed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_correction_service()
        result = service.process_correction(correction)
        
        correction.refresh_from_db()
        
        return Response({
            'id': str(correction.id),
            'status': correction.status,
            'processed_title': correction.processed_title,
            'success': result.success,
            'error': result.error,
        })
