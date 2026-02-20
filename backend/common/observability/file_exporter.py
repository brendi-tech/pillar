"""
NDJSON file-based span exporter for local development.

Writes OpenTelemetry spans as newline-delimited JSON to logs/traces/{YYYY-MM}/.
One file per trace ID (agent session), with child spans appended as they complete.
"""
import json
import logging
import os
import random
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.trace import StatusCode

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = frozenset({
    "password", "token", "key", "secret", "api_key", "apikey", "auth", "credential",
})


def sanitize_attributes(attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Redact values whose keys suggest sensitive content."""
    if not isinstance(attrs, dict):
        return attrs
    return {
        k: "[REDACTED]" if any(s in k.lower() for s in SENSITIVE_KEYS) else v
        for k, v in attrs.items()
    }


class TraceFileManager:
    """Manages trace file creation, cleanup, and discovery."""

    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            backend_dir = Path(__file__).resolve().parent.parent.parent
            base_dir = backend_dir / "logs" / "traces"
        self.base_dir = base_dir

    def get_dir(self) -> Path:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        return self.base_dir

    def get_month_dir(self) -> Path:
        month = datetime.now().strftime("%Y-%m")
        month_dir = self.get_dir() / month
        month_dir.mkdir(parents=True, exist_ok=True)
        return month_dir

    def trace_file_for(self, trace_id: str) -> Path:
        """Return the path for a given trace ID, creating the month dir."""
        now = datetime.now()
        month_dir = self.get_month_dir()
        sort_prefix = 9999999999 - int(now.timestamp())
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        prefix = trace_id[:12]
        filename = f"{sort_prefix}_{prefix}_{timestamp}.ndjson"
        return month_dir / filename

    def cleanup_old_traces(self, max_files: int = 100) -> int:
        """Remove oldest trace files if over limit. Returns count deleted."""
        base = self.get_dir()
        if not base.exists():
            return 0
        files = sorted(base.glob("**/*.ndjson"), key=lambda f: f.stat().st_mtime)
        deleted = 0
        while len(files) > max_files:
            try:
                f = files.pop(0)
                parent = f.parent
                f.unlink()
                deleted += 1
                if parent != base and parent.exists():
                    try:
                        if not any(parent.iterdir()):
                            parent.rmdir()
                    except OSError:
                        pass
            except OSError:
                pass
        return deleted

    def list_recent_traces(self, limit: int = 20) -> List[Path]:
        """List recent trace files, newest first."""
        base = self.get_dir()
        if not base.exists():
            return []
        files = sorted(base.glob("**/*.ndjson"), key=lambda f: f.stat().st_mtime, reverse=True)
        return files[:limit]


def _span_to_dict(span: ReadableSpan) -> Dict[str, Any]:
    """Convert a ReadableSpan to a JSON-serialisable dict."""
    ctx = span.get_span_context()

    attrs = dict(span.attributes) if span.attributes else {}

    events = []
    for ev in span.events or []:
        events.append({
            "name": ev.name,
            "timestamp": ev.timestamp,
            "attributes": {k: _serialisable(v) for k, v in (ev.attributes or {}).items()},
        })

    status_dict = None
    if span.status is not None:
        status_dict = {
            "status_code": span.status.status_code.name,
        }
        if span.status.description:
            status_dict["description"] = span.status.description

    start_ns = span.start_time or 0
    end_ns = span.end_time or 0
    duration_ms = (end_ns - start_ns) / 1_000_000

    return {
        "name": span.name,
        "trace_id": format(ctx.trace_id, "032x"),
        "span_id": format(ctx.span_id, "016x"),
        "parent_span_id": format(span.parent.span_id, "016x") if span.parent else None,
        "start_time": _iso_from_ns(start_ns),
        "end_time": _iso_from_ns(end_ns),
        "duration_ms": round(duration_ms, 2),
        "attributes": {k: _serialisable(v) for k, v in attrs.items()},
        "events": events,
        "status": status_dict,
    }


def _iso_from_ns(ns: int) -> str:
    """Convert nanosecond epoch to ISO-8601 string."""
    if ns == 0:
        return ""
    return datetime.fromtimestamp(ns / 1e9).isoformat()


def _serialisable(value: Any) -> Any:
    """Make a value JSON-serialisable."""
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    if isinstance(value, (list, tuple)):
        return [_serialisable(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialisable(v) for k, v in value.items()}
    return str(value)


class FileSpanExporter(SpanExporter):
    """
    Exports spans as NDJSON to local trace files.

    Each trace ID gets its own file. Spans are appended as they complete,
    so child spans appear before the root span.
    """

    def __init__(self, manager: Optional[TraceFileManager] = None, max_files: int = 100):
        self._manager = manager or TraceFileManager()
        self._max_files = max_files
        self._lock = threading.Lock()
        # trace_id -> file path (cached so we don't create duplicate files)
        self._trace_files: Dict[str, Path] = {}

    def _get_trace_file(self, trace_id: str) -> Path:
        with self._lock:
            if trace_id not in self._trace_files:
                path = self._manager.trace_file_for(trace_id)
                self._trace_files[trace_id] = path
                # Probabilistic cleanup (5% chance)
                if random.random() < 0.05:
                    self._manager.cleanup_old_traces(self._max_files)
            return self._trace_files[trace_id]

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        try:
            for span in spans:
                ctx = span.get_span_context()
                trace_id = format(ctx.trace_id, "032x")
                path = self._get_trace_file(trace_id)
                line = json.dumps(_span_to_dict(span), default=str) + "\n"
                with open(path, "a", encoding="utf-8") as f:
                    f.write(line)
            return SpanExportResult.SUCCESS
        except Exception as exc:
            logger.warning(f"[FileSpanExporter] Export failed: {exc}")
            return SpanExportResult.FAILURE

    def shutdown(self) -> None:
        self._trace_files.clear()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True
