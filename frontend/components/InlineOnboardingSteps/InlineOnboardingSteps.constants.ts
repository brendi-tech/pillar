import type { FrameworkId, Step } from "./InlineOnboardingSteps.types";

import installProviderExample from "@/examples/onboarding/install-provider.tsx.txt";

export const STEPS: Step[] = [
  {
    id: 1,
    title: "Create Your Product",
    description: "Choose a unique product key to identify your copilot.",
  },
  {
    id: 2,
    title: "Install the SDK",
    description: "Add the Pillar packages and wrap your app with the provider.",
  },
  {
    id: 3,
    title: "Create a Tool",
    description: "Define tools the AI assistant can use in your app.",
  },
  {
    id: 4,
    title: "Sync",
    description: "Deploy your actions to Pillar via the CLI.",
  },
  {
    id: 5,
    title: "Add Knowledge",
    description:
      "Crawl your website to give the AI context about your product.",
    optional: true,
  },
];

export const FRAMEWORKS = [
  { id: "react", name: "React" },
  { id: "vue", name: "Vue" },
  { id: "angular", name: "Angular" },
  { id: "vanilla", name: "Vanilla JS" },
] as const;

export const INSTALL_COMMANDS: Record<FrameworkId, string> = {
  react: "npm install @pillar-ai/react",
  vue: "npm install @pillar-ai/vue",
  angular: "npm install @pillar-ai/angular",
  vanilla: "npm install @pillar-ai/sdk",
};

export const getProviderCode = (
  productKey: string
): Record<
  FrameworkId,
  { code: string; language: string; filePath?: string }
> => ({
  react: {
    code: installProviderExample.replace("your-product-key", productKey),
    language: "tsx",
    filePath: "app/layout.tsx",
  },
  vue: {
    code: `<script setup lang="ts">
import { PillarProvider } from '@pillar-ai/vue';
</script>

<template>
  <PillarProvider product-key="${productKey}">
    <YourApp />
  </PillarProvider>
</template>`,
    language: "vue",
    filePath: "App.vue",
  },
  angular: {
    code: `// app.config.ts
import { ApplicationConfig, provideAppInitializer, inject } from '@angular/core';
import { PillarService } from '@pillar-ai/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      const pillar = inject(PillarService);
      return pillar.init({ productKey: '${productKey}' });
    }),
  ],
};`,
    language: "typescript",
    filePath: "app.config.ts",
  },
  vanilla: {
    code: `import { Pillar } from '@pillar-ai/sdk';

const pillar = await Pillar.init({
  productKey: '${productKey}',
});`,
    language: "javascript",
    filePath: "main.js",
  },
});

export const PROVIDER_LABELS: Record<FrameworkId, string> = {
  react: "Wrap your app with PillarProvider",
  vue: "Wrap your app with PillarProvider",
  angular: "Initialize Pillar in your app config",
  vanilla: "Initialize the SDK",
};

export const DOCS_URLS: Record<FrameworkId, string> = {
  react: "https://trypillar.com/docs/get-started/quickstart",
  vue: "https://trypillar.com/docs/get-started/quickstart",
  angular: "https://trypillar.com/docs/get-started/quickstart",
  vanilla: "https://trypillar.com/docs/get-started/quickstart",
};

export const TOOL_EXAMPLES: Record<
  FrameworkId,
  { code: string; language: string; filePath?: string }
> = {
  react: {
    code: `import { usePillarTool } from '@pillar-ai/react';
import { useRouter } from 'next/navigation';

export function usePillarTools() {
  const router = useRouter();

  usePillarTool({
    name: 'open_settings',
    type: 'navigate', // navigate | trigger_tool | query | external_link | copy_text
                      // Full reference: https://trypillar.com/docs/guides/tools
    description: 'Navigate to the settings page',
    examples: ['open settings', 'go to settings'],
    autoRun: true,
    execute: () => router.push('/settings'),
  });
}

// Call usePillarTools() inside PillarProvider (e.g. in app/layout.tsx)`,
    language: "typescript",
    filePath: "hooks/usePillarTools.ts",
  },
  vue: {
    code: `<script setup lang="ts">
import { usePillarTool } from '@pillar-ai/vue';
import { useRouter } from 'vue-router';

const router = useRouter();

usePillarTool({
  name: 'open_settings',
  type: 'navigate', // navigate | trigger_tool | query | external_link | copy_text
                    // Full reference: https://trypillar.com/docs/guides/tools
  description: 'Navigate to the settings page',
  examples: ['open settings', 'go to settings'],
  autoRun: true,
  execute: () => router.push('/settings'),
});
</script>

<template>
  <!-- Your component template -->
</template>`,
    language: "vue",
    filePath: "composables/usePillarTools.vue",
  },
  angular: {
    code: `import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { injectPillarTool } from '@pillar-ai/angular';

@Component({
  selector: 'app-pillar-tools',
  standalone: true,
  template: '',
})
export class PillarToolsComponent {
  constructor(private router: Router) {
    injectPillarTool({
      name: 'open_settings',
      type: 'navigate', // navigate | trigger_tool | query | external_link | copy_text
                        // Full reference: https://trypillar.com/docs/guides/tools
      description: 'Navigate to the settings page',
      examples: ['open settings', 'go to settings'],
      autoRun: true,
      execute: () => this.router.navigate(['/settings']),
    });
  }
}

// Add PillarToolsComponent to your app module or include it in your layout`,
    language: "typescript",
    filePath: "pillar-tools.component.ts",
  },
  vanilla: {
    code: `import { Pillar } from '@pillar-ai/sdk';

// After initializing Pillar
const pillar = Pillar.getInstance();

pillar.defineTool({
  name: 'open_settings',
  type: 'navigate', // navigate | trigger_tool | query | external_link | copy_text
                    // Full reference: https://trypillar.com/docs/guides/tools
  description: 'Navigate to the settings page',
  examples: ['open settings', 'go to settings'],
  autoRun: true,
  execute: () => {
    window.location.href = '/settings';
  },
});`,
    language: "javascript",
    filePath: "pillar-tools.js",
  },
};

export const AI_PROMPT_TITLES: Record<FrameworkId, string> = {
  react: "Build React tools for my app",
  vue: "Build Vue tools for my app",
  angular: "Build Angular tools for my app",
  vanilla: "Build Vanilla JS tools for my app",
};

export const AI_PROMPT_SOURCES: Record<FrameworkId, string> = {
  react: "build-tools-react.md",
  vue: "build-tools-vue.md",
  angular: "build-tools-angular.md",
  vanilla: "build-tools-vanilla.md",
};
