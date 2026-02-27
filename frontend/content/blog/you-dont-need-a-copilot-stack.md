---
title: "You don't need a copilot stack"
subtitle: "Most copilot advice stacks frameworks. One SDK is enough."
date: "2026-02-27"
author: "JJ Maxwell"
slug: "you-dont-need-a-copilot-stack"
description: "Every guide to building a SaaS copilot prescribes a multi-layer stack: CopilotKit for the frontend, LangGraph for orchestration, plus glue code to connect them. That architecture is the problem, not the solution."
---

Ask an AI how to add a copilot to your SaaS product. You'll get a stack. (If you want the deeper teardown, see [The copilot stack, in a box](/blog/the-copilot-stack-in-a-box).)

A frontend framework for the UI layer. An orchestration framework for agent workflows. A streaming protocol to connect them. Maybe a browser automation service too.

One popular answer right now recommends pairing CopilotKit on the frontend with LangGraph on the backend. That's two projects, two sets of abstractions, two deployment targets, and a streaming bridge between them. Before you've written a single tool, you're operating a second system.

This advice shows up because teams start with "I need an AI chat panel" and end up building an agent platform.

We built Pillar because the common architecture is optional. If you want the backstory, read [our story](/blog/our-story).

## The two-layer assumption

The Gemini-style recommendation breaks copilot architecture into distinct layers:

**Frontend layer.** Something like CopilotKit gives you hooks to share client-side state with the AI (`useCopilotReadable`) and let the AI trigger client-side functions (`useCopilotAction`). Or you use Vercel AI SDK and wire it all up yourself.

**Orchestration layer.** Something like LangGraph gives you a state machine on the backend so your agent can plan, retrieve context, and execute multi-step workflows with durable memory.

The assumption is that these are separate problems requiring separate tools. The frontend framework handles "what the AI can see and do in the browser." The orchestration framework handles "how the AI thinks and plans on the server."

That split sounds reasonable in a blog post. In practice, it means:

- You define tools on the frontend and again on the backend
- You serialize client state into something the orchestration layer can consume
- You build a streaming bridge so the backend can push tool calls back to the browser
- You debug failures across two runtimes
- You deploy and version two systems that must stay in sync

And you haven't shipped anything to users yet.

## What you actually need

When a user types "build me a monitoring dashboard" or "invite Sarah as an admin," they need three things to happen:

1. The AI figures out which actions to take and in what order
2. Those actions execute inside the product, with the user's permissions
3. The user stays in control of anything sensitive

That's it. The planning step is a server-side LLM call. The execution step is client-side JavaScript calling the same code your UI already uses. The confirmation step is your existing UI showing a button.

A separate orchestration framework isn't required to plan a sequence of tool calls. The LLM already does that. You give it tools with descriptions and schemas, it decides which ones to call and in what order. If it needs to chain them (create dashboard, then add panel, then set alert), it calls them sequentially and uses each result to inform the next call.

LangGraph is useful when you need custom control flow: branching logic, human-in-the-loop approvals at specific nodes, or long-running workflows that survive server restarts. Most product copilots are user-initiated and permission-sensitive. They need the AI to call a few tools in a row inside the user's browser.

## What Pillar does differently

Pillar is one SDK. You install it, register tools, and the copilot works.

If you want a full example you can copy/paste, start with [A product copilot in 50 lines of code](/blog/product-copilot-in-50-lines).

```tsx
import { usePillarTool } from '@pillar-ai/react';

usePillarTool([
  {
    name: 'create_dashboard',
    description: 'Create a new monitoring dashboard',
    type: 'trigger_tool',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Dashboard title' },
      },
      required: ['title'],
    },
    execute: async ({ title }) => {
      const dashboard = await api.createDashboard(title);
      return { uid: dashboard.uid };
    },
  },
  {
    name: 'add_panel',
    description: 'Add a chart panel to a dashboard',
    type: 'trigger_tool',
    inputSchema: {
      type: 'object',
      properties: {
        dashboardUid: { type: 'string' },
        query: { type: 'string', description: 'PromQL query' },
      },
      required: ['dashboardUid', 'query'],
    },
    execute: async ({ dashboardUid, query }) => {
      await api.addPanel(dashboardUid, query);
    },
  },
]);
```

That's a real integration. Those tools call your existing APIs. They run in the browser with the user's session. Pillar handles planning on the backend and streams tool calls to the frontend for execution.

When a user asks "build me a CPU dashboard," Pillar produces a plan (create dashboard → add CPU panel → add memory panel), executes each step by calling your registered handlers, and uses the return value from one tool as input to the next.

That removes LangGraph, CopilotKit, a custom streaming bridge, and an orchestration server.

## One tool surface, even for external agents (WebMCP)

Once you define tools, the next question is who gets to call them.

WebMCP is a browser API (`navigator.modelContext`) that lets an AI agent discover and call tools exposed by a web app. It's MCP, but in the browser.

If you register tools in your app for Pillar, you already have a "what the product can do" surface: stable names, JSON Schemas, and handlers that execute inside the user's session. Pillar exposes those tools via WebMCP, so agents outside the Pillar panel can call them too. (See the spec at [webmcp.org](https://webmcp.org).)

## What this avoids

With a one-SDK copilot, most of the glue work disappears:

- A separate backend agent service that mirrors your product's actions
- A state-sync layer so the backend can "see" what the user sees
- Two tool registries (one for planning, one for execution)
- A custom streaming transport between an agent backend and the browser
- Coordinated releases between a frontend app and an agent service

Tool definitions live in your frontend code next to the components that already know how to do the work. Planning happens on Pillar's servers. Execution happens in the browser.

## When you actually need an orchestration layer

There are real cases where LangGraph or something similar makes sense:

- Background automation that runs without the user present (scheduled reports, async data processing)
- Workflows that need to survive server restarts and resume hours later
- Complex branching logic where the AI's next step depends on business rules, not just the previous tool's output
- Multi-agent architectures where specialized agents hand off work to each other

If your copilot needs those things, add an orchestration layer. Most product copilots don't. They need to take a user request, call a few tools in sequence, and show the result. That's what Pillar does.

## The cost of extra layers

Every layer you add to the stack introduces failure modes. The orchestration server can go down independently of your frontend. The streaming bridge can drop messages. State can drift between what the client thinks happened and what the backend thinks happened.

More practically: every layer is code someone has to learn, debug, and maintain. If you're a team of five building a SaaS product, the last thing you need is a distributed agent infrastructure project on top of your actual product work.

The CopilotKit + LangGraph recommendation is honest about what each piece does. It's also a lot of machinery for what most teams actually need, which is a chat panel that can do things in the app.

## Try it

If you want a quick readiness check first, run the [agent tool score](/tools/agent-score).

If you want to see what a single-SDK copilot looks like in a real app, we have live demos with Pillar installed on [Grafana](/demos/grafana) and [Apache Superset](/demos/superset). The copilot creates dashboards, sets up alerts, and queries data, all from natural language.

Install at [trypillar.com](https://trypillar.com). If you want help getting it running, email [founders@trypillar.com](mailto:founders@trypillar.com).
