# @pillar-ai/react

React bindings for Pillar — Cursor for your product.

[![npm version](https://img.shields.io/npm/v/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![npm downloads](https://img.shields.io/npm/dm/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

## What is Pillar?

Pillar is an embedded AI co-pilot that helps users complete tasks, not just answer questions. Users say what they want, and Pillar uses your UI to make it happen — navigating pages, pre-filling forms, and calling your APIs.

## Features

- **Task Execution** — Navigate pages, pre-fill forms, call APIs on behalf of users
- **React Hooks** — `usePillar` and `useHelpPanel` for idiomatic React integration
- **Next.js Support** — Works with App Router and Pages Router
- **Multi-Step Plans** — Chain actions into workflows for complex tasks
- **Type-Safe Actions** — Full TypeScript support for action definitions
- **Custom Action Cards** — Render React components for confirmations and data input

## Documentation

**[View Full Documentation](https://trypillar.com/docs)** | [React Guide](https://trypillar.com/docs/react/installation) | [API Reference](https://trypillar.com/docs/reference/react)

## Installation

```bash
npm install @pillar-ai/react
# or
pnpm add @pillar-ai/react
# or
yarn add @pillar-ai/react
```

## Quick Start

### 1. Get Your Product Key

> **⚠️ Beta Onboarding:** Cloud access is currently manual while we learn from early teams. Join the waitlist at [trypillar.com](https://trypillar.com), and we will reach out to onboard you.
>
> By default, you'll get an engineer from Pillar to help with setup. If you prefer onboarding without engineering support, include that in your waitlist request and we will support that too.

### 2. Add the Provider

Wrap your app with `PillarProvider` and define actions:

```tsx
import { PillarProvider } from '@pillar-ai/react';

const actions = {
  export_to_csv: {
    type: 'trigger' as const,
    label: 'Export to CSV',
    description: 'Export current data to CSV file',
  },
  go_to_settings: {
    type: 'navigate' as const,
    label: 'Open Settings',
    description: 'Navigate to settings page',
    path: '/settings',
  },
};

function App() {
  return (
    <PillarProvider
      productKey="your-product-key"
      actions={actions}
      onTask={(actionName, data) => {
        if (actionName === 'export_to_csv') {
          downloadCSV();
        }
      }}
    >
      <MyApp />
    </PillarProvider>
  );
}
```

### Next.js App Router

For Next.js App Router, create a client wrapper component:

```tsx
// providers/PillarClientProvider.tsx
'use client';

import { PillarProvider } from '@pillar-ai/react';
import { useRouter } from 'next/navigation';

const actions = {
  go_to_settings: {
    type: 'navigate' as const,
    label: 'Open Settings',
    description: 'Navigate to settings page',
  },
};

export function PillarClientProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <PillarProvider
      productKey="your-product-key"
      actions={actions}
      onTask={(actionName, data) => {
        if (actionName === 'go_to_settings') {
          router.push('/settings');
        }
      }}
    >
      {children}
    </PillarProvider>
  );
}
```

```tsx
// app/layout.tsx
import { PillarClientProvider } from '@/providers/PillarClientProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PillarClientProvider>{children}</PillarClientProvider>
      </body>
    </html>
  );
}
```

## Defining Actions

Actions define what your co-pilot can do. When users make requests, Pillar matches intent to actions:

```tsx
import type { ActionDefinitions } from '@pillar-ai/react';

const actions = {
  // Navigation actions
  go_to_billing: {
    type: 'navigate' as const,
    label: 'Open Billing',
    description: 'Navigate to billing and subscription settings',
  },

  // Trigger actions that execute code
  export_report: {
    type: 'trigger' as const,
    label: 'Export Report',
    description: 'Export the current report to PDF or CSV',
  },

  // Actions with data schemas (AI extracts parameters)
  invite_team_member: {
    type: 'trigger' as const,
    label: 'Invite Team Member',
    description: 'Send an invitation to join the team',
    dataSchema: {
      email: { type: 'string' as const, required: true },
      role: { type: 'string' as const, enum: ['admin', 'member', 'viewer'] },
    },
  },
} satisfies ActionDefinitions;
```

## Hooks

### usePillar

Access the SDK instance and state:

```tsx
import { usePillar } from '@pillar-ai/react';

function MyComponent() {
  const { isReady, isOpen, pillar } = usePillar();

  if (!isReady) return <div>Loading...</div>;

  return <div>Co-pilot is {isOpen ? 'open' : 'closed'}</div>;
}
```

### useHelpPanel

Control the co-pilot panel:

```tsx
import { useHelpPanel } from '@pillar-ai/react';

function CopilotButton() {
  const { open, close, toggle, isOpen } = useHelpPanel();

  return (
    <button onClick={toggle}>
      {isOpen ? 'Close Co-pilot' : 'Open Co-pilot'}
    </button>
  );
}
```

## Components

### PillarProvider

The root provider that initializes the SDK:

```tsx
<PillarProvider
  productKey="your-product-key"
  actions={actions}
  onTask={(actionName, data) => { /* handle actions */ }}
  config={{
    panel: { position: 'right', mode: 'push' },
    edgeTrigger: { enabled: true },
    theme: { mode: 'auto' },
  }}
>
  {children}
</PillarProvider>
```

### PillarPanel

For custom panel placement:

```tsx
import { PillarProvider, PillarPanel } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider
      productKey="your-product-key"
      config={{ panel: { container: 'manual' } }}
    >
      <div className="layout">
        <main>Your content</main>
        <PillarPanel className="sidebar-panel" />
      </div>
    </PillarProvider>
  );
}
```

### Tooltip

Attach contextual tooltips to elements:

```tsx
import { Tooltip } from '@pillar-ai/react';

<Tooltip tooltipId="export-help">
  <button>Export Data</button>
</Tooltip>
```

## Custom Action Cards

Render custom UI for inline actions:

```tsx
import { PillarProvider } from '@pillar-ai/react';
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
  cards={{
    invite_team_member: InviteCard,
  }}
>
  {children}
</PillarProvider>
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@pillar-ai/sdk](https://github.com/pillarhq/sdk) | Core vanilla JavaScript SDK |
| [@pillar-ai/vue](https://github.com/pillarhq/sdk-vue) | Vue 3 bindings |
| [@pillar-ai/svelte](https://github.com/pillarhq/sdk-svelte) | Svelte bindings |

## Requirements

- React 17.0.0 or higher
- React DOM 17.0.0 or higher

## License

MIT
