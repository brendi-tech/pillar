---
draft: false
title: "Actions as code"
subtitle: "Terraform moved infrastructure from console clicks to version-controlled files. Product actions can move the same way."
date: "2026-03-11"
author: "JJ Maxwell"
slug: "actions-as-code"
description: "Before Terraform, engineers clicked through cloud consoles. Many product workflows still work the same way. Defining product actions in code gives you auditability, reviewability, a controlled action surface, and less drift."
---

Before Terraform, provisioning infrastructure meant logging into the AWS console, clicking through menus, and filling in forms. If you needed to do it again, you did the whole thing again. If someone else needed to do it, you wrote a wiki page with screenshots.

Terraform replaced that with a file.

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}
```

You describe what you want. You run `apply`. Done.

That shift happened for infrastructure a decade ago. It hasn't happened for the products we build on top of that infrastructure.

Your users are still clicking through consoles to get value out of products.

## The user's version of console-clicking

A salesperson wants to close a deal and notify implementation. That's five screens, three dropdowns, and an email or Slack message they write by hand.

A finance admin wants to categorize 30 Uber receipts as "Travel." That's 30 clicks on the same dropdown.

An ops person wants an alert when CPU exceeds 80% on production nodes. They know exactly what they want. They spend ten minutes finding the page with alert settings.

These people know the outcome. The product makes them work for it: navigate menus, hunt for settings, fill forms. It's the same kind of manual console-clicking infrastructure engineers stopped doing years ago.

When they get stuck, they file a ticket. The ticket isn't reporting broken behavior. It's asking where to click.

## Define what users can do, in code

Here's what a Pillar tool definition looks like in the current React SDK:

```tsx
import { usePillarTool } from "@pillar-ai/react";

export function useSalesTools() {
  usePillarTool({
    name: "close_deal",
    type: "trigger_tool",
    description:
      "Mark a deal as closed won. Use when the user wants to close an opportunity or mark a deal as won.",
    examples: [
      "close the Walmart deal",
      "mark Acme as closed won",
      "close this opportunity",
    ],
    inputSchema: {
      type: "object",
      properties: {
        dealName: {
          type: "string",
          description: "Name of the deal to close",
        },
        closeDate: {
          type: "string",
          description: "Optional close date in ISO format",
        },
      },
      required: ["dealName"],
    },
    execute: async ({ dealName, closeDate }) => {
      const deal = await api.findDealByName(dealName);

      await api.updateDeal(deal.id, {
        stage: "closed_won",
        closeDate: closeDate ?? new Date().toISOString(),
      });

      return { deal_id: deal.id, stage: "closed_won" };
    },
  });
}
```

This plays the same role Terraform config plays for infrastructure. It declares what the action is, what inputs it takes, and what it does. It lives in your codebase. It goes through code review. It's versioned with git.

When a user types "close the Walmart deal," Pillar matches the request to the tool, extracts the inputs, and executes it in the browser with the user's session. If the task needs more than one step, Pillar can call multiple tools in sequence.

The user doesn't need to know where the deal page is. They state what they want.

That's useful on its own. The bigger reason to put actions in code is everything that comes with it.

## It's auditable in git

When actions live in code, every change has a commit.

Who added the tool that lets users bulk-delete records? Check `git log`. When did the "close deal" flow start requiring a close date? Check `git blame`. What did the onboarding workflow look like six months ago? Check the history.

Compare that to the alternative: AI capabilities configured in a dashboard, managed through a UI, documented in a Notion page that's three months stale. When something goes wrong, nobody knows what changed or when.

Terraform solved this for infrastructure. You stopped asking "who changed the security group?" because the answer was always in the commit.

Actions as code does the same thing for the action surface in your product.

## You control the surface area

This is the security argument, and it's the most important one.

For the actions you expose through tools, no definition means no capability. The AI can only call what you've explicitly defined. You're not handing it a broad automation surface and hoping it behaves. You're whitelisting specific actions.

This is the same model as Terraform providers. A Terraform config can only manage resources the provider exposes. If the AWS provider doesn't have a resource type for something, Terraform can't touch it. You don't worry about Terraform accidentally deleting your DNS because you never gave it a DNS resource.

Pillar works the same way. If you haven't registered a `delete_user` tool, the copilot can't call one. And if you model a sensitive action as an `inline_ui` confirmation card, an `open_modal`, or any flow that waits for user input, the user confirms before the state change happens. The AI can't skip that step because the gate is in your code.

Your tool definitions are the list of what AI can do through these code-defined actions. You can read them, audit them, and reason about them. If that list is short, the surface area is small. If a tool looks dangerous, catch it in a PR.

## Changes are reviewable before they ship

Imagine this PR comment: "This tool lets the copilot transfer money without a confirmation step. Should we add one?"

That conversation happens in code review, before the change reaches users. The reviewer can see the tool's `execute` function, check whether it opens a confirmation flow or requires user input, and decide whether the behavior is safe.

Without actions as code, this kind of review doesn't happen. Someone enables a new capability in a config panel. Maybe they tested it. Maybe they didn't. Nobody reviews AI capabilities the way they review code, because the capabilities aren't code.

Terraform made infrastructure reviewable. You run `terraform plan`, see what's going to change, and approve it. The equivalent here is a diff in a PR: "we're adding three tools, removing one, and changing the input schema for another."

## You can avoid drift

This part depends on how you wire the tools, and it matters.

The best setup is for tool handlers to call the same APIs, service functions, or UI flows your product already uses. Then they inherit the same validation and permission checks. When you update the product, the tools stay aligned because they're using the same code path.

Compare that to maintaining a separate "automation API" or "agent API" alongside your product. Every time you ship a feature, you ask: did we update the UI? Did we update the automation API? Did we update the docs? Most teams don't keep those in sync. The automation API lags behind. The agent API covers half the features. The docs describe a version from two months ago.

Terraform solved drift for infrastructure by making the code the source of truth. If the code says "t3.micro" and the actual instance is "t3.large," Terraform detects the drift and offers to fix it.

With Pillar, you don't need a separate agent-only execution layer. If your tool handlers share the same code path as the product, there's much less to get out of sync.

## They're testable

A tool handler is just a function. Test it like one.

```tsx
test("close_deal marks deal as closed_won", async () => {
  const result = await closeDealHandler({
    dealName: "Walmart",
  });
  expect(result).toMatchObject({ stage: "closed_won" });
});
```

You can write unit tests for individual tools. You can write integration tests that chain tools together ("close the deal, then notify the channel"). You can add them to CI and block merges if they fail.

Good infrastructure teams treat that as table stakes. The same standard should apply to the actions your AI can take in your product.

## The tool code is the documentation

One of the underrated benefits of Terraform is that the `.tf` files document what exists. You don't need a separate wiki page explaining what infrastructure you have. You read the files.

Pillar tools work the same way. The tool definitions in your codebase are the current spec for what the copilot can do through code-defined actions. New engineer joins the team? Point them at the tool code. Product manager wants to know what the copilot supports? Read the tool code. Security review? Audit the tool code.

No separate documentation to maintain. No Notion page to update. No "I think the copilot can do X but I'm not sure."

## Same permissions, no escalation

Terraform runs with the credentials you give it. If the IAM role can't create an RDS instance, `terraform apply` fails. Terraform doesn't have its own permissions model. It inherits yours.

Pillar tool handlers run in the user's browser. If your frontend normally calls your APIs with the user's session, the tool call uses that same auth context. If the user doesn't have permission to close a deal, the tool call fails the same way a button click would fail. The copilot doesn't need elevated access to do the work.

That means you don't need a shadow permission system for AI for those actions. Your existing RBAC can apply because the tools use the same auth context as the rest of the app.

## Rollbacks are git reverts

A tool is causing problems? Revert the commit. The capability disappears on the next deploy.

With UI-configured AI capabilities, rolling back means logging into a dashboard, finding the right setting, and hoping you remember what the previous state was. With actions as code, the previous state is the previous commit.

## The console isn't going away

Terraform didn't kill the AWS console. Engineers still use it to explore, debug, and understand what's running.

Pillar doesn't replace your product's UI. Some users prefer clicking. Some workflows need visual feedback. A dashboard builder probably wants to drag panels, not describe a layout in text.

The point isn't that UIs are bad. The point is that requiring users to navigate a UI for every action is the same bottleneck that infrastructure had when everything required the console.

Give users both. Let them click when they want to browse. Let them type when they know what they want.

## Where to start

Pick your top five support tickets that aren't bugs. The ones where the answer is "go to Settings, click Billing, select the Annual plan, click Save."

Write five tool definitions. Ship them. Measure whether ticket volume drops.

Terraform adoption didn't start with "convert all infrastructure to code." It started with one team, one service, one file.

Start here: [trypillar.com](https://trypillar.com). Questions? Email [founders@trypillar.com](mailto:founders@trypillar.com).
