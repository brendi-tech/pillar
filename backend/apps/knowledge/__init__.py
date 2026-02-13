"""
Knowledge app - simplified content sources for the Product Assistant.

Provides:
- KnowledgeSource: Help center and marketing site connections
- KnowledgeItem: Crawled pages and manual snippets
- KnowledgeChunk: Vector chunks for RAG retrieval
"""

default_app_config = 'apps.knowledge.apps.KnowledgeConfig'
