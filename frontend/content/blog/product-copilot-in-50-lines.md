---
title: "A product copilot in 50 lines of code"
subtitle: "The question everyone asks is 'what handles both frontend integration and backend orchestration?' The answer is simpler than the question."
date: "2026-02-13"
author: "JJ Maxwell"
slug: "product-copilot-in-50-lines"
description: "Everyone asks what single tool handles both copilot integration and orchestration. Vercel AI SDK, Mastra, and CopilotKit+AG-UI each try. Here's why the question itself is wrong, and what to do instead."
---

Here's a minimal product copilot. It can create projects, invite team members, list data, and navigate:

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
        properties: {
          name: { type: 'string', description: 'Project name' },
        },
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
          role: {
            type: 'string',
            enum: ['admin', 'editor', 'viewer'],
            description: 'Member role (defaults to viewer)',
          },
        },
        required: ['email'],
      },
      execute: async ({ email, role }) => {
        await api.inviteMember({ email, role: role ?? 'viewer' });
      },
    },
    {
      name: 'list_projects',
      description: 'List all projects the user has access to',
      type: 'query',
      autoRun: true,
      execute: async () => {
        const projects = await api.getProjects();
        return projects.map(p => ({ id: p.id, name: p.name }));
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

That's the entire copilot integration. Those tools call the same code your UI already uses (`api.*` here). They run in the browser with the user's session. When someone asks "create a project called Q1 Planning and invite sarah@company.com as editor," Pillar plans both steps, executes them in order, and uses the result of one as input to the next.

## The question people keep asking

Search "how to add a copilot to my SaaS" and you'll get a layered architecture: a frontend framework for UI state, an orchestration framework for multi-step agent logic, and a streaming protocol to connect them.

Eventually you'll ask: "Is there one tool that does both?"

Three answers keep coming up.

**Vercel AI SDK** gives you streaming and tool-calling in TypeScript. It's stateless. If your agent fails mid-task, there's no recovery. And \"tool-calling\" here means you still write the routing, planning, and execution logic. It's a way to ship LLM I/O.

**Mastra** brings workflow orchestration into the TypeScript ecosystem with step-based execution. You define inputs, outputs, and transitions. It's a real framework for building agents. But you're still building the agent: defining steps, managing state, deploying a workflow service, wiring it to your frontend.

**CopilotKit + AG-UI** takes a different approach: instead of replacing the orchestration layer, it bridges CopilotKit's React hooks to LangGraph's Python state machine via a streaming protocol. You're still running two systems in two languages with a protocol layer between them.

These are legitimate projects solving real problems. They're also a lot of infrastructure for what most product teams actually need.

## Why the question is wrong

"What tool handles both integration and orchestration?" assumes those are two jobs that need to happen in separate systems.

For most product copilots, they don't.

**Integration** means the AI can see and do things inside your app. That's a client-side problem. You register tools as functions in your React code. They call the same APIs your buttons call, with the same auth tokens.

**Orchestration** means the AI can plan and execute a sequence of tool calls. LLMs already do this natively. You give the model tools with descriptions and JSON schemas. It decides which ones to call and in what order. When it needs to chain them (create project, invite member, navigate), it calls them sequentially and uses each result as context for the next.

LangGraph, Mastra, and similar frameworks exist for cases that go beyond native tool-calling: custom branching logic, human-in-the-loop approvals at specific graph nodes, durable workflows that survive server restarts. Those are real requirements for some products.

Most product copilots don't have them. They need the AI to call a few functions inside the user's browser session.

## The full setup

Three files.

The provider wraps your app:

```tsx
// providers/PillarSDKProvider.tsx
'use client';
import { PillarProvider } from '@pillar-ai/react';

export function PillarSDKProvider({ children }: { children: React.ReactNode }) {
  return (
    <PillarProvider productKey={process.env.NEXT_PUBLIC_PILLAR_PRODUCT_KEY!}>
      {children}
    </PillarProvider>
  );
}
```

The layout includes it:

```tsx
// app/layout.tsx
import { PillarSDKProvider } from '@/providers/PillarSDKProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PillarSDKProvider>{children}</PillarSDKProvider>
      </body>
    </html>
  );
}
```

The hook registers your tools (the 50 lines from above).

Pillar handles planning on its servers, streams tool calls to the browser, and executes your handlers with the user's existing session. Your tools run in the same JavaScript context as the rest of your app. If the user can't do something, the copilot can't either.

When someone types "set up my workspace," Pillar produces a plan: list existing projects, create a new one, invite the team lead. Then it calls your handlers in sequence. Each step runs client-side. The results show up in the chat panel.

## Chaining without a state machine

Chaining is where people expect to need an orchestration framework. Here's what it looks like without one:

1. User says "create a dashboard with CPU and memory charts"
2. Pillar calls `create_dashboard` → gets back `{ uid: "abc123" }`
3. Pillar calls `add_panel` with `dashboardUid: "abc123"` and a CPU query
4. Pillar calls `add_panel` again with a memory query
5. User sees a completed dashboard

Each step is a tool call. The model decides the sequence. The results flow from one call to the next. This is how LLM tool-calling works by default. You register the tools and the model plans the execution.

In this setup, the model plans the execution.

## When you do need more

Add a real orchestration layer when you have:

- Background automation that runs without the user present
- Durable state that needs to survive server restarts and resume hours later
- Custom control flow where the next step depends on business rules rather than tool output
- Multi-agent systems with specialized agents handing off tasks

If you're building an autonomous data pipeline or a multi-day research workflow, reach for LangGraph or Temporal. But if you're answering "how do I add a copilot to my SaaS product," start with the 50 lines. You can add complexity later if you need it.

## These tools are about to matter twice

There's a W3C proposal called [WebMCP](https://webmcp.org) that adds `navigator.modelContext` to the browser. It lets AI agents, including Claude, ChatGPT, and custom workflows, discover and call tools that web apps register. It uses the same MCP protocol that's already standard on the server side.

Today, when an external agent wants to use your product, it screen-scrapes or drives a headless browser. A CSS change breaks the integration. A redesign breaks it again.

WebMCP changes this. Your app registers tools with schemas. Any agent that speaks MCP can discover them and call them with the user's permissions, through the browser, client-side.

The tools you register with `usePillarTool` are the same tools WebMCP exposes. You write them once for your copilot. When WebMCP ships in browsers, those tools become available to external agents your users bring. No second API. No extra code.

This is why the tool layer matters. The 50 lines above aren't just a copilot integration. They're the start of your product's agent API.

## See it running

If you want a quick readiness check before you build anything, run the [agent tool score](/tools/agent-score).

We have live demos on [Grafana](/demos/grafana) and [Apache Superset](/demos/superset). The copilot creates dashboards, writes queries, and sets up alerts from natural language—all through tools registered the same way as the code above.

If you want the backstory, read [our story](/blog/our-story).

Install at [trypillar.com](https://trypillar.com). Questions? Email [founders@trypillar.com](mailto:founders@trypillar.com).
