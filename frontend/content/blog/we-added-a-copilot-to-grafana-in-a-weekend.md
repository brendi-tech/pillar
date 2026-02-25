---
draft: true
title: "We Added a Copilot to Grafana in a Weekend"
subtitle: "A walkthrough of adding Pillar to an open-source app — from zero to working copilot."
date: "2026-03-18"
author: "Mark Wai"
slug: "we-added-a-copilot-to-grafana-in-a-weekend"
description: "We took Grafana, an open-source monitoring tool, and added a copilot that builds dashboards and sets up alerts from natural language. Here's how we did it."
---

## Outline

### Why Grafana

- Complex UI, lots of features, steep learning curve. Users frequently know what they want to monitor but struggle with the mechanics of building a dashboard.
- Open source, so we can show real code.
- Good test case: the copilot needs to navigate between pages, fill out multi-step forms, and chain actions together.

### Setting up the SDK

- Install `@pillar-ai/react`, wrap the app in `PillarProvider`.
- Brief code snippet showing the provider setup.

### Registering the first tools

- Walk through 2-3 tools: `create_dashboard`, `add_panel`, `set_alert`.
- Show the `usePillarTool` hook with real inputSchema and execute functions.
- Explain how tools map to existing Grafana APIs/UI actions.

### The first request: "build me a CPU monitoring dashboard"

- Show what Pillar's planning step produces: a list of tool calls in sequence.
- Walk through each execution step: create dashboard → add panel with PromQL query → add another panel → set alert threshold.
- Screenshot or GIF of the result.

### What surprised us

- Things that worked well out of the box (multi-step chaining, context passing between tools).
- Things we had to adjust (tool descriptions that were too vague, handling Grafana's async UI updates).
- How the knowledge base helped map user language ("CPU usage" → the right PromQL query).

### Try it yourself

- Link to the live demo.
- Link to the source code.
- Getting started pointers for anyone wanting to do this with their own app.
