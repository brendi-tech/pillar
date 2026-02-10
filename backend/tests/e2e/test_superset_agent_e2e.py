"""
E2E tests for Superset agent flows.

Tests the agentic loop directly (not via HTTP) with mocked client responses.
Uses fixture files to simulate SDK action execution results.

This approach:
1. Imports AgentAnswerServiceReActAsync directly
2. Gets Product from database by slug
3. Calls ask_stream() directly
4. Mocks client responses via signal_query_result

Usage:
    # Load environment and run
    export $(grep -v '^#' .env.local | xargs)
    cd backend
    uv run pytest tests/e2e/test_superset_agent_e2e.py -m e2e -v -s

Requirements:
    - Database connection (Cloud SQL Proxy or local)
    - Superset product configured in database with slug "superset"
"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

logger = logging.getLogger(__name__)

# Mark all tests in this module as e2e
pytestmark = pytest.mark.e2e

# Fixtures directory
FIXTURES_DIR = Path(__file__).parent / "fixtures"


async def evaluate_response(
    question: str,
    response: str,
    actions_called: List[str],
    criteria: str,
) -> Dict[str, Any]:
    """
    Use an LLM to evaluate if the agent's response was good.
    
    Args:
        question: The original user question
        response: The agent's final response text
        actions_called: List of actions the agent called
        criteria: What we expect from a good response
    
    Returns:
        Dict with 'passed', 'score' (1-5), and 'reasoning'
    """
    from common.utils.llm_client import LLMClient
    from common.utils.llm_config import LLMConfigService
    
    evaluation_prompt = f"""You are evaluating an AI assistant's response quality.

USER QUESTION: {question}

ACTIONS THE ASSISTANT TOOK: {', '.join(actions_called) if actions_called else 'None'}

ASSISTANT'S RESPONSE:
{response}

EVALUATION CRITERIA:
{criteria}

Rate the response on a scale of 1-5:
1 = Failed completely (didn't address the question, gave up, or produced an error)
2 = Poor (attempted but gave unhelpful or incorrect information)
3 = Acceptable (addressed the question but incomplete or could be better)
4 = Good (helpful response that addresses the question well)
5 = Excellent (thorough, accurate, and actionable response)

Respond in this exact JSON format:
{{"score": <1-5>, "passed": <true if score >= 3, false otherwise>, "reasoning": "<brief explanation>"}}"""

    # Use budget-tier model for evaluation (fast, cheap)
    eval_model = LLMConfigService.get_model('openai', 'budget')
    eval_model_info = LLMConfigService.get_model_info(eval_model)
    openrouter_model = eval_model_info.get('openrouter_model', eval_model) if eval_model_info else eval_model

    client = LLMClient(
        model=openrouter_model,
    )
    
    try:
        result = await client.complete_async(
            prompt=evaluation_prompt,
            temperature=0.0,
            max_tokens=500,
        )
        
        # Parse JSON from response
        import re
        json_match = re.search(r'\{[^}]+\}', result, re.DOTALL)
        if json_match:
            evaluation = json.loads(json_match.group())
            return evaluation
        else:
            return {"score": 0, "passed": False, "reasoning": f"Could not parse evaluation: {result[:200]}"}
    
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        return {"score": 0, "passed": False, "reasoning": f"Evaluation error: {e}"}


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
    
    # Helper to respond to action requests immediately
    def respond_to_action(action_name: str, tool_call_id: str):
        """Signal fixture response for an action request."""
        fixture_data = get_fixture_for_action(action_name, fixture_product)
        if fixture_data:
            signal_query_result(session_id, action_name, fixture_data, tool_call_id)
            logger.info(f"Signaled fixture response for {action_name}")
        else:
            signal_query_result(session_id, action_name, {
                "success": False,
                "error": f"No fixture for {action_name}"
            }, tool_call_id)
            logger.warning(f"No fixture for {action_name}")
    
    try:
        # Run the agent
        async for event in agent_service.ask_stream(
            question=question,
            top_k=10,
            cancel_event=None,
            session_id=session_id,
        ):
            event_type = event.get("type", "")
            session.events.append(event)
            
            logger.debug(f"Event: {event_type}")
            
            if event_type == "token":
                session.response_text += event.get("text", "")
            
            elif event_type == "sources":
                session.sources = event.get("sources", [])
            
            elif event_type == "actions":
                session.actions = event.get("actions", [])
            
            elif event_type == "action_request":
                # Agent wants us to execute an action - respond immediately with fixture
                action_name = event.get("action_name")
                tool_call_id = event.get("tool_call_id", "")
                logger.info(f"Action request: {action_name}")
                session.action_requests.append({
                    "action_name": action_name,
                    "parameters": event.get("parameters", {}),
                    "tool_call_id": tool_call_id,
                })
                # Signal fixture response immediately
                respond_to_action(action_name, tool_call_id)
            
            elif event_type == "complete":
                session.completed = True
                if not session.response_text:
                    session.response_text = event.get("text", "")
            
            elif event_type == "error":
                session.error = event.get("message", "Unknown error")
                session.completed = True
        
        # Mark complete if we finished the stream
        session.completed = True
        
    except Exception as e:
        session.error = str(e)
        logger.error(f"Agent error: {e}", exc_info=True)
    
    return session


class TestAgentGreetingAndDataDiscovery:
    """Test simple interactions and data discovery flows."""

    @pytest.mark.asyncio
    async def test_simple_greeting(self, superset_slug):
        """Test that simple greetings work without action calls."""
        question = "Hello"

        session = await run_agent_with_fixtures(
            question=question,
            product_slug=superset_slug,
        )

        logger.info(f"Response: {session.response_text}")

        assert session.completed, f"Session should complete. Error: {session.error}"
        assert session.response_text, "Should have a response"
        assert len(session.get_actions_called()) == 0, "Greeting shouldn't call actions"

    @pytest.mark.asyncio
    async def test_list_datasets_action_works(self, superset_slug):
        """Test that asking about datasets triggers the list_datasets action."""
        question = "What datasets are available?"

        session = await run_agent_with_fixtures(
            question=question,
            product_slug=superset_slug,
        )

        logger.info(f"Actions called: {session.get_actions_called()}")
        logger.info(f"Response: {session.response_text[:200] if session.response_text else 'None'}")

        assert session.completed, f"Session should complete. Error: {session.error}"

        # Should have called list_datasets or search_datasets
        actions = session.get_actions_called()
        dataset_action_called = any(
            "dataset" in action.lower() for action in actions if action
        )

        # Either called a dataset action OR responded with dataset info
        assert dataset_action_called or "dataset" in session.response_text.lower(), (
            f"Should mention datasets. Actions: {actions}, Response: {session.response_text[:100]}"
        )


class TestAgentChartCreation:
    """
    Test chart creation flow and verify agent doesn't stop prematurely.

    Covers:
    - Agent discovers datasets, explores columns, and creates/guides chart creation
    - No premature recovery bug (agent dumping raw data instead of continuing)
    - LLM-evaluated response quality
    """

    @pytest.mark.asyncio
    async def test_chart_creation_flow(self, superset_slug):
        """
        Test: "Create a bar chart showing the top 10 most popular given names"

        Expected behavior:
        1. Agent searches for dataset-related actions
        2. Agent calls list_datasets or search_datasets
        3. Agent calls get_dataset_columns for the relevant dataset
        4. Agent creates a chart or provides clear guidance
        5. Response is substantive and actionable

        Also verifies the recovery bug regression (agent should NOT stop
        after list_datasets with "Responding with fetched data (recovery)").
        """
        question = "Create a bar chart showing the top 10 most popular given names"

        session = await run_agent_with_fixtures(
            question=question,
            product_slug=superset_slug,
            fixture_product="superset",
        )

        # Log results for debugging
        actions_called = session.get_actions_called()
        logger.info(f"Session completed: {session.completed}")
        logger.info(f"Actions called: {actions_called}")
        logger.info(f"Response: {session.response_text[:300] if session.response_text else 'None'}...")
        logger.info(f"Error: {session.error}")

        # 1. Session should complete without errors
        assert session.completed, f"Session did not complete. Error: {session.error}"
        assert session.response_text, "Agent should produce a response"

        # 2. Should provide a substantive response (not a one-liner)
        assert len(session.response_text) > 100, (
            "Should provide a substantive response"
        )

        # 3. Regression: no premature recovery bug
        bad_patterns = [
            "retrieved data with fields",
            "success, datasets, count",
            "responding with fetched data",
        ]
        response_lower = session.response_text.lower()
        has_bad_pattern = any(pattern in response_lower for pattern in bad_patterns)
        assert not has_bad_pattern, (
            f"Agent triggered premature recovery! "
            f"Response: {session.response_text[:300]}"
        )

        # 4. LLM-evaluated response quality
        evaluation = await evaluate_response(
            question=question,
            response=session.response_text,
            actions_called=actions_called,
            criteria="""
A good response should:
1. Identify relevant data about names (like birth_names dataset)
2. Either create a chart OR provide clear guidance on how to create one
3. NOT give up or say it cannot help
4. NOT just dump raw data without explanation
5. Be actionable and helpful for someone wanting to visualize name data
"""
        )

        logger.info(f"LLM Evaluation: score={evaluation.get('score')}, passed={evaluation.get('passed')}")
        logger.info(f"Evaluation reasoning: {evaluation.get('reasoning')}")

        assert evaluation.get("passed"), (
            f"LLM evaluation failed (score: {evaluation.get('score')}/5). "
            f"Reasoning: {evaluation.get('reasoning')}. "
            f"Response: {session.response_text[:300]}..."
        )
