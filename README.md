<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pillarhq/pillar/main/.github/img/logo-light.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/pillarhq/pillar/main/.github/img/logo-dark.svg" />
    <img alt="Pillar" src="https://raw.githubusercontent.com/pillarhq/pillar/main/.github/img/logo-dark.svg" width="200" />
  </picture>
</p>

<p align="center">
  <a href="https://trypillar.com"><strong>Pillar is an open-source AI copilot SDK for SaaS — a product assistant that executes tasks, not just answers questions</strong></a>
</p>

<p align="center">
  <a href="https://github.com/pillarhq/pillar/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@pillar-ai/sdk"><img src="https://img.shields.io/npm/v/@pillar-ai/sdk" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@pillar-ai/sdk"><img src="https://img.shields.io/npm/dm/@pillar-ai/sdk" alt="npm downloads" /></a>
  <a href="https://discord.gg/uhVFmGMW"><img src="https://img.shields.io/discord/1470491094847324538?logo=discord&label=Discord" alt="Discord" /></a>
</p>

<p align="center">
  <a href="https://trypillar.com/docs">Docs</a> ·
  <a href="https://trypillar.com/blog">Blog</a> ·
  <a href="https://trypillar.com">Website</a> ·
  <a href="https://discord.gg/uhVFmGMW">Discord</a> ·
  <a href="https://x.com/trypillar_ai">Twitter</a>
</p>

---

> **⚠️ Beta Notice:** Pillar is in active development. APIs may change, features may break, and documentation may be out of date. We're iterating fast — if you run into issues, please [open an issue](https://github.com/pillarhq/pillar/issues) or reach out on [Discord](https://discord.gg/uhVFmGMW).

# Pillar

**The open-source product copilot. Build AI agents into your app that execute tasks, not just answer questions.**

[Pillar](https://trypillar.com) is an embeddable AI co-pilot SDK. Users say what they want, and Pillar uses your UI to make it happen — navigating pages, pre-filling forms, and calling your APIs. It runs client-side with the user's session, so there's no proxy servers or token forwarding.

Pillar works across SaaS and web apps. A user could ask:

> "Close the Walmart deal as won in Salesforce and notify implementation"

> "Add a weekly signups chart to my Amplitude dashboard"

> "Create a P1 bug in Linear for the checkout crash and add it to this sprint"

> "How do I change my direct deposit in Rippling?"

Pillar understands the intent, builds a multi-step plan, and executes it using your UI — the same way the user would, but hands-free.

*This repository contains the Pillar platform: backend API and admin dashboard. SDK packages are maintained separately — see [`sdk`](https://github.com/pillarhq/sdk), [`sdk-react`](https://github.com/pillarhq/sdk-react), and [`sdk-vue`](https://github.com/pillarhq/sdk-vue).*

---

## Why Pillar?

- **One install, fully yours**: `npm install` and go. Define actions, customize UI and behavior — all in your own code. No black boxes.
- **Actions, not just answers**: Navigate pages, pre-fill forms, call APIs. The assistant does things on behalf of users, not just explains how.
- **Client-side execution**: Runs in the user's browser with their session. Same auth, no proxy servers, no token forwarding.
- **Managed knowledge**: Crawls your docs and integrates with your content sources — websites, files, cloud storage, and snippets. RAG that stays fresh automatically.
- **MCP server included**: Claude, ChatGPT, and other AI tools can query your product's knowledge base out of the box.
- **Multi-framework SDKs**: React, Vue, Angular, and vanilla JS. All MIT-licensed, embed freely in proprietary apps.

---

## Quick Start

### Cloud (Fastest)

> **⚠️ Beta Onboarding:** Cloud access is currently manual while we learn from early teams. Join the waitlist at [trypillar.com](https://trypillar.com), and we will reach out to onboard you.
>
> By default, you'll get an engineer from Pillar to help with setup. If you prefer onboarding without engineering support, include that in your waitlist request and we will support that too.

Once your product is onboarded and you have your **Product Key**, install the SDK:

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
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
docker compose up
```

The API runs on port 8000, the admin dashboard on port 3000. See [Self-Hosting](#self-hosting) for configuration details.

---

## Features

| Feature | Description | |
|---------|-------------|-|
| **Actions** | Navigate pages, pre-fill forms, call APIs — the assistant executes, not just explains | [Docs](https://trypillar.com/docs/features/actions) |
| **Knowledge Base** | Ingest from websites, files, cloud storage (S3/GCS), and snippets | [Docs](https://trypillar.com/docs/knowledge-base/overview) |
| **AI Chat** | Streaming, context-aware responses grounded in your documentation | [Docs](https://trypillar.com/docs/features/chat) |
| **Custom Cards** | Render interactive UI for confirmations and data input inline in chat | [Docs](https://trypillar.com/docs/features/custom-cards) |
| **Human Escalation** | Hand off to Intercom, Zendesk, Freshdesk, or a custom support flow | [Docs](https://trypillar.com/docs/features/human-escalation) |
| **MCP Server** | Let Claude, ChatGPT, Cursor, and other AI tools query your knowledge base | |
| **Admin Dashboard** | Manage sources, review analytics, configure agent behavior and theming | |

Explore all features in the [documentation](https://trypillar.com/docs/overview/introduction).

---

## SDKs

All SDK packages are MIT-licensed — embed freely in proprietary applications. Source code lives in standalone repos under [github.com/pillarhq](https://github.com/pillarhq).

| Framework | Package | Install | Guide |
|-----------|---------|---------|-------|
| React | `@pillar-ai/react` | `npm install @pillar-ai/react` | [React Quickstart](https://trypillar.com/docs/quickstarts/react) |
| Vue | `@pillar-ai/vue` | `npm install @pillar-ai/vue` | Coming soon |
| Angular | `@pillar-ai/angular` | `npm install @pillar-ai/angular` | Coming soon |
| Vanilla JS | `@pillar-ai/sdk` | `npm install @pillar-ai/sdk` | [Vanilla JS Quickstart](https://trypillar.com/docs/quickstarts/vanilla) |

Or load via CDN with no build step:

```html
<script src="https://cdn.trypillar.com/sdk.js"></script>
<script>
  Pillar.init({ productKey: 'your-product-key' });
</script>
```

See the [React API Reference](https://trypillar.com/docs/reference/react) and [Core SDK Reference](https://trypillar.com/docs/reference/core) for full API docs.

---

## Architecture

```
backend/          Django API, RAG pipeline, MCP server, Hatchet workflows
frontend/         Next.js admin dashboard
```

SDKs are maintained in separate repos: [`sdk`](https://github.com/pillarhq/sdk), [`sdk-react`](https://github.com/pillarhq/sdk-react), [`sdk-vue`](https://github.com/pillarhq/sdk-vue).

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
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys and configuration
docker compose up
```

The API runs on port 8000 and the admin dashboard on port 3000. See `backend/.env.example` for all configuration options.

For local development setup, see the [Contributing Guide](.github/CONTRIBUTING.md).

---

## Open Source vs Cloud

| | Open Source | Cloud |
|---|---|---|
| **Deployment** | Self-hosted | Managed at [trypillar.com](https://trypillar.com) |
| **Infrastructure** | You manage | We manage |
| **Updates** | Manual | Automatic |
| **License** | AGPL-3.0 | Usage-based pricing |
| **Support** | Community | Priority support |
| **Features** | Full platform | Full platform + managed infra |

The hosted version at [trypillar.com](https://trypillar.com) is the easiest way to get started. No infrastructure to manage, always up to date.

For enterprises that need to self-host without AGPL obligations, commercial licenses are available. Contact [support@trypillar.com](mailto:support@trypillar.com).

---

## Resources

- [Documentation](https://trypillar.com/docs)
- [Guides](https://trypillar.com/docs/guides)
- [API Reference](https://trypillar.com/docs/reference/core)
- [Blog](https://trypillar.com/blog)
- [Discord](https://discord.gg/uhVFmGMW)
- [GitHub Discussions](https://github.com/pillarhq/pillar/discussions)

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](.github/CONTRIBUTING.md) before submitting a pull request.

---

## License

This project uses a dual license model:

- **AGPL-3.0** for the core product (backend + frontend). If you modify Pillar and run it as a service, you must release your modifications under AGPL-3.0. Using Pillar's API from your application does not trigger this obligation.
- **MIT** for SDK packages in `packages/`. You can freely embed these in your proprietary applications.

See [LICENSE](LICENSE) for the full AGPL-3.0 text. Third-party dependency details are in `backend/pyproject.toml` and `frontend/package.json`.

---

**Responsible use:** Users are responsible for respecting websites' policies when using Pillar's crawling features. Pillar respects robots.txt by default.
