---
title: "Why Product Must Own the Chat Bubble"
subtitle: "Moving beyond support deflection to build a semantic interface for your features; essentially, Cursor for your own product."
date: "2026-01-20"
author: "JJ Maxwell"
slug: "product-needs-to-take-back-the-chat-bubble"
---

One of the biggest silent shifts in SaaS right now is the tug-of-war for the most valuable real estate on the screen: the bottom-right corner. For the last decade, there’s been an awkward truce: Product builds the application, but Support owns the chat bubble.

Product teams spend months obsessing over the "happy path"—refining hierarchy, debating button placement, and polishing onboarding flows. Yet, the product rarely works perfectly for everyone. Power users want to move faster than the UI allows; confused users can't find the path you laid out. Support inherits the messy reality of both, usually via the chat bubble they were gifted to handle "deflection."

But as AI agents begin to do a substantial amount of work in the enterprise, that arrangement is about to break. It forces us to ask: Is the chat bubble a help desk, or is it the new command line?

## Navigation vs. Execution

Firstly, we should all get on the same page about what users are actually trying to do. In the old model, a user asks, "Where is the export button?"—a navigation problem. In the AI model, they say, "Export this to CSV"—an execution problem.

AI is rewiring user behavior by collapsing the distance between intent and action. Users are being trained to stop asking for directions and start asking for outcomes. When a user types "Upgrade my plan" or "Add Sarah to this project," that is a direct request to use the product, not a request for a support article about how to use the product.

Leaving that interaction to a ticketing system is a failure of the interface. When the chat bubble shifts from a place for discussion to a place for action, it stops being a Support surface and becomes a Product surface.

## The Railway vs. The All-Terrain Vehicle

Think of your traditional UI like a railway system. It’s efficient, safe, and reliable specifically because it’s restricted. Users can only go where you’ve laid the tracks—click this button, fill this form, follow this specific flow. It prevents them from getting lost or breaking things.

The new AI-driven chat interface is an All-Terrain Vehicle. It isn't bound by your pre-built rails. It can go anywhere—navigating your internal features, but also driving "off-road" to pull in external context. Users will expect to seamlessly switch from updating a record to Googling a competitor's pricing or pulling in recent G2 reviews, all in the same thread.

But an ATV without suspension or brakes is a disaster waiting to happen. How do we ensure this freedom doesn't turn into chaos?

## Client-Side Actions: Inherent Safety

The traditional approach to AI safety is to build complex "guardrails" on the server—trying to re-implement every permission check and validation rule in the AI layer. This is fragile and redundant.

Pillar takes a different approach by separating **Server-Side Reasoning** from **Client-Side Execution**.

*   **The Brain (Server):** The AI on the server plans the workflow. It creates the "to-do list" based on the user's intent.
*   **The Hands (Client):** The actual execution of those steps happens entirely in the user's browser, using the exact same code your UI uses today.

By moving execution to the client, the AI inherently inherits all the guardrails you've already built. It shares the user's session, their cookies, and—most importantly—their permissions. The AI literally *cannot* take an action the user isn't authorized to take, because it is acting *as* the user within their own browser context.

We don't need to rebuild the tracks; we just need to give the AI the steering wheel to the vehicle you've already built.

## The Core vs. Context of Interaction

So, how do we operationalize this? We can borrow Geoffrey Moore’s concept of "core" vs. "context," but apply it to how we define actions in code.

Most engineering teams have already built the "core" actions of their product—the API endpoints, the React hooks, the Redux actions that drive the application. These are the atomic units of value: `inviteUser()`, `updateBilling()`, `generateReport()`.

Historically, these actions were hard-coded into specific UI paths. To use them, a user had to find the right button.

Pillar allows you to expose these exact same core actions to the AI brain. You define the tools in your frontend code—literally `defineTools()`—and let the AI figure out how to piece them together to solve a user's problem.

This is similar to how developers use **Cursor**. You don't manually stitch together every line of code; you express an intent ("Refactor this component to use hooks"), and the AI leverages its understanding of the codebase (the "context") to execute the necessary edits (the "core actions").

By exposing your product's internal API to the chat bubble, you are essentially building a "Cursor for your own product." You are giving your users a semantic interface to drive the machinery you've already built, making complex workflows discoverable simply by asking for them.

Support can then focus on the true "context"—the empathy, the strategy, and the human judgment that no API can capture. But for the execution of the software itself? That belongs to the product, driven by code.

## The Interface is the Product

We are moving toward a world where the interface *is* the conversation. Just as Cursor collapsed the distance between "thinking about code" and "writing code," your product needs to collapse the distance between "wanting an outcome" and "getting it."

This requires a fundamental architectural shift. You cannot achieve this level of integration with a sticker slapped on top of your UI—even if that sticker lets you "define actions" in some admin panel. Those are still just remote control buttons for a separate system.

True integration means the chat interface is woven into the fabric of your frontend, aware of every component, sharing the same state, and capable of driving every action natively.

If you treat the chat bubble as a support channel, you are ignoring the most powerful interface paradigm shift in a generation. Pillar lets you claim that territory, turning your product from a static tool into an intelligent agent.  

It's time for Product to take back the bubble.
