---
draft: true
title: "Why Your Copilot Should Run Client-Side"
subtitle: "The case for executing AI actions in the browser, not on your server."
date: "2026-03-11"
author: "Mark Wai"
slug: "why-your-copilot-should-run-client-side"
description: "Most AI integrations proxy user actions through a backend. That means duplicating auth, mirroring permissions, and creating new attack surface. There's a simpler approach: run in the browser with the user's existing session."
---

## Outline

### The default architecture and its problems

- Most copilot/assistant integrations work server-side: user sends a request, backend impersonates the user, calls internal APIs.
- This requires token forwarding or service accounts that act on behalf of users.
- You end up building a shadow permission system. Every action the copilot can take needs its own server-side authorization check, duplicating what the frontend already enforces.
- New attack surface: if the copilot backend is compromised, it can act as any user.

### Client-side execution: what it means

- The copilot runs in the user's browser tab, in the same JavaScript context as your app.
- Tools are registered as functions inside React components. They call the same APIs your UI already calls, with the same cookies/tokens.
- If the user can't do something, the copilot can't either. No special permissions. No escalation path.
- If your app requires 2FA for a transfer, the copilot triggers the same 2FA flow.

### What you don't have to build

- No proxy server for forwarding auth tokens.
- No permission mapping layer ("which copilot actions map to which user roles?").
- No audit trail divergence — the copilot's actions show up in the same logs as the user's.
- No separate rate limiting or abuse detection for the copilot endpoint.

### The tradeoffs (be honest)

- Client-side means the copilot can only act when the user has the app open. No background jobs.
- Tool execution depends on which page the user is on (components mount/unmount tools).
- Network latency for LLM calls still exists — the planning step is server-side, only execution is client-side.

### When server-side makes sense

- Background automation that runs without the user present.
- Bulk operations that shouldn't tie up a browser tab.
- For everything else — user-initiated, permission-sensitive, interactive — client-side is simpler and safer.
