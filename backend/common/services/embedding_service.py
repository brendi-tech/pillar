"""
Unified embedding service for all embedding operations.

This service provides a single entry point for generating embeddings throughout
the application. It respects the configured embedding provider (OpenAI, Google, etc.)
and supports both synchronous and asynchronous contexts.

Key features:
- Respects RAG_EMBEDDING_PROVIDER and RAG_EMBEDDING_MODEL settings
- Supports both sync and async methods
- Uses module-level cache from embedding_cache.py for efficiency
- Proper task types (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT)
- Singleton pattern for consistent model usage across the application

Usage:
    from common.services.embedding_service import get_embedding_service
    
    # Sync context
    service = get_embedding_service()
    query_embedding = service.embed_query("What is the pricing?")
    
    # Async context
    service = get_embedding_service()
    query_embedding = await service.embed_query_async("What is the pricing?")
"""
import logging
import numpy as np
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Singleton service for generating embeddings.
    
    This service wraps the embedding model from embedding_cache and provides
    a clean API with both sync and async methods.
    
    Do not instantiate directly - use get_embedding_service() instead.
    """
    
    def __init__(self):
        """
        Initialize the embedding service.
        
        Loads the embedding model from cache (respects settings).
        """
        from common.utils.embedding_cache import get_embedding_model
        self._model = get_embedding_model()
        logger.debug("EmbeddingService initialized")
    
    def embed_query(self, text: str) -> List[float]:
        """
        Generate query embedding for search/matching operations.
        
        Uses RETRIEVAL_QUERY task type (optimized for search queries).
        
        Args:
            text: Query text to embed
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            ValueError: If text is empty or None
            Exception: If embedding generation fails
            
        Example:
            service = get_embedding_service()
            embedding = service.embed_query("What is your pricing?")
            print(len(embedding))  # 1536 for typical models
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        try:
            embedding = self._model.get_query_embedding(text)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}", exc_info=True)
            raise
    
    def embed_document(self, text: str) -> List[float]:
        """
        Generate document embedding for indexing operations.
        
        Uses RETRIEVAL_DOCUMENT task type (optimized for document content).
        
        Args:
            text: Document text to embed
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            ValueError: If text is empty or None
            Exception: If embedding generation fails
            
        Example:
            service = get_embedding_service()
            embedding = service.embed_document("Our Pro plan costs $99/month")
            print(len(embedding))  # 1536 for typical models
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        try:
            embedding = self._model.get_text_embedding(text)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate document embedding: {e}", exc_info=True)
            raise
    
    async def embed_query_async(self, text: str) -> List[float]:
        """
        Generate query embedding asynchronously.
        
        Uses native async from llama_index (aget_query_embedding) — no thread pool.
        
        Args:
            text: Query text to embed
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            ValueError: If text is empty or None
            Exception: If embedding generation fails
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        try:
            embedding = await self._model.aget_query_embedding(text)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate async query embedding: {e}", exc_info=True)
            raise
    
    async def embed_document_async(self, text: str) -> List[float]:
        """
        Generate document embedding asynchronously.
        
        Uses native async from llama_index (aget_text_embedding) — no thread pool.
        
        Args:
            text: Document text to embed
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            ValueError: If text is empty or None
            Exception: If embedding generation fails
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        try:
            embedding = await self._model.aget_text_embedding(text)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate async document embedding: {e}", exc_info=True)
            raise
    
    def calculate_similarity(
        self, 
        embedding1: List[float], 
        embedding2: List[float]
    ) -> float:
        """
        Calculate cosine similarity between two embeddings.
        
        Cosine similarity ranges from -1 (opposite) to 1 (identical).
        For normalized embeddings, this is equivalent to dot product.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Float between -1 and 1 representing similarity
            
        Raises:
            ValueError: If embeddings are invalid or different dimensions
            
        Example:
            service = get_embedding_service()
            emb1 = service.embed_query("What is pricing?")
            emb2 = service.embed_query("How much does it cost?")
            similarity = service.calculate_similarity(emb1, emb2)
            print(f"Similarity: {similarity:.2%}")  # e.g., "Similarity: 87%"
        """
        if not embedding1 or not embedding2:
            raise ValueError("Embeddings cannot be None or empty")
        
        if len(embedding1) != len(embedding2):
            raise ValueError(
                f"Embedding dimensions must match: "
                f"{len(embedding1)} != {len(embedding2)}"
            )
        
        # Convert to numpy arrays for efficient computation
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Calculate norms
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            logger.warning("Zero-length vector encountered in similarity calculation")
            return 0.0
        
        # Cosine similarity = dot product / (norm1 * norm2)
        similarity = np.dot(vec1, vec2) / (norm1 * norm2)
        
        return float(similarity)
    
    def batch_embed_documents(
        self, 
        texts: List[str],
        show_progress: bool = False
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple documents.
        
        Note: Currently processes sequentially. Future optimization could
        add true batch processing for supported embedding models.
        
        Args:
            texts: List of document texts to embed
            show_progress: Whether to log progress (useful for large batches)
            
        Returns:
            List of embedding vectors, same order as input texts
            
        Raises:
            ValueError: If texts is empty or contains invalid entries
            
        Example:
            service = get_embedding_service()
            docs = ["Doc 1 text", "Doc 2 text", "Doc 3 text"]
            embeddings = service.batch_embed_documents(docs)
            print(len(embeddings))  # 3
        """
        if not texts:
            return []
        
        embeddings = []
        total = len(texts)
        
        for idx, text in enumerate(texts, 1):
            if show_progress and idx % 10 == 0:
                logger.info(f"Batch embedding progress: {idx}/{total}")
            
            try:
                embedding = self.embed_document(text)
                embeddings.append(embedding)
            except Exception as e:
                logger.error(
                    f"Failed to embed document {idx}/{total}: {e}",
                    exc_info=True
                )
                # Re-raise to stop batch processing on error
                raise
        
        if show_progress:
            logger.info(f"Batch embedding complete: {total} documents")
        
        return embeddings


# Module-level singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get the singleton EmbeddingService instance.
    
    This ensures that the embedding model is loaded only once per process,
    improving performance and memory usage.
    
    Returns:
        Singleton EmbeddingService instance
        
    Example:
        from common.services.embedding_service import get_embedding_service
        
        service = get_embedding_service()
        embedding = service.embed_query("What is the pricing?")
    """
    global _embedding_service
    
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
        logger.info("EmbeddingService singleton created")
    
    return _embedding_service


def reset_embedding_service():
    """
    Reset the singleton instance (useful for testing).
    
    This forces a new EmbeddingService to be created on the next
    call to get_embedding_service(), which will reload the embedding
    model from cache.
    
    Warning: Only use this in tests or when you know the embedding
    configuration has changed.
    """
    global _embedding_service
    _embedding_service = None
    logger.info("EmbeddingService singleton reset")

