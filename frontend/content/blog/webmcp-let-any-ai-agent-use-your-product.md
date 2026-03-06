---
draft: true
title: "WebMCP: Let Any AI Agent Use Your Product"
subtitle: "Your app already has the tools. WebMCP makes them available to every AI agent."
date: "2026-04-01"
author: "JJ Maxwell"
slug: "webmcp-let-any-ai-agent-use-your-product"
description: "WebMCP is a browser API that lets AI agents discover and call tools registered by web apps in supported environments. With Pillar, you can expose your tools through this standard when available."
---

## Outline

### Users aren't the only ones using your product anymore

- AI agents and custom workflows are starting to interact with web apps on behalf of users.
- Today, that means screen-scraping, browser automation, or building custom API integrations per product.
- This is brittle. A CSS change breaks the agent. A redesign kills the integration.

### What WebMCP is

- `navigator.modelContext` — a browser-native API for tools, resources, and context.
- Web apps register what they can do (tools with schemas). AI agents discover and call those tools.
- It's MCP, but for the browser. Same protocol, different transport.
- Brief code example: how a tool registered via `usePillarTool` becomes available through `navigator.modelContext`.

### Why this matters for product teams

- You already defined your tools for your own copilot. WebMCP means those same tools work for any agent.
- Your product becomes a platform without building a new API. The tools are already there.
- Users can bring their preferred AI tool or custom agent, and in supported WebMCP environments it can operate your product with the user's permissions.

### How it works with Pillar

- Register tools with `usePillarTool`. They work in the Pillar copilot.
- The same tools can be exposed via WebMCP in compatible browser environments, with no separate tool implementation.
- External agents call the tools through the browser API. Execution happens client-side with the user's session.

### Where this is going

- The MCP ecosystem is growing — servers, clients, tool registries.
- WebMCP brings this to the browser. Products that adopt it early become the ones agents can actually use.
- Link to the WebMCP spec at webmcp.org. Link to Pillar's WebMCP docs.
