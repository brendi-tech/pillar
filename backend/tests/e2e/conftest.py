"""
E2E Test Configuration

Configuration for direct agent testing with fixture-based responses.

Two modes:
1. Local development: Uses existing database with real products
2. CI: Creates test products with embedded actions

Requirements:
- Real API keys (OPENROUTER_API_KEY, GOOGLE_API_KEY, COHERE_API_KEY)
- Database with pgvector extension
- Redis for action result signaling

Usage (local):
    export $(grep -v '^#' .env.prod | xargs)
    cd hc-backend
    DJANGO_SETTINGS_MODULE=config.settings.development uv run pytest tests/e2e/ -m e2e -v -s --confcutdir=tests/e2e -p no:django

Usage (CI):
    Runs automatically with config.settings.e2e
"""
import os
import sys

# Override Django settings BEFORE Django setup
# In CI, this will already be set to config.settings.e2e
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

import pytest
import json
from pathlib import Path


# Fixtures directory
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_superset_actions():
    """Load Superset actions from fixture file."""
    actions_file = FIXTURES_DIR / "superset" / "actions.json"
    if actions_file.exists():
        with open(actions_file) as f:
            return json.load(f)
    return []


@pytest.fixture(scope="session")
def superset_product():
    """
    Get or create the Superset product for testing.
    
    In local dev: Uses existing product from database
    In CI: Creates a test product with embedded actions
    """
    from apps.products.models import Product, Action
    from apps.users.models import Organization
    
    # Try to get existing product
    try:
        product = Product.objects.select_related('organization').get(subdomain='superset')
        return product
    except Product.DoesNotExist:
        pass
    
    # Create test organization and product for CI
    org, _ = Organization.objects.get_or_create(
        name="Test Organization",
        defaults={"domain": "test-org.example.com"}
    )
    
    product, created = Product.objects.get_or_create(
        subdomain="superset",
        defaults={
            "name": "Superset",
            "organization": org,
            "agent_guidance": """You are an AI assistant for Superset.

When users ask about charts or data:
1. Use list_datasets or search_datasets to find datasets
2. Use get_dataset_columns to understand the schema
3. Use get_sample_data to preview the data
4. Use test_chart_query to validate the chart config
5. Use create_chart_api to create the chart
""",
        }
    )
    
    if created:
        # Create actions for testing with descriptions that will match searches
        actions_data = [
            {
                "name": "list_datasets",
                "description": "List all available datasets with their tables and databases. Returns dataset IDs, names, and schemas for chart building.",
                "action_type": "query",
                "status": "published",
            },
            {
                "name": "search_datasets",
                "description": "Search for datasets by name using server-side filtering. More efficient than list_datasets for finding specific data sources.",
                "action_type": "query",
                "status": "published",
                "data_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
            },
            {
                "name": "get_dataset_columns",
                "description": "Get column details for a specific dataset including names, types, and whether they are dimensions or metrics.",
                "action_type": "query",
                "status": "published",
                "data_schema": {"type": "object", "properties": {"dataset_id": {"type": "integer"}}, "required": ["dataset_id"]},
            },
            {
                "name": "get_sample_data",
                "description": "Get a sample of rows from a dataset to understand the actual values and data quality before building a chart.",
                "action_type": "query",
                "status": "published",
                "data_schema": {"type": "object", "properties": {"dataset_id": {"type": "integer"}, "row_limit": {"type": "integer"}}},
            },
            {
                "name": "test_chart_query",
                "description": "Test a chart configuration by running the query without saving. Validates that the chart config will work before creating.",
                "action_type": "query",
                "status": "published",
            },
            {
                "name": "create_chart_api",
                "description": "Create a chart via API and return the chart ID. Use this after testing the chart configuration.",
                "action_type": "query",
                "status": "published",
            },
            {
                "name": "get_column_distinct_values",
                "description": "Get unique values for a column to understand cardinality and filter options.",
                "action_type": "query",
                "status": "published",
            },
        ]
        
        created_actions = []
        for action_data in actions_data:
            action = Action.objects.create(product=product, organization=org, **action_data)
            created_actions.append(action)
        
        # Generate embeddings for the actions (required for search)
        try:
            from common.services.embedding_service import EmbeddingService
            embedding_service = EmbeddingService()
            
            for action in created_actions:
                text = f"{action.name}: {action.description}"
                embedding = embedding_service.embed_query(text)
                action.description_embedding = embedding
                action.save(update_fields=['description_embedding'])
        except Exception as e:
            # Embeddings are optional for basic testing
            print(f"Warning: Could not generate embeddings: {e}")
    
    return product


@pytest.fixture
def superset_slug(superset_product) -> str:
    """The Superset product slug."""
    return superset_product.subdomain
