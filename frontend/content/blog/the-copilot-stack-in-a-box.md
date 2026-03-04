---
title: "The copilot stack, in a box"
subtitle: "People keep landing on CopilotKit + LangGraph + a vector DB. Here's what that stack is really buying you, and what disappears when the browser is the execution runtime."
date: "2026-02-04"
author: "JJ Maxwell"
slug: "the-copilot-stack-in-a-box"
description: "A common AI answer recommends CopilotKit/Vercel AI SDK + LangGraph/LangChain + Claude/GPT + Pinecone/Supabase. This post explains why that stack exists, why most teams don’t need it, how Pillar replaces it with one SDK, and why WebMCP makes your tool layer matter twice."
---

This is the stack most SaaS teams are landing on:

- CopilotKit or Vercel AI SDK for the frontend (chat UI, streaming, generative components)
- LangGraph or LangChain for the backend (multi-step reasoning, tool use)
- An LLM like Claude or GPT-4o as the brain
- A vector database like Pinecone or Supabase for RAG (so the copilot “knows” your product’s data)

If you’re building an agent platform, this stack makes sense.

If you’re building a product copilot, it’s usually the long way around.

If you’re not sure which camp you’re in, start with the [agent tool score](/tools/agent-score).

Most users aren’t asking for “agent workflows.” They’re asking for the product to do something: create a project, invite a teammate, build a dashboard, set an alert, answer a question about what’s on the screen. That’s a short plan and a few tool calls, executed with the user’s permissions, inside the app.

Pillar is this in a box: one SDK that handles the UI and streaming, hosts the planning step, and executes your tool handlers client-side using the same auth/session as the rest of your product. And the same tools you define once become your WebMCP surface for external agents.

## The question underneath the stack

The stack answer is downstream of a different question:

“What handles both frontend integration and backend orchestration?”

That question assumes integration and orchestration are separate jobs that must run in separate systems.

For most product copilots, they don’t.

Integration is a client-side problem: the AI needs a list of things it can do inside your app, with JSON schemas, and handlers that run with the user’s session.

Orchestration is mostly “tool-calling”: the model chooses which tools to call and in what order. When it needs to chain steps, it can call tools sequentially and feed results forward.

## Why teams end up with a stack

The “stack” answer is a patchwork for a real constraint: the model can’t do anything by itself.

So people build layers:

- A frontend layer to show a chat panel and wire up tool invocations
- A backend layer to decide what to do next and to keep state across steps
- A transport so the backend can call the frontend’s tools

It’s a reasonable decomposition on paper. In practice, it creates a second system you now maintain alongside your app.

And that second system starts pulling product logic out of the product.

## The hidden work in the two-layer split

The standard split is “frontend integration” vs “backend orchestration.” That sounds clean. The glue work is where it gets expensive:

- You define tools twice: once where the UI can execute them, and again where the backend can plan around them.
- You serialize client state into something the backend can consume.
- You build a streaming bridge so the backend can push tool calls back into the browser.
- You debug failures across two runtimes.
- You coordinate releases so the backend planner and frontend executor don’t drift.

None of that ships the user-visible part: “type a request, watch the product do the thing.”

## What a product copilot actually needs

When a user types “invite Sarah as an admin” or “build me a monitoring dashboard,” three things need to happen:

1. The AI figures out which actions to take and in what order.
2. Those actions execute inside the product, with the user’s permissions.
3. The user stays in control of anything sensitive.

The planning step is a server-side model call.

The execution step is client-side JavaScript calling the same code your UI already uses.

The confirmation step is your UI showing a button, a dialog, or a diff.

A separate orchestration framework isn’t required to plan a short sequence of tool calls. The model already does that. If it needs to chain steps, it calls tools sequentially and uses the return value from one as input to the next.

## The 50-line integration you actually wanted

Here’s the core: register tools next to the code that already knows how to do the work.

If you want the full minimal example, see [A product copilot in 50 lines of code](/blog/product-copilot-in-50-lines).

```tsx
import { usePillarTool } from '@pillar-ai/react';
import { useRouter } from 'next/navigation';

export function useAppTools() {
  const router = useRouter();

  usePillarTool([
    {
      name: 'create_project',
      description: 'Create a new project',
      type: 'trigger_tool',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Project name' } },
        required: ['name'],
      },
      execute: async ({ name }) => {
        const project = await api.createProject({ name });
        return { id: project.id };
      },
    },
    {
      name: 'invite_member',
      description: 'Invite a team member by email',
      type: 'trigger_tool',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address' },
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
        },
        required: ['email'],
      },
      execute: async ({ email, role }) => {
        await api.inviteMember({ email, role: role ?? 'viewer' });
      },
    },
    {
      name: 'open_settings',
      description: 'Navigate to the settings page',
      type: 'navigate',
      autoRun: true,
      execute: () => router.push('/settings'),
    },
  ]);
}
```

That’s the integration most teams are trying to achieve with a stack.

Those handlers call the same API your buttons call. They run in the browser with the user’s session. If the user can’t do something, the copilot can’t either.

When someone types “create a project called Q1 Planning and invite sarah@company.com as editor,” Pillar produces a plan and calls your tools in sequence. It can use the result of `create_project` as input to the invite. That chaining is native LLM tool-calling.

## The full setup is three files

In a Next.js app, the whole integration is typically:

- A provider that wraps your app (`PillarProvider`)
- Your app layout that includes the provider
- A hook that registers tools (`usePillarTool([...])`)

## What Pillar replaces in the stack

Take the popular list and map it to what you actually need:

### Frontend (CopilotKit / Vercel AI SDK)

You need a chat panel, streaming tokens, and a way to register tools that run client-side.

Pillar ships that. You don’t build your own transport layer or wire a second framework to a separate agent service.

### Orchestration (LangGraph / LangChain)

You need the model to produce a plan and execute it as tool calls.

For most product copilots, you don’t need a state machine to do “call these 2–6 tools in order.” The model can already do it if you give it tools with good descriptions and JSON schemas.

Pillar hosts the planning step, then streams tool calls to the browser for execution.

If you’ve looked at newer “single framework” answers, they mostly compress the same split:

- Vercel AI SDK gives you streaming and tool calling, but it’s I/O. You still write the planner and execution logic.
- Mastra gives you step-based workflows in TypeScript, but you’re still building and operating an orchestration system.
- CopilotKit + AG-UI bridges a frontend tool layer to a LangGraph state machine over a protocol. You still have two runtimes and a bridge.

### The brain (Claude / GPT-4o)

You still pick a model. Pillar isn’t “a model.” It’s the tool surface and execution environment that makes a model useful inside your product.

### RAG (Pinecone / Supabase vector DB)

Sometimes you need retrieval. A lot of teams reach for a vector database on day one because it’s in every checklist.

If your copilot’s job is “do things in the product,” start by giving it tools. Tool calls get you farther than RAG for most workflows because they touch live state: the current project, the current dashboard, the current permissions, the current page.

When you do need retrieval (docs, past tickets, long-form knowledge), you can still use a vector database. It just shouldn’t be the first dependency you add because a blog post told you to.

## Chaining without a state machine

Chaining is where people assume they need LangGraph.

Here’s what it looks like when you don’t:

1. User says “create a dashboard with CPU and memory charts”
2. Pillar calls `create_dashboard` → gets back `{ uid: "abc123" }`
3. Pillar calls `add_panel` with `dashboardUid: "abc123"` and a CPU query
4. Pillar calls `add_panel` again with a memory query
5. User sees a completed dashboard

Each step is a tool call. The model decides the sequence. The results flow forward.

## When you actually need LangGraph (or something similar)

Add a real orchestration layer when you have requirements that are not “a short plan and tool calls”:

- Background automation that runs without the user present
- Durable workflows that need to survive restarts and resume hours later
- Branching logic that depends on business rules, not just tool output
- Multi-agent systems where specialized agents hand off work

If you’re building an autonomous pipeline or long-running workflow, use LangGraph, Temporal, Hatchet, or whatever fits your constraints.

If you’re answering “how do I add a copilot to my SaaS product,” start with the tool layer.

## The part people miss: these tools are about to matter twice (WebMCP)

There’s a proposal called WebMCP that adds `navigator.modelContext` to the browser.

It lets AI agents discover and call tools that a web app registers, using MCP in the browser. The agent runs with the user’s permissions, client-side.

Today, external agents “integrate” with your product by screen-scraping or driving a headless browser. It breaks when you change CSS. It breaks again when you redesign.

WebMCP flips that. Your product exposes a stable tool surface: names, JSON schemas, and handlers.

The tool definitions you register for your product copilot are the same thing an external agent wants. Pillar exposes those tools via WebMCP. You write them once.

## If you want the stack, fine. But start with the product.

Stacks show up when you treat “copilot” as a separate system.

Most teams don’t need a separate system. They need:

- a chat UI
- a tool registry
- server-side planning
- client-side execution with the user’s session

That’s what Pillar does. If you outgrow it, you’ll know why, and you’ll have a real tool surface to orchestrate.

If you want to see it running, we have live demos with Pillar installed on [Grafana](/demos/grafana) and [Apache Superset](/demos/superset).

If you want the backstory, read [our story](/blog/our-story).

Install at [trypillar.com](https://trypillar.com). Questions? Email [founders@trypillar.com](mailto:founders@trypillar.com).
