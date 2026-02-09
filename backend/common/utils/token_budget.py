"""
Token budget tracking for agentic loops.

Tracks token usage across LLM calls, monitors context window occupancy,
and provides warnings when approaching limits.

Copyright (C) 2026 Pillar Team
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Lazy-loaded tiktoken encoder
_encoder = None


def _get_encoder():
    """Lazy-load tiktoken encoder to avoid import overhead."""
    global _encoder
    if _encoder is None:
        try:
            import tiktoken
            _encoder = tiktoken.get_encoding("cl100k_base")
        except ImportError:
            logger.warning("tiktoken not installed, using character-based estimation")
            _encoder = False  # Mark as unavailable
    return _encoder


@dataclass
class TokenBudget:
    """
    Track token usage across an agentic session.
    
    Monitors context window occupancy and warns when approaching limits.
    Designed to work with any model by accepting context_window as parameter.
    
    Example:
        budget = TokenBudget(model_name="gemini-3-pro", context_window=1000000)
        
        # After each LLM call
        budget.log_iteration(
            iteration=0,
            prompt_tokens=1500,
            completion_tokens=200,
        )
        
        if budget.should_compact:
            # Handle context compaction (summarize or truncate history)
            ...
    """
    
    model_name: str
    context_window: int  # From LLMConfigService.AVAILABLE_MODELS
    
    # Reserve space for output and safety buffer
    output_reserve: int = 8000  # Reserve for model output
    safety_buffer: int = 5000   # Buffer before triggering compaction
    
    # Compaction threshold (percentage of available context)
    compaction_threshold_pct: float = 75.0
    
    # Accumulated usage (updated after each LLM call)
    system_prompt_tokens: int = 0
    tool_result_tokens: int = 0
    
    # Per-iteration tracking for debugging and analytics
    iteration_history: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def available_tokens(self) -> int:
        """Tokens available for new content (before hitting compaction threshold)."""
        effective_window = self.context_window - self.output_reserve - self.safety_buffer
        return max(0, effective_window - self.total_used)
    
    @property
    def total_used(self) -> int:
        """Total tokens currently tracked (from iteration history)."""
        if not self.iteration_history:
            return self.system_prompt_tokens + self.tool_result_tokens
        
        # Sum prompt tokens from all iterations (each iteration's prompt includes previous context)
        # Use the latest iteration's prompt tokens as the current context size
        latest = self.iteration_history[-1]
        return latest.get('prompt_tokens', 0) + self.tool_result_tokens
    
    @property
    def total_prompt_tokens(self) -> int:
        """Sum of all prompt tokens across iterations."""
        return sum(i.get('prompt_tokens', 0) for i in self.iteration_history)
    
    @property
    def total_completion_tokens(self) -> int:
        """Sum of all completion tokens across iterations."""
        return sum(i.get('completion_tokens', 0) for i in self.iteration_history)
    
    @property
    def occupancy_pct(self) -> float:
        """Current context occupancy as percentage of effective window."""
        effective_window = self.context_window - self.output_reserve
        if effective_window <= 0:
            return 100.0
        return (self.total_used / effective_window) * 100
    
    @property
    def should_compact(self) -> bool:
        """True if approaching context limit and should trigger summarization."""
        return self.occupancy_pct >= self.compaction_threshold_pct
    
    @property
    def peak_occupancy_pct(self) -> float:
        """Peak occupancy percentage across all iterations."""
        if not self.iteration_history:
            return 0.0
        return max(i.get('occupancy_pct', 0) for i in self.iteration_history)
    
    def count_tokens(self, text: str) -> int:
        """
        Count tokens using tiktoken (cl100k_base encoding).
        
        Falls back to character-based estimation if tiktoken unavailable.
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Token count
        """
        if not text:
            return 0
        
        encoder = _get_encoder()
        if encoder and encoder is not False:
            try:
                return len(encoder.encode(text))
            except Exception as e:
                logger.debug(f"tiktoken encoding failed: {e}, using estimation")
        
        # Fallback: ~4 characters per token (conservative estimate)
        return self.estimate_tokens(text)
    
    def estimate_tokens(self, text: str) -> int:
        """
        Fast token estimation without tiktoken.
        
        Uses ~4 characters per token as a conservative estimate.
        
        Args:
            text: Text to estimate tokens for
            
        Returns:
            Estimated token count
        """
        if not text:
            return 0
        return len(text) // 4 + 1
    
    def add_tool_result(self, result_text: str) -> int:
        """
        Track tokens from a tool result.
        
        Args:
            result_text: The tool result text
            
        Returns:
            Token count added
        """
        tokens = self.count_tokens(result_text)
        self.tool_result_tokens += tokens
        return tokens
    
    def log_iteration(
        self,
        iteration: int,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> None:
        """
        Log token usage for an iteration (from LLM response).
        
        Args:
            iteration: Current iteration number (0-indexed)
            prompt_tokens: Input tokens for this call
            completion_tokens: Output tokens for this call
        """
        # Calculate occupancy at this point
        effective_window = self.context_window - self.output_reserve
        current_occupancy = (prompt_tokens / effective_window * 100) if effective_window > 0 else 100
        
        self.iteration_history.append({
            "iteration": iteration,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "occupancy_pct": round(current_occupancy, 2),
        })
        
        logger.debug(
            f"[TokenBudget] Iteration {iteration}: "
            f"prompt={prompt_tokens:,}, completion={completion_tokens:,}, "
            f"occupancy={current_occupancy:.1f}%"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Export token budget state for analytics/logging.
        
        Returns:
            Dict with token usage summary
        """
        return {
            "model_name": self.model_name,
            "context_window": self.context_window,
            "total_prompt_tokens": self.total_prompt_tokens,
            "total_completion_tokens": self.total_completion_tokens,
            "total_tokens": self.total_prompt_tokens + self.total_completion_tokens,
            "peak_occupancy_pct": round(self.peak_occupancy_pct, 2),
            "iterations": len(self.iteration_history),
            "should_compact": self.should_compact,
        }
    
    def __repr__(self) -> str:
        return (
            f"TokenBudget(model={self.model_name}, "
            f"used={self.total_used:,}/{self.context_window:,}, "
            f"occupancy={self.occupancy_pct:.1f}%)"
        )
