"""
Legacy helpers for plan-era error recovery.

The plan execution system was removed, but some recovery logic remains useful and is
still referenced by tests and integration code. This module intentionally contains
ONLY soft-error detection helpers (no tools, no plan execution).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional


def detect_soft_error_simple(result: Any) -> Optional[str]:
    """
    Detect obvious errors from a tool/action result without calling an LLM.

    This is intentionally conservative: it only flags explicit failure signals
    (e.g., `success=False`, `error`, or `validation_errors`). It should NOT attempt
    to infer nuanced failures from missing/null fields.

    Args:
        result: Tool/action result payload (typically a dict).

    Returns:
        A human-readable error string if an explicit error is detected, otherwise None.
    """
    if not isinstance(result, dict):
        return None

    # Explicit failure signal
    if result.get("success") is False:
        message = result.get("error") or result.get("message") or "Action returned success=false"
        return str(message)

    # Explicit error fields (even if success=True)
    if result.get("error"):
        return str(result["error"])

    validation_errors = result.get("validation_errors")
    if isinstance(validation_errors, list) and validation_errors:
        joined = ", ".join(str(e) for e in validation_errors)
        return f"Validation errors: {joined}"

    return None


async def detect_soft_error_llm(
    *,
    result: Any,
    action_name: str,
    llm_client: Any,
    timeout: float = 2.0,
) -> Optional[str]:
    """
    Detect nuanced/ambiguous failures using an LLM classification call.

    The LLM is only consulted if `detect_soft_error_simple()` finds no explicit
    error. On timeout or any parsing errors, this returns None (assume success).

    Expected LLM response is JSON:
      {"is_error": true|false, "reason": "<string>"}

    Args:
        result: Tool/action result payload (typically a dict).
        action_name: Name of the action/tool that produced the result.
        llm_client: Client with an awaitable `complete_async(**kwargs)` method.
        timeout: Max seconds to wait for the LLM call.

    Returns:
        An error description if the LLM flags an error, otherwise None.
    """
    explicit = detect_soft_error_simple(result)
    if explicit is not None:
        return explicit

    prompt = (
        "You are validating whether an action result indicates a hidden failure.\n\n"
        f"Action: {action_name}\n"
        "Result JSON:\n"
        f"{json.dumps(result, indent=2, default=str)}\n\n"
        'Return ONLY valid JSON: {"is_error": true|false, "reason": "<brief>"}'
    )

    try:
        response = await asyncio.wait_for(
            llm_client.complete_async(
                prompt=prompt,
                system_prompt="Return ONLY JSON. No markdown.",
                max_tokens=120,
                temperature=0,
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        return None
    except Exception:
        return None

    if not response or not str(response).strip():
        return None

    try:
        data = json.loads(str(response))
    except Exception:
        return None

    if not isinstance(data, dict):
        return None

    if data.get("is_error") is True:
        reason = data.get("reason") or "The action result appears to indicate an error."
        return str(reason)

    return None

