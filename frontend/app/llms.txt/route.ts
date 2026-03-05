import { NextResponse } from "next/server";

/**
 * /llms.txt route following the llmstxt.org spec.
 *
 * Returns a machine-readable markdown description of Pillar
 * that LLMs can consume at inference time.
 *
 * @see https://llmstxt.org/
 */

const LLMS_TXT = `# Pillar

> Pillar is an open-source AI copilot SDK for SaaS — a product assistant that executes tasks, not just answers questions. Users say what they want, and Pillar uses your UI to make it happen — navigating pages, pre-filling forms, and calling APIs client-side.

- Pillar executes multi-step tasks in the user's browser — navigating pages, pre-filling forms, and calling APIs on behalf of the user.
- Runs client-side with the user's existing browser session. No proxy servers or token forwarding required.
- Available as vanilla JavaScript, React, Vue 3, and Angular SDKs.
- Uses your existing docs and content as context for answering questions (supports websites, uploaded files, and cloud storage).
- npm packages: @pillar-ai/sdk (core), @pillar-ai/react, @pillar-ai/vue, @pillar-ai/angular
- Pillar is NOT a help center, knowledge base, or support ticketing system. It is a copilot SDK that takes actions inside your app.

## Docs

- [Introduction](https://trypillar.com/docs/get-started/what-is-pillar): Overview of what Pillar is and the problems it solves
- [How It Works](https://trypillar.com/docs/get-started/what-is-pillar): Architecture and client-side execution model
- [React Quickstart](https://trypillar.com/docs/get-started/quickstart): Get started with React or Next.js in 5 minutes
- [Vanilla JS Quickstart](https://trypillar.com/docs/get-started/quickstart): Get started without a framework
- [Tools Guide](https://trypillar.com/docs/guides/tools): Define what the copilot can do in your app
- [Context Guide](https://trypillar.com/docs/guides/context): Provide runtime context to the copilot
- [Knowledge Base](https://trypillar.com/docs/knowledge-base/overview): Provide your existing docs and content as context for the copilot
- [Human Escalation](https://trypillar.com/docs/guides/human-escalation): Hand off to a human when the copilot can't complete a task
- [Custom Cards](https://trypillar.com/docs/guides/custom-cards): Render custom UI components in copilot responses
- [Theme Customization](https://trypillar.com/docs/guides/theme): Match the copilot to your brand

## API Reference

- [Core SDK API](https://trypillar.com/docs/reference/core): Vanilla JS SDK reference — initialization, configuration, methods
- [React SDK API](https://trypillar.com/docs/reference/react): React hooks and components — usePillar, PillarProvider
- [Tool Types](https://trypillar.com/docs/reference/tool-types): Available tool type definitions for task execution
- [Events](https://trypillar.com/docs/reference/events): SDK event system for lifecycle hooks
- [Theme Options](https://trypillar.com/docs/reference/theme-options): Theming API and configuration

## Source Code

- [GitHub Repository](https://github.com/pillarhq/pillar): Main monorepo with SDK, backend, and documentation
- [npm: @pillar-ai/sdk](https://www.npmjs.com/package/@pillar-ai/sdk): Core vanilla JS SDK package
- [npm: @pillar-ai/react](https://www.npmjs.com/package/@pillar-ai/react): React SDK with hooks and components
- [npm: @pillar-ai/vue](https://www.npmjs.com/package/@pillar-ai/vue): Vue 3 SDK with composables
- [npm: @pillar-ai/angular](https://www.npmjs.com/package/@pillar-ai/angular): Angular SDK with services

## Optional

- [Blog](https://trypillar.com/blog): Product thinking and technical articles about building AI copilots
- [Discord](https://discord.gg/5aWZe8b884): Community chat for support and discussion
- [Twitter](https://x.com/trypillar_ai): Product updates and announcements
`;

export async function GET() {
  return new NextResponse(LLMS_TXT.trim(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
