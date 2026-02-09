"""
KeywordSearchTool - Keyword search across help center articles.

Copyright (C) 2025 Pillar Team
"""
import logging
from typing import Any, Dict, List

from apps.mcp.tools.base import Tool

logger = logging.getLogger(__name__)


class KeywordSearchTool(Tool):
    """
    Keyword search across help center articles.

    Uses ArticleKeywordSearchService for waterfall keyword search.
    """

    name = "keyword_search"
    public = True
    supports_streaming = True

    description = (
        "Search help center articles using keyword matching. "
        "Uses a waterfall strategy: title matches first, then excerpt, then full-text. "
        "Best for exact term matches and known phrase searches."
    )

    input_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Keywords to search for. "
                    "Examples: 'password reset', 'billing FAQ', 'API documentation'"
                ),
                "minLength": 1,
                "maxLength": 500
            },
            "top_k": {
                "type": "integer",
                "description": "Number of results to return",
                "default": 10,
                "minimum": 1,
                "maximum": 50
            },
            "category_slug": {
                "type": "string",
                "description": "Optional category slug to filter results",
                "maxLength": 100
            }
        },
        "required": ["query"]
    }

    annotations = {
        "readOnlyHint": True,
        "categories": ["search", "keyword", "articles"],
        "tags": ["search", "keyword", "text", "exact-match"],
        "useCases": [
            "Find articles with specific terms",
            "Exact phrase matching",
            "Filter by category"
        ],
        "capabilities": {
            "keyword_search": True,
            "waterfall_strategy": True,
            "category_filter": True
        }
    }

    async def execute(self, help_center_config, arguments: Dict[str, Any], request=None, language: str = 'en') -> Dict[str, Any]:
        """
        Execute keyword search (non-streaming).
        """
        from apps.knowledge.services import KnowledgeRAGServiceAsync

        query = arguments.get('query')
        if not query:
            return {
                'success': False,
                'error': 'Query parameter is required',
                'results': [],
                'result_count': 0
            }

        if not help_center_config:
            return {
                'success': False,
                'error': 'Help center context not available for search',
                'results': [],
                'result_count': 0
            }

        top_k = arguments.get('top_k', 10)

        logger.info(
            f"[keyword_search] Starting search: query='{query}' "
            f"help_center={help_center_config.id} top_k={top_k}"
        )

        try:
            # Execute keyword search using KnowledgeRAGService
            rag_service = KnowledgeRAGServiceAsync(
                organization_id=str(help_center_config.organization_id),
                product_id=str(help_center_config.id)
            )
            all_results = await rag_service.keyword_search(
                query=query,
                top_k=top_k,
            )

            logger.info(f"[keyword_search] Search complete: {len(all_results)} items")

            return {
                'success': True,
                'results': all_results,
                'result_count': len(all_results),
                'query': query
            }

        except Exception as e:
            logger.error(f"Error executing keyword_search: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'results': [],
                'result_count': 0
            }

    async def execute_stream(
        self,
        help_center_config,
        organization,
        request,
        arguments: Dict[str, Any],
        cancel_event=None,
        language: str = 'en'
    ):
        """
        Execute keyword search with streaming response.
        """
        from apps.knowledge.services import KnowledgeRAGServiceAsync

        query = arguments.get('query')
        if not query:
            yield {'type': 'error', 'message': 'Query parameter is required'}
            return

        if not help_center_config:
            yield {'type': 'error', 'message': 'Help center context not available for search'}
            return

        top_k = arguments.get('top_k', 10)

        logger.info(
            f"[keyword_search] Starting streaming search: query='{query}' "
            f"help_center={help_center_config.id} top_k={top_k}"
        )

        try:
            # Execute keyword search using KnowledgeRAGService
            rag_service = KnowledgeRAGServiceAsync(
                organization_id=str(organization.id),
                product_id=str(help_center_config.id)
            )
            all_results = await rag_service.keyword_search(
                query=query,
                top_k=top_k,
            )

            # Yield batch results
            if all_results:
                yield {
                    'type': 'search_results_batch',
                    'results': all_results,
                    'source': 'keyword',
                    'count': len(all_results)
                }

            # Yield completion
            yield {
                'type': 'search_complete',
                'total_results': len(all_results),
                'query': query,
                'results': all_results
            }

        except Exception as e:
            logger.exception(f"[keyword_search] Search failed: {e}")
            yield {'type': 'error', 'message': f'Search failed: {str(e)}'}
