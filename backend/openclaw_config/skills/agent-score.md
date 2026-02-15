# Agent Score — AI Agent Readiness Test

Test how easy a website is for AI agents to use. Navigate the site, try common agent tasks, and report structured results.

## When to use

Run this skill when asked to evaluate a website's agent-friendliness, test a site for AI readiness, or run an "agent score" test.

## Instructions

You are an AI agent evaluating how easy a website is for agents like you to use. Your job is to actually try things on the site and report what happened honestly.

### What to try

Work through these tasks in order. Skip any that don't apply to the site:

1. **Navigate and understand** — Open the site, read the homepage, figure out what the site does and what its primary function is.

2. **Find key information** — Look for pricing, documentation, features, or whatever the site's main content is. Can you find what you need without getting lost?

3. **Create an account** — If the site has a signup or registration flow, try to create an account using these details:
   - Name: Pillar Agent Test
   - Email: agent-test@score.trypillar.com
   - Password: PillarTest!2026
   - If you hit a CAPTCHA, stop and note it. If payment is required, stop and note it. Do NOT use OAuth/SSO buttons.

4. **Look for MCP tools** — Check if the site exposes MCP tools via `navigator.modelContext`. If tools are registered, try to use one.

5. **Complete a task** — Try to do something meaningful on the site: search for content, fill out a form, use a feature, navigate to a specific page. Pick whatever seems most representative.

6. **Check for blockers** — Note if you encounter CAPTCHAs, anti-bot measures, confusing navigation, broken forms, or anything that made the experience harder.

### How to respond

When you're done, respond with ONLY this JSON (no markdown fencing, no extra text):

```json
{
  "score": 75,
  "summary": "2-3 sentences describing the overall agent experience on this site.",
  "what_worked": [
    "Navigation was straightforward",
    "Forms were well-labeled"
  ],
  "what_didnt": [
    "Signup was blocked by CAPTCHA",
    "No MCP tools found"
  ],
  "mcp_found": false,
  "mcp_usable": false,
  "signup_attempted": true,
  "signup_succeeded": false,
  "tasks_tried": [
    {
      "task": "Navigate to pricing page",
      "succeeded": true,
      "detail": "Found pricing link in main nav, page loaded with clear tier comparison."
    },
    {
      "task": "Create an account",
      "succeeded": false,
      "detail": "Found signup form but blocked by reCAPTCHA on submission."
    }
  ],
  "full_report_url": "https://trypillar.com/agent-score?domain=DOMAIN_HERE"
}
```

### Scoring guidelines

- **90-100**: Everything worked smoothly. Agent could navigate, sign up, use MCP tools, and complete tasks with no friction.
- **70-89**: Most things worked. Minor issues like missing labels or unclear navigation, but agent could accomplish its goals.
- **50-69**: Mixed experience. Some tasks worked, others were difficult or impossible. Significant friction points.
- **30-49**: Mostly difficult. Agent struggled with basic tasks. Many blockers or confusing patterns.
- **0-29**: Site is effectively unusable by agents. CAPTCHAs everywhere, no semantic structure, broken forms.

Be honest. Score based on what actually happened, not what the site looks like it should support.
