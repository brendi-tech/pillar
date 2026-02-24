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
    cd backend
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
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Directories
FIXTURES_DIR = Path(__file__).parent / "fixtures"
EVAL_CASES_DIR = Path(__file__).parent / "eval_cases"


# =============================================================================
# Shared agent test harness (used by both old tests and new eval runner)
# =============================================================================


class AgentTestSession:
    """Tracks state during an agent test run."""

    def __init__(self):
        self.events: List[Dict] = []
        self.action_requests: List[Dict] = []
        self.response_text: str = ""
        self.sources: List[Dict] = []
        self.actions: List[Dict] = []
        self.completed: bool = False
        self.error: Optional[str] = None

    def get_actions_called(self) -> List[str]:
        """Get list of action names that were requested."""
        return [req.get("action_name") for req in self.action_requests]


def load_fixture(fixture_path: str) -> dict:
    """Load a fixture JSON file."""
    full_path = FIXTURES_DIR / fixture_path
    if not full_path.exists():
        raise FileNotFoundError(f"Fixture not found: {full_path}")
    with open(full_path) as f:
        return json.load(f)


def get_fixture_for_action(action_name: str, product: str = "superset") -> Optional[dict]:
    """Get fixture data for a specific action."""
    fixture_path = f"{product}/{action_name}.json"
    try:
        return load_fixture(fixture_path)
    except FileNotFoundError:
        logger.warning(f"No fixture found for action: {action_name}")
        return None


async def run_agent_with_fixtures(
    question: str,
    product=None,
    product_slug: str = "superset",
    fixture_product: str = "superset",
    session_id: str = None,
) -> AgentTestSession:
    """
    Run the agent service directly with fixture-based client responses.

    Args:
        question: The question to ask
        product: Product object (preferred, avoids async DB lookup)
        product_slug: Slug of the product (fallback if product not provided)
        fixture_product: Directory for fixtures
        session_id: Session ID for action correlation

    Returns:
        AgentTestSession with collected events and final state
    """
    import uuid
    from apps.products.models import Product
    from apps.mcp.services.agent import AgentAnswerServiceReActAsync
    from apps.mcp.services.agent.helpers import signal_query_result

    session = AgentTestSession()
    session_id = session_id or str(uuid.uuid4())

    # Get product from database if not provided
    if product is None:
        try:
            product = await Product.objects.select_related('organization').aget(
                subdomain=product_slug
            )
        except Product.DoesNotExist:
            session.error = f"Product with slug '{product_slug}' not found"
            return session

    logger.info(f"Found product: {product.name} (org: {product.organization.name})")

    # Create agent service
    agent_service = AgentAnswerServiceReActAsync(
        help_center_config=product,
        organization=product.organization,
        conversation_history=[],
    )

    # Track call counts per action so repeated calls return unique data
    action_call_counts: Dict[str, int] = {}

    # Helper to respond to action requests immediately
    def respond_to_action(action_name: str, tool_call_id: str, params: Dict = None):
        """Signal fixture response for an action request.

        For actions that may be called multiple times (e.g. create_chart_api),
        the response is adjusted so each call returns a unique ID/name.
        """
        import copy

        action_call_counts[action_name] = action_call_counts.get(action_name, 0) + 1
        call_num = action_call_counts[action_name]

        fixture_data = get_fixture_for_action(action_name, fixture_product)
        if fixture_data:
            # Deep copy so mutations don't affect the cached fixture
            fixture_data = copy.deepcopy(fixture_data)

            # Make create_chart_api return unique chart IDs/names per call
            if action_name == "create_chart_api" and call_num > 1:
                if "chart_id" in fixture_data:
                    fixture_data["chart_id"] = fixture_data["chart_id"] + call_num - 1
                # Echo back the chart_name from params if provided
                if params and params.get("chart_name"):
                    fixture_data["chart_name"] = params["chart_name"]
                fixture_data["url"] = f"/explore/?slice_id={fixture_data.get('chart_id', 195)}"

            # Make test_chart_query return unique results per call
            if action_name == "test_chart_query" and call_num > 1:
                fixture_data["message"] = f"Query executed successfully (call {call_num}), returned {fixture_data.get('row_count', 100)} rows"

            signal_query_result(session_id, action_name, fixture_data, tool_call_id)
            logger.info(f"Signaled fixture response for {action_name} (call #{call_num})")
        else:
            signal_query_result(session_id, action_name, {
                "success": False,
                "error": f"No fixture for {action_name}"
            }, tool_call_id)
            logger.warning(f"No fixture for {action_name}")

    import time
    start_time = time.time()
    event_count = 0
    token_count = 0

    try:
        # Run the agent
        logger.info(f"[Agent] Starting agent stream for: {question[:80]}...")
        async for event in agent_service.ask_stream(
            question=question,
            top_k=10,
            cancel_event=None,
            session_id=session_id,
        ):
            event_type = event.get("type", "")
            session.events.append(event)
            event_count += 1

            if event_type == "token":
                token_text = event.get("text", "")
                session.response_text += token_text
                token_count += 1
                # Log first token and periodic progress
                if token_count == 1:
                    logger.info(f"[Agent] First token received at {time.time() - start_time:.1f}s")
                elif token_count % 50 == 0:
                    logger.info(
                        f"[Agent] ...streaming ({token_count} tokens, "
                        f"{len(session.response_text)} chars, {time.time() - start_time:.1f}s)"
                    )

            elif event_type == "sources":
                session.sources = event.get("sources", [])
                logger.info(f"[Agent] Sources received: {len(session.sources)} sources")

            elif event_type == "actions":
                session.actions = event.get("actions", [])
                action_names = [a.get("name", "?") for a in session.actions]
                logger.info(f"[Agent] Available actions: {action_names}")

            elif event_type == "action_request":
                # Agent wants us to execute an action - respond immediately with fixture
                action_name = event.get("action_name")
                tool_call_id = event.get("tool_call_id", "")
                params = event.get("parameters", {})
                logger.info(
                    f"[Agent] ACTION REQUEST: {action_name} "
                    f"(params: {json.dumps(params, default=str)[:200]}) "
                    f"at {time.time() - start_time:.1f}s"
                )
                session.action_requests.append({
                    "action_name": action_name,
                    "parameters": params,
                    "tool_call_id": tool_call_id,
                })
                # Signal fixture response immediately
                respond_to_action(action_name, tool_call_id, params)

            elif event_type == "thinking":
                thought = event.get("text", "")[:150]
                logger.info(f"[Agent] THINKING: {thought}...")

            elif event_type == "complete":
                session.completed = True
                if not session.response_text:
                    session.response_text = event.get("text", "")
                logger.info(f"[Agent] Complete at {time.time() - start_time:.1f}s")

            elif event_type == "error":
                session.error = event.get("message", "Unknown error")
                session.completed = True
                logger.error(f"[Agent] ERROR: {session.error}")

            else:
                logger.info(f"[Agent] Event: {event_type}")

        # Mark complete if we finished the stream
        session.completed = True

    except Exception as e:
        session.error = str(e)
        logger.error(f"[Agent] Exception: {e}", exc_info=True)

    elapsed = time.time() - start_time
    actions_called = session.get_actions_called()
    logger.info(
        f"[Agent] DONE in {elapsed:.1f}s | "
        f"{event_count} events | "
        f"{token_count} tokens | "
        f"{len(session.response_text)} chars | "
        f"actions: {actions_called or 'none'}"
    )
    if session.response_text:
        logger.info(f"[Agent] Response preview: {session.response_text[:300]}")

    return session


# =============================================================================
# Eval case discovery
# =============================================================================


def load_eval_cases(product: str) -> List[Dict[str, Any]]:
    """
    Discover and load all JSON eval case files for a product.

    Args:
        product: Product directory name (e.g. "superset")

    Returns:
        List of eval case dicts, each loaded from a JSON file.
    """
    product_dir = EVAL_CASES_DIR / product
    if not product_dir.exists():
        return []

    cases = []
    for json_file in sorted(product_dir.glob("*.json")):
        with open(json_file) as f:
            case = json.load(f)
        # Ensure eval_id is set (fall back to filename)
        if "eval_id" not in case:
            case["eval_id"] = json_file.stem
        cases.append(case)

    return cases


# =============================================================================
# Fixtures (shared across test files)
# =============================================================================


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
    # Use filter().first() to handle race conditions with parallel xdist workers
    # that may create duplicate orgs before unique constraints catch them.
    org = Organization.objects.filter(name="Test Organization").first()
    if not org:
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
            {
                "name": "create_dashboard_api",
                "description": "Create a new dashboard with a title and optional description. Returns the dashboard ID and URL.",
                "action_type": "query",
                "status": "published",
                "data_schema": {"type": "object", "properties": {"dashboard_title": {"type": "string"}, "description": {"type": "string"}}, "required": ["dashboard_title"]},
            },
            {
                "name": "add_chart_to_dashboard",
                "description": "Add an existing chart to a dashboard by chart ID and dashboard ID.",
                "action_type": "query",
                "status": "published",
                "data_schema": {"type": "object", "properties": {"dashboard_id": {"type": "integer"}, "chart_id": {"type": "integer"}}, "required": ["dashboard_id", "chart_id"]},
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

    # Always re-fetch with select_related so the organization is cached.
    # Without this, accessing product.organization in an async context
    # triggers a lazy sync DB query -> SynchronousOnlyOperation.
    return Product.objects.select_related('organization').get(pk=product.pk)


@pytest.fixture
def superset_slug(superset_product) -> str:
    """The Superset product slug."""
    return superset_product.subdomain
