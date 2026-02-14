"""
Tests for the WebMCP analyzer — meta tag, script detection, tools,
descriptions, tool count, and context checks.
"""
import pytest

from apps.agent_score.analyzers.webmcp import (
    _check_context_provided,
    _check_meta_tag,
    _check_script_detected,
    _check_tool_count,
    _check_tool_descriptions_quality,
    _check_tools_registered,
)

from .conftest import DQ_ALL_OK

# ── HTML samples for meta/script checks ──

HTML_NO_WEBMCP = "<html><head><title>Plain</title></head><body><p>Content</p></body></html>"

HTML_WEBMCP_META = """
<html><head>
<meta name="webmcp" content="enabled">
<title>WebMCP Page</title>
</head><body></body></html>
"""

HTML_MODEL_CONTEXT_META = """
<html><head>
<meta name="model-context" content="yes">
</head><body></body></html>
"""

HTML_SCRIPT_MODELCONTEXT = """
<html><head></head><body>
<script>
  if (navigator.modelContext) {
    navigator.modelContext.registerTool({ name: "test" });
  }
</script>
</body></html>
"""

HTML_SCRIPT_NAVIGATOR_AI = """
<html><body>
<script>navigator.ai.modelContext</script>
</body></html>
"""


class TestCheckMetaTag:
    """Tests for _check_meta_tag."""

    def test_no_meta_scores_0(self):
        result = _check_meta_tag(HTML_NO_WEBMCP, DQ_ALL_OK)
        assert result.check_name == "webmcp_meta_tag"
        assert result.passed is False
        assert result.score == 0
        assert result.details["has_webmcp_meta"] is False

    def test_webmcp_meta_scores_100(self):
        result = _check_meta_tag(HTML_WEBMCP_META, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["has_webmcp_meta"] is True

    def test_model_context_meta_scores_100(self):
        result = _check_meta_tag(HTML_MODEL_CONTEXT_META, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["has_model_context_meta"] is True

    def test_empty_html_scores_0(self):
        result = _check_meta_tag("", DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0


class TestCheckScriptDetected:
    """Tests for _check_script_detected."""

    def test_no_script_scores_0(self):
        result = _check_script_detected(HTML_NO_WEBMCP, DQ_ALL_OK)
        assert result.check_name == "webmcp_script_detected"
        assert result.passed is False
        assert result.score == 0
        assert result.details["references_found"] == 0

    def test_modelcontext_in_script_scores_100(self):
        result = _check_script_detected(HTML_SCRIPT_MODELCONTEXT, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["references_found"] >= 1

    def test_navigator_modelcontext_in_html_scores_100(self):
        result = _check_script_detected(HTML_SCRIPT_NAVIGATOR_AI, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100

    def test_empty_html_scores_0(self):
        result = _check_script_detected("", DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0


class TestCheckToolsRegistered:
    """Tests for _check_tools_registered."""

    def test_no_webmcp_data_scores_0(self):
        result = _check_tools_registered({}, DQ_ALL_OK)
        assert result.check_name == "tools_registered"
        assert result.passed is False
        assert result.score == 0
        assert result.details["tool_count"] == 0

    def test_api_and_tools_scores_100(self):
        webmcp = {"api_exists": True, "tools": [{"name": "test_tool"}]}
        result = _check_tools_registered(webmcp, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["tool_count"] == 1

    def test_api_exists_no_tools_scores_40(self):
        webmcp = {"api_exists": True, "tools": []}
        result = _check_tools_registered(webmcp, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 40

    def test_no_api_scores_0(self):
        webmcp = {"api_exists": False, "tools": []}
        result = _check_tools_registered(webmcp, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0


class TestCheckToolDescriptionsQuality:
    """Tests for _check_tool_descriptions_quality."""

    def test_no_tools_scores_0(self):
        result = _check_tool_descriptions_quality({"tools": []}, DQ_ALL_OK)
        assert result.check_name == "tool_descriptions_quality"
        assert result.passed is False
        assert result.score == 0
        assert result.details["tool_count"] == 0

    def test_all_tools_with_description_and_schema_scores_100(self):
        tools = [
            {"name": "a", "description": "Desc", "has_schema": True},
            {"name": "b", "description": "Desc", "has_schema": True},
        ]
        result = _check_tool_descriptions_quality({"tools": tools}, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["description_coverage"] == 100
        assert result.details["schema_coverage"] == 100

    def test_partial_descriptions_scores_lower(self):
        tools = [
            {"name": "a", "description": "Desc", "has_schema": True},
            {"name": "b", "description": "", "has_schema": False},
        ]
        result = _check_tool_descriptions_quality({"tools": tools}, DQ_ALL_OK)
        assert result.passed is False
        assert result.score < 100


class TestCheckToolCount:
    """Tests for _check_tool_count."""

    def test_no_tools_scores_0(self):
        result = _check_tool_count({"tools": []}, DQ_ALL_OK)
        assert result.check_name == "tool_count"
        assert result.passed is False
        assert result.score == 0
        assert result.details["tool_count"] == 0

    def test_one_tool_scores_50(self):
        result = _check_tool_count({"tools": [{"name": "a"}]}, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 50
        assert result.details["tool_count"] == 1

    def test_three_tools_scores_80(self):
        tools = [{"name": f"tool_{i}"} for i in range(3)]
        result = _check_tool_count({"tools": tools}, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 80
        assert result.details["tool_count"] == 3

    def test_five_or_more_scores_100(self):
        tools = [{"name": f"tool_{i}"} for i in range(5)]
        result = _check_tool_count({"tools": tools}, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["tool_count"] == 5


class TestCheckContextProvided:
    """Tests for _check_context_provided."""

    def test_no_context_scores_0(self):
        result = _check_context_provided({}, DQ_ALL_OK)
        assert result.check_name == "context_provided"
        assert result.passed is False
        assert result.score == 0
        assert result.details["context_provided"] is False

    def test_context_false_scores_0(self):
        result = _check_context_provided({"context_provided": False}, DQ_ALL_OK)
        assert result.passed is False
        assert result.score == 0

    def test_context_true_scores_100(self):
        result = _check_context_provided({"context_provided": True}, DQ_ALL_OK)
        assert result.passed is True
        assert result.score == 100
        assert result.details["context_provided"] is True


@pytest.mark.django_db
class TestWebmcpRun:
    """Integration tests for webmcp.run()."""

    def test_run_returns_six_checks(self, report_with_markdown):
        from apps.agent_score.analyzers import webmcp

        report = report_with_markdown
        report.webmcp_data = {}
        report.raw_html = HTML_NO_WEBMCP
        report.save()

        checks = webmcp.run(report, DQ_ALL_OK)
        assert len(checks) == 6
        names = [c.check_name for c in checks]
        assert names == [
            "webmcp_meta_tag",
            "webmcp_script_detected",
            "tools_registered",
            "tool_descriptions_quality",
            "tool_count",
            "context_provided",
        ]

    def test_run_all_checks_webmcp_category(self, report_with_markdown):
        from apps.agent_score.analyzers import webmcp

        report = report_with_markdown
        report.webmcp_data = {}
        report.save()

        checks = webmcp.run(report, DQ_ALL_OK)
        for c in checks:
            assert c.category == "webmcp"

    def test_run_with_populated_webmcp_data(self, report_with_markdown):
        from apps.agent_score.analyzers import webmcp

        report = report_with_markdown
        report.raw_html = HTML_WEBMCP_META + HTML_SCRIPT_MODELCONTEXT
        report.webmcp_data = {
            "api_exists": True,
            "tools": [
                {"name": "t1", "description": "D1", "has_schema": True},
                {"name": "t2", "description": "D2", "has_schema": True},
            ],
            "context_provided": True,
        }
        report.save()

        checks = webmcp.run(report, DQ_ALL_OK)
        meta = next(c for c in checks if c.check_name == "webmcp_meta_tag")
        script = next(c for c in checks if c.check_name == "webmcp_script_detected")
        tools = next(c for c in checks if c.check_name == "tools_registered")
        context = next(c for c in checks if c.check_name == "context_provided")

        assert meta.passed is True
        assert script.passed is True
        assert tools.passed is True
        assert context.passed is True
