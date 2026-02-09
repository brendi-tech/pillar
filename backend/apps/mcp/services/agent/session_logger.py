"""
Agent session logging for debugging.

Captures the complete lifecycle of MCP agent sessions including all thinking,
tool decisions, client communication, and internal state. Creates human-readable
"black box" recordings for post-hoc debugging.

Only active in development mode (controlled by AGENT_SESSION_LOGGING setting).
"""
import json
import logging
import os
import random
import traceback
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from django.conf import settings

if TYPE_CHECKING:
    from apps.mcp.services.agent_tools.context import AgentContext
    from common.utils.token_budget import TokenBudget

logger = logging.getLogger(__name__)

# Section separator for log files
SECTION_SEPARATOR = "=" * 80


class AgentSessionLogManager:
    """
    Manages log file creation, cleanup, and discovery.
    """

    @staticmethod
    def get_log_dir() -> Path:
        """Get the log directory, creating it if needed."""
        config = getattr(settings, 'AGENT_SESSION_LOGGING', {})
        log_dir = config.get('log_dir', Path(settings.BASE_DIR) / 'logs' / 'agent-sessions')
        if isinstance(log_dir, str):
            log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir

    @staticmethod
    def create_log_file(thread_id: str) -> Path:
        """Create a new log file for a session.
        
        Files are named with a descending sort prefix so newest files appear
        first when sorted alphabetically in file explorers.
        
        Logs are organized by month (e.g., agent-sessions/2026-02/) for easy cleanup.
        """
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        month_folder = now.strftime("%Y-%m")
        # Descending sort prefix: 9999999999 - epoch_seconds
        # This ensures newest files sort first alphabetically
        sort_prefix = 9999999999 - int(now.timestamp())
        # Sanitize thread_id for filename
        safe_thread_id = thread_id.replace("/", "_").replace("\\", "_")[:50]
        filename = f"{sort_prefix}_{safe_thread_id}_{timestamp}.txt"
        # Create month subdirectory
        month_dir = AgentSessionLogManager.get_log_dir() / month_folder
        month_dir.mkdir(parents=True, exist_ok=True)
        return month_dir / filename

    @staticmethod
    def cleanup_old_logs(max_files: int = 100) -> int:
        """
        Remove oldest log files if over limit.
        
        Searches all month subdirectories (e.g., 2026-02/) for log files.
        Also cleans up empty month directories.
        
        Returns the number of files deleted.
        """
        log_dir = AgentSessionLogManager.get_log_dir()
        if not log_dir.exists():
            return 0
        
        # Search recursively in month subdirectories
        files = sorted(log_dir.glob("**/*.txt"), key=lambda f: f.stat().st_mtime)
        deleted = 0
        while len(files) > max_files:
            try:
                file_to_delete = files.pop(0)
                parent_dir = file_to_delete.parent
                file_to_delete.unlink()
                deleted += 1
                # Clean up empty month directories
                if parent_dir != log_dir and parent_dir.exists():
                    try:
                        if not any(parent_dir.iterdir()):
                            parent_dir.rmdir()
                    except OSError:
                        pass
            except OSError:
                pass  # File may have been deleted by another process
        return deleted

    @staticmethod
    def list_recent_logs(limit: int = 20) -> List[Path]:
        """List recent session logs for debugging.
        
        Searches all month subdirectories (e.g., 2026-02/) for log files.
        """
        log_dir = AgentSessionLogManager.get_log_dir()
        if not log_dir.exists():
            return []
        # Search recursively in month subdirectories
        files = sorted(log_dir.glob("**/*.txt"), key=lambda f: f.stat().st_mtime, reverse=True)
        return files[:limit]


class AgentSessionLogger:
    """
    Captures complete agent session for debugging.
    
    Creates a human-readable, chronological dump of everything that happens
    during an agent session. Each session gets its own log file.
    
    Usage:
        logger = AgentSessionLogger(session_id, thread_id, run_id)
        logger.log_header(widget_id, org_id, user_message)
        logger.log_system_prompt(prompt)
        
        for iteration in range(max_iterations):
            logger.log_iteration_start(iteration, max_iterations)
            logger.log_context_state(context)
            logger.log_llm_request(model, messages, len(messages))
            logger.log_llm_response(thinking, tool, reasoning, args)
            logger.log_tool_execution(tool, duration_ms, results, len(results))
        
        logger.log_session_complete("SUCCESS", reasoning_trace)
    """

    def __init__(self, session_id: str, thread_id: str, run_id: str):
        """
        Initialize the session logger.
        
        Args:
            session_id: Session ID for correlation
            thread_id: Thread/conversation ID
            run_id: Unique run identifier
        """
        self.session_id = session_id
        self.thread_id = thread_id
        self.run_id = run_id
        self.start_time = datetime.now()
        self.buffer: List[str] = []
        self._iteration_count = 0
        self._response_buffer: List[str] = []
        
        # Load configuration
        self._config = getattr(settings, 'AGENT_SESSION_LOGGING', {})
        self._enabled = self._config.get('enabled', False)
        self._log_file: Optional[Path] = None
        self._django_log_info = self._get_django_log_info()
        
        if self._enabled:
            # Create log file
            self._log_file = AgentSessionLogManager.create_log_file(thread_id)
            
            # Probabilistic cleanup (10% chance to avoid overhead)
            if random.random() < 0.1:
                max_files = self._config.get('max_files', 100)
                AgentSessionLogManager.cleanup_old_logs(max_files)

    def _get_django_log_info(self) -> Dict[str, str]:
        """Resolve Django log metadata for linking with session logs."""
        log_file = getattr(settings, 'LOG_FILENAME', None)
        if not log_file:
            log_file = (
                getattr(settings, 'LOGGING', {})
                .get('handlers', {})
                .get('app_file', {})
                .get('filename')
            )
        log_path = Path(log_file) if log_file else None
        if log_path:
            return {
                "file": str(log_path),
                "pid": str(getattr(settings, 'LOG_PID', 'unknown')),
                "process": str(getattr(settings, 'PROCESS_TYPE', 'django')),
            }
        return {}

    def _write_section(self, title: str, content: str = "") -> None:
        """Write a section with a title header."""
        if not self._enabled:
            return
        
        self.buffer.append(SECTION_SEPARATOR)
        self.buffer.append(title)
        self.buffer.append(SECTION_SEPARATOR)
        if content:
            self.buffer.append(content)
        self.buffer.append("")  # Blank line after section

    def _write_subsection(self, title: str, content: str = "") -> None:
        """Write a subsection with a smaller header."""
        if not self._enabled:
            return
        
        self.buffer.append(f"--- {title} ---")
        if content:
            self.buffer.append(content)
        self.buffer.append("")

    def _flush_to_file(self) -> None:
        """Write buffer contents to the log file."""
        if not self._enabled or not self._log_file:
            return
        
        try:
            with open(self._log_file, 'a', encoding='utf-8') as f:
                f.write('\n'.join(self.buffer))
                f.write('\n')
            self.buffer.clear()
        except Exception as e:
            logger.warning(f"[SessionLogger] Failed to write log file: {e}")

    def _elapsed_time(self) -> float:
        """Get elapsed time since session start in seconds."""
        return (datetime.now() - self.start_time).total_seconds()

    # =========================================================================
    # Phase 1: Core Logging Methods
    # =========================================================================

    def log_header(
        self,
        widget_id: str,
        org_id: str,
        user_message: str,
    ) -> None:
        """Log the session header with metadata."""
        if not self._enabled:
            return
        
        self._write_section("AGENT SESSION LOG")
        self.buffer.append(f"Session ID:     {self.session_id}")
        self.buffer.append(f"Thread ID:      {self.thread_id}")
        self.buffer.append(f"Run ID:         {self.run_id}")
        self.buffer.append(f"Timestamp:      {self.start_time.isoformat()}")
        self.buffer.append(f"Widget ID:      {widget_id}")
        self.buffer.append(f"Organization:   {org_id}")
        if self._django_log_info:
            self.buffer.append(f"Django Log File: {self._django_log_info.get('file')}")
            self.buffer.append(f"Django Log PID:  {self._django_log_info.get('pid')}")
            self.buffer.append(f"Django Process:  {self._django_log_info.get('process')}")
        self.buffer.append("")
        
        self._write_section("USER MESSAGE", user_message)
        self._flush_to_file()

    def log_system_prompt(self, prompt: str) -> None:
        """Log the system prompt sent to the LLM."""
        if not self._enabled:
            return
        
        include_full = self._config.get('include_full_responses', True)
        if include_full:
            self._write_section("SYSTEM PROMPT", prompt)
        else:
            # Truncate for brevity
            truncated = prompt[:500] + "..." if len(prompt) > 500 else prompt
            self._write_section("SYSTEM PROMPT (truncated)", truncated)
        self._flush_to_file()

    def log_session_complete(
        self,
        status: str,
        display_trace: List[Dict[str, Any]],
        total_tokens_prompt: int = 0,
        total_tokens_completion: int = 0,
    ) -> None:
        """Log session completion with summary."""
        if not self._enabled:
            return
        
        duration = self._elapsed_time()
        
        self._write_section("SESSION COMPLETE")
        self.buffer.append(f"Total Duration: {duration:.2f}s")
        self.buffer.append(f"Total Iterations: {self._iteration_count}")
        if total_tokens_prompt or total_tokens_completion:
            self.buffer.append(f"Total Tokens: {total_tokens_prompt} (prompt) + {total_tokens_completion} (completion)")
        self.buffer.append(f"Final Status: {status}")
        self.buffer.append("")
        
        if display_trace:
            self._write_subsection("DISPLAY TRACE", json.dumps(display_trace, indent=2))
        
        self._write_section("END OF LOG")
        self._flush_to_file()

    # =========================================================================
    # Phase 2: Iteration and Tool Logging
    # =========================================================================

    def log_iteration_start(self, iteration: int, max_iterations: int) -> None:
        """Log the start of an iteration."""
        if not self._enabled:
            return
        
        self._iteration_count = iteration + 1
        timestamp = datetime.now().isoformat()
        
        self._write_section(f"ITERATION {iteration + 1} / {max_iterations}")
        self.buffer.append(f"Timestamp: {timestamp}")
        # Token budget will be logged separately

    def log_context_state(self, context: 'AgentContext') -> None:
        """Log the current context state."""
        if not self._enabled:
            return
        
        self._write_subsection("CONTEXT STATE")
        self.buffer.append(f"Found Actions: {len(context.found_actions)}")
        self.buffer.append(f"Found Knowledge: {len(context.found_knowledge)}")
        self.buffer.append(f"Query Results: {len(context.query_results)}")
        self.buffer.append(f"Tool Calls: {len(context.tool_calls)}")
        self.buffer.append("")

    def log_token_budget(self, budget: 'TokenBudget') -> None:
        """Log token budget state."""
        if not self._enabled:
            return
        
        self.buffer.append(f"Token Budget: {budget.total_used:,} used / {budget.context_window:,} total ({budget.occupancy_pct:.1f}%)")
        self.buffer.append("")
        self._flush_to_file()

    def log_llm_request(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        message_count: int,
    ) -> None:
        """Log an LLM request."""
        if not self._enabled:
            return
        
        self._write_subsection("LLM REQUEST")
        self.buffer.append(f"Model: {model}")
        self.buffer.append(f"Messages: {message_count}")
        
        include_full = self._config.get('include_full_responses', True)
        if include_full and messages:
            # Log message summaries
            for i, msg in enumerate(messages[-3:]):  # Last 3 messages
                role = msg.get('role', 'unknown')
                content = msg.get('content', '')
                if isinstance(content, str):
                    preview = content[:200] + "..." if len(content) > 200 else content
                else:
                    preview = str(content)[:200]
                self.buffer.append(f"  [{i}] {role}: {preview}")
        self.buffer.append("")

    def log_llm_response(
        self,
        thinking: str,
        tool: str,
        reasoning: str,
        args: Dict[str, Any],
    ) -> None:
        """Log an LLM response with tool decision."""
        if not self._enabled:
            return
        
        if thinking:
            self._write_subsection("LLM RESPONSE (THINKING)")
            self.buffer.append(f"<thinking>")
            self.buffer.append(thinking)
            self.buffer.append(f"</thinking>")
            self.buffer.append("")
        
        self._write_subsection("TOOL DECISION")
        self.buffer.append(f"Tool: {tool}")
        if reasoning:
            self.buffer.append(f"Reasoning: {reasoning}")
        if args:
            self.buffer.append("Arguments:")
            self.buffer.append(json.dumps(args, indent=2))
        self.buffer.append("")
        self._flush_to_file()

    def log_tool_execution(
        self,
        tool: str,
        duration_ms: int,
        results: Any,
        results_count: int = 0,
    ) -> None:
        """Log tool execution results."""
        if not self._enabled:
            return
        
        self._write_subsection("TOOL EXECUTION")
        self.buffer.append(f"Duration: {duration_ms}ms")
        self.buffer.append(f"Results Count: {results_count}")
        
        include_results = self._config.get('include_tool_results', True)
        if include_results and results:
            self.buffer.append("")
            if isinstance(results, list):
                for i, result in enumerate(results[:5]):  # Limit to first 5
                    self._format_result(i + 1, result)
            elif isinstance(results, dict):
                self.buffer.append(json.dumps(results, indent=2, default=str)[:1000])
            else:
                self.buffer.append(str(results)[:1000])
        self.buffer.append("")
        self._flush_to_file()

    def _format_result(self, index: int, result: Dict[str, Any]) -> None:
        """Format a single result for logging."""
        self.buffer.append(f"Result {index}:")
        if isinstance(result, dict):
            if 'score' in result:
                self.buffer.append(f"  Score: {result.get('score', 'N/A')}")
            if 'title' in result:
                self.buffer.append(f"  Title: {result.get('title', 'N/A')}")
            if 'name' in result:
                self.buffer.append(f"  Name: {result.get('name', 'N/A')}")
            if 'content' in result:
                content = result.get('content', '')
                preview = content[:200] + "..." if len(content) > 200 else content
                self.buffer.append(f"  Content: {preview}")
            if 'source' in result:
                self.buffer.append(f"  Source: {result.get('source', 'N/A')}")
            if 'url' in result:
                self.buffer.append(f"  URL: {result.get('url', 'N/A')}")
        else:
            self.buffer.append(f"  {str(result)[:200]}")
        self.buffer.append("")

    # =========================================================================
    # Phase 3: Event and Communication Logging
    # =========================================================================

    def log_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
        """Log a streaming event."""
        if not self._enabled:
            return
        
        # Compact format for events
        if event_data:
            # Filter out large content fields
            compact_data = {k: v for k, v in event_data.items() 
                          if k not in ('content', 'delta') or len(str(v)) < 100}
            data_str = json.dumps(compact_data, default=str) if compact_data else ""
        else:
            data_str = ""
        
        self.buffer.append(f"{event_type}: {data_str}")

    def log_events_batch(self, events: List[str]) -> None:
        """Log a batch of streaming events."""
        if not self._enabled:
            return
        
        self._write_subsection("EVENTS EMITTED")
        for event in events:
            self.buffer.append(event)
        self.buffer.append("")
        self._flush_to_file()

    def log_query_action_sent(self, action_id: str, params: Dict[str, Any]) -> None:
        """Log when a query action is sent to the client."""
        if not self._enabled:
            return
        
        self._write_subsection("QUERY ACTION SENT TO CLIENT")
        self.buffer.append(f"Action ID: {action_id}")
        self.buffer.append(f"Params: {json.dumps(params, default=str)}")
        self.buffer.append(f"Thread ID: {self.thread_id}")
        self.buffer.append("")
        
        self._write_subsection("WAITING FOR CLIENT RESULT")
        self.buffer.append(f"Waiting started: {datetime.now().isoformat()}")
        self.buffer.append(f"Timeout: 30s")
        self.buffer.append("")
        self._flush_to_file()

    def log_query_result_received(
        self,
        wait_duration_ms: int,
        result: Dict[str, Any],
    ) -> None:
        """Log when a query result is received from the client."""
        if not self._enabled:
            return
        
        self._write_subsection("CLIENT RESULT RECEIVED")
        self.buffer.append(f"Wait duration: {wait_duration_ms / 1000:.2f}s")
        self.buffer.append("Result:")
        self.buffer.append(json.dumps(result, indent=2, default=str)[:2000])
        self.buffer.append("")
        self._flush_to_file()

    def log_query_timeout(self, action_id: str, timeout_seconds: float) -> None:
        """Log when a query action times out."""
        if not self._enabled:
            return
        
        self._write_subsection("QUERY TIMEOUT")
        self.buffer.append(f"Action ID: {action_id}")
        self.buffer.append(f"Timeout: {timeout_seconds}s")
        self.buffer.append("")
        self._flush_to_file()

    def log_response_stream_start(self) -> None:
        """Log when response streaming starts."""
        if not self._enabled:
            return
        
        self._response_buffer.clear()
        self._write_subsection("STREAMING RESPONSE")

    def log_response_stream_content(self, content: str) -> None:
        """Accumulate streaming response content."""
        if not self._enabled:
            return
        
        self._response_buffer.append(content)

    def log_response_stream_complete(
        self,
        sources: List[Dict[str, Any]] = None,
    ) -> None:
        """Log completed streaming response."""
        if not self._enabled:
            return
        
        full_content = ''.join(self._response_buffer)
        self.buffer.append(full_content)
        self.buffer.append("")
        
        if sources:
            self._write_subsection("SOURCES USED")
            for i, source in enumerate(sources[:5], 1):
                title = source.get('title', 'Unknown')
                score = source.get('score', 'N/A')
                url = source.get('url', source.get('source', 'N/A'))
                self.buffer.append(f"{i}. {title} (score: {score})")
                if url:
                    self.buffer.append(f"   {url}")
            self.buffer.append("")
        
        self._response_buffer.clear()
        self._flush_to_file()

    # =========================================================================
    # Phase 4: Error Logging
    # =========================================================================

    def log_error(
        self,
        error_type: str,
        message: str,
        stack_trace: str = None,
    ) -> None:
        """Log an error with optional stack trace."""
        if not self._enabled:
            return
        
        self._write_subsection("ERROR")
        self.buffer.append(f"Error Type: {error_type}")
        self.buffer.append(f"Message: {message}")
        if stack_trace:
            self.buffer.append("Stack Trace:")
            self.buffer.append(stack_trace)
        self.buffer.append("")
        self._flush_to_file()

    def log_recovery_action(self, action: str) -> None:
        """Log a recovery action taken after an error."""
        if not self._enabled:
            return
        
        self._write_subsection("RECOVERY ACTION")
        self.buffer.append(action)
        self.buffer.append("")
        self._flush_to_file()

    def log_plan_created(self, plan: Dict[str, Any]) -> None:
        """Log when a plan is created."""
        if not self._enabled:
            return
        
        self._write_subsection("PLAN CREATED")
        plan_id = plan.get('id', 'unknown')
        goal = plan.get('goal', 'unknown')
        steps = plan.get('steps', [])
        
        self.buffer.append(f"Plan ID: {plan_id}")
        self.buffer.append(f"Goal: {goal}")
        self.buffer.append(f"Steps: {len(steps)}")
        self.buffer.append("Validation: PASSED")
        self.buffer.append("")
        self._flush_to_file()

    # =========================================================================
    # Phase 5: Native Tool Calling Logging
    # =========================================================================

    # Keys that should be redacted from logged arguments
    SENSITIVE_KEYS = {'password', 'token', 'key', 'secret', 'api_key', 'apikey', 'auth', 'credential'}

    def _sanitize_arguments(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive values from arguments before logging."""
        if not isinstance(args, dict):
            return args
        return {
            k: "[REDACTED]" if any(s in k.lower() for s in self.SENSITIVE_KEYS) else v
            for k, v in args.items()
        }

    def log_native_tool_call(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        tool_call_id: str,
        model: str,
        used_fallback: bool = False,
    ) -> None:
        """Log a native tool call with full details.
        
        Args:
            tool_name: Name of the tool being called (search, execute, respond)
            arguments: Arguments passed to the tool
            tool_call_id: Unique ID for this tool call (for correlation with results)
            model: Model that generated the tool call
            used_fallback: Whether this call used a fallback model
        """
        if not self._enabled:
            return
        
        self._write_subsection("NATIVE TOOL CALL")
        self.buffer.append(f"Tool: {tool_name}")
        self.buffer.append(f"Tool Call ID: {tool_call_id}")
        self.buffer.append(f"Model: {model}")
        if used_fallback:
            self.buffer.append("Fallback: YES (primary model failed)")
        self.buffer.append("Arguments:")
        # Filter sensitive params (passwords, tokens, keys)
        safe_args = self._sanitize_arguments(arguments)
        self.buffer.append(json.dumps(safe_args, indent=2, default=str))
        self.buffer.append("")
        self._flush_to_file()

    def log_model_fallback(
        self,
        original_model: str,
        fallback_model: str,
        reason: str,
    ) -> None:
        """Log when tool calling falls back to a different model.
        
        Args:
            original_model: The model that failed
            fallback_model: The model being used as fallback
            reason: Why the fallback was triggered
        """
        if not self._enabled:
            return
        
        self._write_subsection("MODEL FALLBACK")
        self.buffer.append(f"Original Model: {original_model}")
        self.buffer.append(f"Fallback Model: {fallback_model}")
        self.buffer.append(f"Reason: {reason}")
        self.buffer.append("")
        self._flush_to_file()

    def log_actions_registered(
        self,
        action_names: list[str],
        source: str = "search",
    ) -> None:
        """Log when actions are registered as native tools.
        
        Part of dynamic action tool calling - actions discovered via search
        are registered as native LLM tools for direct invocation.
        
        Args:
            action_names: Names of the actions registered
            source: Where the actions came from (e.g., "search", "restored")
        """
        if not self._enabled:
            return
        
        self._write_subsection("ACTIONS REGISTERED AS NATIVE TOOLS")
        self.buffer.append(f"Source: {source}")
        self.buffer.append(f"Count: {len(action_names)}")
        self.buffer.append(f"Actions: {', '.join(action_names)}")
        self.buffer.append("")
        self._flush_to_file()

    def log_action_tool_call(
        self,
        action_name: str,
        parameters: dict,
        tool_call_id: str,
    ) -> None:
        """Log when an action is called directly as a native tool.
        
        This is different from the legacy execute(action_name, params) pattern.
        With dynamic action tools, the LLM calls the action directly:
        action_name(param1=value1, param2=value2)
        
        Args:
            action_name: Name of the action being called (e.g., "test_chart_query")
            parameters: Parameters passed to the action
            tool_call_id: Unique ID for this tool call
        """
        if not self._enabled:
            return
        
        self._write_subsection("ACTION TOOL CALL (NATIVE)")
        self.buffer.append(f"Action: {action_name}")
        self.buffer.append(f"Tool Call ID: {tool_call_id}")
        self.buffer.append("Parameters:")
        safe_params = self._sanitize_arguments(parameters)
        self.buffer.append(json.dumps(safe_params, indent=2, default=str))
        self.buffer.append("")
        self._flush_to_file()


def emit_with_log(session_logger: AgentSessionLogger, event: Any) -> Any:
    """
    Helper to emit a streaming event and log it.
    
    Usage:
        yield emit_with_log(session_logger, emitter.step_started("reasoning"))
    """
    if session_logger and session_logger._enabled:
        event_type = type(event).__name__
        try:
            event_data = event.model_dump() if hasattr(event, 'model_dump') else {}
        except Exception:
            event_data = {}
        session_logger.log_event(event_type, event_data)
    return event
