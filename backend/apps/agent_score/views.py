"""
Views for Agent Score — public endpoints, no authentication required.
"""
import logging
from datetime import timedelta

import httpx
from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from apps.agent_score.models import AgentScoreReport
from apps.agent_score.serializers import (
    ReportSerializer,
    ScanRequestSerializer,
    ScanResponseSerializer,
)
from apps.agent_score.throttles import AgentScoreScanThrottle, AgentScoreSignupThrottle
from apps.agent_score.utils import extract_domain, validate_url
from common.task_router import TaskRouter

logger = logging.getLogger(__name__)


class AgentScoreViewSet(viewsets.GenericViewSet):
    """
    Public viewset for Agent Score.

    POST /scan/         — submit a URL for scanning
    GET  /{id}/report/  — retrieve the full scored report
    """

    permission_classes = [AllowAny]
    serializer_class = ReportSerializer
    lookup_field = "pk"

    # Heavy fields not needed by the serializer — skip loading them.
    _deferred_fields = [
        "raw_html",
        "rendered_html",
        "accessibility_tree",
        "axe_results",
        "webmcp_data",
        "forms_data",
        "captcha_data",
        "page_metadata",
        "datacenter_issues",
        "completed_layers",
        "email",
    ]

    def get_queryset(self):
        return (
            AgentScoreReport.objects.all()
            .prefetch_related("checks")
            .defer(*self._deferred_fields)
        )

    def get_throttles(self):
        """Apply scan-specific throttles to the scan action."""
        if self.action == "scan":
            throttles = [AgentScoreScanThrottle()]
            # Signup test gets a stricter throttle (2/hour) because it
            # creates real accounts on the target site.
            # Read directly from request.data since get_throttles runs
            # before the action method sets instance attributes.
            test_signup = True
            try:
                test_signup = self.request.data.get("test_signup", True)
            except Exception:
                pass
            if test_signup:
                throttles.append(AgentScoreSignupThrottle())
            return throttles
        return []

    @action(detail=False, methods=["post"], url_path="scan")
    def scan(self, request: Request) -> Response:
        """
        Submit a URL for agent-readiness scanning.

        If a completed report for the same domain exists within the last hour,
        returns it immediately instead of starting a new scan.
        """
        serializer = ScanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url: str = serializer.validated_data["url"]
        email: str = serializer.validated_data.get("email", "")
        test_signup: bool = serializer.validated_data.get("test_signup", True)
        force_rescan: bool = serializer.validated_data.get("force_rescan", False)

        # Validate URL safety
        is_valid, error_msg = validate_url(url)
        if not is_valid:
            return Response(
                {"error": error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        domain = extract_domain(url)

        if not force_rescan:
            # Check domain cache — return recent completed report if one exists.
            # Match on signup_test_enabled so toggling the checkbox gives fresh results.
            one_hour_ago = timezone.now() - timedelta(hours=1)
            recent_report = AgentScoreReport.objects.filter(
                domain=domain,
                status="complete",
                signup_test_enabled=test_signup,
                created_at__gte=one_hour_ago,
            ).first()

            if recent_report:
                logger.info(
                    f"[AGENT SCORE] Returning cached report {recent_report.id} for {domain}"
                )
                response_data = ScanResponseSerializer({
                    "report_id": recent_report.id,
                    "status": recent_report.status,
                }).data
                return Response(response_data, status=status.HTTP_200_OK)

        # Create new report
        report = AgentScoreReport.objects.create(
            url=url,
            domain=domain,
            email=email,
            signup_test_enabled=test_signup,
            status="running",
        )

        logger.info(f"[AGENT SCORE] Created report {report.id} for {url}")

        # Fire all layers in parallel.
        # Each task increments completed_layers atomically when done.
        # The last one to finish triggers analyze-and-score.
        report_id = str(report.id)
        TaskRouter.execute(
            "agent-score-http-probes",
            report_id=report_id,
        )
        TaskRouter.execute(
            "agent-score-browser-analysis",
            report_id=report_id,
        )
        if test_signup:
            TaskRouter.execute(
                "agent-score-signup-test",
                report_id=report_id,
            )

        response_data = ScanResponseSerializer({
            "report_id": report.id,
            "status": report.status,
        }).data
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request: Request, pk=None) -> Response:
        """Retrieve the full scored report with all check results."""
        report = self.get_object()
        serializer = ReportSerializer(report)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def recording(self, request: Request, pk=None) -> Response:
        """Proxy the Browserbase session recording for the signup test.

        Fetches rrweb DOM replay events from the Browserbase API using our
        API key so the end-user doesn't need Browserbase credentials.
        """
        report = self.get_object()

        session_id = (report.signup_test_data or {}).get("session_id")
        if not session_id:
            return Response(
                {"error": "No session recording available for this report."},
                status=status.HTTP_404_NOT_FOUND,
            )

        browserbase_url = (
            f"https://api.browserbase.com/v1/sessions/{session_id}/recording"
        )
        try:
            with httpx.Client(timeout=30.0) as client:
                bb_response = client.get(
                    browserbase_url,
                    headers={"X-BB-API-Key": settings.BROWSERBASE_API_KEY},
                )
                bb_response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                f"[AGENT SCORE] Browserbase recording fetch failed for "
                f"session {session_id}: {e.response.status_code}"
            )
            return Response(
                {"error": "Recording not available from Browserbase."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except httpx.RequestError as e:
            logger.error(
                f"[AGENT SCORE] Browserbase recording request error for "
                f"session {session_id}: {e}"
            )
            return Response(
                {"error": "Could not reach Browserbase API."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(bb_response.json())
