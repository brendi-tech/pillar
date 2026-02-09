"""
Custom pagination classes for Django REST Framework.
"""
from rest_framework.pagination import PageNumberPagination, CursorPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination with configurable page size.
    Default: 50 items per page, max 200.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'page_size': self.page_size,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'results': data
        })


class LargeResultsSetPagination(PageNumberPagination):
    """
    Pagination for large result sets.
    Default: 100 items per page, max 1000.
    """
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000


class TimeSeriesCursorPagination(CursorPagination):
    """
    Cursor-based pagination for time-series data.
    Optimized for large datasets with timestamp ordering.
    """
    page_size = 100
    ordering = '-created_at'
    cursor_query_param = 'cursor'
