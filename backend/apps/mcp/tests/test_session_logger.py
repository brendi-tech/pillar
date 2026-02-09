"""
Tests for the agent session logger.

Tests the AgentSessionLogger and AgentSessionLogManager classes
for proper formatting, file management, and logging functionality.
"""
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from apps.mcp.services.agent.session_logger import (
    AgentSessionLogManager,
    AgentSessionLogger,
    emit_with_log,
)


class TestAgentSessionLogManager:
    """Tests for AgentSessionLogManager."""

    def test_get_log_dir_creates_directory(self, tmp_path):
        """Test that get_log_dir creates the directory if it doesn't exist."""
        log_dir = tmp_path / "logs" / "agent-sessions"
        
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': log_dir,
            }
            mock_settings.BASE_DIR = tmp_path
            
            result = AgentSessionLogManager.get_log_dir()
            
            assert result == log_dir
            assert log_dir.exists()

    def test_create_log_file_format(self, tmp_path):
        """Test log file naming format."""
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            
            log_file = AgentSessionLogManager.create_log_file("th_test123")
            
            # Log files are now in monthly subdirectories (e.g., 2026-02/)
            assert log_file.parent.parent == tmp_path
            assert log_file.parent.name.startswith("20")  # Year prefix like 2026-02
            assert "th_test123_" in log_file.name
            assert log_file.name.endswith(".txt")

    def test_cleanup_old_logs(self, tmp_path):
        """Test that cleanup removes oldest files when over limit."""
        # Create 5 log files
        for i in range(5):
            (tmp_path / f"log_{i}.txt").touch()
        
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            
            # Cleanup with max 3 files
            deleted = AgentSessionLogManager.cleanup_old_logs(max_files=3)
            
            assert deleted == 2
            remaining = list(tmp_path.glob("*.txt"))
            assert len(remaining) == 3

    def test_list_recent_logs(self, tmp_path):
        """Test listing recent logs returns files in reverse chronological order."""
        # Create log files with different timestamps
        import time
        for i in range(3):
            file = tmp_path / f"log_{i}.txt"
            file.touch()
            time.sleep(0.01)  # Small delay to ensure different mtimes
        
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            
            logs = AgentSessionLogManager.list_recent_logs(limit=2)
            
            assert len(logs) == 2
            # Most recent should be first
            assert logs[0].name == "log_2.txt"


class TestAgentSessionLogger:
    """Tests for AgentSessionLogger."""

    @pytest.fixture
    def enabled_logger(self, tmp_path):
        """Create an enabled logger for testing."""
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
                'max_files': 100,
                'include_full_responses': True,
                'include_tool_results': True,
            }
            mock_settings.BASE_DIR = tmp_path
            
            logger = AgentSessionLogger(
                session_id="test_session",
                thread_id="test_thread",
                run_id="test_run",
            )
            yield logger

    @pytest.fixture
    def disabled_logger(self, tmp_path):
        """Create a disabled logger for testing."""
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': False,
            }
            mock_settings.BASE_DIR = tmp_path
            
            logger = AgentSessionLogger(
                session_id="test_session",
                thread_id="test_thread",
                run_id="test_run",
            )
            yield logger

    def test_disabled_logger_does_nothing(self, disabled_logger):
        """Test that a disabled logger doesn't write anything."""
        disabled_logger.log_header("widget_1", "org_1", "Hello")
        disabled_logger.log_system_prompt("System prompt")
        disabled_logger.log_iteration_start(0, 100)
        
        assert len(disabled_logger.buffer) == 0
        assert disabled_logger._log_file is None

    def test_log_header_format(self, enabled_logger):
        """Test that header is formatted correctly."""
        enabled_logger.log_header("widget_123", "org_456", "How do I reset my password?")
        
        # Check log file was created and contains expected content
        assert enabled_logger._log_file.exists()
        content = enabled_logger._log_file.read_text()
        
        assert "AGENT SESSION LOG" in content
        assert "Session ID:     test_session" in content
        assert "Thread ID:      test_thread" in content
        assert "Run ID:         test_run" in content
        assert "Widget ID:      widget_123" in content
        assert "Organization:   org_456" in content
        assert "USER MESSAGE" in content
        assert "How do I reset my password?" in content

    def test_log_header_includes_django_log_info(self, tmp_path):
        """Test that Django log metadata is included when available."""
        django_log = tmp_path / "django.log"
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            mock_settings.LOG_FILENAME = django_log
            mock_settings.LOG_PID = 4242
            mock_settings.PROCESS_TYPE = "django-server"

            logger = AgentSessionLogger(
                session_id="test_session",
                thread_id="test_thread",
                run_id="test_run",
            )
            logger.log_header("widget_123", "org_456", "Hello")

            content = logger._log_file.read_text()

            assert "Django Log File:" in content
            assert str(django_log) in content
            assert "Django Log PID:  4242" in content
            assert "Django Process:  django-server" in content

    def test_log_iteration_start(self, enabled_logger):
        """Test iteration logging."""
        enabled_logger.log_iteration_start(0, 100)
        
        buffer_text = '\n'.join(enabled_logger.buffer)
        assert "ITERATION 1 / 100" in buffer_text
        assert "Timestamp:" in buffer_text

    def test_log_context_state(self, enabled_logger):
        """Test context state logging."""
        # Create mock context
        mock_context = MagicMock()
        mock_context.found_actions = [{"name": "action1"}]
        mock_context.found_knowledge = [{"title": "doc1"}, {"title": "doc2"}]
        mock_context.query_results = []
        mock_context.tool_calls = [{"tool": "search"}]
        
        enabled_logger.log_context_state(mock_context)
        
        buffer_text = '\n'.join(enabled_logger.buffer)
        assert "CONTEXT STATE" in buffer_text
        assert "Found Actions: 1" in buffer_text
        assert "Found Knowledge: 2" in buffer_text
        assert "Query Results: 0" in buffer_text
        assert "Tool Calls: 1" in buffer_text

    def test_log_llm_response(self, enabled_logger):
        """Test LLM response logging."""
        enabled_logger.log_llm_response(
            thinking="I need to search for password reset info",
            tool="search_knowledge",
            reasoning="User needs help resetting password",
            args={"query": "reset password", "limit": 5},
        )
        
        # Flush to file
        enabled_logger._flush_to_file()
        content = enabled_logger._log_file.read_text()
        
        assert "LLM RESPONSE (THINKING)" in content
        assert "I need to search for password reset info" in content
        assert "TOOL DECISION" in content
        assert "Tool: search_knowledge" in content
        assert "Reasoning: User needs help resetting password" in content

    def test_log_tool_execution(self, enabled_logger):
        """Test tool execution logging."""
        results = [
            {"title": "Password Reset Guide", "score": 0.92, "url": "https://example.com/reset"},
            {"title": "Account FAQ", "score": 0.85, "url": "https://example.com/faq"},
        ]
        
        enabled_logger.log_tool_execution(
            tool="search_knowledge",
            duration_ms=234,
            results=results,
            results_count=2,
        )
        
        enabled_logger._flush_to_file()
        content = enabled_logger._log_file.read_text()
        
        assert "TOOL EXECUTION" in content
        assert "Duration: 234ms" in content
        assert "Results Count: 2" in content
        assert "Password Reset Guide" in content
        assert "0.92" in content

    def test_log_session_complete(self, enabled_logger):
        """Test session completion logging."""
        display_trace = [
            {"step_type": "tool_decision", "tool": "search_knowledge"},
            {"step_type": "tool_result", "results_count": 3},
        ]
        
        enabled_logger.log_session_complete(
            status="SUCCESS",
            display_trace=display_trace,
            total_tokens_prompt=1000,
            total_tokens_completion=200,
        )
        
        content = enabled_logger._log_file.read_text()
        
        assert "SESSION COMPLETE" in content
        assert "SUCCESS" in content
        assert "END OF LOG" in content

    def test_log_query_action_flow(self, enabled_logger):
        """Test query action logging flow."""
        enabled_logger.log_query_action_sent("get_user_data", {"user_id": "123"})
        enabled_logger.log_query_result_received(
            wait_duration_ms=1200,
            result={"success": True, "data": {"name": "John"}},
        )
        
        content = enabled_logger._log_file.read_text()
        
        assert "QUERY ACTION SENT TO CLIENT" in content
        assert "Action ID: get_user_data" in content
        assert "CLIENT RESULT RECEIVED" in content
        assert "Wait duration: 1.20s" in content

    def test_log_query_timeout(self, enabled_logger):
        """Test query timeout logging."""
        enabled_logger.log_query_timeout("get_user_data", 30.0)
        
        content = enabled_logger._log_file.read_text()
        
        assert "QUERY TIMEOUT" in content
        assert "Action ID: get_user_data" in content
        assert "Timeout: 30.0s" in content

    def test_log_error(self, enabled_logger):
        """Test error logging."""
        enabled_logger.log_error(
            error_type="TimeoutError",
            message="Knowledge search timed out after 10s",
            stack_trace="File 'agentic_loop.py', line 234...",
        )
        
        content = enabled_logger._log_file.read_text()
        
        assert "ERROR" in content
        assert "Error Type: TimeoutError" in content
        assert "Knowledge search timed out after 10s" in content
        assert "Stack Trace:" in content

    def test_response_stream_logging(self, enabled_logger):
        """Test response streaming logging."""
        enabled_logger.log_response_stream_start()
        enabled_logger.log_response_stream_content("To reset your password, ")
        enabled_logger.log_response_stream_content("follow these steps...")
        enabled_logger.log_response_stream_complete(
            sources=[{"title": "Password Reset Guide", "score": 0.92}]
        )
        
        content = enabled_logger._log_file.read_text()
        
        assert "STREAMING RESPONSE" in content
        assert "To reset your password, follow these steps..." in content
        assert "SOURCES USED" in content
        assert "Password Reset Guide" in content


class TestEmitWithLog:
    """Tests for the emit_with_log helper."""

    def test_emit_with_log_returns_event(self, tmp_path):
        """Test that emit_with_log returns the original event."""
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            
            logger = AgentSessionLogger("s1", "t1", "r1")
            
            # Create a mock event
            mock_event = MagicMock()
            mock_event.model_dump.return_value = {"step_name": "reasoning"}
            
            result = emit_with_log(logger, mock_event)
            
            assert result is mock_event

    def test_emit_with_log_logs_event(self, tmp_path):
        """Test that emit_with_log logs the event."""
        with patch('apps.mcp.services.agent.session_logger.settings') as mock_settings:
            mock_settings.AGENT_SESSION_LOGGING = {
                'enabled': True,
                'log_dir': tmp_path,
            }
            mock_settings.BASE_DIR = tmp_path
            
            logger = AgentSessionLogger("s1", "t1", "r1")
            
            # Create a mock event
            mock_event = MagicMock()
            mock_event.__class__.__name__ = "StepStartedEvent"
            mock_event.model_dump.return_value = {"step_name": "reasoning"}
            
            emit_with_log(logger, mock_event)
            
            # Check that the event was logged
            buffer_text = '\n'.join(logger.buffer)
            assert "StepStartedEvent" in buffer_text

    def test_emit_with_log_handles_none_logger(self):
        """Test that emit_with_log handles None logger gracefully."""
        mock_event = MagicMock()
        result = emit_with_log(None, mock_event)
        assert result is mock_event
