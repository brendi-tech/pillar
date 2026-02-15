"""
OpenClaw Agent Experience Test — runs OpenClaw as a local subprocess
inside the worker to evaluate how easy a website is for AI agents.


Runs in parallel with http_probes, browser_analysis, and (optionally)
signup_test. Joins the fan-in via complete_layer() so the finalize step
includes the openclaw category in the final report.

Architecture:
- The worker Docker image includes Node.js + OpenClaw + Chromium.
- This workflow starts an OpenClaw gateway subprocess on a random port,
  sends the eval prompt via HTTP to localhost, then shuts it down.
- No separate Cloud Run service needed — everything runs in-process.

Key properties:
- OpenClaw self-scores the experience 0-100 (no second LLM classification)
- Checks are dynamic — generated from whatever OpenClaw actually tried
- The agent reports what worked, what didn't, and a narrative summary
"""
import asyncio
import json as json_mod
import logging
import random
import shutil
from datetime import timedelta
from typing import Callable, Awaitable

import httpx
from hatchet_sdk import Context
from pydantic import BaseModel

from common.hatchet_client import get_hatchet_client

logger = logging.getLogger(__name__)

hatchet = get_hatchet_client()


class OpenclawTestInput(BaseModel):
    """Input for the openclaw-test task."""
    report_id: str


OPENCLAW_EVAL_PROMPT = """Open {url}. You are an AI agent evaluating how easy this website is \
for agents like you to use.

Try the kinds of things an AI agent would naturally want to do:
- Navigate around and understand what the site does
- Find key information (pricing, docs, features)
- Create an account if there's a signup flow, using:
  Name: Pillar Agent Test, Email: agent-test@score.trypillar.com, \
Password: PillarTest!2026
- Look for MCP tools (navigator.modelContext) and try to use them
- Complete a representative task (search, fill a form, etc.)
- Check if the site blocks you or throws up CAPTCHAs

For each thing you try, note whether it worked, was difficult, or \
failed entirely.

When you're done, respond with ONLY this JSON (no markdown fencing, no extra text):
{{
  "score": <0-100 how agent-friendly the site is>,
  "summary": "<2-3 sentences on the overall experience>",
  "what_worked": ["<thing that went smoothly>", ...],
  "what_didnt": ["<thing that was hard or impossible>", ...],
  "mcp_found": <true/false>,
  "mcp_usable": <true/false>,
  "signup_attempted": <true/false>,
  "signup_succeeded": <true/false>,
  "tasks_tried": [
    {{"task": "<what you tried>", "succeeded": <bool>, "detail": "<what happened>"}},
    ...
  ]
}}

Scoring guidelines:
- 90-100: Everything worked smoothly. No friction.
- 70-89: Most things worked. Minor issues.
- 50-69: Mixed. Some tasks worked, others were difficult.
- 30-49: Mostly difficult. Many blockers.
- 0-29: Site is effectively unusable by agents.

Be honest. Score based on what actually happened."""


def build_openclaw_eval_prompt(url: str) -> str:
    """Build the evaluation prompt for a specific URL."""
    return OPENCLAW_EVAL_PROMPT.format(url=url)


def _extract_message(response_data: dict) -> str:
    """Extract the text message from an OpenClaw /v1/responses response."""
    # OpenResponses API returns output[] with message content
    output = response_data.get("output", [])
    for item in output:
        if item.get("type") == "message":
            content = item.get("content", [])
            for part in content:
                if part.get("type") == "output_text":
                    return part.get("text", "")
    # Fallback: try common response shapes
    if "message" in response_data:
        return response_data["message"]
    if "choices" in response_data:
        choices = response_data["choices"]
        if choices and "message" in choices[0]:
            return choices[0]["message"].get("content", "")
    return str(response_data)


def _build_checks_from_result(result: dict) -> list[dict]:
    """
    Convert OpenClaw's self-scored JSON into AgentScoreCheck-compatible dicts.

    Each tasks_tried entry becomes a check. Boolean fields (mcp_found, etc.)
    become additional checks. All checks use category="openclaw".
    """
    checks: list[dict] = []

    # Boolean-level checks
    bool_checks = [
        ("mcp_found", "MCP tools detected", "mcp_found"),
        ("mcp_usable", "MCP tools usable by agent", "mcp_usable"),
        ("signup_attempted", "Agent attempted signup", "signup_attempted"),
        ("signup_succeeded", "Agent signup succeeded", "signup_succeeded"),
    ]
    for check_name, label, key in bool_checks:
        value = result.get(key)
        if value is not None:
            checks.append({
                "category": "openclaw",
                "check_name": f"oc_{check_name}",
                "check_label": label,
                "passed": bool(value),
                "score": 100 if value else 0,
                "weight": 1,
                "details": {},
                "recommendation": "",
            })

    # Task-level checks from tasks_tried
    for i, task in enumerate(result.get("tasks_tried", [])):
        task_name = task.get("task", f"Task {i + 1}")
        succeeded = task.get("succeeded", False)
        detail = task.get("detail", "")

        # Create a slug-safe check name from the task description
        slug = task_name.lower().replace(" ", "_")[:40]
        slug = "".join(c for c in slug if c.isalnum() or c == "_")

        checks.append({
            "category": "openclaw",
            "check_name": f"oc_task_{slug}_{i}",
            "check_label": task_name,
            "passed": succeeded,
            "score": 100 if succeeded else 0,
            "weight": 1,
            "details": {"detail": detail} if detail else {},
            "recommendation": "",
        })

    return checks


# Fixed token for ephemeral localhost gateway. Not a secret — the gateway
# binds to loopback and is killed after each test.
_OPENCLAW_GW_TOKEN = "pillar-agent-score-local-token"


def _find_playwright_chromium() -> str | None:
    """
    Discover the Playwright-installed Chromium binary path.

    OpenClaw's managed browser auto-detects system Chrome/Brave/Edge/Chromium
    but does NOT find Playwright's bundled Chromium.  We need to set
    ``browser.executablePath`` explicitly in the config.

    Search order:
    1. ``PLAYWRIGHT_BROWSERS_PATH`` env var (set in the worker Dockerfile
       to ``/opt/ms-playwright``)
    2. ``~/.cache/ms-playwright`` (default Playwright cache location)

    Within each directory, we look for:
    - Full Chromium: ``chromium-*/chrome-linux/chrome``
    - Headless shell (fallback): ``chromium_headless_shell-*/chrome-linux/headless_shell``

    Returns the path to the binary, or None if not found.
    """
    import os
    from pathlib import Path

    search_dirs = []

    # Check env var first (worker Dockerfile sets this to /opt/ms-playwright)
    env_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env_path:
        search_dirs.append(Path(env_path))

    # Default Playwright cache locations
    home = os.path.expanduser("~")
    search_dirs.append(Path(home) / ".cache" / "ms-playwright")

    for base_dir in search_dirs:
        if not base_dir.exists():
            logger.info(
                "[AGENT SCORE] Playwright dir %s does not exist", base_dir
            )
            continue

        # Log what we see for debugging
        try:
            contents = list(base_dir.iterdir())
            logger.info(
                "[AGENT SCORE] Playwright dir %s contains: %s",
                base_dir,
                [p.name for p in contents],
            )
        except PermissionError:
            logger.warning(
                "[AGENT SCORE] Cannot list %s (permission denied)", base_dir
            )
            continue

        # Search for the Chromium binary.  Playwright uses different
        # directory names depending on the platform and version:
        # - chrome-linux/chrome (older Playwright, ARM)
        # - chrome-linux64/chrome (newer Playwright on amd64)
        # Also look for headless_shell as a fallback.
        headless_fallback: str | None = None

        for entry in sorted(contents, key=lambda p: p.name, reverse=True):
            if not entry.is_dir():
                continue

            # Skip non-chromium directories
            if not entry.name.startswith("chromium"):
                continue

            # Search all subdirectories for a "chrome" binary
            for sub in entry.iterdir():
                if not sub.is_dir():
                    continue

                chrome_bin = sub / "chrome"
                hs_bin = sub / "headless_shell"

                if chrome_bin.is_file() and "headless" not in entry.name:
                    logger.info(
                        "[AGENT SCORE] Found Playwright Chromium at %s",
                        chrome_bin,
                    )
                    return str(chrome_bin)

                if hs_bin.is_file() and headless_fallback is None:
                    headless_fallback = str(hs_bin)

        if headless_fallback:
            logger.info(
                "[AGENT SCORE] Using Playwright headless shell at %s "
                "(full Chromium not available)",
                headless_fallback,
            )
            return headless_fallback

    logger.warning("[AGENT SCORE] Playwright Chromium binary not found")
    return None


def _write_openclaw_config(port: int) -> str:
    """
    Write a complete OpenClaw config to the home directory and return the path.

    Instead of running 7+ slow `openclaw config set` subprocess calls (~8s
    each due to Node cold start), we write the JSON config directly.  This
    is faster (instant vs ~56s) and avoids the config-file-conflict bug where
    `config set` writes to ~/.openclaw/openclaw.json but OPENCLAW_CONFIG
    points the gateway at a different file.

    The skills directory is at /etc/openclaw/skills/ (baked into the Docker
    image) so we use an absolute path.
    """
    import os
    from pathlib import Path

    # Config schema follows OpenClaw 2026.2.x — validated locally via:
    #   docker run --rm -v config.json:/root/.openclaw/openclaw.json node:22-slim \
    #     sh -c "npm i -g openclaw@latest && openclaw gateway --port 18500"
    config = {
        "$schema": "https://openclaw.ai/schema/config.json",
        "agents": {
            "defaults": {
                "model": {
                    "primary": "openrouter/google/gemini-2.5-flash",
                },
                "heartbeat": {
                    "every": "0m",  # disable periodic heartbeats
                },
            },
        },
        "env": {
            "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        },
        "gateway": {
            "mode": "local",
            "port": port,
            "auth": {
                "mode": "token",
                "token": _OPENCLAW_GW_TOKEN,
            },
            "http": {
                "endpoints": {
                    "responses": {"enabled": True},
                },
            },
        },
        "browser": {
            "enabled": True,
            "headless": True,
            "defaultProfile": "openclaw",
            "noSandbox": True,
        },
        "skills": {
            "load": {
                "extraDirs": ["/etc/openclaw/skills"],
            },
        },
    }

    # Discover the Playwright Chromium binary and set executablePath so
    # OpenClaw's managed browser can find it (it doesn't auto-detect
    # Playwright-installed Chromium, only system Chrome/Brave/Edge).
    chrome_path = _find_playwright_chromium()
    if chrome_path:
        config["browser"]["executablePath"] = chrome_path

    # Write to OpenClaw's default config location
    home = os.path.expanduser("~")
    config_dir = Path(home) / ".openclaw"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "openclaw.json"
    config_path.write_text(json_mod.dumps(config, indent=2))

    logger.info(
        "[AGENT SCORE] Wrote OpenClaw config to %s (port=%d, chrome=%s)",
        config_path, port, chrome_path or "auto-detect",
    )
    return str(config_path)


async def _nuke_openclaw_gateway(port: int = 0) -> None:
    """
    Forcefully kill ALL OpenClaw gateway processes and free ports.

    OpenClaw's gateway lock is primarily a **port bind** (EADDRINUSE).
    The secondary lock is a PID-based guard file.  We attack both:
    1. Kill processes by name (SIGKILL)
    2. Kill processes holding our target port (fuser)
    3. Remove lock/PID files
    """
    # Step 1: Try the graceful stop command (best-effort, short timeout)
    openclaw_bin = shutil.which("openclaw")
    if openclaw_bin:
        stop_proc = await asyncio.create_subprocess_exec(
            openclaw_bin, "gateway", "stop",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(stop_proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            stop_proc.kill()
            await stop_proc.wait()

    # Step 2: SIGKILL all gateway-related processes by name
    # Also use fuser to kill anything holding our target port (primary lock).
    # Fallback: use lsof if fuser is unavailable.
    port_kill = ""
    if port:
        port_kill = (
            f"fuser -k -9 {port}/tcp 2>/dev/null || "
            f"  kill -9 $(lsof -ti tcp:{port}) 2>/dev/null; "
        )

    kill_proc = await asyncio.create_subprocess_shell(
        # SIGKILL gateway processes immediately (don't bother with SIGTERM first)
        "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; "
        "pkill -9 -f 'node.*openclaw' 2>/dev/null; "
        # Kill anything on our target port
        + port_kill +
        # Also kill any gateway on the default OpenClaw port
        "fuser -k -9 18789/tcp 2>/dev/null || "
        "  kill -9 $(lsof -ti tcp:18789) 2>/dev/null; "
        "sleep 1; "
        # Remove ALL possible lock/PID files
        "rm -f ~/.openclaw/gateway.lock ~/.openclaw/.gateway.lock "
        "~/.openclaw/openclaw.lock ~/.openclaw/*.lock ~/.openclaw/*.pid "
        "/tmp/openclaw*.lock /tmp/.openclaw*.lock 2>/dev/null; "
        "true",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        await asyncio.wait_for(kill_proc.wait(), timeout=15)
    except asyncio.TimeoutError:
        kill_proc.kill()
        await kill_proc.wait()

    # Step 3: Wait for processes to fully exit and OS to release ports
    await asyncio.sleep(2)


async def _start_openclaw_gateway(port: int) -> asyncio.subprocess.Process:
    """
    Start an OpenClaw gateway subprocess on the given port.

    Returns the subprocess. Caller is responsible for terminating it.
    """
    openclaw_bin = shutil.which("openclaw")
    if not openclaw_bin:
        raise RuntimeError(
            "OpenClaw CLI not found. Install it with: npm install -g openclaw"
        )

    # Nuke any stale gateway from a previous run (pass our target port)
    await _nuke_openclaw_gateway(port)

    # Write a complete config file to ~/.openclaw/openclaw.json.
    # This replaces the old _ensure_openclaw_config() which ran 7 slow
    # `openclaw config set` subprocess calls (~56s total) and had a bug
    # where OPENCLAW_CONFIG env var pointed the gateway at a different
    # config file than the one `config set` wrote to.
    _write_openclaw_config(port)

    proc = await asyncio.create_subprocess_exec(
        openclaw_bin, "gateway", "--port", str(port),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # Wait for the gateway HTTP server to be ready.
    # OpenClaw 2026.2.x takes ~15s locally and can take 30-45s on
    # resource-constrained Cloud Run instances (cold Node.js startup,
    # plugin loading, browser service init).  Poll for up to 90s.
    import time as _time

    start = _time.monotonic()
    for attempt in range(30):
        await asyncio.sleep(3)
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"http://127.0.0.1:{port}/health")
                if resp.status_code == 200:
                    elapsed = _time.monotonic() - start
                    logger.info(
                        "[AGENT SCORE] OpenClaw gateway ready on port %d "
                        "(%.1fs startup)",
                        port,
                        elapsed,
                    )
                    return proc
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        # Check if process died — could be "gateway already running" lock error
        if proc.returncode is not None:
            stderr_bytes = await proc.stderr.read()
            stderr_text = stderr_bytes.decode()[:500]
            # If it's a lock error, nuke again and retry ONCE
            if "already running" in stderr_text and attempt < 5:
                logger.warning(
                    "[AGENT SCORE] Gateway lock collision on attempt %d, "
                    "nuking and retrying...",
                    attempt,
                )
                await _nuke_openclaw_gateway(port)
                proc = await asyncio.create_subprocess_exec(
                    openclaw_bin, "gateway", "--port", str(port),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                continue
            raise RuntimeError(
                f"OpenClaw gateway exited with code {proc.returncode}: "
                f"{stderr_text}"
            )

    # If we got here, gateway never became ready — log diagnostics and fail
    elapsed = _time.monotonic() - start
    logger.error(
        "[AGENT SCORE] OpenClaw gateway did not become healthy after %.0fs "
        "on port %d",
        elapsed,
        port,
    )
    # Try to capture any output for diagnosis
    proc.terminate()
    try:
        await asyncio.wait_for(proc.wait(), timeout=5)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
    stderr = await proc.stderr.read()
    stdout = await proc.stdout.read()
    raise RuntimeError(
        f"OpenClaw gateway health check timed out after {elapsed:.0f}s. "
        f"stdout: {stdout.decode()[:300]} | "
        f"stderr: {stderr.decode()[:300]}"
    )


async def _stop_openclaw_gateway(
    proc: asyncio.subprocess.Process, port: int = 0
) -> None:
    """Terminate the OpenClaw gateway subprocess and all child processes."""
    # First, try graceful termination of our subprocess handle
    if proc.returncode is None:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            logger.warning("[AGENT SCORE] OpenClaw gateway didn't stop, killing")
            proc.kill()
            await proc.wait()

    # Then nuke everything — the gateway may have forked child processes
    # (Node.js children, browser processes, etc.) that survive the parent.
    # Pass the port so fuser can kill anything still holding it.
    await _nuke_openclaw_gateway(port)


# ---------------------------------------------------------------------------
# Real-time activity logging — tails OpenClaw's own log file for tool events
# ---------------------------------------------------------------------------

# Human-readable labels for OpenClaw tool names.
_TOOL_LABELS: dict[str, str] = {
    "browser": "Browsing the site",
    "web_search": "Searching the web",
    "web_fetch": "Fetching a page",
    "computer": "Interacting with the page",
}

# Don't create more than this many activity log entries per run to
# prevent DB bloat on sites where the agent does many tool calls.
_MAX_STREAM_LOG_ENTRIES = 20

# OpenClaw writes structured JSON logs here.
_OPENCLAW_LOG_DIR = "/tmp/openclaw"


def _parse_openclaw_log_kv(msg: str) -> dict[str, str]:
    """
    Extract ``key=value`` pairs from an OpenClaw log message.

    Messages look like::

        embedded run tool start: runId=resp_abc tool=browser toolCallId=tool_xyz

    Returns e.g. ``{"runId": "resp_abc", "tool": "browser", "toolCallId": "tool_xyz"}``.
    """
    try:
        kv_part = msg.split(": ", 1)[1]
        return dict(
            p.split("=", 1) for p in kv_part.split() if "=" in p
        )
    except (IndexError, ValueError):
        return {}


async def _tail_openclaw_log(
    report_id: str,
    update_status: Callable[[str], Awaitable[None]],
    stop_event: asyncio.Event,
) -> None:
    """
    Tail the OpenClaw log file and write activity entries for tool calls.

    OpenClaw logs structured JSON to ``/tmp/openclaw/openclaw-YYYY-MM-DD.log``
    with entries like::

        {"0": ..., "1": "embedded run tool start: runId=resp_... tool=browser ..."}

    To isolate entries from *this* run, the tailer captures the ``runId``
    from the first ``embedded run`` entry it encounters (since we just
    started a fresh gateway, the first run is ours) and ignores all
    entries with a different ``runId``.
    """
    from datetime import date
    from pathlib import Path

    from apps.agent_score.workflows.activity_log import log_activity

    log_path = Path(_OPENCLAW_LOG_DIR) / f"openclaw-{date.today().isoformat()}.log"
    log_count = 0
    run_id: str | None = None  # captured from the first matching entry

    try:
        # Wait for log file to exist (gateway may still be starting)
        for _ in range(30):
            if stop_event.is_set():
                return
            if log_path.exists():
                break
            await asyncio.sleep(1)
        else:
            logger.debug(
                "[AGENT SCORE] OpenClaw log file not found at %s", log_path,
            )
            return

        with open(log_path, "r") as f:
            # Seek to end — we only care about new entries from this run
            f.seek(0, 2)

            while not stop_event.is_set():
                line = f.readline()
                if not line:
                    # No new data yet — yield control briefly
                    await asyncio.sleep(0.5)
                    continue

                line = line.strip()
                if not line:
                    continue

                try:
                    obj = json_mod.loads(line)
                except json_mod.JSONDecodeError:
                    continue

                msg = obj.get("1", "")
                if not isinstance(msg, str):
                    continue

                # We only care about "embedded run" entries (tool start/end)
                if "embedded run" not in msg:
                    continue

                parts = _parse_openclaw_log_kv(msg)
                entry_run_id = parts.get("runId", "")

                if not entry_run_id:
                    continue

                # Lock onto the first runId we see — it's ours because we
                # just started a fresh gateway and this is the first request.
                if run_id is None:
                    run_id = entry_run_id
                    logger.info(
                        "[AGENT SCORE] Locked onto OpenClaw runId=%s",
                        run_id,
                    )
                elif entry_run_id != run_id:
                    # Different run — skip it
                    continue

                # Only log tool *start* events (not end)
                if "tool start:" not in msg:
                    continue

                tool_name = parts.get("tool", "unknown")
                label = _TOOL_LABELS.get(tool_name, f"Using {tool_name}")

                # Write an activity log entry (capped)
                if log_count < _MAX_STREAM_LOG_ENTRIES:
                    await log_activity(
                        report_id, "openclaw_test", "info",
                        label, {"tool": tool_name, "runId": run_id},
                    )
                    log_count += 1

                # Update the ScanProgress substatus line
                await update_status(f"{label}...")

    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.debug("[AGENT SCORE] Log tail error: %s", e)


async def _stream_openclaw_response(
    port: int,
    report_id: str,
    prompt: str,
    update_status: Callable[[str], Awaitable[None]],
) -> dict:
    """
    Send an OpenClaw ``/v1/responses`` request and tail the OpenClaw log
    file in parallel for real-time activity updates.

    The OpenClaw gateway runs tool calls (browser, web_search, etc.)
    internally.  These don't appear in the SSE response stream, but they
    *do* appear in OpenClaw's own log file.  We tail that log in a
    background task while the HTTP request is in flight, writing
    ``AgentScoreLogEntry`` records so the frontend shows live progress.

    Returns the full response dict.
    """
    url = f"http://127.0.0.1:{port}/v1/responses"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_OPENCLAW_GW_TOKEN}",
    }
    payload = {"model": "openclaw", "input": prompt}

    # Start tailing the OpenClaw log for tool events in the background.
    # The tailer locks onto the first runId it sees (which is ours,
    # since we just started a fresh gateway) and ignores all others.
    stop_event = asyncio.Event()
    log_tailer = asyncio.create_task(
        _tail_openclaw_log(report_id, update_status, stop_event),
    )

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(280.0, connect=10.0),
        ) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

        return response.json()
    finally:
        # Signal the log tailer to stop, then wait for it
        stop_event.set()
        try:
            await asyncio.wait_for(log_tailer, timeout=3.0)
        except asyncio.TimeoutError:
            log_tailer.cancel()
            try:
                await log_tailer
            except asyncio.CancelledError:
                pass


# Per-process lock to serialize OpenClaw gateway access within a single
# Cloud Run container.  Each container is isolated (separate PID namespace,
# filesystem, ports), so two containers CAN run gateways in parallel.
# We removed the Hatchet ConcurrencyExpression because it serialized across
# ALL containers, causing the dispatch queue to stall when a worker died
# mid-task (the concurrency slot stayed "occupied" until execution_timeout).
_OPENCLAW_LOCK = asyncio.Lock()


@hatchet.task(
    name="agent-score-openclaw-test",
    retries=1,
    execution_timeout=timedelta(minutes=5),
    input_validator=OpenclawTestInput,
)
async def openclaw_test_workflow(
    workflow_input: OpenclawTestInput, context: Context
):
    """
    Run OpenClaw locally to evaluate a site's agent-readiness.

    Starts a temporary OpenClaw gateway subprocess on localhost, sends
    the eval prompt, parses the self-scored JSON result, creates check
    records, and stores the narrative data on the report.
    """
    from apps.agent_score.models import AgentScoreReport

    report_id = workflow_input.report_id
    logger.info(f"[AGENT SCORE] Starting OpenClaw test for report {report_id}")

    from django.db import close_old_connections
    close_old_connections()

    try:
        report = await AgentScoreReport.objects.aget(id=report_id)
    except AgentScoreReport.DoesNotExist:
        logger.error(
            f"[AGENT SCORE] Report {report_id} not found for OpenClaw test"
        )
        return {"status": "error", "error": "report_not_found"}

    async def _update_status(status_text: str) -> None:
        report.openclaw_test_status = status_text
        await report.asave(update_fields=["openclaw_test_status"])

    # Acquire the per-process lock to serialize gateway access within this
    # container.  Other containers can run their own gateways in parallel.
    logger.info(
        "[AGENT SCORE] Waiting for OpenClaw lock for report %s", report_id
    )
    async with _OPENCLAW_LOCK:
        return await _run_openclaw_test(
            report, report_id, _update_status, workflow_input,
        )


async def _run_openclaw_test(report, report_id, _update_status, workflow_input):
    """Inner implementation — runs under the _OPENCLAW_LOCK."""
    from asgiref.sync import sync_to_async

    from apps.agent_score.models import AgentScoreCheck, AgentScoreReport
    from apps.agent_score.workflows.fan_in import complete_layer
    from common.utils.json_parser import parse_json_from_llm
    from apps.agent_score.workflows.activity_log import log_activity

    gateway_proc = None
    port = random.randint(18000, 19000)

    try:
        # 1. Start local OpenClaw gateway
        await _update_status("Starting OpenClaw agent...")
        await log_activity(
            report_id, "openclaw_test", "info",
            f"Starting OpenClaw gateway on port {port}",
        )
        gateway_proc = await _start_openclaw_gateway(port)
        await log_activity(
            report_id, "openclaw_test", "info",
            "OpenClaw gateway ready",
            {"port": port},
        )

        # 2. Build the eval prompt and stream the response
        await _update_status("Agent is browsing site...")
        prompt = build_openclaw_eval_prompt(report.url)

        await log_activity(
            report_id, "openclaw_test", "info",
            f"Sending eval request for {report.url}",
            {"endpoint": f"http://127.0.0.1:{port}/v1/responses"},
        )

        response_data = await _stream_openclaw_response(
            port, report_id, prompt, _update_status,
        )

        await log_activity(
            report_id, "openclaw_test", "info",
            "OpenClaw agent finished",
        )

        # 3. Parse the self-scored JSON from OpenClaw's response
        await _update_status("Processing results...")
        raw_message = _extract_message(response_data)

        # Log the raw response for debugging (truncated to avoid huge logs)
        logger.info(
            "[AGENT SCORE] OpenClaw raw response for %s (first 1000 chars): %s",
            report_id,
            raw_message[:1000],
        )
        await log_activity(
            report_id, "openclaw_test", "info",
            f"Raw response length: {len(raw_message)} chars",
            {"preview": raw_message[:500]},
        )

        result = parse_json_from_llm(raw_message, expected_type="object")

        # Validate and clamp score
        score = result.get("score")
        if isinstance(score, (int, float)):
            score = max(0, min(100, int(score)))
        else:
            score = None

        # 4. Build check records from the structured result
        check_dicts = _build_checks_from_result(result)
        check_objects = [
            AgentScoreCheck(
                report=report,
                category=cd["category"],
                check_name=cd["check_name"],
                check_label=cd["check_label"],
                passed=cd["passed"],
                score=cd["score"],
                weight=cd["weight"],
                details=cd["details"],
                recommendation=cd["recommendation"],
            )
            for cd in check_dicts
        ]

        if check_objects:
            await sync_to_async(
                lambda: AgentScoreCheck.objects.bulk_create(check_objects)
            )()

        # 5. Store full result on the report
        openclaw_data = {
            "score": score,
            "summary": result.get("summary", ""),
            "what_worked": result.get("what_worked", []),
            "what_didnt": result.get("what_didnt", []),
            "mcp_found": result.get("mcp_found", False),
            "mcp_usable": result.get("mcp_usable", False),
            "signup_attempted": result.get("signup_attempted", False),
            "signup_succeeded": result.get("signup_succeeded", False),
            "tasks_tried": result.get("tasks_tried", []),
        }

        # Write the openclaw score into category_scores alongside existing scores
        category_scores = report.category_scores or {}
        category_scores["openclaw"] = score

        report.openclaw_data = openclaw_data
        report.category_scores = category_scores
        await report.asave(
            update_fields=["openclaw_data", "category_scores"]
        )

        logger.info(
            f"[AGENT SCORE] OpenClaw test complete for {report_id}: "
            f"score={score}, checks={len(check_objects)}"
        )
        await log_activity(
            report_id, "openclaw_test", "success",
            f"OpenClaw test complete: {score}/100 ({len(check_objects)} checks)",
            {
                "score": score,
                "check_count": len(check_objects),
                "summary": result.get("summary", ""),
            },
        )

    except Exception as e:
        logger.error(
            f"[AGENT SCORE] OpenClaw test failed for {report_id}: {e}",
            exc_info=True,
        )
        await log_activity(
            report_id, "openclaw_test", "error",
            f"OpenClaw test failed: {type(e).__name__}",
            {"error": str(e)},
        )

        # Store error state so the frontend can show a message
        report.openclaw_data = {
            "score": None,
            "summary": "",
            "what_worked": [],
            "what_didnt": [],
            "error": str(e),
        }
        await report.asave(update_fields=["openclaw_data"])

    finally:
        # Always shut down the gateway subprocess
        if gateway_proc:
            await _stop_openclaw_gateway(gateway_proc, port)

    # Update status to done
    await _update_status("Complete")

    # Join the fan-in — finalize fires when all optional layers are done
    await complete_layer(report_id)

    # Re-read to get the final state
    report = await AgentScoreReport.objects.aget(id=report_id)
    final_score = (report.openclaw_data or {}).get("score")

    return {
        "status": "success",
        "report_id": report_id,
        "score": final_score,
    }
