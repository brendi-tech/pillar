---
draft: true
title: "Two ways to build a product copilot"
subtitle: "One model starts with a CLI and an API spec. The other starts with tools you define in code. The difference is bigger than setup speed."
date: "2026-03-11"
author: "JJ Maxwell"
slug: "two-ways-to-build-a-product-copilot"
description: "There are two common ways to add a copilot to a product. One turns an API spec into tools. The other has you define tools in code. The real difference is where actions execute, how permissions work, and what the copilot can safely do after the demo."
---

There are two common ways to add a copilot to a product.

The first starts with a CLI and an API spec. You point the system at your backend, generate tools from the endpoints, and get something working fast.

The second starts with tools you define in code. You decide what actions exist, how they are described, how they execute, and where confirmation happens.

People often frame this as "easy setup" versus "customization."

That leaves out the part that matters. The real split is architectural:

- Where does the copilot execute actions?
- How does it get its action surface?
- Does it run with the user's real permissions?
- Can it do product work, or only call backend endpoints?

If you skip those questions, you can end up picking a copilot that demos well and breaks down once users ask it to do real work.

## Start with the model

One model can be set up quickly by uploading an OpenAPI spec and turning backend endpoints into tools.

The other asks developers to define tools themselves.

That is a fair description of two different models.

It is also why the comparison should start with execution and control, not setup speed.

If your product is mostly CRUD over a clean backend API, auto-generated tools from OpenAPI may get you to a demo fast. If your product has UI-driven workflows, permission checks tied to the current session, confirmation steps, and multi-step actions that move through both frontend and backend code, the OpenAPI upload is the easy part. The hard part starts after that.

## The first question: where do actions run?

This is the line that matters most.

Pillar runs tools in the user's browser with the user's session. The copilot uses the same auth context your product already uses. If the user can do something, the tool can do it. If the user cannot do it, the tool cannot do it either.

That has a few direct consequences:

- You do not need to forward user tokens to a third-party action runner.
- Your existing RBAC applies to copilot actions.
- Actions can show up in the same audit trail as normal user actions.
- The copilot can call the same frontend code paths your product already uses.

If your copilot executes actions server-side by proxying backend endpoints, you have a different system. You now need to think about token forwarding, permission mapping, tenant isolation, and how the action runner relates to the user's real session.

That may be fine for some products. But it is not a small implementation detail. It shapes what the copilot can do and what you have to maintain.

## The second question: what is the action surface?

It is easy to treat "developers define tools themselves" as the cost side of this model.

For us, that is the point.

When you auto-generate tools from an API spec, you are giving the model a large slice of your backend surface area. Maybe that is what you want. Maybe it is far more than you want.

When you define tools in code, you choose the exact action surface:

- `invite_member`
- `close_deal`
- `create_alert`
- `export_report`

Each tool has a name, description, schema, handler, and whatever confirmation flow you decide to put in front of it.

That means the action layer is:

- versioned in git
- reviewed in PRs
- testable in CI
- easy to audit
- easy to remove with a revert

We wrote more about that in [Actions as code](/blog/actions-as-code).

Here is the shape of that model in Pillar:

```tsx
usePillarTool({
  name: "invite_member",
  type: "trigger_tool",
  description: "Invite a teammate to the current workspace",
  inputSchema: {
    type: "object",
    properties: {
      email: { type: "string" },
      role: { type: "string" },
    },
    required: ["email", "role"],
  },
  execute: async ({ email, role }) => {
    await api.inviteMember({ email, role });
    return { invited: true };
  },
});
```

Yes, this takes more thought than uploading an OpenAPI spec.

And that thought is what gives you control.

## The third question: can it do product work or only API work?

Users do not think in endpoints.

They ask for things like:

- "Invite Sarah as admin and put her in the analytics workspace."
- "Create a dashboard for weekly signups and share it with the growth team."
- "Turn this report into a CSV and email it to finance."
- "Set an alert if checkout failures spike after deploy."

Those requests usually cross more than one boundary. They may need a backend mutation, a frontend navigation step, a modal, a form fill, a confirmation card, or a follow-up action that uses the output of the previous step.

That is product work.

An API-spec-driven copilot is strongest when the product maps cleanly to backend endpoints. Many real products do not. The workflow is spread across frontend state, backend state, permissions, and the current user context.

Pillar was built for that case. The tool layer lives in the product code. The copilot can navigate, fill forms, open UI, call APIs, and chain those actions together inside the app.

## The fourth question: what happens after the demo?

A lot of platform choices look obvious on day one.

Day one asks:

- How fast can we install this?
- Can we get a copilot on screen by Friday?

Month two asks different questions:

- Which actions did we expose?
- Which ones need confirmation?
- Which ones are safe to chain?
- How do we test them?
- How do we roll one back?
- How do we explain what changed in a security review?

Month six asks an even harder one:

- Is the copilot still using the same code paths as the product, or did we build a second system?

This is where the "manual setup" criticism flips.

If the action layer lives in code, it stays close to the product. If the action layer is generated from an API surface and managed outside the product logic, drift shows up later. The demo stays clean. The maintenance gets worse.

## The fifth question: does the platform stop at actions?

The "define your own tools" model can sound more bare-metal than it is.

Pillar is not a framework where you assemble every piece yourself. It includes:

- an embedded copilot SDK
- a managed knowledge base
- hosted reasoning
- custom cards for confirmations and structured flows
- human escalation
- MCP and WebMCP support

So the real tradeoff is not "plug-and-play product" versus "build your own copilot stack."

The tradeoff is closer to this:

- Do you want a copilot that maps quickly to your backend API?
- Or do you want a copilot whose action surface lives in your product code and executes inside the user's session?

Those are different bets.

## Where the CLI-plus-spec model makes sense

If your product already has a strong backend API, your workflows are mostly server-side, and your main goal is to get a chat interface calling those APIs quickly, the CLI-plus-spec model may be a good fit.

That is a real advantage. Speed matters.

## Where defining tools in code makes sense

If you want the copilot to work inside the product with the user's real session, reuse your existing auth model, and execute actions you define as code, Pillar is the better fit.

That matters when the job is not "call an endpoint." The job is "complete the workflow."

## The useful comparison

If you are evaluating copilot platforms, ask these six questions:

1. Where do actions execute?
2. Whose permissions apply at execution time?
3. How is the action surface defined?
4. Can the copilot complete UI-heavy workflows?
5. Can you test, audit, and roll back tool behavior?
6. Does the platform include knowledge, escalation, and an agent-facing interface like MCP?

That will tell you more than "which one is easier to set up."

Setup is a day-one concern.

Execution model is the product.

If you want to see the Pillar model in practice, we have live demos on [Grafana](/demos/grafana) and [Apache Superset](/demos/superset). If you want a quick check on whether your product is ready for an action-capable copilot, try the [agent tool score](/tools/agent-score).
