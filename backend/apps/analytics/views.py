"""
ViewSets for the analytics app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.analytics.models import (
    Search, WidgetSession,
    ChatConversation, ChatMessage
)
from apps.analytics.serializers import (
    SearchSerializer,
    WidgetSessionSerializer, ChatConversationSerializer, ChatMessageSerializer
)
from apps.users.permissions import IsAuthenticatedAdmin


class SearchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing Search analytics."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = SearchSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['clicked_article']
    
    def get_queryset(self):
        return Search.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-searched_at')


class WidgetSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing WidgetSessions."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = WidgetSessionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['visitor_id']
    
    def get_queryset(self):
        return WidgetSession.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('-started_at')


class ChatConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing ChatConversations."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = ChatConversationSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['session', 'status']
    
    def get_queryset(self):
        return ChatConversation.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).prefetch_related('messages').order_by('-started_at')


class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing ChatMessages."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = ChatMessageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['conversation', 'role', 'feedback']
    
    def get_queryset(self):
        return ChatMessage.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('conversation', 'timestamp')
