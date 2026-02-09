<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pillarhq/pillar/main/img/logo-light.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/pillarhq/pillar/main/img/logo-dark.svg" />
    <img alt="Pillar" src="https://raw.githubusercontent.com/pillarhq/pillar/main/img/logo-dark.svg" width="200" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/pillarhq/pillar/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@pillar-ai/sdk"><img src="https://img.shields.io/npm/v/@pillar-ai/sdk" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@pillar-ai/sdk"><img src="https://img.shields.io/npm/dm/@pillar-ai/sdk" alt="npm downloads" /></a>
  <a href="https://github.com/pillarhq/pillar/stargazers"><img src="https://img.shields.io/github/stars/pillarhq/pillar" alt="GitHub stars" /></a>
  <a href="https://github.com/pillarhq/pillar/graphs/contributors"><img src="https://img.shields.io/github/contributors/pillarhq/pillar" alt="Contributors" /></a>
  <a href="https://discord.gg/uhVFmGMW"><img src="https://img.shields.io/discord/1234567890?logo=discord&label=Discord" alt="Discord" /></a>
</p>

<p align="center">
  <a href="https://trypillar.com/docs">Docs</a> ·
  <a href="https://pillar.to/blog">Blog</a> ·
  <a href="https://pillar.to">Website</a> ·
  <a href="https://discord.gg/uhVFmGMW">Discord</a> ·
  <a href="https://x.com/trypillar">Twitter</a>
</p>

---

# Pillar

**The open-source product copilot. Build AI agents into your app that execute tasks, not just answer questions.**

[Pillar](https://pillar.to) is an embeddable AI co-pilot SDK. Users say what they want, and Pillar uses your UI to make it happen — navigating pages, pre-filling forms, and calling your APIs. It runs client-side with the user's session, so there's no proxy servers or token forwarding.

*This repository contains the full Pillar platform: backend, admin dashboard, and all SDK packages.*

---

## Why Pillar?

- **One install, fully yours**: `npm install` and go. Define actions, customize UI and behavior — all in your own code. No black boxes.
- **Actions, not just answers**: Navigate pages, pre-fill forms, call APIs. The assistant does things on behalf of users, not just explains how.
- **Client-side execution**: Runs in the user's browser with their session. Same auth, no proxy servers, no token forwarding.
- **Managed knowledge**: Crawls your docs and integrates with Zendesk, Intercom, YouTube, files, and more. RAG that stays fresh automatically.
- **MCP server included**: Claude, ChatGPT, and other AI tools can query your product's knowledge base out of the box.
- **Multi-framework SDKs**: React, Vue, Angular, and vanilla JS. All MIT-licensed, embed freely in proprietary apps.

---

## Quick Start

### Cloud (Fastest)

Sign up at [app.trypillar.com](https://app.trypillar.com), create a product, and grab your **Product Key**.

Install the SDK:

```bash
npm install @pillar-ai/react
```

Add the provider and define your first action:

```tsx
import { PillarProvider } from '@pillar-ai/react';

const actions = {
  go_to_settings: {
    type: 'navigate' as const,
    label: 'Open Settings',
    description: 'Navigate to settings page',
  },
  export_to_csv: {
    type: 'trigger' as const,
    label: 'Export to CSV',
    description: 'Export current data to CSV file',
  },
};

function App() {
  return (
    <PillarProvider
      productKey="your-product-key"
      actions={actions}
      onTask={(actionName, data) => {
        if (actionName === 'go_to_settings') {
          router.push('/settings');
        }
        if (actionName === 'export_to_csv') {
          downloadCSV();
        }
      }}
    >
      <YourApp />
    </PillarProvider>
  );
}
```

That's it. Users can now ask the co-pilot to navigate to settings or export data, and it executes using your code.

### Self-Hosted

```bash
git clone https://github.com/pillarhq/pillar.git
cd pillar
cp .env.example .env
# Edit .env with your API keys
docker compose up
```

The API runs on port 8000, the admin dashboard on port 3000. See [Self-Hosting](#self-hosting) for details.

---

## Feature Overview

| Feature | Description |
|---------|-------------|
| [**Actions**](#actions) | Navigate, pre-fill, trigger — the assistant executes, not just explains |
| [**Knowledge Base**](#knowledge-base) | Ingest from websites, Zendesk, Intercom, files, YouTube, and more |
| [**AI Chat**](#ai-chat) | Context-aware responses grounded in your documentation |
| [**Custom Cards**](#custom-cards) | Render interactive UI for confirmations and data input inline in chat |
| [**MCP Server**](#mcp-server) | Let Claude, ChatGPT, and AI tools access your product info |
| [**Admin Dashboard**](#admin-dashboard) | Manage sources, review analytics, configure behavior |

---

## Actions

Actions are Pillar's core differentiator. Instead of telling users *how* to do something, Pillar *does it for them*.

Define what your co-pilot can do, and Pillar matches user intent to actions:

```tsx
const actions = {
  // Navigation — the co-pilot navigates the user
  go_to_billing: {
    type: 'navigate' as const,
    label: 'Open Billing',
    description: 'Navigate to billing and subscription settings',
  },

  // Trigger — the co-pilot runs your code
  export_report: {
    type: 'trigger' as const,
    label: 'Export Report',
    description: 'Export the current report to PDF or CSV',
  },

  // With data extraction — AI pulls parameters from conversation
  invite_team_member: {
    type: 'trigger' as const,
    label: 'Invite Team Member',
    description: 'Send an invitation to join the team',
    dataSchema: {
      email: { type: 'string' as const, required: true },
      role: { type: 'string' as const, enum: ['admin', 'member', 'viewer'] },
    },
  },
};
```

Handle execution in your existing code:

```tsx
<PillarProvider
  productKey="your-product-key"
  actions={actions}
  onTask={(actionName, data) => {
    if (actionName === 'invite_team_member') {
      sendInvite(data.email, data.role);
    }
  }}
>
```

Actions run client-side with the user's session. They call your APIs with the user's existing auth. You control what's possible — Pillar orchestrates.

For production, define actions in code and sync them via the `pillar-sync` CLI during CI/CD. See [Setting Up Actions](https://trypillar.com/docs/guides/actions) in the docs.

---

## Knowledge Base

Connect your existing content and Pillar keeps it in sync. The RAG pipeline handles chunking, embedding, and retrieval so the co-pilot's answers are grounded in your actual documentation.

**Supported sources:**

- **Websites** — Crawl your docs, help center, or marketing site
- **Zendesk** — Articles and help center content
- **Intercom** — Articles and conversation data
- **YouTube** — Video transcripts
- **Files** — PDF, Word, Markdown, plain text
- **Cloud storage** — S3 and Google Cloud Storage
- **Snippets** — Custom text for corrections, FAQs, and AI instructions

Sources sync automatically on a schedule you configure. Add new sources from the admin dashboard or API.

Learn more in the [Knowledge Base docs](https://trypillar.com/docs/knowledge-base/overview).

---

## AI Chat

The co-pilot provides streaming, context-aware responses grounded in your knowledge base. It knows the user's current page, selected text, and application state.

**Key capabilities:**

- **Streaming responses** with source citations
- **Suggested questions** based on the current page
- **Conversation persistence** across sessions
- **Feedback collection** (thumbs up/down) for continuous improvement
- **Human escalation** — hand off to Intercom, Zendesk, Freshdesk, or a custom support form

```tsx
// The co-pilot is context-aware — tell it where the user is
const { pillar } = usePillar();

pillar.setContext({
  currentPage: '/dashboard/analytics',
  userRole: 'admin',
  planTier: 'pro',
});
```

---

## Custom Cards

Render interactive UI components inline in the chat for confirmations, data input, and rich displays:

```tsx
import type { CardComponentProps } from '@pillar-ai/react';

function InviteCard({ data, onConfirm, onCancel }: CardComponentProps<{ email: string; role: string }>) {
  return (
    <div className="card">
      <p>Invite {data.email} as {data.role}?</p>
      <button onClick={() => onConfirm()}>Send Invite</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

<PillarProvider
  productKey="your-product-key"
  cards={{ invite_team_member: InviteCard }}
>
```

Cards use your existing design system and component library. No iframes, no styling conflicts.

---

## MCP Server

Pillar includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) server. This lets AI tools like Claude, ChatGPT, Cursor, and others query your product's knowledge base directly.

Your documentation and help content become accessible to any MCP-compatible client — no extra integration work.

---

## Admin Dashboard

The admin dashboard gives you full control over your Pillar deployment:

- **Sources** — Add, configure, and monitor knowledge base sources
- **Analytics** — Track usage, popular questions, resolution rates
- **Agent configuration** — Customize AI behavior, tone, and guidance
- **Theming** — Match the co-pilot to your brand colors and style

---

## SDKs

All SDK packages are [MIT-licensed](packages/sdk/LICENSE) — embed freely in proprietary applications.

### React

```bash
npm install @pillar-ai/react
```

```tsx
import { PillarProvider, usePillar, useHelpPanel } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider
      productKey="your-product-key"
      actions={actions}
      onTask={(actionName, data) => { /* handle actions */ }}
      config={{
        panel: { position: 'right', mode: 'push' },
        theme: { mode: 'auto' },
      }}
    >
      <YourApp />
    </PillarProvider>
  );
}

function HelpButton() {
  const { toggle, isOpen } = useHelpPanel();
  return <button onClick={toggle}>{isOpen ? 'Close' : 'Help'}</button>;
}
```

Works with Next.js App Router, Pages Router, and any React setup. See the [React Guide](https://trypillar.com/docs/react/installation).

### Vue

```bash
npm install @pillar-ai/vue
```

```vue
<script setup lang="ts">
import { PillarProvider, usePillar } from '@pillar-ai/vue';

const { toggle, isOpen } = usePillar();
</script>

<template>
  <PillarProvider
    product-key="your-product-key"
    :actions="actions"
    :on-task="handleTask"
  >
    <YourApp />
  </PillarProvider>
</template>
```

Works with Vue 3 and Nuxt 3. See the [Vue Guide](https://trypillar.com/docs/vue/installation).

### Angular

```bash
npm install @pillar-ai/angular
```

```typescript
// app.config.ts
import { APP_INITIALIZER, inject } from '@angular/core';
import { PillarService } from '@pillar-ai/angular';

function initPillar() {
  const pillar = inject(PillarService);
  return () => pillar.init({ productKey: 'your-product-key' });
}

export const appConfig = {
  providers: [
    { provide: APP_INITIALIZER, useFactory: initPillar, multi: true },
  ],
};
```

```typescript
// component
import { injectPillar } from '@pillar-ai/angular';

export class HelpButtonComponent {
  private pillar = injectPillar();
  isPanelOpen = this.pillar.isPanelOpen;
  toggle = this.pillar.toggle;
}
```

Works with Angular 17+. See the [Angular Guide](https://trypillar.com/docs/angular/installation).

### Vanilla JavaScript

```bash
npm install @pillar-ai/sdk
```

```javascript
import { Pillar } from '@pillar-ai/sdk';

const pillar = await Pillar.init({
  productKey: 'your-product-key',
});

pillar.onTask('go_to_settings', (data) => {
  router.push('/settings');
});

pillar.onTask('export_to_csv', async (data) => {
  await downloadCSV();
});

pillar.open();
```

Or load via CDN:

```html
<script src="https://cdn.trypillar.com/sdk.js"></script>
<script>
  Pillar.init({ productKey: 'your-product-key' });
</script>
```

See the [Vanilla JS Guide](https://trypillar.com/docs/quickstarts/vanilla).

---

## Architecture

```
backend/          Django API, RAG pipeline, MCP server, Hatchet workflows
frontend/         Next.js admin dashboard
packages/
  sdk/            Core JavaScript SDK (MIT)
  sdk-react/      React bindings (MIT)
  sdk-vue/        Vue bindings (MIT)
  sdk-angular/    Angular bindings (MIT)
  pillar-ui/      Embeddable UI components (MIT)
```

**Stack:** Django + DRF, PostgreSQL + pgvector, Redis, Hatchet (workflow orchestration), Next.js, TypeScript

---

## Self-Hosting

### Prerequisites

- Docker and Docker Compose
- At least one AI provider API key (OpenAI, Anthropic, or Google)
- A [Hatchet](https://hatchet.run) instance (cloud or self-hosted) for background workflows

### Setup

```bash
git clone https://github.com/pillarhq/pillar.git
cd pillar
cp .env.example .env
# Edit .env with your API keys and configuration
docker compose up
```

The API runs on port 8000 and the admin dashboard on port 3000.

See `.env.example` for all configuration options. Required external services:

- **Hatchet** for workflow orchestration (background jobs, sync pipelines)
- **At least one AI provider** (OpenAI, Anthropic, or Google API key)
- **Firecrawl** for web crawling sources (API key or self-hosted)

### Local Development

```bash
# Start Postgres and Redis
docker compose up -d db redis

# Backend
cd backend
cp .env.example .env.local
uv sync
uv run python manage.py migrate
uv run python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Open Source vs Cloud

| | Open Source | Cloud |
|---|---|---|
| **Deployment** | Self-hosted | Managed at [pillar.to](https://pillar.to) |
| **Infrastructure** | You manage | We manage |
| **Updates** | Manual | Automatic |
| **License** | AGPL-3.0 | Usage-based pricing |
| **Support** | Community | Priority support |
| **Features** | Full platform | Full platform + managed infra |

The hosted version at [pillar.to](https://pillar.to) is the easiest way to get started. No infrastructure to manage, always up to date.

For enterprises that need to self-host without AGPL obligations, commercial licenses are available. Contact [enterprise@pillar.to](mailto:enterprise@pillar.to).

---

## Resources

- [Documentation](https://trypillar.com/docs)
- [API Reference](https://trypillar.com/docs/reference/core)
- [Blog](https://pillar.to/blog)
- [GitHub Discussions](https://github.com/pillarhq/pillar/discussions)

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

---

## License

This project uses a dual license model:

- **AGPL-3.0** for the core product (backend + frontend). If you modify Pillar and run it as a service, you must release your modifications under AGPL-3.0. Using Pillar's API from your application does not trigger this obligation.
- **MIT** for SDK packages in `packages/`. You can freely embed these in your proprietary applications.

See [LICENSE](LICENSE) for the full AGPL-3.0 text and [NOTICE](NOTICE) for third-party attributions.

---

**Responsible use:** Users are responsible for respecting websites' policies when using Pillar's crawling features. Pillar respects robots.txt by default.
