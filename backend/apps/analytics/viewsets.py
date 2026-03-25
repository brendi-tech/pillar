"""
ViewSets for the analytics app.
"""
from datetime import datetime
from django.db.models import Count, Exists, OuterRef, Subquery, Q, Prefetch
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
from apps.knowledge.models import Correction
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
    channel = django_filters.CharFilter(field_name='channel')
    agent = django_filters.UUIDFilter(field_name='agent_id')
    query_type = django_filters.CharFilter(field_name='query_type')
    intent_category = django_filters.CharFilter(field_name='intent_category')

    class Meta:
        model = ChatConversation
        fields = [
            'status', 'started_at_gte', 'started_at_lte', 'has_negative_feedback',
            'search', 'product', 'channel', 'agent', 'query_type', 'intent_category',
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
        ).select_related('visitor', 'agent')
        
        if self.action == 'list':
            # Annotate with message count for list view
            queryset = queryset.annotate(
                message_count=Count('messages')
            ).prefetch_related('messages')
        else:
            # Detail view - prefetch messages with their corrections
            queryset = queryset.prefetch_related(
                Prefetch(
                    'messages',
                    queryset=ChatMessage.objects.prefetch_related(
                        Prefetch(
                            'corrections',
                            queryset=Correction.objects.order_by('-created_at'),
                            to_attr='_corrections_list'
                        )
                    )
                )
            )
        
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


class UnifiedUserViewSet(viewsets.ViewSet):
    """
    Merges Visitor (web SDK) and IdentityMapping (channel linking) records
    into a single user list keyed by external_user_id.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def list(self, request):
        from apps.identity.models import IdentityMapping
        from collections import defaultdict

        org_ids = list(request.user.organizations.values_list("id", flat=True))
        search = request.query_params.get("search", "").strip()
        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 20)), 100)

        visitors_qs = Visitor.objects.filter(
            organization_id__in=org_ids,
            external_user_id__isnull=False,
        ).exclude(external_user_id="")

        mappings_qs = IdentityMapping.objects.filter(
            organization_id__in=org_ids,
            is_active=True,
        )

        if search:
            visitors_qs = visitors_qs.filter(
                Q(external_user_id__icontains=search)
                | Q(name__icontains=search)
                | Q(email__icontains=search)
            )
            mappings_qs = mappings_qs.filter(
                Q(external_user_id__icontains=search)
                | Q(channel_user_id__icontains=search)
                | Q(email__icontains=search)
            )

        visitor_map: dict[str, Visitor] = {}
        for v in visitors_qs.iterator():
            visitor_map[v.external_user_id] = v

        channel_map: dict[str, list[str]] = defaultdict(list)
        earliest_mapping: dict[str, datetime] = {}
        for m in mappings_qs.iterator():
            if m.channel not in channel_map[m.external_user_id]:
                channel_map[m.external_user_id].append(m.channel)
            ts = m.created_at
            if m.external_user_id not in earliest_mapping or ts < earliest_mapping[m.external_user_id]:
                earliest_mapping[m.external_user_id] = ts

        all_ext_ids = set(visitor_map.keys()) | set(channel_map.keys())

        users = []
        for ext_id in all_ext_ids:
            visitor = visitor_map.get(ext_id)
            channels = list(channel_map.get(ext_id, []))
            if visitor:
                channels = ["web"] + [c for c in channels if c != "web"]

            first_seen = None
            if visitor and ext_id in earliest_mapping:
                first_seen = min(visitor.first_seen_at, earliest_mapping[ext_id])
            elif visitor:
                first_seen = visitor.first_seen_at
            elif ext_id in earliest_mapping:
                first_seen = earliest_mapping[ext_id]

            users.append({
                "external_user_id": ext_id,
                "name": visitor.name if visitor else "",
                "email": visitor.email if visitor else "",
                "channels": channels,
                "first_seen_at": first_seen.isoformat() if first_seen else None,
                "last_seen_at": visitor.last_seen_at.isoformat() if visitor else None,
            })

        users.sort(key=lambda u: u["first_seen_at"] or "", reverse=True)

        total = len(users)
        start = (page - 1) * page_size
        page_results = users[start : start + page_size]

        return Response({
            "count": total,
            "next": page + 1 if start + page_size < total else None,
            "previous": page - 1 if page > 1 else None,
            "results": page_results,
        })
