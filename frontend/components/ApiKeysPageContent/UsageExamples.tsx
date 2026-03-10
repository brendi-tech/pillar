"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./CopyButton";
import type { GeneratedSecret } from "./ApiKeysPageContent.types";

interface UsageExamplesProps {
  slug: string;
  apiUrl: string;
  isLocalDev: boolean;
  generatedSecret: GeneratedSecret | null;
}

export function UsageExamples({
  slug,
  apiUrl,
  isLocalDev,
  generatedSecret,
}: UsageExamplesProps) {
  const githubActionsExample = `# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run build
      
      # Sync actions to Pillar
      # Use environment-specific secrets: PILLAR_SECRET_PROD, PILLAR_SECRET_STAGING, etc.
      - run: npm run extract-actions && npm run sync-actions
        env:
          PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
          PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`;

  const githubActionsCopySnippet = `# Sync actions to Pillar
- run: npm run extract-actions && npm run sync-actions
  env:
    PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
    PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`;

  const localDevExample = `# Add to your .env.local file
PILLAR_SLUG=${slug || "your-slug"}
PILLAR_SECRET=${generatedSecret ? generatedSecret.secret : "<generate-a-secret-above>"}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ""}

# Then run:
npm run extract-actions && npm run sync-actions`;

  const localDevCopyValue = generatedSecret
    ? `PILLAR_SLUG=${slug}\nPILLAR_SECRET=${generatedSecret.secret}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ""}`
    : "";

  return (
    <Tabs defaultValue="github" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="github">GitHub Actions</TabsTrigger>
        <TabsTrigger value="local">Local Development</TabsTrigger>
      </TabsList>
      <TabsContent value="github" className="space-y-3">
        <div className="relative">
          <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
            <code>{githubActionsExample}</code>
          </pre>
          <CopyButton
            value={githubActionsCopySnippet}
            className="absolute top-2 right-2"
          />
        </div>
      </TabsContent>
      <TabsContent value="local" className="space-y-3">
        <div className="relative">
          <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
            <code>{localDevExample}</code>
          </pre>
          <CopyButton
            value={localDevCopyValue}
            className="absolute top-2 right-2"
            disabled={!generatedSecret}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
