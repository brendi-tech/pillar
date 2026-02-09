"""
Tests for LLM resilience utilities.

Tests retry logic, error classification, smart defaults,
and API health tracking.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from common.utils.llm_resilience import (
    ErrorType,
    LLMCallResult,
    APIHealthTracker,
    classify_error,
    resilient_complete,
    resilient_complete_with_health_check,
    get_api_health_tracker,
)
from common.exceptions import LLMAPIError


class TestErrorClassification:
    """Tests for classify_error function."""
    
    def test_classify_rate_limit_429(self):
        """429 errors should be retryable."""
        error = LLMAPIError("Error 429: Too many requests")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_rate_limit_text(self):
        """Rate limit text should be retryable."""
        error = LLMAPIError("Rate limit exceeded, please slow down")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_service_unavailable(self):
        """503 errors should be retryable."""
        error = LLMAPIError("503 Service Unavailable")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_timeout(self):
        """Timeout errors should be retryable."""
        error = LLMAPIError("Connection timed out after 30s")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_connection_error(self):
        """Connection errors should be retryable."""
        error = LLMAPIError("Connection refused to openrouter.ai")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_ssl_error(self):
        """SSL errors should be retryable."""
        error = LLMAPIError("SSL certificate verify failed")
        assert classify_error(error) == ErrorType.RETRYABLE
    
    def test_classify_bad_request(self):
        """400 errors should be non-retryable."""
        error = LLMAPIError("400 Bad Request: Invalid model")
        assert classify_error(error) == ErrorType.NON_RETRYABLE
    
    def test_classify_unauthorized(self):
        """401 errors should be non-retryable."""
        error = LLMAPIError("401 Unauthorized")
        assert classify_error(error) == ErrorType.NON_RETRYABLE
    
    def test_classify_forbidden(self):
        """403 errors should be non-retryable."""
        error = LLMAPIError("403 Forbidden")
        assert classify_error(error) == ErrorType.NON_RETRYABLE
    
    def test_classify_content_filter(self):
        """Content filter errors should be non-retryable."""
        error = LLMAPIError("Response blocked by content_filter")
        assert classify_error(error) == ErrorType.NON_RETRYABLE
    
    def test_classify_invalid_api_key(self):
        """Invalid API key should be non-retryable."""
        error = LLMAPIError("Invalid API key provided")
        assert classify_error(error) == ErrorType.NON_RETRYABLE
    
    def test_classify_unknown_error(self):
        """Unknown errors should be classified as UNKNOWN."""
        error = LLMAPIError("Something weird happened")
        assert classify_error(error) == ErrorType.UNKNOWN


class TestAPIHealthTracker:
    """Tests for APIHealthTracker class."""
    
    @pytest.mark.asyncio
    async def test_initial_state_not_degraded(self):
        """Health tracker starts in non-degraded state."""
        tracker = APIHealthTracker(failure_threshold=3)
        assert not tracker.is_degraded
        assert await tracker.should_skip_llm() is False
    
    @pytest.mark.asyncio
    async def test_enters_degraded_mode_after_threshold(self):
        """Tracker enters degraded mode after threshold failures."""
        tracker = APIHealthTracker(failure_threshold=3)
        
        await tracker.record_failure()
        assert not tracker.is_degraded
        
        await tracker.record_failure()
        assert not tracker.is_degraded
        
        await tracker.record_failure()
        assert tracker.is_degraded
        assert await tracker.should_skip_llm() is True
    
    @pytest.mark.asyncio
    async def test_exits_degraded_mode_on_success(self):
        """Success resets failure count and exits degraded mode."""
        tracker = APIHealthTracker(failure_threshold=2)
        
        await tracker.record_failure()
        await tracker.record_failure()
        assert tracker.is_degraded
        
        await tracker.record_success()
        assert not tracker.is_degraded
        assert tracker.consecutive_failures == 0
    
    @pytest.mark.asyncio
    async def test_attempts_recovery_after_time(self):
        """After recovery_time, should_skip_llm returns False to try again."""
        tracker = APIHealthTracker(failure_threshold=1, recovery_time=0.1)
        
        await tracker.record_failure()
        assert tracker.is_degraded
        assert await tracker.should_skip_llm() is True
        
        # Wait for recovery time
        await asyncio.sleep(0.15)
        
        # Should attempt recovery
        assert await tracker.should_skip_llm() is False
    
    @pytest.mark.asyncio
    async def test_success_resets_consecutive_failures(self):
        """Success after failures resets the counter."""
        tracker = APIHealthTracker(failure_threshold=3)
        
        await tracker.record_failure()
        await tracker.record_failure()
        assert tracker.consecutive_failures == 2
        
        await tracker.record_success()
        assert tracker.consecutive_failures == 0


class TestResilientComplete:
    """Tests for resilient_complete function."""
    
    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self):
        """Returns success when LLM responds on first try."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="Valid response")
        
        with patch('apps.mcp.services.agent.recovery.get_smart_default_action') as mock_default:
            result = await resilient_complete(
                llm_client=mock_client,
                prompt="Test prompt",
                system_prompt="Test system",
                context={"question": "test"},
            )
        
        assert result.success is True
        assert result.content == "Valid response"
        assert result.retried is False
        assert result.retry_count == 0
    
    @pytest.mark.asyncio
    async def test_retry_on_empty_response(self):
        """Retries when LLM returns empty response."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(
            side_effect=["", "Valid on retry"]
        )
        
        with patch('apps.mcp.services.agent.recovery.get_smart_default_action'):
            result = await resilient_complete(
                llm_client=mock_client,
                prompt="Test prompt",
                system_prompt="Test system",
                max_retries=2,
                base_delay=0.01,
                context={"question": "test"},
            )
        
        assert result.success is True
        assert result.content == "Valid on retry"
        assert result.retried is True
        assert result.retry_count == 1
    
    @pytest.mark.asyncio
    async def test_retry_on_timeout(self):
        """Retries when LLM call times out."""
        mock_client = MagicMock()
        
        async def timeout_then_success(*args, **kwargs):
            if mock_client.complete_async.call_count == 1:
                await asyncio.sleep(10)  # Will timeout
            return "Success after timeout"
        
        mock_client.complete_async = AsyncMock(side_effect=timeout_then_success)
        
        with patch('apps.mcp.services.agent.recovery.get_smart_default_action'):
            result = await resilient_complete(
                llm_client=mock_client,
                prompt="Test prompt",
                system_prompt="Test system",
                max_retries=2,
                timeout=0.1,
                base_delay=0.01,
                context={"question": "test"},
            )
        
        assert result.success is True
        assert result.retried is True
    
    @pytest.mark.asyncio
    async def test_fallback_after_max_retries(self):
        """Uses fallback action after max retries exhausted."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="")  # Always empty
        
        mock_fallback = {"tool": "search_knowledge", "arguments": {"query": "test"}}
        
        with patch(
            'apps.mcp.services.agent.recovery.get_smart_default_action',
            return_value=mock_fallback
        ):
            result = await resilient_complete(
                llm_client=mock_client,
                prompt="Test prompt",
                system_prompt="Test system",
                max_retries=2,
                base_delay=0.01,
                context={"question": "test"},
            )
        
        assert result.success is False
        assert result.fallback_action == mock_fallback
        assert result.retry_count == 2
    
    @pytest.mark.asyncio
    async def test_no_retry_on_non_retryable_error(self):
        """Skips retry for non-retryable errors."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(
            side_effect=LLMAPIError("401 Unauthorized")
        )
        
        mock_fallback = {"tool": "search_knowledge", "arguments": {"query": "test"}}
        
        with patch(
            'apps.mcp.services.agent.recovery.get_smart_default_action',
            return_value=mock_fallback
        ):
            result = await resilient_complete(
                llm_client=mock_client,
                prompt="Test prompt",
                system_prompt="Test system",
                max_retries=2,
                base_delay=0.01,
                context={"question": "test"},
            )
        
        assert result.success is False
        assert result.error_type == ErrorType.NON_RETRYABLE
        assert result.retry_count == 0  # No retries for non-retryable


class TestResilientCompleteWithHealthCheck:
    """Tests for resilient_complete_with_health_check function."""
    
    @pytest.mark.asyncio
    async def test_skips_llm_when_degraded(self):
        """Skips LLM call when API is in degraded mode."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="Should not be called")
        
        mock_fallback = {"tool": "search_knowledge", "arguments": {"query": "test"}}
        
        with patch(
            'common.utils.llm_resilience._api_health.should_skip_llm',
            new_callable=AsyncMock,
            return_value=True
        ):
            with patch(
                'apps.mcp.services.agent.recovery.get_smart_default_action',
                return_value=mock_fallback
            ):
                result = await resilient_complete_with_health_check(
                    llm_client=mock_client,
                    prompt="Test prompt",
                    system_prompt="Test system",
                    context={"question": "test"},
                )
        
        assert result.success is False
        assert result.fallback_action == mock_fallback
        assert "degraded mode" in result.original_error
        mock_client.complete_async.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_records_success(self):
        """Records success to health tracker."""
        mock_client = MagicMock()
        mock_client.complete_async = AsyncMock(return_value="Valid response")
        
        with patch(
            'common.utils.llm_resilience._api_health.should_skip_llm',
            new_callable=AsyncMock,
            return_value=False
        ):
            with patch(
                'common.utils.llm_resilience._api_health.record_success',
                new_callable=AsyncMock
            ) as mock_record:
                with patch('apps.mcp.services.agent.recovery.get_smart_default_action'):
                    result = await resilient_complete_with_health_check(
                        llm_client=mock_client,
                        prompt="Test prompt",
                        system_prompt="Test system",
                        context={"question": "test"},
                    )
        
        assert result.success is True
        mock_record.assert_called_once()
