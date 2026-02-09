#!/usr/bin/env python
"""
Verify all common module imports work correctly.

This script tests that Phase 2 (Core Infrastructure) is properly set up
by importing all modules and checking they load without errors.

Usage:
    cd help-center-backend
    python scripts/verify_common.py
"""
import os
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
django.setup()


def test_imports():
    """Test all common module imports."""
    print("=" * 60)
    print("Phase 2: Core Infrastructure Verification")
    print("=" * 60)
    print()

    errors = []

    # Test Utils
    print("Testing common.utils imports...")

    try:
        from common.utils import LLMClient
        print("  ✓ LLMClient")
    except ImportError as e:
        print(f"  ✗ LLMClient: {e}")
        errors.append(("LLMClient", str(e)))

    try:
        from common.utils import LLMConfigService
        print("  ✓ LLMConfigService")
    except ImportError as e:
        print(f"  ✗ LLMConfigService: {e}")
        errors.append(("LLMConfigService", str(e)))

    try:
        from common.utils import parse_json_from_llm, clean_llm_response
        print("  ✓ parse_json_from_llm, clean_llm_response")
    except ImportError as e:
        print(f"  ✗ parse_json_from_llm: {e}")
        errors.append(("parse_json_from_llm", str(e)))

    try:
        from common.utils import get_embedding_model
        print("  ✓ get_embedding_model")
    except ImportError as e:
        print(f"  ✗ get_embedding_model: {e}")
        errors.append(("get_embedding_model", str(e)))

    try:
        from common.utils import HybridMarkdownChunker
        print("  ✓ HybridMarkdownChunker")
    except ImportError as e:
        print(f"  ✗ HybridMarkdownChunker: {e}")
        errors.append(("HybridMarkdownChunker", str(e)))

    try:
        from common.utils import CohereRerankerService, get_reranker
        print("  ✓ CohereRerankerService, get_reranker")
    except ImportError as e:
        print(f"  ✗ CohereRerankerService: {e}")
        errors.append(("CohereRerankerService", str(e)))

    try:
        from common.utils import FirecrawlService
        print("  ✓ FirecrawlService")
    except ImportError as e:
        print(f"  ✗ FirecrawlService: {e}")
        errors.append(("FirecrawlService", str(e)))

    print()

    # Test Services
    print("Testing common.services imports...")

    try:
        from common.services import EmbeddingService, get_embedding_service
        print("  ✓ EmbeddingService, get_embedding_service")
    except ImportError as e:
        print(f"  ✗ EmbeddingService: {e}")
        errors.append(("EmbeddingService", str(e)))

    try:
        from common.services import markdown_to_tiptap, get_md_converter
        print("  ✓ markdown_to_tiptap, get_md_converter")
    except ImportError as e:
        print(f"  ✗ markdown_to_tiptap: {e}")
        errors.append(("markdown_to_tiptap", str(e)))

    try:
        from common.services import tiptap_to_markdown, get_tiptap_converter
        print("  ✓ tiptap_to_markdown, get_tiptap_converter")
    except ImportError as e:
        print(f"  ✗ tiptap_to_markdown: {e}")
        errors.append(("tiptap_to_markdown", str(e)))

    print()

    # Test Models
    print("Testing common.models imports...")

    try:
        from common.models import BaseModel, TenantAwareModel
        print("  ✓ BaseModel, TenantAwareModel")
    except ImportError as e:
        print(f"  ✗ BaseModel, TenantAwareModel: {e}")
        errors.append(("BaseModel", str(e)))

    try:
        from common.models import VectorEmbedding
        print("  ✓ VectorEmbedding")
    except ImportError as e:
        print(f"  ✗ VectorEmbedding: {e}")
        errors.append(("VectorEmbedding", str(e)))

    print()

    # Test Infrastructure
    print("Testing infrastructure imports...")

    try:
        from common import LLMAPIError, PlanLimitExceeded, FeatureNotAvailableOnPlan
        print("  ✓ LLMAPIError, PlanLimitExceeded, FeatureNotAvailableOnPlan")
    except ImportError as e:
        print(f"  ✗ Exceptions: {e}")
        errors.append(("Exceptions", str(e)))

    try:
        from common import get_hatchet_client, reset_hatchet_client
        print("  ✓ get_hatchet_client, reset_hatchet_client")
    except ImportError as e:
        print(f"  ✗ get_hatchet_client: {e}")
        errors.append(("get_hatchet_client", str(e)))

    try:
        from common.task_router import TaskRouter
        print("  ✓ TaskRouter")
    except ImportError as e:
        print(f"  ✗ TaskRouter: {e}")
        errors.append(("TaskRouter", str(e)))

    try:
        from common.cache_keys import CacheKeys
        print("  ✓ CacheKeys")
    except ImportError as e:
        print(f"  ✗ CacheKeys: {e}")
        errors.append(("CacheKeys", str(e)))

    print()

    # Test RAG Services
    print("Testing RAG service imports...")

    try:
        from common.utils.django_rag_service import HelpCenterRAGService, get_rag_service
        print("  ✓ HelpCenterRAGService (sync)")
    except ImportError as e:
        print(f"  ✗ HelpCenterRAGService: {e}")
        errors.append(("HelpCenterRAGService", str(e)))

    try:
        from common.utils.django_rag_service_async import HelpCenterRAGServiceAsync, get_async_rag_service
        print("  ✓ HelpCenterRAGServiceAsync (async)")
    except ImportError as e:
        print(f"  ✗ HelpCenterRAGServiceAsync: {e}")
        errors.append(("HelpCenterRAGServiceAsync", str(e)))

    print()
    print("=" * 60)

    # Summary
    if errors:
        print(f"❌ Verification FAILED with {len(errors)} error(s):")
        for name, error in errors:
            print(f"   - {name}: {error}")
        print()
        print("Please check:")
        print("  1. All dependencies are installed (uv sync)")
        print("  2. All files are in place")
        print("  3. PostgreSQL has pgvector extension")
        return False
    else:
        print("✅ All imports successful!")
        print()
        print("Phase 2 (Core Infrastructure) is complete.")
        print("Ready for Phase 3 (Data Models) or Phase 4 (Authentication).")
        return True


def test_settings():
    """Verify all required settings are configured."""
    print()
    print("=" * 60)
    print("Verifying Settings Configuration")
    print("=" * 60)
    print()

    from django.conf import settings

    required_settings = [
        # LLM Configuration
        ('OPENAI_API_KEY', False),  # (name, required_value)
        ('ANTHROPIC_API_KEY', False),
        ('GEMINI_API_KEY', False),
        ('GOOGLE_API_KEY', False),
        ('OPENROUTER_API_KEY', False),
        ('DEFAULT_LLM_MODEL', True),
        ('DEFAULT_VISION_MODEL', True),

        # RAG Embeddings
        ('RAG_EMBEDDING_MODEL', True),
        ('RAG_EMBEDDING_DIMENSIONS', True),
        ('RAG_EMBEDDING_PROVIDER', True),
        ('RAG_EMBEDDING_VERSION', True),

        # RAG Chunking
        ('RAG_CHUNK_SIZE', True),
        ('RAG_CHUNK_OVERLAP', True),
        ('RAG_BATCH_SIZE', True),
        ('RAG_ASYNC_INDEXING', True),

        # RAG Retrieval
        ('RAG_DEFAULT_TOP_K', True),
        ('RAG_SIMILARITY_THRESHOLD', True),

        # Cohere
        ('COHERE_API_KEY', False),
        ('COHERE_RERANK_ENABLED', True),
        ('COHERE_RERANK_MODEL', True),
        ('COHERE_RERANK_TOP_N', True),
        ('COHERE_RERANK_CANDIDATES', True),

        # Quality Thresholds
        ('RERANK_QUALITY_RATIO', True),
        ('VECTOR_QUALITY_RATIO', True),

        # Hatchet
        ('HATCHET_ENABLED', True),
        ('HATCHET_CLIENT_TOKEN', False),
        ('HATCHET_NAMESPACE', True),

        # Firecrawl
        ('FIRECRAWL_API_KEY', False),
        ('FIRECRAWL_API_URL', True),
    ]

    missing = []
    configured = []

    for setting_name, required in required_settings:
        value = getattr(settings, setting_name, None)
        if value is None:
            missing.append(setting_name)
            print(f"  ✗ {setting_name}: NOT FOUND")
        elif required and not value:
            print(f"  ⚠ {setting_name}: empty (optional)")
            configured.append(setting_name)
        else:
            # Don't print secrets
            if 'KEY' in setting_name or 'TOKEN' in setting_name or 'SECRET' in setting_name:
                display = "***" if value else "(empty)"
            else:
                display = value
            print(f"  ✓ {setting_name}: {display}")
            configured.append(setting_name)

    print()
    print(f"Configured: {len(configured)}/{len(required_settings)}")

    if missing:
        print(f"Missing: {len(missing)}")
        for name in missing:
            print(f"  - {name}")
        return False

    return True


if __name__ == "__main__":
    import_success = test_imports()
    settings_success = test_settings()

    print()
    print("=" * 60)
    if import_success and settings_success:
        print("✅ Phase 2 Verification Complete!")
        sys.exit(0)
    else:
        print("❌ Phase 2 Verification Failed")
        sys.exit(1)
