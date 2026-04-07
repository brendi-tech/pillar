---
draft: false
title: "We built a copilot. Our customers needed a control plane."
subtitle: "What we learned from our first customers about where AI actually fits in their products."
date: "2026-04-07"
author: "JJ Maxwell"
slug: "copilot-to-control-plane"
description: "We started Pillar as an in-app copilot SDK. After working with our first customers, we realized the real problem is bigger: managing tools, knowledge, and agents across every channel from one place."
---

We started Pillar as an in-app copilot. Embed a chat widget, register some tools, ship it. That was the product.

Then we started working with actual customers.

## What we heard

The first few conversations followed a pattern. A team would integrate the copilot into their app. It worked. Users could type a request and the copilot would execute it.

Then the questions started.

"Can we also have this in Slack?" Sure. "And we want it to answer questions from our docs." Makes sense. "Our sales team uses Calendly. Can the agent book meetings?" Okay. "We have an internal tool that checks order status. Can the agent call that too?" Yes. At that point we were talking about something else.

Nobody wanted a copilot by itself. They wanted one place to define what their AI can do, what it knows, and where it shows up. The copilot was one surface. Slack was another. Their internal tools, external integrations, and docs all had to connect.

## Driving existing UI wasn't enough

Here's what we got wrong initially: we thought driving existing UI was the main thing. Reuse the current components. Put them in a chat thread. Let the agent open the same flows people already use. That part still matters, and we've gotten much better at it.

Some of our recent updates are exactly about that. You can reuse existing components inside a chat thread, whether that thread lives in a sidebar or takes over the full page.

But that wasn't the whole problem customers were trying to solve.

In most products, AI is going to be the main interface. The user says what they want. The product makes it happen.

That interaction can happen in your app, in Slack, in Discord, through an MCP client, or somewhere else. Reusing existing UI is one part of that. The bigger product is everything behind it: what tools are available, what knowledge the agent has, how it reasons, and where it's deployed.

## The real problem: one place for everything

One of our early customers had tools scattered everywhere. Their product API handled orders. Their sales team used Calendly for bookings. Their help docs lived in Notion. They had an internal Slack bot that could check inventory.

They didn't need a copilot. They needed a control plane.

They needed one place to say: here are my tools. Some are APIs, some are MCP servers, some are browser actions. Here is my knowledge. These docs, those help articles. And here are my agents: one for customers in the app, one for the team in Slack, one exposed as an MCP server for Cursor.

The important part was simple: when they update something, it should update everywhere. Change the return policy in the knowledge base and the in-app copilot, the Slack agent, and the MCP server all get the new answer. Add a new tool and pick which agents get it. Remove a tool and it disappears from every channel.

That's the product Pillar is now.

## What changed

We rebuilt around the control plane idea. Pillar is the layer between your tools and your users, regardless of where those users show up.

The stack is simple.

At the bottom are your tools. Bring them however they already exist: an OpenAPI spec, an MCP server, or code-defined tools in the SDK.

Then knowledge. Pillar crawls your docs, indexes your content sources, and keeps them current.

Then the reasoning engine. It decides which tools to call, when to search knowledge, when to ask for clarification, and how to chain multiple steps together.

Then the control plane itself. A dashboard where you configure agents, review conversations, see analytics, and manage identity across channels.

At the top are the channels: Slack, Discord, your web app, MCP, CLI. Same agent brain. Different surfaces.

## Why one place matters

The alternative is what most teams do today: separate integrations for each channel. A Slack bot with its own tool set. A copilot with different capabilities. An MCP server that's out of date because nobody updated it.

When your sales team's Calendly link changes, you update it in one place and the Slack agent, the in-app copilot, and the MCP server all have the right link. When you add a new knowledge source, every agent can answer questions about it.

This sounds obvious written down. In practice, very few teams have it. They maintain parallel systems that drift apart.

## The copilot still exists

We didn't remove the in-app copilot. It's still there. And browser-native execution still matters for that channel: tools run in the user's session with their auth and no extra round trip.

It's one channel. The copilot is how Pillar started. The control plane is what Pillar is now.

## Try it

If you have tools, MCP servers, docs, and internal systems you want to wire into one agent setup, Pillar is built for that: [trypillar.com](https://trypillar.com).

Questions? [founders@trypillar.com](mailto:founders@trypillar.com).
