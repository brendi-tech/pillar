---
draft: true
title: "The Action Layer Your Product Is Missing"
subtitle: "Users don't want to learn your UI. They want outcomes."
date: "2026-03-04"
author: "JJ Maxwell"
slug: "the-action-layer-your-product-is-missing"
description: "Products ship features faster than users can absorb them. The missing piece isn't more documentation — it's an action layer that lets users say what they want and have the product do it."
---

Most product teams have the same problem now: you ship faster than your users can learn.

The UI keeps moving. The changelog keeps growing. And users keep asking for outcomes that the product already supports.

That gap shows up in a predictable place: support.

You get tickets that sound like bugs or missing features:

- “How do I export this report?”
- “Can you add a button to notify the customer?”
- “Is there a way to set this deal to won and create the onboarding project?”

Half the time, the answer is: yes, you can already do that. It’s just buried in a menu, gated behind a permission, or requires five steps across three screens.

So teams react the way teams always react. They add more help.

More tooltips. More onboarding tours. More docs. More “here’s where the button moved.”

That helps for a week, then you ship again.

## The layers your product already has

Most web products have three layers:

### Data layer

Your APIs, databases, business rules, permissions.

### Presentation layer

Pages, components, forms, navigation. The actual way a human uses the product.

### Documentation layer

Help center articles, tooltips, onboarding steps, “what’s new” posts.

These layers are necessary. None of them closes the gap between “I want X” and “X is done.”

## The missing layer: action

An **action layer** takes a user’s intent and carries it out end-to-end inside the product.

When a user asks “where is the settings page,” the right response is still a link to the doc. When a user asks for an outcome, the product should do the work:

- Navigate to the right place
- Fill the form
- Pick the right record
- Run the mutation
- Ask for confirmation when it matters
- Leave an audit trail that matches how the product works today

If you’ve built a UI, you already have most of the primitives an action layer needs. The missing part is the interface that lets the user express intent and have the product execute.

## What it looks like in practice

Picture a CRM. A salesperson types:

> Close the Walmart deal as won and notify implementation.

An action layer doesn’t respond with a paragraph. It produces a plan and executes it. Something like:

1. Search for the “Walmart” deal in the current pipeline
2. Open the deal
3. Change stage to “Closed won”
4. If required, confirm any fields needed for closed-won (amount, close date, primary contact)
5. Save
6. Post a message in the implementation channel with key details (customer name, ARR, start date, handoff notes)
7. Create an onboarding project using the same flow the team uses today

Some of those steps can run without asking the user. Some shouldn’t.

If “Closed won” triggers billing, the product should ask for a human confirmation in the existing confirmation UI. If the product requires 2FA to change billing status, the action layer should hit the same gate.

The important part is where execution happens.

If it runs inside the product, with the user’s session, then:

- The action layer can’t do things the user can’t do
- The action layer automatically respects permissions and org scoping
- Your existing checks and workflows still apply
- Your logs and audit trail still make sense

This is the opposite of “automation that lives next to the product.” It’s the product doing the work.

## Why docs and chatbots don’t solve this

Docs help users learn. They don’t reduce the amount of work.

Even the best help center article usually ends with something like:

- Go to Settings
- Click Billing
- Open Plans
- Select “Annual”
- Save

That’s still five steps. The user still has to hunt for the page. The user still has to understand what “Plans” means in your app.

Chatbots are often a nicer front-end for the same thing. You ask a question, it tells you where to click, maybe links the right doc. Sometimes it hallucinates a button name that doesn’t exist.

Users don’t open support tickets because they love learning.

They open support tickets because they want the outcome and the product is making them do too much navigation to get it.

## Why “just build an API for agents” isn’t enough

Some teams respond with automation surfaces:

- A dedicated “automation API”
- A separate “agent API”
- A workflow builder that re-implements your product’s actions

That can work. It also creates a second product to maintain.

Now every time you ship a UI change or a feature change, you have to ask:

- Did we update the UI flow?
- Did we update the automation API?
- Did we update the docs?

Most teams don’t keep those surfaces in sync. The automation API lags behind the product. The workflow builder becomes a graveyard of half-supported actions.

An action layer avoids that by reusing what you already shipped. It’s built out of the same code paths and the same permission checks.

If the product can do it, the action layer can do it.

If the product can’t do it, the action layer shouldn’t invent a way.

## This is the interface agents will use

Humans are the first consumer of an action layer. They’re also not the only consumer anymore.

AI agents are starting to operate inside web apps: updating CRM records, building dashboards, configuring alerts, triaging tickets. Today, most of that is browser automation glued together with brittle selectors.

That breaks when you redesign a page.

If you want agents to use your product reliably, you need a stable way to express “what can be done” and a safe way to do it with the user in the loop.

That’s what an action layer is: tool calls with schemas, backed by real UI actions, executed in the user’s session.

## Where to start

If you’re trying to decide whether you need this, you probably do. The tell is simple: users keep asking for outcomes your product already supports.

Start with your highest-volume tickets and internal asks. Ignore the ones that are truly bugs. Look for the ones where the “fix” is a link and a list of steps.

Pick a small set of workflows that are common, touch multiple pages, and end in a real state change (send money, close deal, create dashboard, change permissions).

Then build the smallest action layer that can do one workflow end-to-end:

- Register a few tools that wrap what your UI already does (search, open, set fields, submit)
- Keep the same confirmation points you already trust
- Log tool calls the same way you log user actions
- Add guardrails where mistakes hurt (money, access, deletes)

Once one workflow works, the rest are repetition.

## Where Pillar fits

Pillar is an action layer you embed into your app.

Users type what they want. Pillar plans the steps. Your app executes those steps client-side by calling tools you register from your existing frontend code.

That last part matters. You don’t need to build a parallel automation API. You don’t need to proxy credentials. You register the same actions your UI already supports: “open deal,” “set stage,” “prefill form,” “post message,” “create project.”

Sensitive actions still look and feel like the product. A money transfer still goes through the transfer flow. A permission gate still blocks the action. A confirmation modal still appears.

If you’ve been shipping onboarding tours and help center articles to explain where the buttons are, that’s a signal: the product has too much surface area for the user to keep in their head.

An action layer gives users a different way in. It turns “I want this outcome” into “done,” without asking them to memorize your navigation.

If you want to see what this looks like in a real app, we’ve got live demos (including Grafana) and an SDK you can install in a React app in minutes. Start here: [trypillar.com](https://trypillar.com). If you want help getting it live, email [founders@trypillar.com](mailto:founders@trypillar.com).
