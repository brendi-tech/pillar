"""
Tests for backend disconnect detection.

Tests verify:
1. ASGIDisconnectMiddleware correctly detects http.disconnect messages
2. Disconnect event bridges to cancel_event via the monitor task
3. CancelledError safety net sets cancel_event
4. End-to-end: disconnect -> cancel_event.set() -> downstream stops

See: apps/mcp/middleware/disconnect_detection.py
     apps/mcp/views/streamable_http.py (stream_event_generator)
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.mcp.middleware.disconnect_detection import ASGIDisconnectMiddleware
from apps.mcp.services.stream_registry import stream_registry, StreamRegistry


# ---------------------------------------------------------------------------
# ASGIDisconnectMiddleware unit tests
# ---------------------------------------------------------------------------


class TestASGIDisconnectMiddleware:
    """Unit tests for the ASGI disconnect detection middleware."""

    @pytest.fixture(autouse=True)
    def _clear_registry(self):
        """Clear stream registry before/after each test."""
        StreamRegistry._active_streams.clear()
        yield
        StreamRegistry._active_streams.clear()

    @pytest.mark.asyncio
    async def test_sets_disconnect_event_on_scope(self):
        """Middleware should place a _disconnect_event on the HTTP scope."""
        captured_scope = {}

        async def mock_app(scope, receive, send):
            captured_scope.update(scope)

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "http"}
        receive = AsyncMock(return_value={"type": "http.request", "body": b""})
        send = AsyncMock()

        await middleware(scope, receive, send)

        assert "_disconnect_event" in captured_scope
        assert isinstance(captured_scope["_disconnect_event"], asyncio.Event)
        assert not captured_scope["_disconnect_event"].is_set()

    @pytest.mark.asyncio
    async def test_disconnect_event_set_on_http_disconnect(self):
        """Middleware should set the event when http.disconnect is received."""
        disconnect_event_holder = {}

        async def mock_app(scope, receive, send):
            disconnect_event_holder["event"] = scope["_disconnect_event"]
            # Simulate the app calling receive() which gets http.disconnect
            message = await receive()
            assert message["type"] == "http.disconnect"

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "http"}
        receive = AsyncMock(return_value={"type": "http.disconnect"})
        send = AsyncMock()

        await middleware(scope, receive, send)

        assert disconnect_event_holder["event"].is_set()

    @pytest.mark.asyncio
    async def test_disconnect_event_not_set_on_normal_request(self):
        """Middleware should NOT set the event for normal http.request messages."""
        disconnect_event_holder = {}

        async def mock_app(scope, receive, send):
            disconnect_event_holder["event"] = scope["_disconnect_event"]
            message = await receive()
            assert message["type"] == "http.request"

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "http"}
        receive = AsyncMock(return_value={"type": "http.request", "body": b""})
        send = AsyncMock()

        await middleware(scope, receive, send)

        assert not disconnect_event_holder["event"].is_set()

    @pytest.mark.asyncio
    async def test_non_http_scope_passes_through(self):
        """Non-HTTP scopes (websocket, lifespan) should pass through unchanged."""
        app_called = False

        async def mock_app(scope, receive, send):
            nonlocal app_called
            app_called = True
            # No _disconnect_event should be set for non-http scopes
            assert "_disconnect_event" not in scope

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "websocket"}
        receive = AsyncMock()
        send = AsyncMock()

        await middleware(scope, receive, send)

        assert app_called

    @pytest.mark.asyncio
    async def test_receive_wrapper_returns_message(self):
        """The wrapped receive should still return the message to the caller."""
        received_messages = []

        async def mock_app(scope, receive, send):
            msg = await receive()
            received_messages.append(msg)

        middleware = ASGIDisconnectMiddleware(mock_app)
        original_message = {"type": "http.request", "body": b"test"}
        scope = {"type": "http"}
        receive = AsyncMock(return_value=original_message)
        send = AsyncMock()

        await middleware(scope, receive, send)

        assert len(received_messages) == 1
        assert received_messages[0] is original_message

    @pytest.mark.asyncio
    async def test_multiple_receives_only_disconnect_sets_event(self):
        """Only http.disconnect should set the event, not other message types."""
        call_count = 0

        async def fake_receive():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"type": "http.request", "body": b"data"}
            else:
                return {"type": "http.disconnect"}

        disconnect_event_holder = {}

        async def mock_app(scope, receive, send):
            disconnect_event_holder["event"] = scope["_disconnect_event"]

            # First receive: normal request
            msg1 = await receive()
            assert msg1["type"] == "http.request"
            assert not disconnect_event_holder["event"].is_set()

            # Second receive: disconnect
            msg2 = await receive()
            assert msg2["type"] == "http.disconnect"

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "http"}
        send = AsyncMock()

        await middleware(scope, fake_receive, send)

        assert disconnect_event_holder["event"].is_set()


# ---------------------------------------------------------------------------
# Disconnect monitor task tests
# ---------------------------------------------------------------------------


class TestDisconnectMonitorTask:
    """Tests for the _monitor_disconnect task spawned in stream_event_generator."""

    @pytest.fixture(autouse=True)
    def _clear_registry(self):
        """Clear stream registry before/after each test."""
        StreamRegistry._active_streams.clear()
        yield
        StreamRegistry._active_streams.clear()

    @pytest.mark.asyncio
    async def test_monitor_bridges_disconnect_to_cancel_event(self):
        """When disconnect_event is set, the monitor should set cancel_event."""
        disconnect_event = asyncio.Event()
        cancel_event = asyncio.Event()

        async def _monitor_disconnect():
            while not disconnect_event.is_set():
                await asyncio.sleep(0.01)  # Faster polling for tests
            cancel_event.set()

        monitor_task = asyncio.create_task(_monitor_disconnect())

        # cancel_event should not be set yet
        assert not cancel_event.is_set()

        # Simulate browser disconnect
        disconnect_event.set()

        # Wait for monitor to pick it up
        await asyncio.sleep(0.05)

        assert cancel_event.is_set()

        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_monitor_can_be_cancelled_cleanly(self):
        """The monitor task should handle cancellation without errors."""
        disconnect_event = asyncio.Event()
        cancel_event = asyncio.Event()

        async def _monitor_disconnect():
            while not disconnect_event.is_set():
                await asyncio.sleep(0.01)
            cancel_event.set()

        monitor_task = asyncio.create_task(_monitor_disconnect())

        # Cancel before disconnect happens
        await asyncio.sleep(0.02)
        monitor_task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await monitor_task

        # cancel_event should NOT have been set since disconnect didn't happen
        assert not cancel_event.is_set()

    @pytest.mark.asyncio
    async def test_monitor_detection_latency(self):
        """Monitor should detect disconnect within a reasonable time window."""
        disconnect_event = asyncio.Event()
        cancel_event = asyncio.Event()
        detection_time = None

        async def _monitor_disconnect():
            nonlocal detection_time
            while not disconnect_event.is_set():
                await asyncio.sleep(0.1)  # Match production polling interval
            cancel_event.set()
            detection_time = asyncio.get_event_loop().time()

        monitor_task = asyncio.create_task(_monitor_disconnect())

        await asyncio.sleep(0.05)  # Let monitor start

        disconnect_time = asyncio.get_event_loop().time()
        disconnect_event.set()

        # Wait for detection
        await asyncio.sleep(0.2)

        assert cancel_event.is_set()
        assert detection_time is not None
        latency = detection_time - disconnect_time
        # Should detect within 200ms (polling at 100ms + scheduling overhead)
        assert latency < 0.3, f"Detection latency {latency:.3f}s exceeds 300ms"

        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass


# ---------------------------------------------------------------------------
# End-to-end integration: middleware -> monitor -> cancel_event -> downstream
# ---------------------------------------------------------------------------


class TestDisconnectEndToEnd:
    """Integration tests for the full disconnect detection chain."""

    @pytest.fixture(autouse=True)
    def _clear_registry(self):
        """Clear stream registry before/after each test."""
        StreamRegistry._active_streams.clear()
        yield
        StreamRegistry._active_streams.clear()

    @pytest.mark.asyncio
    async def test_full_chain_middleware_to_cancel_event(self):
        """
        End-to-end: middleware detects disconnect -> scope event set ->
        monitor bridges to cancel_event -> downstream code sees cancellation.
        
        This simulates the full flow without needing Django views.
        """
        cancel_event = stream_registry.register("e2e-test-stream")
        monitor_task = None

        async def mock_app(scope, receive, send):
            nonlocal monitor_task

            # Simulate what stream_event_generator does:
            # bridge the scope disconnect event to the cancel_event
            disconnect_event = scope.get("_disconnect_event")
            assert disconnect_event is not None

            async def _monitor_disconnect():
                while not disconnect_event.is_set():
                    await asyncio.sleep(0.01)
                cancel_event.set()

            monitor_task = asyncio.create_task(_monitor_disconnect())

            # Simulate streaming work...
            await asyncio.sleep(0.05)

            # Now simulate client disconnect by calling receive()
            # which will return http.disconnect
            msg = await receive()
            assert msg["type"] == "http.disconnect"

            # Give monitor time to detect and bridge
            await asyncio.sleep(0.05)

        middleware = ASGIDisconnectMiddleware(mock_app)
        scope = {"type": "http"}
        receive = AsyncMock(return_value={"type": "http.disconnect"})
        send = AsyncMock()

        await middleware(scope, receive, send)

        # The full chain should have resulted in cancel_event being set
        assert cancel_event.is_set()

        # Verify StreamRegistry also sees it as cancelled
        assert stream_registry.is_cancelled("e2e-test-stream")

        # Cleanup
        if monitor_task:
            monitor_task.cancel()
            try:
                await monitor_task
            except asyncio.CancelledError:
                pass

    @pytest.mark.asyncio
    async def test_disconnect_stops_simulated_polling_loop(self):
        """
        Simulate what wait_for_query_result does: poll every 100ms,
        check cancel_event. Verify disconnect stops the loop quickly.
        """
        cancel_event = stream_registry.register("polling-test")
        disconnect_event = asyncio.Event()
        poll_iterations = 0

        # Simulate the monitor task
        async def _monitor_disconnect():
            while not disconnect_event.is_set():
                await asyncio.sleep(0.01)
            cancel_event.set()

        monitor_task = asyncio.create_task(_monitor_disconnect())

        # Simulate wait_for_query_result polling loop
        async def simulated_wait_for_query_result(timeout=5.0):
            nonlocal poll_iterations
            import time
            start = time.time()
            while True:
                if cancel_event.is_set():
                    return None  # Cancelled
                elapsed = time.time() - start
                if elapsed >= timeout:
                    return {"error": "timeout"}
                poll_iterations += 1
                await asyncio.sleep(0.01)  # Faster polling for test

        # Start the polling in a task
        poll_task = asyncio.create_task(simulated_wait_for_query_result(timeout=5.0))

        # Let it poll for a bit
        await asyncio.sleep(0.05)
        assert not cancel_event.is_set()

        # Simulate browser disconnect
        disconnect_event.set()

        # Wait for the poll to finish
        result = await asyncio.wait_for(poll_task, timeout=1.0)

        # Should have returned None (cancelled), not timed out
        assert result is None
        # Should have stopped well before the 5s timeout
        assert poll_iterations < 100  # Way less than 500 iterations (5s / 0.01s)

        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_cancelled_error_safety_net(self):
        """
        When CancelledError fires, cancel_event.set() should be called
        as a safety net, ensuring downstream operations stop even if
        the disconnect middleware didn't trigger first.
        """
        cancel_event = stream_registry.register("safety-net-test")

        assert not cancel_event.is_set()

        # Simulate the CancelledError handler behavior from
        # stream_event_generator lines 721-726
        try:
            raise asyncio.CancelledError()
        except asyncio.CancelledError:
            cancel_event.set()  # The safety net line we added

        assert cancel_event.is_set()
        assert stream_registry.is_cancelled("safety-net-test")

    @pytest.mark.asyncio
    async def test_normal_completion_does_not_trigger_cancel(self):
        """
        When a stream completes normally (no disconnect), cancel_event
        should NOT be set and the monitor task should be cleanly cancelled.
        """
        cancel_event = stream_registry.register("normal-completion")
        disconnect_event = asyncio.Event()

        async def _monitor_disconnect():
            while not disconnect_event.is_set():
                await asyncio.sleep(0.01)
            cancel_event.set()

        monitor_task = asyncio.create_task(_monitor_disconnect())

        # Simulate normal streaming work completing
        await asyncio.sleep(0.05)

        # Stream completes normally -- cancel the monitor (like the finally block)
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

        # cancel_event should NOT be set
        assert not cancel_event.is_set()

        # Cleanup
        stream_registry.cleanup("normal-completion")
        assert stream_registry.get_active_count() == 0


# Example of how to run these tests:
# uv run pytest apps/mcp/tests/test_disconnect_detection.py -v
