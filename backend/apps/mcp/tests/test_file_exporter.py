"""
Tests for the FileSpanExporter and TraceFileManager.
"""
import json
import time
from pathlib import Path

import pytest

from common.observability.file_exporter import (
    FileSpanExporter,
    TraceFileManager,
    sanitize_attributes,
    _span_to_dict,
)


class TestTraceFileManager:
    """Tests for TraceFileManager."""

    def test_get_dir_creates_directory(self, tmp_path):
        base = tmp_path / "logs" / "traces"
        mgr = TraceFileManager(base_dir=base)
        result = mgr.get_dir()
        assert result == base
        assert base.exists()

    def test_get_month_dir_creates_subdirectory(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        month_dir = mgr.get_month_dir()
        assert month_dir.exists()
        assert month_dir.parent == tmp_path

    def test_trace_file_naming(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        path = mgr.trace_file_for("abc123def456")
        assert path.name.endswith(".ndjson")
        assert "abc123def456" in path.name

    def test_cleanup_old_traces(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        for i in range(5):
            f = tmp_path / f"trace_{i}.ndjson"
            f.touch()
            time.sleep(0.01)

        deleted = mgr.cleanup_old_traces(max_files=3)
        assert deleted == 2
        remaining = list(tmp_path.glob("*.ndjson"))
        assert len(remaining) == 3

    def test_list_recent_traces(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        for i in range(3):
            f = tmp_path / f"trace_{i}.ndjson"
            f.touch()
            time.sleep(0.01)

        traces = mgr.list_recent_traces(limit=2)
        assert len(traces) == 2
        assert traces[0].name == "trace_2.ndjson"

    def test_list_recent_traces_empty(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        traces = mgr.list_recent_traces()
        assert traces == []


class TestFileSpanExporter:
    """Tests for FileSpanExporter."""

    def test_export_creates_ndjson(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("mcp.request") as span:
            span.set_attribute("test.key", "test_value")

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        assert len(files) == 1

        with open(files[0], 'r') as f:
            lines = [l.strip() for l in f if l.strip()]
        assert len(lines) == 1

        data = json.loads(lines[0])
        assert data["name"] == "mcp.request"
        assert data["attributes"]["test.key"] == "test_value"
        assert data["trace_id"]
        assert data["span_id"]
        assert data["duration_ms"] >= 0

    def test_export_groups_by_trace_id(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("mcp.request"):
            with tracer.start_as_current_span("agentic_loop"):
                pass

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        assert len(files) == 1

        with open(files[0], 'r') as f:
            lines = [l.strip() for l in f if l.strip()]
        assert len(lines) == 2

        spans = [json.loads(l) for l in lines]
        assert spans[0]["name"] == "agentic_loop"
        assert spans[1]["name"] == "mcp.request"
        assert spans[0]["trace_id"] == spans[1]["trace_id"]
        assert spans[0]["parent_span_id"] == spans[1]["span_id"]

    def test_export_filters_noise_traces(self, tmp_path):
        """Standalone auto-instrumented traces should not be written to disk."""
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("POST mcp/"):
            with tracer.start_as_current_span("SELECT"):
                pass

        with tracer.start_as_current_span("EVAL"):
            pass

        with tracer.start_as_current_span("BZPOPMIN"):
            pass

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        assert len(files) == 0

    def test_meaningful_trace_includes_all_children(self, tmp_path):
        """Auto-instrumented child spans within a meaningful trace are kept."""
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("mcp.request"):
            with tracer.start_as_current_span("agentic_loop"):
                with tracer.start_as_current_span("SELECT"):
                    pass
                with tracer.start_as_current_span("llm.tool_decision"):
                    pass

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        assert len(files) == 1

        with open(files[0], 'r') as f:
            lines = [l.strip() for l in f if l.strip()]
        assert len(lines) == 4

        span_names = [json.loads(l)["name"] for l in lines]
        assert "SELECT" in span_names
        assert "llm.tool_decision" in span_names
        assert "agentic_loop" in span_names
        assert "mcp.request" in span_names

    def test_export_captures_events(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("mcp.request") as span:
            span.add_event("test_event", {"detail": "something happened"})

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        with open(files[0], 'r') as f:
            data = json.loads(f.readline())

        assert len(data["events"]) == 1
        assert data["events"][0]["name"] == "test_event"
        assert data["events"][0]["attributes"]["detail"] == "something happened"

    def test_export_captures_status(self, tmp_path):
        mgr = TraceFileManager(base_dir=tmp_path)
        exporter = FileSpanExporter(manager=mgr)

        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor
        from opentelemetry.trace import StatusCode

        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        tracer = provider.get_tracer("test")

        with tracer.start_as_current_span("mcp.request") as span:
            span.set_status(StatusCode.ERROR, "something failed")

        provider.shutdown()

        files = list(tmp_path.glob("**/*.ndjson"))
        with open(files[0], 'r') as f:
            data = json.loads(f.readline())

        assert data["status"]["status_code"] == "ERROR"
        assert data["status"]["description"] == "something failed"


class TestSanitizeAttributes:
    """Tests for sensitive data redaction."""

    def test_redacts_sensitive_keys(self):
        attrs = {"name": "test", "api_key": "secret123", "token": "tok_abc"}
        result = sanitize_attributes(attrs)
        assert result["name"] == "test"
        assert result["api_key"] == "[REDACTED]"
        assert result["token"] == "[REDACTED]"

    def test_preserves_safe_keys(self):
        attrs = {"query": "hello", "count": 5, "enabled": True}
        result = sanitize_attributes(attrs)
        assert result == attrs

    def test_handles_non_dict(self):
        assert sanitize_attributes("not a dict") == "not a dict"

    def test_handles_empty_dict(self):
        assert sanitize_attributes({}) == {}
