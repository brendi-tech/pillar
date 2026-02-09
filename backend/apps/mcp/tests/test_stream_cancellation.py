"""
Tests for MCP stream cancellation functionality.

Tests verify:
1. StreamRegistry correctly registers and cancels streams
2. Cancellation signal propagates correctly
"""
import asyncio
import pytest
from django.test import TestCase
from django.core.cache import cache
from apps.mcp.services.stream_registry import stream_registry, StreamRegistry


class StreamRegistryTests(TestCase):
    """Unit tests for StreamRegistry class."""

    def setUp(self):
        """Clear registry before each test."""
        StreamRegistry._active_streams.clear()

    def tearDown(self):
        """Clear registry after each test."""
        StreamRegistry._active_streams.clear()

    def test_register_creates_cancel_event(self):
        """Test that register() creates and returns an asyncio.Event."""
        cancel_event = stream_registry.register('test-request-1')

        self.assertIsInstance(cancel_event, asyncio.Event)
        self.assertFalse(cancel_event.is_set())
        self.assertIn('test-request-1', StreamRegistry._active_streams)

    def test_cancel_sets_event(self):
        """Test that cancel() sets the event for registered stream."""
        cancel_event = stream_registry.register('test-request-2')

        self.assertFalse(cancel_event.is_set())

        result = stream_registry.cancel('test-request-2')

        self.assertTrue(result)
        self.assertTrue(cancel_event.is_set())

    def test_cancel_returns_false_for_unknown_request(self):
        """Test that cancel() returns False for non-existent request."""
        result = stream_registry.cancel('non-existent-request')

        self.assertFalse(result)

    def test_cleanup_removes_stream(self):
        """Test that cleanup() removes stream from registry."""
        stream_registry.register('test-request-3')
        self.assertIn('test-request-3', StreamRegistry._active_streams)

        stream_registry.cleanup('test-request-3')

        self.assertNotIn('test-request-3', StreamRegistry._active_streams)

    def test_cleanup_handles_missing_request(self):
        """Test that cleanup() doesn't raise for non-existent request."""
        # Should not raise
        stream_registry.cleanup('non-existent-request')

    def test_multiple_streams_independent(self):
        """Test that multiple streams can be registered and cancelled independently."""
        event1 = stream_registry.register('request-1')
        event2 = stream_registry.register('request-2')
        event3 = stream_registry.register('request-3')

        # Cancel only request-2
        stream_registry.cancel('request-2')

        self.assertFalse(event1.is_set())
        self.assertTrue(event2.is_set())
        self.assertFalse(event3.is_set())

    def test_is_cancelled_returns_correct_state(self):
        """Test that is_cancelled() returns correct state."""
        stream_registry.register('test-request-4')

        # Not cancelled yet
        self.assertFalse(stream_registry.is_cancelled('test-request-4'))

        # Cancel it
        stream_registry.cancel('test-request-4')

        # Now should be cancelled
        self.assertTrue(stream_registry.is_cancelled('test-request-4'))

        # Unknown request should return False
        self.assertFalse(stream_registry.is_cancelled('unknown-request'))

    def test_get_active_count(self):
        """Test that get_active_count() returns correct count."""
        self.assertEqual(stream_registry.get_active_count(), 0)

        stream_registry.register('request-a')
        self.assertEqual(stream_registry.get_active_count(), 1)

        stream_registry.register('request-b')
        self.assertEqual(stream_registry.get_active_count(), 2)

        stream_registry.cleanup('request-a')
        self.assertEqual(stream_registry.get_active_count(), 1)


class CancelEventPropagationTests(TestCase):
    """Tests for cancel event propagation through the streaming chain."""

    def setUp(self):
        """Clear registry."""
        StreamRegistry._active_streams.clear()

    def tearDown(self):
        """Clean up."""
        StreamRegistry._active_streams.clear()

    def test_cancel_event_shared_reference(self):
        """Test that the cancel event is the same object throughout."""
        # This verifies the event passed to streaming functions
        # is the same one that cancel() sets
        event = stream_registry.register('shared-ref-test')

        # Simulate what would happen in the streaming chain
        # The event reference should be the same
        stored_event = StreamRegistry._active_streams.get('shared-ref-test')

        self.assertIs(event, stored_event)

        # When cancelled, both references should see it
        stream_registry.cancel('shared-ref-test')
        self.assertTrue(event.is_set())
        self.assertTrue(stored_event.is_set())

    def test_cancel_event_works_across_async_contexts(self):
        """Test that cancel event works correctly in async context."""
        async def async_test():
            event = stream_registry.register('async-test')

            # Simulate streaming loop checking event
            self.assertFalse(event.is_set())

            # Cancel from another "thread" (sync call)
            stream_registry.cancel('async-test')

            # Event should be set
            self.assertTrue(event.is_set())

            return True

        # Run the async test
        result = asyncio.get_event_loop().run_until_complete(async_test())
        self.assertTrue(result)


# Example of how to run these tests:
# uv run pytest apps/mcp/tests/test_stream_cancellation.py -v
# or with Django test runner:
# uv run python manage.py test apps.mcp.tests.test_stream_cancellation
