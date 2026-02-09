"""
Analytics insights views for the dashboard.

Provides aggregate statistics for the analytics dashboard.
"""
from datetime import datetime, timedelta
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from apps.users.permissions import IsAuthenticatedAdmin
from apps.knowledge.models import KnowledgeItem
from apps.analytics.models import (
    Search,
    ChatConversation, ChatMessage,
)


def parse_date_range(request):
    """Parse start/end date from query params."""
    start_str = request.query_params.get('start')
    end_str = request.query_params.get('end')

    if start_str and end_str:
        try:
            start = datetime.strptime(start_str, '%Y-%m-%d').date()
            end = datetime.strptime(end_str, '%Y-%m-%d').date()
        except ValueError:
            # Default to last 30 days if invalid
            end = timezone.now().date()
            start = end - timedelta(days=30)
    else:
        # Default to last 30 days
        end = timezone.now().date()
        start = end - timedelta(days=30)

    return start, end


def get_previous_period(start, end):
    """Get the previous period of same length for comparison."""
    period_length = (end - start).days
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_length)
    return prev_start, prev_end


def calculate_change_percent(current, previous):
    """Calculate percentage change between two values."""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def get_organization_from_request(request):
    """
    Get organization from request query param or user's first organization.
    Validates user has access to the organization.
    """
    org_id = request.query_params.get('organization')
    user_orgs = request.user.organizations.all()

    if org_id:
        # Validate user has access
        org = user_orgs.filter(id=org_id).first()
        if not org:
            return None
        return org

    # Default to first organization
    return user_orgs.first()


def get_context_from_request(request):
    """
    Get organization and optional product from request params.
    Returns tuple of (organization, product_or_none).
    """
    from apps.products.models import Product
    
    organization = get_organization_from_request(request)
    if not organization:
        return None, None
    
    product_id = request.query_params.get('product')
    product = None
    if product_id:
        product = Product.objects.filter(id=product_id, organization=organization).first()
    
    return organization, product


def apply_product_filter(queryset, product, field_name='product'):
    """Apply product filter to queryset if product is specified."""
    if product:
        return queryset.filter(**{field_name: product})
    return queryset


@extend_schema(
    summary="Get overview statistics",
    description="Get aggregate statistics for the analytics dashboard",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='product', type=OpenApiTypes.UUID, description='Product ID (optional)'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
    ],
)
class OverviewStatsView(APIView):
    """Get overview statistics for the dashboard."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization, product = get_context_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        start, end = parse_date_range(request)
        prev_start, prev_end = get_previous_period(start, end)

        # Make end inclusive by adding 1 day for datetime comparison
        end_datetime = datetime.combine(end, datetime.max.time())
        start_datetime = datetime.combine(start, datetime.min.time())
        prev_end_datetime = datetime.combine(prev_end, datetime.max.time())
        prev_start_datetime = datetime.combine(prev_start, datetime.min.time())

        # Page views - ArticleView tracking has been removed
        # This feature is no longer supported
        current_views = 0
        prev_views = 0

        # Searches
        current_searches = Search.objects.filter(
            organization=organization,
            searched_at__gte=start_datetime,
            searched_at__lte=end_datetime,
        ).count()

        prev_searches = Search.objects.filter(
            organization=organization,
            searched_at__gte=prev_start_datetime,
            searched_at__lte=prev_end_datetime,
        ).count()

        # Helpfulness (from knowledge items)
        # Note: KnowledgeItem doesn't have helpfulness tracking yet
        # This will be 0 until helpfulness tracking is added to KnowledgeItem
        total_helpful = 0
        total_unhelpful = 0
        total_votes = 0
        helpfulness_pct = 0

        # AI chats - from ChatConversation model (with optional product filter)
        ai_chats_qs = ChatConversation.objects.filter(
            organization=organization,
            started_at__gte=start_datetime,
            started_at__lte=end_datetime,
        )
        ai_chats = apply_product_filter(ai_chats_qs, product).count()

        prev_ai_chats_qs = ChatConversation.objects.filter(
            organization=organization,
            started_at__gte=prev_start_datetime,
            started_at__lte=prev_end_datetime,
        )
        prev_ai_chats = apply_product_filter(prev_ai_chats_qs, product).count()

        response_data = {
            'stats': {
                'pageViews': {
                    'total': current_views,
                    'changePercent': calculate_change_percent(current_views, prev_views),
                },
                'searches': {
                    'total': current_searches,
                    'changePercent': calculate_change_percent(current_searches, prev_searches),
                },
                'helpfulness': {
                    'percentage': helpfulness_pct,
                    'changePercent': 0,  # Would need historical data to calculate
                },
                'aiChats': {
                    'total': ai_chats,
                    'changePercent': calculate_change_percent(ai_chats, prev_ai_chats),
                },
            },
            'dateRange': {
                'start': start.isoformat(),
                'end': end.isoformat(),
            },
        }

        return Response(response_data)


@extend_schema(
    summary="Get page views time series",
    description="Get page views data grouped by day",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
    ],
)
class PageViewsView(APIView):
    """Get page views time series data.
    
    Note: ArticleView tracking has been removed.
    This endpoint returns empty data for backwards compatibility.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization = get_organization_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        start, end = parse_date_range(request)

        # ArticleView tracking has been removed
        # Generate full date range with zeros for backwards compatibility
        data = []
        current = start
        while current <= end:
            data.append({
                'date': current.isoformat(),
                'views': 0,
            })
            current += timedelta(days=1)

        return Response({
            'data': data,
            'dateRange': {
                'start': start.isoformat(),
                'end': end.isoformat(),
            },
        })


@extend_schema(
    summary="Get article performance",
    description="Get top or low performing articles",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
        OpenApiParameter(name='type', type=OpenApiTypes.STR, description='Type: "top" or "low"', enum=['top', 'low']),
        OpenApiParameter(name='limit', type=OpenApiTypes.INT, description='Number of articles (default: 5)'),
    ],
)
class ArticlePerformanceView(APIView):
    """Get top or low performing articles based on search clicks.
    
    Note: ArticleView tracking has been removed.
    Performance is now based on search click data only.
    """

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization = get_organization_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        start, end = parse_date_range(request)
        perf_type = request.query_params.get('type', 'top')
        limit = int(request.query_params.get('limit', 5))

        end_datetime = datetime.combine(end, datetime.max.time())
        start_datetime = datetime.combine(start, datetime.min.time())

        # Get search appearances and clicks
        search_clicks = (
            Search.objects.filter(
                organization=organization,
                searched_at__gte=start_datetime,
                searched_at__lte=end_datetime,
                clicked_knowledge_item__isnull=False,
            )
            .values('clicked_knowledge_item_id')
            .annotate(clicks=Count('id'))
        )
        clicks_dict = {item['clicked_knowledge_item_id']: item['clicks'] for item in search_clicks}

        # Get knowledge items
        items = KnowledgeItem.objects.filter(
            organization=organization,
            is_active=True,
            status=KnowledgeItem.Status.INDEXED,
        ).select_related('source')

        # Build performance data
        performance_data = []
        for item in items:
            # ArticleView tracking removed - views are now 0
            views = 0
            unique_visitors = 0

            # KnowledgeItem doesn't have helpfulness tracking yet
            helpful = 0
            unhelpful = 0
            helpful_pct = 0

            search_clicks_count = clicks_dict.get(item.id, 0)

            performance_data.append({
                'id': str(item.id),
                'title': item.title,
                'slug': '',  # KnowledgeItem doesn't have slugs
                'category': item.source.name if item.source else 'Unknown Source',
                'categorySlug': '',
                'views': views,
                'uniqueVisitors': unique_visitors,
                'avgTimeOnPage': 0,  # Would need client-side tracking
                'bounceRate': 0,  # Would need client-side tracking
                'helpfulVotes': helpful,
                'unhelpfulVotes': unhelpful,
                'helpfulPercentage': helpful_pct,
                'searchAppearances': 0,  # Would need search result tracking
                'searchClicks': search_clicks_count,
            })

        # Sort by search clicks (since views are no longer tracked)
        if perf_type == 'low':
            # Low performers: sort by clicks ascending
            performance_data.sort(key=lambda x: x['searchClicks'])
        else:
            # Top performers: sort by clicks descending
            performance_data.sort(key=lambda x: x['searchClicks'], reverse=True)

        return Response({
            'articles': performance_data[:limit],
            'dateRange': {
                'start': start.isoformat(),
                'end': end.isoformat(),
            },
        })


@extend_schema(
    summary="Get search analytics",
    description="Get search query analytics with pagination",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
        OpenApiParameter(name='page', type=OpenApiTypes.INT, description='Page number (default: 1)'),
        OpenApiParameter(name='page_size', type=OpenApiTypes.INT, description='Page size (default: 10)'),
    ],
)
class SearchAnalyticsView(APIView):
    """Get search query analytics."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization = get_organization_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        start, end = parse_date_range(request)
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))

        end_datetime = datetime.combine(end, datetime.max.time())
        start_datetime = datetime.combine(start, datetime.min.time())

        # Aggregate search queries
        search_queries = (
            Search.objects.filter(
                organization=organization,
                searched_at__gte=start_datetime,
                searched_at__lte=end_datetime,
            )
            .values('query')
            .annotate(
                count=Count('id'),
                clicks=Count('clicked_knowledge_item', filter=Q(clicked_knowledge_item__isnull=False)),
                has_results=Sum('results_count'),
            )
            .order_by('-count')
        )

        total = search_queries.count()
        offset = (page - 1) * page_size
        paginated = search_queries[offset:offset + page_size]

        # Build response with click-through rates
        queries = []
        for item in paginated:
            count = item['count']
            clicks = item['clicks']
            ctr = round((clicks / count * 100), 1) if count > 0 else 0
            has_results = (item['has_results'] or 0) > 0

            # Get top result for this query
            top_result = None
            top_search = Search.objects.filter(
                organization=organization,
                query=item['query'],
                clicked_knowledge_item__isnull=False,
            ).select_related('clicked_knowledge_item').first()

            if top_search and top_search.clicked_knowledge_item:
                top_result = {
                    'id': str(top_search.clicked_knowledge_item.id),
                    'title': top_search.clicked_knowledge_item.title or top_search.clicked_knowledge_item.slug,
                }

            queries.append({
                'query': item['query'],
                'count': count,
                'clicks': clicks,
                'ctr': ctr,
                'topResult': top_result,
                'hasResults': has_results,
            })

        return Response({
            'queries': queries,
            'total': total,
            'page': page,
            'pageSize': page_size,
            'hasNext': offset + page_size < total,
        })


@extend_schema(
    summary="Get AI usage statistics",
    description="Get AI assistant usage statistics from ChatConversation data",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='product', type=OpenApiTypes.UUID, description='Product ID (optional)'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
    ],
)
class AIUsageView(APIView):
    """Get AI assistant usage statistics from real ChatConversation data."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization, product = get_context_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        start, end = parse_date_range(request)
        prev_start, prev_end = get_previous_period(start, end)

        end_datetime = datetime.combine(end, datetime.max.time())
        start_datetime = datetime.combine(start, datetime.min.time())
        prev_end_datetime = datetime.combine(prev_end, datetime.max.time())
        prev_start_datetime = datetime.combine(prev_start, datetime.min.time())

        # Query conversations in date range (with optional product filter)
        conversations = ChatConversation.objects.filter(
            organization=organization,
            started_at__gte=start_datetime,
            started_at__lte=end_datetime,
        )
        conversations = apply_product_filter(conversations, product)

        total_conversations = conversations.count()
        resolved_count = conversations.filter(status=ChatConversation.Status.RESOLVED).count()
        escalated_count = conversations.filter(status=ChatConversation.Status.ESCALATED).count()
        
        # Previous period for comparison (with same product filter)
        prev_conversations_qs = ChatConversation.objects.filter(
            organization=organization,
            started_at__gte=prev_start_datetime,
            started_at__lte=prev_end_datetime,
        )
        prev_conversations = apply_product_filter(prev_conversations_qs, product).count()

        # Calculate resolution rate
        resolution_rate = round((resolved_count / total_conversations * 100), 1) if total_conversations > 0 else 0

        # Get message stats (filtered by product if specified)
        messages = ChatMessage.objects.filter(
            organization=organization,
            conversation__in=conversations,
        )
        messages = apply_product_filter(messages, product)
        
        total_messages = messages.count()
        avg_messages = round(total_messages / total_conversations, 1) if total_conversations > 0 else 0

        # Top questions (user messages)
        top_questions = (
            messages.filter(role=ChatMessage.Role.USER)
            .values('content')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        top_questions_list = [
            {'question': q['content'], 'count': q['count']}
            for q in top_questions
        ]

        # Feedback stats
        feedback_messages = messages.filter(
            role=ChatMessage.Role.ASSISTANT,
        ).exclude(feedback=ChatMessage.Feedback.NONE)
        
        helpful_count = feedback_messages.filter(feedback=ChatMessage.Feedback.UP).count()
        unhelpful_count = feedback_messages.filter(feedback=ChatMessage.Feedback.DOWN).count()
        total_feedback = helpful_count + unhelpful_count
        helpful_rate = round((helpful_count / total_feedback * 100), 1) if total_feedback > 0 else 0

        # Escalation reasons
        escalation_reasons = (
            conversations.filter(status=ChatConversation.Status.ESCALATED)
            .exclude(escalation_reason='')
            .values('escalation_reason')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )
        escalation_reasons_list = [
            {'reason': r['escalation_reason'], 'count': r['count']}
            for r in escalation_reasons
        ]

        # Query type breakdown (new field)
        query_type_stats = (
            messages.filter(role=ChatMessage.Role.USER)
            .values('query_type')
            .annotate(count=Count('id'))
        )
        query_type_breakdown = {
            item['query_type']: item['count']
            for item in query_type_stats
        }

        # Intent breakdown (new field)
        intent_stats = (
            messages.filter(role=ChatMessage.Role.USER)
            .exclude(intent_category='')
            .values('intent_category')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        intent_breakdown = {
            item['intent_category']: item['count']
            for item in intent_stats
        }

        # Streaming stats (new field)
        assistant_messages = messages.filter(role=ChatMessage.Role.ASSISTANT)
        total_assistant = assistant_messages.count()
        stopped_count = assistant_messages.filter(was_stopped=True).count()
        stop_rate = round((stopped_count / total_assistant * 100), 1) if total_assistant > 0 else 0

        return Response({
            'stats': {
                'totalConversations': total_conversations,
                'changePercent': calculate_change_percent(total_conversations, prev_conversations),
                'resolutionRate': resolution_rate,
                'resolvedCount': resolved_count,
                'escalatedCount': escalated_count,
                'avgMessagesPerChat': avg_messages,
                'totalMessages': total_messages,
                'topQuestions': top_questions_list,
                'escalationReasons': escalation_reasons_list,
                'feedback': {
                    'helpfulCount': helpful_count,
                    'unhelpfulCount': unhelpful_count,
                    'helpfulRate': helpful_rate,
                },
                # New enhanced fields
                'queryTypeBreakdown': query_type_breakdown,
                'intentBreakdown': intent_breakdown,
                'streamingStats': {
                    'total': total_assistant,
                    'stoppedEarly': stopped_count,
                    'stopRatePercent': stop_rate,
                },
            },
            'dateRange': {
                'start': start.isoformat(),
                'end': end.isoformat(),
            },
        })


@extend_schema(
    summary="Get AI conversations time series",
    description="Get conversation counts grouped by day",
    parameters=[
        OpenApiParameter(name='organization', type=OpenApiTypes.UUID, description='Organization ID'),
        OpenApiParameter(name='product', type=OpenApiTypes.UUID, description='Product ID (optional)'),
        OpenApiParameter(name='start', type=OpenApiTypes.DATE, description='Start date (YYYY-MM-DD)'),
        OpenApiParameter(name='end', type=OpenApiTypes.DATE, description='End date (YYYY-MM-DD)'),
    ],
)
class ConversationsTrendView(APIView):
    """Get AI conversations time series data."""

    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        organization, product = get_context_from_request(request)
        if not organization:
            return Response({'error': 'Organization not found'}, status=status.HTTP_400_BAD_REQUEST)
        start, end = parse_date_range(request)

        end_datetime = datetime.combine(end, datetime.max.time())
        start_datetime = datetime.combine(start, datetime.min.time())

        # Group conversations by date (with optional product filter)
        conversations_qs = ChatConversation.objects.filter(
            organization=organization,
            started_at__gte=start_datetime,
            started_at__lte=end_datetime,
        )
        conversations_qs = apply_product_filter(conversations_qs, product)
        
        conversations_by_date = (
            conversations_qs
            .annotate(date=TruncDate('started_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        # Build dict for quick lookup
        conv_dict = {item['date']: item['count'] for item in conversations_by_date}

        # Generate full date range with zeros for missing days
        data = []
        current = start
        while current <= end:
            data.append({
                'date': current.isoformat(),
                'count': conv_dict.get(current, 0),
            })
            current += timedelta(days=1)

        return Response({
            'data': data,
            'dateRange': {
                'start': start.isoformat(),
                'end': end.isoformat(),
            },
        })


