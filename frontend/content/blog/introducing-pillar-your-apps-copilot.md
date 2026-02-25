---
title: "Introducing Pillar: your app's copilot"
subtitle: "An open source copilot that turns user requests into completed actions, right inside your app."
date: "2026-02-25"
author: "Mark Wai"
slug: "introducing-pillar-your-apps-copilot"
description: "Pillar is an embedded AI copilot that executes tasks inside your product. Users type what they want, and the copilot carries it out client-side using existing permissions and security checks."
---

We're JJ and Mark, cofounders of Pillar. Today we're launching on [YC](https://www.ycombinator.com/launches/PUQ-pillar-your-app-s-copilot).

Pillar is an embedded AI copilot that executes tasks inside your product for users and agents. Users type what they want. The copilot carries it out client-side in the browser, using the user's existing session, permissions, and security checks. You install the SDK via npm and register your existing frontend code as tools.

Here's a quick example: in a banking app, a user types "send $200 to my cleaners." Pillar finds the right recipient, navigates to the transfer flow, and pre-fills the form. The user still reviews and confirms. If your app requires 2FA for that action, so does the copilot.

Watch the demo: [youtube.com/watch?v=ruNJ5OFuKsI](https://www.youtube.com/watch?v=ruNJ5OFuKsI)

## The problem

Teams ship faster than ever. But when your changelog is 10x longer than it used to be, users can't keep up.

**Discoverability breaks down.** The UI changes, features move, people forget where things live.

**Friction turns into "support."** Users open tickets that aren't really support tickets. They wanted to do something the product already supported but couldn't get there.

**Products don't have an action layer.** AI agents are starting to use web apps the same way users do: navigate, click, fill forms. Products need to be ready for this.

The bottom line: products need a way to execute actions end-to-end, with proper permissions, not just document them.

## How it works

Pillar turns a user request into action by combining planning with in-browser execution.

1. **Plan.** Pillar determines which steps and tools to run.
2. **Execute.** Your app runs those tools in the browser: navigation, API calls, state updates, form fills.
3. **Confirm.** The user stays in control for sensitive actions.

You register tools inside your existing React components:

```typescript
import { usePillarTool } from '@pillar-ai/react';

export function useBankingTools() {
  usePillarTool({
    name: 'search_recipients',
    type: 'query',
    description: 'Search for saved payment recipients',
    inputSchema: {
      query: { type: 'string', description: 'Search term' },
    },
    execute: async ({ query }) => {
      const results = await recipientsApi.search(query);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    },
  });

  usePillarTool({
    name: 'prefill_transfer',
    type: 'fill_form',
    description: 'Pre-fill the money transfer form',
    inputSchema: {
      recipientId: { type: 'string', description: 'Recipient ID' },
      amount: { type: 'number', description: 'Amount to send' },
    },
    execute: ({ recipientId, amount }) => {
      router.push(`/transfer?to=${recipientId}&amount=${amount}`);
    },
  });
}
```

What happens at runtime when a user types "send $200 to my cleaners":

1. Pillar calls `search_recipients` with "cleaners"
2. Selects the right match
3. Calls `prefill_transfer` with the recipient + amount
4. User reviews and confirms in the existing flow

Because execution happens in the browser, tools run with the current user's permissions and session. Pillar can't do anything the user can't do.

## Knowledge sync

Pillar syncs with your help content (Zendesk, Intercom, Notion, Confluence, internal docs) so requests map to the right tools and flows. When it picks the wrong path, you flag it and the correction is captured so the same mistake is less likely to repeat.

## SDKs and WebMCP

SDKs are available for React and vanilla JavaScript. Registered tools can also be reused by other copilots and agents via [WebMCP](https://webmcp.org) (`navigator.modelContext`).

## Try it

Install at [trypillar.com](https://trypillar.com).

We also have live demos you can try right now, with Pillar installed on open-source products:

- **[Grafana](https://trypillar.com/demos/grafana)** — have Pillar build you a monitoring dashboard and set up alerts
- **[Apache Superset](https://trypillar.com/demos/superset)** — explore the names dataset and build a dashboard

Want help getting live? Reach out at [founders@trypillar.com](mailto:founders@trypillar.com).

## Backstory

We built Pillar to solve our own problem. At our last company (Double Finance), we saw a pattern: users asked for outcomes we already supported, but still opened support tickets. We wanted a way to reuse the frontend code we'd already shipped, without rebuilding flows or adding new "automation" surfaces.

Pillar is what we wish we had.

If you lead product or engineering and users open tickets for things your product already does, we'd love to talk: [founders@trypillar.com](mailto:founders@trypillar.com).
