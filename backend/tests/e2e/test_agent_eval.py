"""
Parametrized agent evaluation runner using DeepEval metrics.

Loads eval cases from JSON files in eval_cases/superset/, runs the agent
with fixture-based responses, and evaluates using DeepEval's ToolCorrectnessMetric
and GEval (custom rubric via LLM-as-judge).

Usage:
    # Collect tests (no execution)
    cd backend
    uv run pytest tests/e2e/test_agent_eval.py --collect-only

    # Run all eval cases
    export $(grep -v '^#' .env.local | xargs)
    uv run pytest tests/e2e/test_agent_eval.py -m e2e -v -s

    # Run a specific eval case
    uv run pytest tests/e2e/test_agent_eval.py -m e2e -v -s -k "chart_creation"
"""
import logging
from typing import List

import pytest
from deepeval import assert_test
from deepeval.metrics import GEval, ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, LLMTestCaseParams, ToolCall

from tests.e2e.conftest import load_eval_cases, run_agent_with_fixtures
from tests.e2e.conftest_deepeval import get_eval_llm

logger = logging.getLogger(__name__)

# Mark all tests in this module as e2e
pytestmark = pytest.mark.e2e

# Load eval cases at module level for parametrize
SUPERSET_EVAL_CASES = load_eval_cases("superset")


def build_expected_tools(
    expected_tools_raw: List[str],
    actions_called: List[str],
) -> List[ToolCall]:
    """Convert JSON tool specs to DeepEval ToolCall objects.

    For '|' alternatives, picks the option that was actually called by the
    agent (if any), so ToolCorrectnessMetric sees a match. Falls back to
    the first alternative if none matched.

    Example:
        specs=["list_datasets|search_datasets", "get_dataset_columns|get_sample_data"]
        called=["search_datasets", "get_dataset_columns"]
        -> [ToolCall(name="search_datasets"), ToolCall(name="get_dataset_columns")]
    """
    tools = []
    for tool_spec in expected_tools_raw:
        alternatives = tool_spec.split("|")
        # Pick whichever alternative the agent actually called
        matched = [alt for alt in alternatives if alt in actions_called]
        name = matched[0] if matched else alternatives[0]
        tools.append(ToolCall(name=name))
    return tools


def check_tool_alternatives(
    actions_called: List[str],
    expected_tools_raw: List[str],
) -> bool:
    """Check if actual tools satisfy expected tools (including '|' alternatives).

    Returns True if for each expected tool spec, at least one alternative
    was called by the agent.
    """
    for tool_spec in expected_tools_raw:
        alternatives = tool_spec.split("|")
        if not any(alt in actions_called for alt in alternatives):
            return False
    return True


class TestAgentEval:
    """Parametrized agent evaluation from JSON eval cases."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "eval_case",
        SUPERSET_EVAL_CASES,
        ids=lambda c: c.get("eval_id", "unknown"),
    )
    async def test_eval_case(self, superset_product, eval_case):
        """Run a single eval case and check all criteria."""
        eval_id = eval_case.get("eval_id", "unknown")
        turn = eval_case["turns"][0]  # single-turn for now
        question = turn["user_message"]

        logger.info(f"\n{'='*60}")
        logger.info(f"EVAL: {eval_id}")
        logger.info(f"Question: {question}")
        logger.info(f"Expected tools: {turn.get('expected_tools', [])}")
        logger.info(f"{'='*60}")

        # ----------------------------------------------------------------
        # 1. Run agent with existing harness
        # ----------------------------------------------------------------
        session = await run_agent_with_fixtures(
            question=question,
            product=superset_product,
            fixture_product=eval_case.get("fixture_product", "superset"),
        )

        assert session.completed, f"Agent did not complete: {session.error}"
        assert session.response_text, "Agent should produce a response"

        actions_called = session.get_actions_called()
        response_lower = session.response_text.lower()

        logger.info(f"[{eval_id}] Actions called: {actions_called}")
        logger.info(f"[{eval_id}] Response length: {len(session.response_text)} chars")
        logger.info(f"[{eval_id}] Response: {session.response_text[:500]}")

        # ----------------------------------------------------------------
        # 2. Deterministic checks (fast, no LLM calls, fail early)
        # ----------------------------------------------------------------

        # Regression patterns
        for pattern in turn.get("regression_patterns", []):
            found = pattern.lower() in response_lower
            if found:
                logger.warning(f"[{eval_id}] FAIL regression: found '{pattern}'")
            assert not found, f"Regression pattern found: '{pattern}'"
        logger.info(f"[{eval_id}] PASS: regression patterns clean")

        # Expected response checks
        expected_resp = turn.get("expected_response", {})

        if min_len := expected_resp.get("min_length"):
            assert len(session.response_text) >= min_len, (
                f"Response too short: {len(session.response_text)} < {min_len}"
            )
            logger.info(f"[{eval_id}] PASS: min_length ({len(session.response_text)} >= {min_len})")

        if must_not := expected_resp.get("must_not_contain"):
            for term in must_not:
                found = term.lower() in response_lower
                if found:
                    logger.warning(f"[{eval_id}] FAIL must_not_contain: found '{term}'")
                assert not found, f"Response contains banned term: '{term}'"
            logger.info(f"[{eval_id}] PASS: must_not_contain")

        if must_any := expected_resp.get("must_contain_any"):
            matched = [t for t in must_any if t.lower() in response_lower]
            if not matched:
                logger.warning(f"[{eval_id}] FAIL must_contain_any: none of {must_any} found")
            else:
                logger.info(f"[{eval_id}] PASS: must_contain_any (matched: {matched})")
            assert matched, (
                f"Response must contain one of {must_any}, "
                f"got: {session.response_text[:200]}"
            )

        # ----------------------------------------------------------------
        # 3. Build DeepEval test case
        # ----------------------------------------------------------------
        expected_tools_raw = turn.get("expected_tools", [])

        test_case = LLMTestCase(
            input=question,
            actual_output=session.response_text,
            tools_called=[ToolCall(name=a) for a in actions_called if a],
            expected_tools=build_expected_tools(expected_tools_raw, actions_called),
        )

        # ----------------------------------------------------------------
        # 4. Build metrics list
        # ----------------------------------------------------------------
        metrics = []

        # Tool correctness (only when we have expected tools)
        if expected_tools_raw:
            eval_llm = get_eval_llm()
            metrics.append(ToolCorrectnessMetric(
                threshold=0.5,
                model=eval_llm,
                should_consider_ordering=False,
            ))

        # Rubric-based quality (only when rubric is defined)
        if rubric := turn.get("rubric"):
            eval_llm = get_eval_llm()
            geval_threshold = turn.get("geval_threshold", 0.5)
            metrics.append(GEval(
                name="ResponseQuality",
                criteria=rubric,
                evaluation_params=[
                    LLMTestCaseParams.INPUT,
                    LLMTestCaseParams.ACTUAL_OUTPUT,
                ],
                model=eval_llm,
                threshold=geval_threshold,
            ))

        # ----------------------------------------------------------------
        # 5. Assert with DeepEval
        # ----------------------------------------------------------------
        if metrics:
            logger.info(
                f"[{eval_id}] Running DeepEval metrics: "
                f"{[type(m).__name__ for m in metrics]}"
            )
            logger.info(
                f"[{eval_id}] DeepEval test_case: "
                f"tools_called={[tc.name for tc in test_case.tools_called]}, "
                f"expected_tools={[tc.name for tc in test_case.expected_tools]}"
            )
            assert_test(test_case, metrics)
            logger.info(f"[{eval_id}] PASS: All DeepEval metrics passed")
        else:
            logger.info(f"[{eval_id}] No DeepEval metrics (deterministic only)")

        logger.info(f"[{eval_id}] === TEST PASSED ===")
