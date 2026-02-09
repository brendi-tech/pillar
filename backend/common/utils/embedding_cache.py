"""
Shared embedding model cache for both sync and async RAG services.

This module provides a single source of truth for cached embedding models,
ensuring that the model is loaded ONCE per process regardless of whether
it's accessed from sync or async contexts.
"""
import logging
import time
import numpy as np
from typing import Dict, Any, List

from django.conf import settings

logger = logging.getLogger(__name__)


# Module-level cache for embedding models (singleton per process)
# Key: (provider, model_name) tuple
# Value: embedding model instance
_EMBEDDING_MODEL_CACHE: Dict[tuple, Any] = {}


def get_cache_key() -> tuple:
    """Get the cache key for the current settings."""
    provider = getattr(settings, 'RAG_EMBEDDING_PROVIDER', 'openai')
    model_name = getattr(settings, 'RAG_EMBEDDING_MODEL', 'text-embedding-3-small')
    return (provider, model_name)


def get_embedding_model():
    """
    Get or create embedding model from settings with provider detection.
    
    Uses module-level cache to ensure model is loaded ONCE per process.
    Supports OpenAI and OpenRouter (OpenAI-compatible) providers.
    """
    provider = getattr(settings, 'RAG_EMBEDDING_PROVIDER', 'openai')
    model_name = getattr(settings, 'RAG_EMBEDDING_MODEL', 'text-embedding-3-small')
    
    # Create cache key
    cache_key = get_cache_key()
    
    # Return cached model if exists
    if cache_key in _EMBEDDING_MODEL_CACHE:
        logger.debug(f"Using cached embedding model: {model_name} ({provider})")
        return _EMBEDDING_MODEL_CACHE[cache_key]
    
    # Load new model and cache it
    logger.info(f"Loading embedding model: {model_name} ({provider})")
    load_start = time.time()
    
    if provider == 'openai':
        from llama_index.embeddings.openai import OpenAIEmbedding
        
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured in settings")
        
        model = OpenAIEmbedding(
            model=model_name,
            api_key=api_key
        )
    
    elif provider == 'google':
        # Direct Google GenAI API with task-type support and normalization
        api_key = getattr(settings, 'GOOGLE_API_KEY', None)
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not configured in settings")
        
        # Google GenAI requires 'models/' prefix for model names
        if not model_name.startswith('models/'):
            full_model_name = f'models/{model_name}'
        else:
            full_model_name = model_name
        
        # Get dimension configuration
        output_dim = getattr(settings, 'RAG_EMBEDDING_DIMENSIONS', 3072)
        
        logger.info(
            f"Configuring Google embedding wrapper: {full_model_name}, "
            f"dimensions={output_dim}, task_types=RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY"
        )
        
        # Use wrapper that handles task types and normalization
        model = GoogleEmbeddingWrapper(
            api_key=api_key,
            model_name=full_model_name,
            output_dim=output_dim
        )
    
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}. Use 'openai' or 'google'")
    
    load_time = time.time() - load_start
    logger.info(f"✓ Embedding model loaded and cached ({load_time:.1f}s): {model_name}")
    
    # Cache for future use
    _EMBEDDING_MODEL_CACHE[cache_key] = model
    
    return model


def normalize_embedding(embedding: List[float]) -> List[float]:
    """
    Normalize embedding vector to unit length.
    
    Required for Google gemini-embedding-001 when using dimensions other than 3072.
    The 3072d embeddings are pre-normalized, but 768d and 1536d need normalization.
    
    Args:
        embedding: Raw embedding vector
        
    Returns:
        Normalized embedding vector (unit length, suitable for cosine similarity)
    """
    embedding_np = np.array(embedding)
    norm = np.linalg.norm(embedding_np)
    
    if norm == 0:
        logger.warning("Zero-length embedding vector encountered during normalization")
        return embedding
    
    normalized = embedding_np / norm
    return normalized.tolist()


class GoogleEmbeddingWrapper:
    """
    Wrapper for Google embeddings that handles task types and normalization.
    
    Google's gemini-embedding-001 supports different task types:
    - RETRIEVAL_DOCUMENT: For indexing documents
    - RETRIEVAL_QUERY: For search queries
    
    This wrapper manages two model instances (one for each task type) and
    automatically normalizes embeddings when using non-3072 dimensions.
    """
    
    def __init__(self, api_key: str, model_name: str, output_dim: int):
        from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
        
        self.model_name = model_name
        self.output_dim = output_dim
        self.needs_normalization = (output_dim != 3072)
        
        # Create two instances: one for documents, one for queries
        logger.info(f"Initializing GoogleEmbeddingWrapper with {output_dim}d embeddings")
        
        # Build embedding_config dict based on dimensions
        # For 3072d (default), don't specify output_dimensionality
        if output_dim == 3072:
            document_config = {'task_type': 'RETRIEVAL_DOCUMENT'}
            query_config = {'task_type': 'RETRIEVAL_QUERY'}
        else:
            document_config = {
                'task_type': 'RETRIEVAL_DOCUMENT',
                'output_dimensionality': output_dim
            }
            query_config = {
                'task_type': 'RETRIEVAL_QUERY',
                'output_dimensionality': output_dim
            }
        
        self.document_model = GoogleGenAIEmbedding(
            model_name=model_name,
            api_key=api_key,
            embed_batch_size=100,
            embedding_config=document_config,
        )
        
        self.query_model = GoogleGenAIEmbedding(
            model_name=model_name,
            api_key=api_key,
            embed_batch_size=100,
            embedding_config=query_config,
        )
        
        logger.info(
            f"✓ GoogleEmbeddingWrapper ready: {model_name}, {output_dim}d, "
            f"normalization={'required' if self.needs_normalization else 'not needed (default)'}"
        )
    
    def get_text_embedding(self, text: str) -> List[float]:
        """Get embedding for document text (uses RETRIEVAL_DOCUMENT task type)."""
        embedding = self.document_model.get_text_embedding(text)
        
        if self.needs_normalization:
            embedding = normalize_embedding(embedding)
        
        return embedding
    
    async def aget_text_embedding(self, text: str) -> List[float]:
        """Async: get embedding for document text (uses RETRIEVAL_DOCUMENT task type)."""
        embedding = await self.document_model.aget_text_embedding(text)
        
        if self.needs_normalization:
            embedding = normalize_embedding(embedding)
        
        return embedding
    
    def get_query_embedding(self, query: str) -> List[float]:
        """Get embedding for query text (uses RETRIEVAL_QUERY task type)."""
        embedding = self.query_model.get_query_embedding(query)
        
        if self.needs_normalization:
            embedding = normalize_embedding(embedding)
        
        return embedding
    
    async def aget_query_embedding(self, query: str) -> List[float]:
        """Async: get embedding for query text (uses RETRIEVAL_QUERY task type)."""
        embedding = await self.query_model.aget_query_embedding(query)
        
        if self.needs_normalization:
            embedding = normalize_embedding(embedding)
        
        return embedding


def prewarm_embedding_cache():
    """
    Pre-warm the embedding model cache at startup.
    
    This initializes the embedding client during Django startup,
    avoiding a small delay on the first query/indexing operation.
    
    Called from CommonConfig.ready() during app initialization.
    """
    try:
        provider = getattr(settings, 'RAG_EMBEDDING_PROVIDER', 'openai')
        model_name = getattr(settings, 'RAG_EMBEDDING_MODEL', 'text-embedding-3-small')
        
        cache_key = get_cache_key()
        
        # Check if already cached
        if cache_key in _EMBEDDING_MODEL_CACHE:
            logger.debug(f"[Prewarm] Embedding model already cached: {model_name}")
            return
        
        logger.info(f"[Prewarm] Initializing embedding client at startup: {model_name} ({provider})")
        
        # Use the shared get_embedding_model function
        get_embedding_model()
        
    except Exception as e:
        # Don't crash Django startup if prewarm fails
        logger.warning(f"[Prewarm] ⚠️  Failed to prewarm embedding cache: {e}. Client will initialize on first use.")
