"""
Cohere reranking service for RAG retrieval enhancement.

Implements two-stage retrieval:
1. Vector search retrieves candidates (bi-encoder)
2. Reranker reorders by relevance (cross-encoder)
"""
import asyncio
import logging
import time
from typing import List, Dict, Optional
import cohere
from django.conf import settings

logger = logging.getLogger(__name__)

# Timeout for Cohere API calls (seconds)
# Normal latency is ~150-200ms, so 3s is generous buffer
COHERE_TIMEOUT_SECONDS = 3.0


class CohereRerankerService:
    """
    Reranking service using Cohere's cross-encoder models.

    Provides more accurate relevance scoring than bi-encoder embeddings
    by processing query-document pairs through a cross-encoder.
    """

    def __init__(self):
        """Initialize Cohere client with API key from settings."""
        if not settings.COHERE_API_KEY:
            logger.warning("[Rerank] No COHERE_API_KEY found - reranking disabled")
            self.client = None
            self.async_client = None
            self.enabled = False
            self.model = None
            return

        # Configure clients with timeout to prevent long hangs
        self.client = cohere.Client(
            settings.COHERE_API_KEY,
            timeout=COHERE_TIMEOUT_SECONDS
        )
        self.async_client = cohere.AsyncClient(
            settings.COHERE_API_KEY,
            timeout=COHERE_TIMEOUT_SECONDS
        )
        self.model = settings.COHERE_RERANK_MODEL
        self.enabled = settings.COHERE_RERANK_ENABLED

        logger.info(
            f"[Rerank] Initialized with model: {self.model}, "
            f"timeout: {COHERE_TIMEOUT_SECONDS}s"
        )

    def rerank(
        self,
        query: str,
        documents: List[Dict],
        top_n: Optional[int] = None
    ) -> List[Dict]:
        """
        Rerank documents using Cohere's cross-encoder.

        Args:
            query: User's search query
            documents: List of document dicts with 'chunk_text' key
            top_n: Number of top results to return (default: from settings)

        Returns:
            Reranked documents with updated scores, or original on failure
        """
        if not self.enabled or not self.client:
            logger.info("[Rerank] Reranking disabled, returning original order")
            # Still respect top_n even when reranking is disabled
            if top_n is not None:
                return documents[:top_n]
            return documents

        if not documents:
            return []

        top_n = top_n or settings.COHERE_RERANK_TOP_N

        # Log BEFORE reranking
        logger.info(f"[Rerank] BEFORE - Top 10 candidates by vector score:")
        for i, doc in enumerate(documents[:10], 1):
            logger.info(
                f"  [{i}] score={doc.get('score', 0):.4f} | "
                f"url={doc.get('page_url', '')[:60]} | "
                f"chunk_preview={doc.get('chunk_text', '')[:80]}..."
            )

        # Prepare documents for Cohere API
        doc_texts = [d.get('chunk_text', '') for d in documents]

        try:
            start_time = time.time()

            # Call Cohere Rerank API with timeout
            response = self.client.rerank(
                query=query,
                documents=doc_texts,
                model=self.model,
                top_n=top_n,
                return_documents=False  # We already have the documents
            )

            latency_ms = (time.time() - start_time) * 1000

            # Check if we exceeded timeout
            if latency_ms > COHERE_TIMEOUT_SECONDS * 1000:
                logger.warning(
                    f"[Rerank] Cohere API was slow: {latency_ms:.0f}ms (limit: {COHERE_TIMEOUT_SECONDS}s)"
                )

            logger.info(
                f"[Rerank] Cohere API call completed in {latency_ms:.0f}ms | "
                f"Reranked {len(documents)} -> {len(response.results)} documents"
            )

            # Rebuild results with rerank scores
            reranked = []
            for rank, result in enumerate(response.results, 1):
                original_doc = documents[result.index]
                original_rank = result.index + 1

                reranked_doc = {
                    **original_doc,
                    'rerank_score': result.relevance_score,
                    'vector_score': original_doc.get('score', 0),
                    'score': result.relevance_score,  # Use rerank score as primary
                    'original_rank': original_rank,
                    'rerank_position': rank
                }
                reranked.append(reranked_doc)

            # Log AFTER reranking
            logger.info(f"[Rerank] AFTER - Top {len(reranked)} results by Cohere:")
            for rank, doc in enumerate(reranked, 1):
                position_change = doc['original_rank'] - rank
                change_indicator = "^" if position_change > 0 else "v" if position_change < 0 else "="

                logger.info(
                    f"  [{rank}] {change_indicator} (was #{doc['original_rank']}) | "
                    f"rerank={doc['rerank_score']:.4f} | "
                    f"vector={doc['vector_score']:.4f} | "
                    f"url={doc.get('page_url', '')[:60]}"
                )

            # Log biggest movers
            movers = sorted(
                [(doc['original_rank'] - doc['rerank_position'], doc) for doc in reranked],
                key=lambda x: abs(x[0]),
                reverse=True
            )[:3]

            if movers and abs(movers[0][0]) > 0:
                logger.info(f"[Rerank] Biggest ranking changes:")
                for change, doc in movers:
                    if change != 0:
                        direction = "UP" if change > 0 else "DOWN"
                        logger.info(
                            f"  {direction} {abs(change)} positions: "
                            f"#{doc['original_rank']} -> #{doc['rerank_position']} | "
                            f"{doc.get('page_url', '')[:60]}"
                        )

            return reranked

        except cohere.core.api_error.ApiError as e:
            if "timeout" in str(e).lower():
                logger.warning(
                    f"[Rerank] Cohere API TIMEOUT | "
                    f"Falling back to vector scores for {len(documents)} documents"
                )
            else:
                logger.error(
                    f"[Rerank] Cohere rerank failed: {e} | "
                    f"Falling back to original vector ranking",
                    exc_info=True
                )
            return documents[:top_n]
        except Exception as e:
            # Check for httpx timeout or other timeout-like exceptions
            if "timeout" in str(e).lower() or "timed out" in str(e).lower():
                logger.warning(
                    f"[Rerank] Cohere API TIMEOUT: {e} | "
                    f"Falling back to vector scores for {len(documents)} documents"
                )
            else:
                logger.error(
                    f"[Rerank] Cohere rerank failed: {e} | "
                    f"Falling back to original vector ranking",
                    exc_info=True
                )
            # Graceful fallback: return original ranking
            return documents[:top_n]

    async def rerank_async(
        self,
        query: str,
        documents: List[Dict],
        top_n: Optional[int] = None
    ) -> List[Dict]:
        """
        Async version of rerank using Cohere's async client.

        Eliminates sync_to_async overhead for better performance in async contexts.
        """
        if not self.enabled or not self.async_client:
            logger.info("[Rerank] Reranking disabled, returning original order")
            # Still respect top_n even when reranking is disabled
            if top_n is not None:
                return documents[:top_n]
            return documents

        if not documents:
            return []

        top_n = top_n or settings.COHERE_RERANK_TOP_N

        # Log BEFORE reranking
        logger.info(f"[Rerank] BEFORE - Top 10 candidates by vector score:")
        for i, doc in enumerate(documents[:10], 1):
            logger.info(
                f"  [{i}] score={doc.get('score', 0):.4f} | "
                f"url={doc.get('page_url', '')[:60]} | "
                f"chunk_preview={doc.get('chunk_text', '')[:80]}..."
            )

        # Prepare documents for Cohere API
        doc_texts = [d.get('chunk_text', '') for d in documents]

        try:
            start_time = time.time()

            # Call Cohere Rerank API with timeout protection
            try:
                response = await asyncio.wait_for(
                    self.async_client.rerank(
                        query=query,
                        documents=doc_texts,
                        model=self.model,
                        top_n=top_n,
                        return_documents=False
                    ),
                    timeout=COHERE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                latency_ms = (time.time() - start_time) * 1000
                logger.warning(
                    f"[Rerank] Cohere API TIMEOUT after {latency_ms:.0f}ms (limit: {COHERE_TIMEOUT_SECONDS}s) | "
                    f"Falling back to vector scores for {len(documents)} documents"
                )
                # Return original documents sorted by vector score, capped to top_n
                return documents[:top_n]

            latency_ms = (time.time() - start_time) * 1000
            logger.info(
                f"[Rerank] Cohere API call completed in {latency_ms:.0f}ms | "
                f"Reranked {len(documents)} -> {len(response.results)} documents"
            )

            # Rebuild results with rerank scores
            reranked = []
            for rank, result in enumerate(response.results, 1):
                original_doc = documents[result.index]
                original_rank = result.index + 1

                reranked_doc = {
                    **original_doc,
                    'rerank_score': result.relevance_score,
                    'vector_score': original_doc.get('score', 0),
                    'score': result.relevance_score,
                    'original_rank': original_rank,
                    'rerank_position': rank
                }
                reranked.append(reranked_doc)

            # Log AFTER reranking
            logger.info(f"[Rerank] AFTER - Top {len(reranked)} results by Cohere:")
            for rank, doc in enumerate(reranked, 1):
                position_change = doc['original_rank'] - rank
                change_indicator = "^" if position_change > 0 else "v" if position_change < 0 else "="

                logger.info(
                    f"  [{rank}] {change_indicator} (was #{doc['original_rank']}) | "
                    f"rerank={doc['rerank_score']:.4f} | "
                    f"vector={doc['vector_score']:.4f} | "
                    f"url={doc.get('page_url', '')[:60]}"
                )

            # Log biggest movers
            movers = sorted(
                [(doc['original_rank'] - doc['rerank_position'], doc) for doc in reranked],
                key=lambda x: abs(x[0]),
                reverse=True
            )[:3]

            if movers and abs(movers[0][0]) > 0:
                logger.info(f"[Rerank] Biggest ranking changes:")
                for change, doc in movers:
                    if change != 0:
                        direction = "UP" if change > 0 else "DOWN"
                        logger.info(
                            f"  {direction} {abs(change)} positions: "
                            f"#{doc['original_rank']} -> #{doc['rerank_position']} | "
                            f"{doc.get('page_url', '')[:60]}"
                        )

            return reranked

        except Exception as e:
            logger.error(
                f"[Rerank] Cohere async rerank failed: {e} | "
                f"Falling back to original vector ranking",
                exc_info=True
            )
            return documents[:top_n]


# Global singleton instance
_reranker_instance = None

def get_reranker() -> CohereRerankerService:
    """Get or create singleton reranker instance."""
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = CohereRerankerService()
    return _reranker_instance
