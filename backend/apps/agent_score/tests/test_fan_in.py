"""
Tests for the fan-in coordination logic.
"""
from unittest.mock import patch

import pytest
from asgiref.sync import sync_to_async

from apps.agent_score.models import AgentScoreCheck, AgentScoreReport
from apps.agent_score.workflows.fan_in import complete_layer


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
        """When base layers are ready, should trigger analyze-and-score."""
        # Simulate both base layers done: probe_results + screenshot_url
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(
                completed_layers=1,
                probe_results={"status": 200},
                screenshot_url="https://example.com/screenshot.png",
            )
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is True
        mock_execute.assert_called_once_with(
            "agent-score-analyze-and-score",
            report_id=str(report.id),
        )

        # Counter should be incremented
        await report.arefresh_from_db()
        assert report.completed_layers == 2

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

    @pytest.mark.asyncio
    async def test_openclaw_checks_before_base_layers_does_not_finalize(self, report):
        """When openclaw creates checks before base layers finish, Phase 2
        should NOT fire — prevents race where report finalizes without
        rules/webmcp checks."""
        # Enable openclaw and simulate it finishing first: openclaw_data set,
        # checks exist (category=openclaw), but no probe_results or browser data.
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(
                completed_layers=1,
                openclaw_test_enabled=True,
                openclaw_data={"score": 50},
            )
        )()
        await sync_to_async(
            lambda: AgentScoreCheck.objects.create(
                report=report,
                category="openclaw",
                check_name="oc_mcp_found",
                check_label="MCP tools detected",
                passed=False,
                score=0,
                weight=1,
            )
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        # Neither Phase 1 nor Phase 2 should trigger
        assert triggered is False
        mock_execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_base_layers_ready_after_openclaw_triggers_analyzers(self, report):
        """When base layers become ready after openclaw already created checks,
        Phase 1 should still trigger analyze-and-score."""
        # Simulate: openclaw finished (has checks), base layers now also ready
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(
                completed_layers=2,
                openclaw_test_enabled=True,
                openclaw_data={"score": 50},
                probe_results={"status": 200},
                screenshot_url="https://example.com/screenshot.png",
            )
        )()
        # Openclaw check exists, but no rules/webmcp checks
        await sync_to_async(
            lambda: AgentScoreCheck.objects.create(
                report=report,
                category="openclaw",
                check_name="oc_mcp_found",
                check_label="MCP tools detected",
                passed=False,
                score=0,
                weight=1,
            )
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is True
        mock_execute.assert_called_once_with(
            "agent-score-analyze-and-score",
            report_id=str(report.id),
        )

    @pytest.mark.asyncio
    async def test_finalize_triggers_after_analyzers_and_openclaw(self, report):
        """Phase 2 triggers when analyzers have run (rules checks exist) AND
        all optional layers are done."""
        await sync_to_async(
            lambda: AgentScoreReport.objects.filter(id=report.id).update(
                completed_layers=2,
                openclaw_test_enabled=True,
                openclaw_data={"score": 50},
                probe_results={"status": 200},
                screenshot_url="https://example.com/screenshot.png",
            )
        )()
        # Rules check exists (from analyze-and-score)
        await sync_to_async(
            lambda: AgentScoreCheck.objects.create(
                report=report,
                category="rules",
                check_name="has_title",
                check_label="Page has title",
                passed=True,
                score=100,
                weight=1,
            )
        )()

        with patch("common.task_router.TaskRouter.execute") as mock_execute:
            triggered = await complete_layer(str(report.id))

        assert triggered is True
        mock_execute.assert_called_once_with(
            "agent-score-finalize-report",
            report_id=str(report.id),
        )
