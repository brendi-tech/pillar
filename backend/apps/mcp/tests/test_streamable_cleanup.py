"""
Guard tests for streamable_http.stream_event_generator cleanup.

Verifies ask-tool-specific persistence (flush_state, periodic flush, mark_completed)
was removed while SSE/JSON-RPC, cancel/disconnect, and mark_disconnected remain.
"""

import inspect
import re

import pytest

from apps.mcp.views.streamable_http import stream_event_generator


def _stream_event_generator_source() -> str:
    return inspect.getsource(stream_event_generator)


@pytest.fixture
def stream_gen_source() -> str:
    return _stream_event_generator_source()


class TestStreamableCleanup:
    def test_no_flush_state_dict(self, stream_gen_source: str) -> None:
        assert "flush_state = {" not in stream_gen_source

    def test_no_flush_all_function(self, stream_gen_source: str) -> None:
        assert "_flush_all" not in stream_gen_source

    def test_no_state_checkpoint_updates(self, stream_gen_source: str) -> None:
        assert re.search(
            r"if event_type == ['\"]state_checkpoint['\"]:\s*\n\s+pass\b",
            stream_gen_source,
        ), "state_checkpoint branch should be a no-op (pass only)"

    def test_no_periodic_flush(self, stream_gen_source: str) -> None:
        assert "last_flush_time" not in stream_gen_source

    def test_no_mark_completed_call(self, stream_gen_source: str) -> None:
        assert "mark_completed" not in stream_gen_source


class TestSSEFormattingPreserved:
    def test_sse_formatting_still_present(self, stream_gen_source: str) -> None:
        assert 'yield f"data:' in stream_gen_source

    def test_jsonrpc_wrapping_still_present(self, stream_gen_source: str) -> None:
        assert "'jsonrpc'" in stream_gen_source or '"jsonrpc"' in stream_gen_source
        assert "notifications/progress" in stream_gen_source


class TestCancelDisconnectPreserved:
    def test_cancel_event_handling_present(self, stream_gen_source: str) -> None:
        assert "cancel_event" in stream_gen_source
        assert "cancel_event.is_set()" in stream_gen_source

    def test_mark_disconnected_present(self, stream_gen_source: str) -> None:
        assert (
            "from apps.mcp.services.session_resumption import mark_disconnected"
            in stream_gen_source
        )
        assert "await mark_disconnected(" in stream_gen_source

    def test_disconnect_monitor_present(self, stream_gen_source: str) -> None:
        assert "disconnect_monitor_task" in stream_gen_source
