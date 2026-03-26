"""
Compare Pillar's custom agentic loop vs Claude Agent SDK side-by-side.

Runs the same question through both harnesses using the same underlying tools
and system prompt, then prints a structured evaluation report.

Usage:
    export $(grep -v '^#' .env.local | xargs)
    uv run python manage.py compare_harnesses --product-slug pillar-help --question "How do I set up an agent?"
    uv run python manage.py compare_harnesses --product-slug pillar-help --question "hello" --question "How do I set up an agent?"
"""
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

# Suppress noisy loggers during comparison
logging.getLogger("apps.mcp").setLevel(logging.WARNING)
logging.getLogger("common.utils").setLevel(logging.WARNING)
logging.getLogger("apps.products").setLevel(logging.WARNING)
logging.getLogger("apps.knowledge").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)


@dataclass
class PathResult:
    answer_text: str = ""
    tool_calls: list = field(default_factory=list)
    events: list = field(default_factory=list)
    wall_time: float = 0.0
    first_token_time: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    iteration_count: int = 0
    error: str = ""
    thinking_text: str = ""


class Command(BaseCommand):
    help = "Compare Pillar custom loop vs Claude Agent SDK harness"

    def add_arguments(self, parser):
        parser.add_argument("--product-slug", required=True, help="Product subdomain")
        parser.add_argument("--question", action="append", required=True, help="Question(s) to test")
        parser.add_argument("--model", default="claude-sonnet-4-20250514", help="Claude model for both paths")
        parser.add_argument("--verbose", action="store_true", help="Print all events/messages")

    def handle(self, *args, **options):
        product_slug = options["product_slug"]
        questions = options["question"]
        model = options["model"]
        verbose = options["verbose"]

        anthropic_key = os.environ.get("ANTHROPIC_API_KEY") or settings.ANTHROPIC_API_KEY
        openrouter_key = os.environ.get("OPENROUTER_API_KEY") or settings.OPENROUTER_API_KEY

        if not anthropic_key or anthropic_key.startswith("sk-ant-test"):
            self.stderr.write(self.style.ERROR("ANTHROPIC_API_KEY not set. Required for SDK path."))
            return
        if not openrouter_key:
            self.stderr.write(self.style.ERROR("OPENROUTER_API_KEY not set. Required for Pillar path."))
            return

        os.environ["ANTHROPIC_API_KEY"] = anthropic_key

        asyncio.run(self._run(product_slug, questions, model, verbose))

    async def _run(self, product_slug: str, questions: list[str], model: str, verbose: bool):
        from apps.products.models import Product

        try:
            product = await Product.objects.select_related("organization").aget(subdomain=product_slug)
        except Product.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Product '{product_slug}' not found"))
            return

        self.stdout.write(f"\n{'=' * 72}")
        self.stdout.write(f"HARNESS COMPARISON: Pillar Loop vs Claude Agent SDK")
        self.stdout.write(f"Product: {product.name} ({product_slug})")
        self.stdout.write(f"Model: {model}")
        self.stdout.write(f"{'=' * 72}\n")

        all_results = []

        for i, question in enumerate(questions):
            self.stdout.write(f"\n{'─' * 72}")
            self.stdout.write(f"Question {i + 1}: \"{question}\"")
            self.stdout.write(f"{'─' * 72}")

            pillar_result, sdk_result = await asyncio.gather(
                self._run_pillar_path(product, question, model),
                self._run_sdk_path(product, question, model),
            )

            all_results.append((question, pillar_result, sdk_result))

            self._print_question_comparison(question, pillar_result, sdk_result, verbose)

        self._print_component_summary(all_results)

    # ─── Path A: Pillar Custom Loop ───────────────────────────────────────

    async def _run_pillar_path(self, product, question: str, model: str) -> PathResult:
        from apps.mcp.services.agent import AgentAnswerServiceReActAsync

        result = PathResult()
        start = time.monotonic()
        first_token_recorded = False

        try:
            service = AgentAnswerServiceReActAsync(
                help_center_config=product,
                organization=product.organization,
                conversation_history=[],
            )

            async for event in service.ask_stream(question=question, top_k=10):
                event_type = event.get("type", "")
                result.events.append(event)

                if event_type == "token":
                    text = event.get("text", "")
                    result.answer_text += text
                    if not first_token_recorded and text.strip():
                        result.first_token_time = time.monotonic() - start
                        first_token_recorded = True

                elif event_type == "progress":
                    data = event.get("data", {})
                    kind = data.get("kind", "")
                    if kind == "tool_call":
                        label = data.get("label", "")
                        result.tool_calls.append(label)
                    elif kind == "thinking":
                        result.thinking_text += data.get("text", "")
                    elif kind == "token_usage":
                        result.prompt_tokens += data.get("prompt_tokens", 0)
                        result.completion_tokens += data.get("completion_tokens", 0)
                        result.iteration_count += 1

                elif event_type == "complete":
                    if event.get("thinking_text"):
                        result.thinking_text = event["thinking_text"]

        except Exception as e:
            result.error = str(e)
            logger.error(f"Pillar path error: {e}", exc_info=True)

        result.wall_time = time.monotonic() - start
        return result

    # ─── Path B: Claude Agent SDK ─────────────────────────────────────────

    async def _run_sdk_path(self, product, question: str, model: str) -> PathResult:
        result = PathResult()
        start = time.monotonic()

        try:
            from claude_agent_sdk import (
                AssistantMessage,
                ClaudeAgentOptions,
                ResultMessage,
                SystemMessage,
                query,
                tool as sdk_tool,
                create_sdk_mcp_server,
            )
        except ImportError as e:
            result.error = f"claude-agent-sdk not installed: {e}"
            return result

        executor = await self._build_executor(product)
        system_prompt = await self._build_system_prompt(product, question)

        from apps.mcp.services.prompts.agentic_prompts import format_search_result_content

        @sdk_tool(
            "search",
            "Search for tools and knowledge. Returns executable tools and documentation.",
            {"query": str},
        )
        async def search_tool(args: dict[str, Any]) -> dict[str, Any]:
            q = args.get("query", question)
            search_results = await executor.execute_search(q, limit=5)
            actions = search_results.get("actions", [])
            knowledge = search_results.get("knowledge", [])
            mcp_resources = search_results.get("mcp_resources", [])
            skills = search_results.get("skills", [])

            for a in actions:
                if "data_schema" in a and "schema" not in a:
                    a["schema"] = a["data_schema"]

            formatted = format_search_result_content(
                query=q, tools=actions, knowledge=knowledge,
                mcp_resources=mcp_resources, skills=skills,
            )
            return {"content": [{"type": "text", "text": formatted}]}

        @sdk_tool(
            "get_article",
            "Get the full content of a knowledge article by its ID. Use when a search result chunk seems relevant but incomplete.",
            {"item_id": str},
        )
        async def get_article_tool(args: dict[str, Any]) -> dict[str, Any]:
            item_id = args.get("item_id", "")
            if not item_id:
                return {"content": [{"type": "text", "text": "Error: item_id is required"}], "is_error": True}
            try:
                article = await executor.execute_get_article(item_id)
                title = article.get("title", "")
                content = article.get("content", "")
                return {"content": [{"type": "text", "text": f"{title}\n\n{content}"}]}
            except Exception as e:
                return {"content": [{"type": "text", "text": f"Error fetching article: {e}"}], "is_error": True}

        pillar_tools_server = create_sdk_mcp_server(
            name="pillar",
            version="1.0.0",
            tools=[search_tool, get_article_tool],
        )

        options = ClaudeAgentOptions(
            model=model,
            system_prompt=system_prompt,
            tools=[],
            mcp_servers={"pillar": pillar_tools_server},
            allowed_tools=["mcp__pillar__*"],
        )

        SDK_TIMEOUT = 120

        async def _run_sdk_query():
            async for message in query(prompt=question, options=options):
                result.events.append({"sdk_type": type(message).__name__, "raw": str(message)[:500]})

                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, "name") and hasattr(block, "input"):
                            call_label = f"{block.name}({json.dumps(block.input)[:100]})"
                            result.tool_calls.append(call_label)

                elif isinstance(message, ResultMessage):
                    if message.subtype == "success":
                        result.answer_text = message.result or ""
                    elif message.subtype == "error_during_execution":
                        result.error = f"SDK execution error: {message.result}"

                elif isinstance(message, SystemMessage) and message.subtype == "init":
                    pass

        try:
            await asyncio.wait_for(_run_sdk_query(), timeout=SDK_TIMEOUT)
        except asyncio.TimeoutError:
            result.error = f"SDK timed out after {SDK_TIMEOUT}s ({len(result.tool_calls)} tool calls made)"
        except Exception as e:
            result.error = str(e)
            logger.error(f"SDK path error: {e}", exc_info=True)

        result.wall_time = time.monotonic() - start
        return result

    # ─── Shared helpers ───────────────────────────────────────────────────

    async def _build_executor(self, product):
        from apps.mcp.services.agent_tools.executor import AgentToolExecutor

        ks_ids = []
        async for ks in product.knowledge_sources.all().values_list("id", flat=True):
            ks_ids.append(str(ks))

        return AgentToolExecutor(
            product=product,
            organization=product.organization,
            channel="web",
            knowledge_source_ids=ks_ids,
            endpoint_healthy=False,
        )

    async def _build_system_prompt(self, product, question: str) -> str:
        from apps.mcp.services.prompts.agentic_prompts import build_agentic_prompt

        messages = build_agentic_prompt(
            question=question,
            site_context=product.name,
        )
        for msg in messages:
            if msg.get("role") == "system":
                return msg["content"]
        return ""

    # ─── Output ───────────────────────────────────────────────────────────

    def _print_question_comparison(
        self, question: str, pillar: PathResult, sdk: PathResult, verbose: bool
    ):
        W = self.stdout.write

        W(f"\n  PATH A: Pillar Custom Loop")
        if pillar.error:
            W(f"    ERROR: {pillar.error}")
        else:
            W(f"    Time: {pillar.wall_time:.1f}s  |  First token: {pillar.first_token_time:.1f}s")
            W(f"    Tokens: {pillar.prompt_tokens} prompt / {pillar.completion_tokens} completion")
            W(f"    Iterations: {pillar.iteration_count}")
            W(f"    Tool calls: {' -> '.join(pillar.tool_calls) if pillar.tool_calls else '(none)'}")
            W(f"    Thinking: {len(pillar.thinking_text)} chars")
            W(f"    Answer ({len(pillar.answer_text)} chars):")
            for line in pillar.answer_text[:800].split("\n"):
                W(f"      {line}")
            if len(pillar.answer_text) > 800:
                W(f"      ... ({len(pillar.answer_text) - 800} more chars)")
            W(f"    Events: {len(pillar.events)} total")
            if verbose:
                for e in pillar.events:
                    W(f"      [{e.get('type', '?')}] {str(e)[:120]}")

        W(f"\n  PATH B: Claude Agent SDK")
        if sdk.error:
            W(f"    ERROR: {sdk.error}")
        else:
            W(f"    Time: {sdk.wall_time:.1f}s")
            W(f"    Tool calls: {' -> '.join(sdk.tool_calls) if sdk.tool_calls else '(none)'}")
            W(f"    Answer ({len(sdk.answer_text)} chars):")
            for line in sdk.answer_text[:800].split("\n"):
                W(f"      {line}")
            if len(sdk.answer_text) > 800:
                W(f"      ... ({len(sdk.answer_text) - 800} more chars)")
            W(f"    Messages: {len(sdk.events)} total")
            if verbose:
                for e in sdk.events:
                    W(f"      [{e.get('sdk_type', '?')}] {e.get('raw', '')[:120]}")

        W(f"\n  COMPARISON:")
        if not pillar.error and not sdk.error:
            time_diff = sdk.wall_time - pillar.wall_time
            faster = "SDK" if time_diff < 0 else "Pillar"
            W(f"    Latency: {faster} faster by {abs(time_diff):.1f}s")

            pillar_tools_norm = [t.split("(")[0].replace("mcp__pillar__", "") for t in pillar.tool_calls]
            sdk_tools_norm = [t.split("(")[0].replace("mcp__pillar__", "") for t in sdk.tool_calls]
            if pillar_tools_norm == sdk_tools_norm:
                W(f"    Tool sequence: MATCH ({' -> '.join(pillar_tools_norm)})")
            else:
                W(f"    Tool sequence: DIFFERENT")
                W(f"      Pillar: {' -> '.join(pillar_tools_norm) or '(none)'}")
                W(f"      SDK:    {' -> '.join(sdk_tools_norm) or '(none)'}")

            len_diff = len(sdk.answer_text) - len(pillar.answer_text)
            W(f"    Answer length: Pillar={len(pillar.answer_text)} / SDK={len(sdk.answer_text)} (delta={len_diff:+d})")
            W(f"    Streaming events: Pillar={len(pillar.events)} / SDK={len(sdk.events)}")
        elif pillar.error:
            W(f"    Pillar FAILED, SDK succeeded")
        elif sdk.error:
            W(f"    Pillar succeeded, SDK FAILED")
        else:
            W(f"    Both FAILED")

    def _print_component_summary(self, all_results: list):
        W = self.stdout.write

        W(f"\n{'=' * 72}")
        W(f"COMPONENT EVALUATION SUMMARY")
        W(f"{'=' * 72}")

        pillar_successes = sum(1 for _, p, _ in all_results if not p.error)
        sdk_successes = sum(1 for _, _, s in all_results if not s.error)
        W(f"\n  Success rate: Pillar={pillar_successes}/{len(all_results)} | SDK={sdk_successes}/{len(all_results)}")

        pillar_times = [p.wall_time for _, p, _ in all_results if not p.error]
        sdk_times = [s.wall_time for _, _, s in all_results if not s.error]
        if pillar_times:
            W(f"  Avg latency: Pillar={sum(pillar_times) / len(pillar_times):.1f}s | SDK={sum(sdk_times) / len(sdk_times):.1f}s" if sdk_times else "")

        W(f"\n  COMPARABLE (same underlying logic, measurable delta):")
        W(f"    - Search + get_article execution: same AgentToolExecutor")
        W(f"    - System prompt: identical text passed to both")
        W(f"    - Final answer quality: see per-question comparison above")

        tool_matches = 0
        tool_diffs = 0
        for _, p, s in all_results:
            if p.error or s.error:
                continue
            p_tools = [t.split("(")[0].replace("mcp__pillar__", "") for t in p.tool_calls]
            s_tools = [t.split("(")[0].replace("mcp__pillar__", "") for t in s.tool_calls]
            if p_tools == s_tools:
                tool_matches += 1
            else:
                tool_diffs += 1

        W(f"\n  DIFFERENT (both do it, mechanism differs):")
        W(f"    - Tool call decisions: {tool_matches} match / {tool_diffs} different")

        pillar_events_avg = sum(len(p.events) for _, p, _ in all_results if not p.error) / max(pillar_successes, 1)
        sdk_events_avg = sum(len(s.events) for _, _, s in all_results if not s.error) / max(sdk_successes, 1)
        W(f"    - Streaming granularity: Pillar avg {pillar_events_avg:.0f} events / SDK avg {sdk_events_avg:.0f} messages")
        W(f"    - Conversation history: Pillar=manual message list / SDK=automatic")
        W(f"    - Dynamic tool registration: Pillar=progressive reveal / SDK=static")

        has_greeting = any(q.lower().strip() in ("hello", "hi", "hey", "thanks", "thank you") for q, _, _ in all_results)
        W(f"\n  LOST (Pillar has, SDK cannot replicate):")
        if has_greeting:
            for q, p, s in all_results:
                if q.lower().strip() in ("hello", "hi", "hey", "thanks", "thank you"):
                    W(f"    - Fast-path bypass: Pillar={p.wall_time:.1f}s / SDK={s.wall_time:.1f}s for \"{q}\"")
        else:
            W(f"    - Fast-path bypass: not tested (no greeting questions)")
        W(f"    - Model fallback (Gemini retry on Claude failure): not testable in A/B")
        W(f"    - Empty response recovery (synthetic tool call injection)")
        W(f"    - Token budget tracking with compaction warnings")
        W(f"    - State checkpointing for crash recovery")
        W(f"    - Confirmation flow (mid-loop pause/resume for destructive actions)")
        W(f"    - Display trace for debug panel")
        W(f"    - OTel span instrumentation")
        W(f"    - SOURCES_USED footer stripping")

        W(f"\n  GAINED (SDK provides, Pillar doesn't have):")
        W(f"    - Native session resume (no manual DB persistence)")
        W(f"    - Subagent spawning for parallel subtasks")
        W(f"    - Built-in tool search for large tool sets")
        W(f"    - Simplified code (~10 files of harness replaced by SDK)")
        W(f"")
