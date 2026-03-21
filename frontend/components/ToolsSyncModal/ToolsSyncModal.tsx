"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduct } from "@/providers/ProductProvider";
import {
  AlertTriangle,
  ChevronDown,
  Code2,
  ExternalLink,
  Server,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";

import { CopyButton } from "./CopyButton";
import { SecretsTable } from "./SecretsTable";
import type { NewlyGeneratedSecret, ToolsSyncModalProps } from "./ToolsSyncModal.types";

export function ToolsSyncModal({ trigger }: ToolsSyncModalProps) {
  const { currentProduct: config, isLoading } = useProduct();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] =
    useState<NewlyGeneratedSecret | null>(null);

  useEffect(() => {
    if (!open) {
      setNewlyGeneratedSecret(null);
    }
  }, [open]);

  const handleSecretCreated = (secret: string, name: string) => {
    setNewlyGeneratedSecret({ secret, name });
  };

  const slug = config?.subdomain ?? "";
  const apiUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "https://help-api.trypillar.com";
  const isLocalDev = apiUrl.includes("localhost");
  const isInitializing = isLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Code2 className="mr-2 h-4 w-4" />
            Configure Sync
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Configure Action Sync
          </DialogTitle>
          <DialogDescription>
            Add these environment variables to your CI/CD pipeline to sync
            actions from your code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isInitializing ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <SlugSection slug={slug} />

              {newlyGeneratedSecret && (
                <NewSecretAlert secret={newlyGeneratedSecret} />
              )}

              {config?.id && (
                <SecretsTable
                  productId={config.id}
                  onSecretCreated={handleSecretCreated}
                />
              )}

              {isLocalDev && (
                <AdvancedSettings
                  apiUrl={apiUrl}
                  showAdvanced={showAdvanced}
                  onToggle={setShowAdvanced}
                />
              )}

              <UsageExamples
                slug={slug}
                apiUrl={apiUrl}
                isLocalDev={isLocalDev}
                newlyGeneratedSecret={newlyGeneratedSecret}
              />

              <DocumentationLink />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SlugSection({ slug }: { slug: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-purple-500" />
          <code className="font-mono text-sm font-medium">PILLAR_SLUG</code>
        </div>
        <CopyButton value={`PILLAR_SLUG=${slug}`} />
      </div>
      <p className="text-xs text-muted-foreground">Your Pillar subdomain</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
          {slug}
        </div>
        <CopyButton value={slug} />
      </div>
    </div>
  );
}

function NewSecretAlert({ secret }: { secret: NewlyGeneratedSecret }) {
  return (
    <Alert
      variant="default"
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Copy Your &quot;{secret.name}&quot; Secret Now!
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
        <p>
          This secret will only be shown once. Copy it now and store it
          securely.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs break-all">
            {secret.secret}
          </code>
          <CopyButton value={secret.secret} />
        </div>
      </AlertDescription>
    </Alert>
  );
}

function AdvancedSettings({
  apiUrl,
  showAdvanced,
  onToggle,
}: {
  apiUrl: string;
  showAdvanced: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <Collapsible open={showAdvanced} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="text-sm text-muted-foreground">
            Advanced: API URL (for local dev)
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <code className="font-mono text-sm font-medium">
                PILLAR_API_URL
              </code>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <CopyButton value={`PILLAR_API_URL=${apiUrl}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Only needed for local development. Defaults to
            https://help-api.trypillar.com
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
              {apiUrl}
            </div>
            <CopyButton value={apiUrl} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function UsageExamples({
  slug,
  apiUrl,
  isLocalDev,
  newlyGeneratedSecret,
}: {
  slug: string;
  apiUrl: string;
  isLocalDev: boolean;
  newlyGeneratedSecret: NewlyGeneratedSecret | null;
}) {
  return (
    <Tabs defaultValue="github" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="github">GitHub Actions</TabsTrigger>
        <TabsTrigger value="local">Local Development</TabsTrigger>
      </TabsList>
      <TabsContent value="github" className="space-y-3">
        <div className="relative">
          <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
            <code>{`# .github/workflows/deploy.yml
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
          PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`}</code>
          </pre>
          <CopyButton
            value={`# Sync actions to Pillar
- run: npm run extract-actions && npm run sync-actions
  env:
    PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
    PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`}
            className="absolute top-2 right-2"
          />
        </div>
      </TabsContent>
      <TabsContent value="local" className="space-y-3">
        <div className="relative">
          <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
            <code>{`# Add to your .env.local file
PILLAR_SLUG=${slug || "your-slug"}
PILLAR_SECRET=${newlyGeneratedSecret ? newlyGeneratedSecret.secret : "<generate-a-secret-above>"}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ""}

# Then run:
npm run extract-actions && npm run sync-actions`}</code>
          </pre>
          <CopyButton
            value={
              newlyGeneratedSecret
                ? `PILLAR_SLUG=${slug}\nPILLAR_SECRET=${newlyGeneratedSecret.secret}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ""}`
                : ""
            }
            className="absolute top-2 right-2"
            disabled={!newlyGeneratedSecret}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function DocumentationLink() {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Need help defining actions?</p>
        <p className="text-xs text-muted-foreground">
          Learn how to export actions from your code
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href="/docs/guides/tools" target="_blank" rel="noopener">
          <ExternalLink className="mr-2 h-3 w-3" />
          View Docs
        </a>
      </Button>
    </div>
  );
}
