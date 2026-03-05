"""
ViewSets for the analytics app.
"""
from datetime import datetime
from django.db.models import Count, Exists, OuterRef, Subquery, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
import django_filters

from apps.analytics.models import (
    Search, WidgetSession,
    ChatConversation, ChatMessage, Visitor
)
from apps.analytics.serializers import (
    SearchSerializer,
    WidgetSessionSerializer, ChatConversationSerializer, ChatMessageSerializer,
    ChatConversationListSerializer, ChatConversationDetailSerializer,
    ChatMessageDetailSerializer, VisitorSerializer,
)
from apps.users.permissions import IsAuthenticatedAdmin


class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination for analytics endpoints."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ChatConversationFilter(FilterSet):
    """Filter for ChatConversation queries."""
    started_at_gte = django_filters.DateTimeFilter(
        field_name='started_at', lookup_expr='gte'
    )
    started_at_lte = django_filters.DateTimeFilter(
        field_name='started_at', lookup_expr='lte'
    )
    has_negative_feedback = django_filters.BooleanFilter(
        method='filter_negative_feedback'
    )
    search = django_filters.CharFilter(method='filter_search')
    product = django_filters.UUIDFilter(field_name='product_id')
    query_type = django_filters.CharFilter(field_name='query_type')
    intent_category = django_filters.CharFilter(field_name='intent_category')

    class Meta:
        model = ChatConversation
        fields = [
            'status', 'started_at_gte', 'started_at_lte', 'has_negative_feedback',
            'search', 'product', 'query_type', 'intent_category',
        ]
    
    def filter_negative_feedback(self, queryset, name, value):
        """Filter conversations that have negative feedback on any message."""
        if value is True:
            return queryset.filter(
                messages__role=ChatMessage.Role.ASSISTANT,
                messages__feedback=ChatMessage.Feedback.DOWN
            ).distinct()
        elif value is False:
            return queryset.exclude(
                messages__role=ChatMessage.Role.ASSISTANT,
                messages__feedback=ChatMessage.Feedback.DOWN
            )
        return queryset
    
    def filter_search(self, queryset, name, value):
        """Search in message content."""
        if value:
            return queryset.filter(
                messages__content__icontains=value
            ).distinct()
        return queryset


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
    """
    ViewSet for viewing ChatConversations.
    
    Supports:
    - Pagination: page, page_size
    - Filtering: status, started_at_gte, started_at_lte, has_negative_feedback, search
    - List view with aggregated fields
    - Detail view with full message information
    """
    
    permission_classes = [IsAuthenticatedAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_class = ChatConversationFilter
    pagination_class = StandardResultsSetPagination
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return ChatConversationListSerializer
        return ChatConversationDetailSerializer
    
    def get_queryset(self):
        """
        Get conversations for user's organizations.
        Annotates with message count for list view.
        """
        queryset = ChatConversation.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).select_related('visitor')
        
        if self.action == 'list':
            # Annotate with message count for list view
            queryset = queryset.annotate(
                message_count=Count('messages')
            ).prefetch_related('messages')
        else:
            # Detail view - prefetch messages ordered by timestamp
            queryset = queryset.prefetch_related('messages')
        
        return queryset.order_by('-started_at')


class ChatMessageFilter(FilterSet):
    """Filter for ChatMessage queries."""
    product = django_filters.UUIDFilter(field_name='product_id')
    
    class Meta:
        model = ChatMessage
        fields = ['conversation', 'role', 'feedback', 'product']


class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing ChatMessages."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = ChatMessageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ChatMessageFilter
    
    def get_queryset(self):
        return ChatMessage.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).order_by('conversation', 'timestamp')


class VisitorFilter(FilterSet):
    """Filter for Visitor queries."""
    search = django_filters.CharFilter(method='filter_search')

    class Meta:
        model = Visitor
        fields = ['external_user_id', 'search']

    def filter_search(self, queryset, name, value):
        """Search across visitor_id, external_user_id, name, and email."""
        if value:
            return queryset.filter(
                Q(visitor_id__icontains=value) |
                Q(external_user_id__icontains=value) |
                Q(name__icontains=value) |
                Q(email__icontains=value)
            )
        return queryset


class VisitorViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing Visitors (SDK identified users)."""
    
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = VisitorSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = VisitorFilter
    
    def get_queryset(self):
        return Visitor.objects.filter(
            organization__in=self.request.user.organizations.all()
        ).annotate(
            conversation_count=Count('conversations')
        ).order_by('-last_seen_at')
