"""
Tests for Agent Score API views.
"""
from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.agent_score.models import AgentScoreReport


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def mock_task_router():
    with patch("apps.agent_score.views.TaskRouter.execute") as mock:
        yield mock


@pytest.fixture(autouse=True)
def _disable_throttle():
    """Disable rate limiting for all view tests."""
    with (
        patch("apps.agent_score.views.AgentScoreScanThrottle.allow_request", return_value=True),
        patch("apps.agent_score.views.AgentScoreSignupThrottle.allow_request", return_value=True),
    ):
        yield


@pytest.mark.django_db
class TestScanEndpoint:
    """Tests for POST /api/public/agent-score/scan/"""

    URL = "/api/public/agent-score/scan/"

    def test_valid_url_creates_report(self, client, mock_task_router):
        response = client.post(self.URL, {"url": "https://example.com/"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "report_id" in response.data
        assert response.data["status"] == "running"

        # Verify report was created in DB
        report = AgentScoreReport.objects.get(id=response.data["report_id"])
        assert report.url == "https://example.com/"
        assert report.domain == "example.com"
        assert report.status == "running"

    def test_fires_all_tasks_in_parallel(self, client, mock_task_router):
        """View should fire all 4 tasks in parallel (http_probes, browser_analysis, signup_test, openclaw_test)."""
        client.post(self.URL, {"url": "https://example.com/"}, format="json")
        assert mock_task_router.call_count == 4

        task_names = [call[0][0] for call in mock_task_router.call_args_list]
        assert "agent-score-http-probes" in task_names
        assert "agent-score-browser-analysis" in task_names
        assert "agent-score-signup-test" in task_names
        assert "agent-score-openclaw-test" in task_names

    def test_invalid_url_rejected(self, client, mock_task_router):
        response = client.post(self.URL, {"url": "not-a-url"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_localhost_rejected(self, client, mock_task_router):
        response = client.post(self.URL, {"url": "http://localhost:8000/"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Localhost" in response.data.get("error", "")

    def test_private_ip_rejected(self, client, mock_task_router):
        response = client.post(self.URL, {"url": "http://192.168.1.1/"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_url_rejected(self, client, mock_task_router):
        response = client.post(self.URL, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_optional_email_stored(self, client, mock_task_router):
        response = client.post(
            self.URL,
            {"url": "https://example.com/", "email": "user@example.com"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        report = AgentScoreReport.objects.get(id=response.data["report_id"])
        assert report.email == "user@example.com"

    def test_returns_cached_report(self, client, mock_task_router):
        """A completed report within 1h should be returned instead of creating new."""
        existing = AgentScoreReport.objects.create(
            url="https://cached.com/",
            domain="cached.com",
            status="complete",
            overall_score=75,
            signup_test_enabled=True,
            openclaw_test_enabled=True,
        )

        response = client.post(self.URL, {"url": "https://cached.com/page"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["report_id"]) == str(existing.id)
        assert response.data["status"] == "complete"

        # Should NOT trigger a new workflow
        mock_task_router.assert_not_called()

    def test_running_report_not_cached(self, client, mock_task_router):
        """A running report should NOT be returned as cached."""
        AgentScoreReport.objects.create(
            url="https://running.com/",
            domain="running.com",
            status="running",
        )

        response = client.post(self.URL, {"url": "https://running.com/"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        # All parallel tasks should be triggered
        assert mock_task_router.call_count == 4

    def test_force_rescan_bypasses_cache(self, client, mock_task_router):
        """force_rescan should always create a fresh report."""
        existing = AgentScoreReport.objects.create(
            url="https://cached.com/",
            domain="cached.com",
            status="complete",
            overall_score=75,
        )

        response = client.post(
            self.URL,
            {"url": "https://cached.com/page", "force_rescan": True},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert str(response.data["report_id"]) != str(existing.id)
        assert response.data["status"] == "running"
        assert mock_task_router.call_count == 4


@pytest.mark.django_db
class TestReportEndpoint:
    """Tests for GET /api/public/agent-score/{id}/report/"""

    def test_complete_report(self, client, mock_task_router):
        report = AgentScoreReport.objects.create(
            url="https://example.com/",
            domain="example.com",
            status="complete",
            overall_score=85,
            content_score=90,
            interaction_score=80,
            html_token_count=5000,
            markdown_token_count=800,
            supports_markdown_negotiation=True,
            content_signal="ai-train=yes, search=yes, ai-input=yes",
        )

        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["overall_score"] == 85
        assert response.data["status"] == "complete"
        assert response.data["domain"] == "example.com"

        # Check token metrics include markdown negotiation
        metrics = response.data["token_metrics"]
        assert metrics["html_token_count"] == 5000
        assert metrics["markdown_token_count"] == 800
        assert metrics["supports_markdown_negotiation"] is True
        assert metrics["content_signal"] == "ai-train=yes, search=yes, ai-input=yes"
        assert metrics["token_reduction_percent"] == 84.0

    def test_category_config_always_present(self, client, mock_task_router):
        """Every report response should include category_config from the registry."""
        report = AgentScoreReport.objects.create(
            url="https://example.com/",
            domain="example.com",
            status="complete",
            overall_score=75,
        )
        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        assert "category_config" in response.data
        cfg = response.data["category_config"]
        # Must contain all registry categories
        assert "openclaw" in cfg
        assert "signup_test" in cfg
        assert "rules" in cfg
        assert "webmcp" in cfg
        # Each entry must have the expected fields
        for key, entry in cfg.items():
            assert "label" in entry, f"category_config['{key}'] missing 'label'"
            assert "description" in entry
            assert "scored" in entry
            assert "optional" in entry
            assert "sort_order" in entry
        # WebMCP should not be scored
        assert cfg["webmcp"]["scored"] is False
        # Rules should be scored
        assert cfg["rules"]["scored"] is True

    def test_category_scores_fallback_for_legacy_report(self, client, mock_task_router):
        """Old reports without category_scores JSON should fall back to legacy columns."""
        report = AgentScoreReport.objects.create(
            url="https://legacy.com/",
            domain="legacy.com",
            status="complete",
            overall_score=70,
            content_score=80,
            interaction_score=60,
            webmcp_score=0,
            signup_test_score=50,
            # category_scores left empty (default={}) to simulate old report
        )
        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        assert "category_scores" in response.data
        scores = response.data["category_scores"]
        # Legacy content_score=80 and interaction_score=60 are averaged to rules
        assert scores["rules"] == 70  # (80 + 60) / 2
        assert scores["webmcp"] == 0
        assert scores["signup_test"] == 50

    def test_category_scores_from_json_field(self, client, mock_task_router):
        """New reports with category_scores JSON should use it directly."""
        report = AgentScoreReport.objects.create(
            url="https://new.com/",
            domain="new.com",
            status="complete",
            overall_score=72,
            category_scores={"rules": 85, "webmcp": 10, "signup_test": None},
            content_score=85,
            interaction_score=60,
        )
        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        scores = response.data["category_scores"]
        assert scores["rules"] == 85
        assert scores["webmcp"] == 10
        assert scores["signup_test"] is None

    def test_pending_report(self, client, mock_task_router):
        report = AgentScoreReport.objects.create(
            url="https://example.com/",
            domain="example.com",
            status="pending",
        )

        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "pending"
        assert response.data["overall_score"] is None

    def test_nonexistent_report_404(self, client, mock_task_router):
        import uuid
        url = f"/api/public/agent-score/{uuid.uuid4()}/report/"
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_report_without_markdown(self, client, mock_task_router):
        report = AgentScoreReport.objects.create(
            url="https://plain.com/",
            domain="plain.com",
            status="complete",
            overall_score=55,
            html_token_count=10000,
            supports_markdown_negotiation=False,
        )

        url = f"/api/public/agent-score/{report.id}/report/"
        response = client.get(url)

        metrics = response.data["token_metrics"]
        assert metrics["supports_markdown_negotiation"] is False
        assert "token_reduction_percent" not in metrics
        assert "content_signal" not in metrics
