# @pillar-ai/angular

Angular bindings for [Pillar](https://trypillar.com) Embedded Help SDK.

Add contextual AI help and documentation to your Angular application with just a few lines of code.

## Requirements

- Angular 17.0.0 or higher
- `@pillar-ai/sdk` (installed automatically as a dependency)

## Installation

```bash
npm install @pillar-ai/angular
```

## Quick Start

### 1. Initialize Pillar in your app config

```typescript
// app.config.ts
import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { PillarService } from '@pillar-ai/angular';

function initPillar() {
  const pillar = inject(PillarService);
  return () => pillar.init({ productKey: 'your-product-key' });
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_INITIALIZER, useFactory: initPillar, multi: true },
  ],
};
```

### 2. Use Pillar in your components

```typescript
// help-button.component.ts
import { Component } from '@angular/core';
import { injectPillar } from '@pillar-ai/angular';

@Component({
  selector: 'app-help-button',
  standalone: true,
  template: `
    <button (click)="toggle()">
      {{ isPanelOpen() ? 'Close Help' : 'Get Help' }}
    </button>
  `,
})
export class HelpButtonComponent {
  private pillar = injectPillar();
  isPanelOpen = this.pillar.isPanelOpen;
  toggle = this.pillar.toggle;
}
```

## API Reference

### PillarService

Injectable service that manages the Pillar SDK lifecycle.

```typescript
import { PillarService } from '@pillar-ai/angular';

@Component({...})
export class MyComponent {
  constructor(private pillarService: PillarService) {}
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize the SDK with your product key |
| `open(options?)` | Open the help panel |
| `close()` | Close the help panel |
| `toggle()` | Toggle the help panel |
| `openArticle(slug)` | Open a specific article |
| `openCategory(slug)` | Navigate to a category |
| `search(query)` | Open search with a query |
| `navigate(view, params?)` | Navigate to a specific view |
| `setTheme(theme)` | Update the panel theme |
| `setTextSelectionEnabled(enabled)` | Toggle text selection popover |
| `on(event, callback)` | Subscribe to SDK events |
| `onTask(taskName, handler)` | Register a task handler |

#### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `state` | `WritableSignal<PillarState>` | Current SDK state |
| `isReady` | `Signal<boolean>` | Whether SDK is ready |
| `isPanelOpen` | `WritableSignal<boolean>` | Whether panel is open |

### injectPillar()

Angular injection function for accessing the Pillar SDK with full functionality.

```typescript
import { injectPillar } from '@pillar-ai/angular';

@Component({...})
export class MyComponent {
  private pillar = injectPillar();

  handleHelp() {
    this.pillar.open({ view: 'chat' });
  }
}
```

### injectHelpPanel()

Simplified injection function focused on panel controls.

```typescript
import { injectHelpPanel } from '@pillar-ai/angular';

@Component({...})
export class HelpMenuComponent {
  private panel = injectHelpPanel();

  isOpen = this.panel.isOpen;
  toggle = this.panel.toggle;
  openChat = this.panel.openChat;
}
```

### PillarPanelComponent

Standalone component for custom panel placement.

```typescript
import { PillarPanelComponent } from '@pillar-ai/angular';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [PillarPanelComponent],
  template: `
    <div class="layout">
      <pillar-panel class="help-panel" />
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class LayoutComponent {}
```

**Important**: When using `PillarPanelComponent`, set `panel.container: 'manual'` in your config:

```typescript
pillar.init({
  productKey: 'your-product-key',
  config: { panel: { container: 'manual' } }
});
```

## Advanced Usage

### Type-Safe Task Handlers

Define your actions and get full TypeScript support:

```typescript
// lib/pillar/actions.ts
import { defineActions } from '@pillar-ai/sdk';

export const actions = defineActions({
  invite_member: {
    description: 'Invite a team member',
    data: {
      email: { type: 'string', description: 'Email address' },
      role: { type: 'string', description: 'Member role' },
    },
  },
});
```

```typescript
// my.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { injectPillar } from '@pillar-ai/angular';
import { actions } from './lib/pillar/actions';

@Component({...})
export class MyComponent implements OnInit, OnDestroy {
  private pillar = injectPillar<typeof actions>();
  private unsubscribe?: () => void;

  ngOnInit() {
    // TypeScript knows the exact shape of data
    this.unsubscribe = this.pillar.onTask('invite_member', (data) => {
      console.log(data.email); // ✓ Typed as string
      console.log(data.role);  // ✓ Typed as string
    });
  }

  ngOnDestroy() {
    this.unsubscribe?.();
  }
}
```

### Custom Card Components

Render custom Angular components for inline UI actions:

```typescript
// invite-card.component.ts
import { Component, input } from '@angular/core';
import type { CardComponentProps } from '@pillar-ai/angular';

@Component({
  selector: 'app-invite-card',
  standalone: true,
  template: `
    <div class="invite-card">
      <h3>Invite Team Members</h3>
      <input [(ngModel)]="email" placeholder="Email address" />
      <button (click)="confirm()">Send Invite</button>
      <button (click)="cancel()">Cancel</button>
    </div>
  `,
})
export class InviteCardComponent implements CardComponentProps {
  data = input.required<Record<string, unknown>>();
  onConfirm = input.required<(data?: Record<string, unknown>) => void>();
  onCancel = input.required<() => void>();
  onStateChange = input<(state: 'loading' | 'success' | 'error', message?: string) => void>();

  email = '';

  confirm() {
    this.onConfirm()({ email: this.email });
  }

  cancel() {
    this.onCancel()();
  }
}
```

```typescript
// app.config.ts
pillar.init({
  productKey: 'your-product-key',
  cards: {
    invite_member: InviteCardComponent,
  },
});
```

### Theme Synchronization

Sync Pillar's theme with your app's dark mode:

```typescript
@Component({...})
export class ThemeToggleComponent {
  private pillar = injectPillar();

  toggleDarkMode(isDark: boolean) {
    this.pillar.setTheme({ mode: isDark ? 'dark' : 'light' });
  }
}
```

### Subscribe to Events

```typescript
@Component({...})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private pillar = injectPillar();
  private unsubscribes: (() => void)[] = [];

  ngOnInit() {
    this.unsubscribes.push(
      this.pillar.on('panel:open', () => {
        analytics.track('help_panel_opened');
      }),
      this.pillar.on('task:execute', (task) => {
        analytics.track('task_executed', { name: task.name });
      })
    );
  }

  ngOnDestroy() {
    this.unsubscribes.forEach(unsub => unsub());
  }
}
```

## Configuration Options

```typescript
interface PillarInitConfig {
  /** Your product key from app.trypillar.com */
  productKey: string;

  /** Additional SDK configuration */
  config?: {
    panel?: {
      /** Panel placement: 'auto' | 'manual' */
      container?: string;
      /** Use Shadow DOM for style isolation */
      useShadowDOM?: boolean;
    };
    theme?: {
      /** Theme mode: 'light' | 'dark' | 'auto' */
      mode?: string;
      /** Custom colors */
      colors?: {
        primary?: string;
        // ... other color options
      };
    };
    // ... other options
  };

  /** Global task handler */
  onTask?: (task: TaskExecutePayload) => void;

  /** Custom card components */
  cards?: Record<string, Type<any>>;
}
```

## License

MIT
