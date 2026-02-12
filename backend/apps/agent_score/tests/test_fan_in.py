"""
Tests for the fan-in coordination logic.
"""
from unittest.mock import patch

import pytest
from asgiref.sync import sync_to_async

from apps.agent_score.models import AgentScoreReport
from apps.agent_score.workflows.fan_in import BASE_LAYERS, complete_layer


@pytest.mark.django_db(transaction=True)
class TestCompleteLayer:
    """Tests for the atomic fan-in counter."""

    @pytest.fixture
    def report(self):
        return AgentScoreReport.objects.create(
            url="https://example.com/",
            domain="example.com",
            status="running",
            completed_layers=0,
            signup_test_enabled=False,
        )

    @pytest.mark.asyncio
    async def test_first_layer_does_not_trigger(self, report):
        """First task to finish should NOT trigger analyze-and-score."""
        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is False
        mock_execute.assert_not_called()

        # Counter should be incremented
        await report.arefresh_from_db()
        assert report.completed_layers == 1

    @pytest.mark.asyncio
    async def test_second_layer_triggers_analyzer(self, report):
        """Second task to finish should trigger analyze-and-score."""
        # Simulate first layer already done
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(completed_layers=1)
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is True
        mock_execute.assert_called_once_with(
            "agent-score-analyze-and-score",
            report_id=str(report.id),
        )

        # Counter should be 2
        await report.arefresh_from_db()
        assert report.completed_layers == BASE_LAYERS

    @pytest.mark.asyncio
    async def test_failed_report_does_not_trigger(self, report):
        """If the report already failed, don't trigger even when counter hits 2."""
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(
                completed_layers=1, status="failed"
            )
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is False
        mock_execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_counter_starts_at_zero(self, report):
        """Freshly created report should have completed_layers=0."""
        assert report.completed_layers == 0

    @pytest.mark.asyncio
    async def test_atomic_increment_from_zero(self, report):
        """F() expression correctly increments from 0 to 1."""
        with patch("common.task_router.TaskRouter.execute"):
            await complete_layer(str(report.id))

        await report.arefresh_from_db()
        assert report.completed_layers == 1
