"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { CopyButton, SecretsManager } from "@/components/Onboarding/SecretsManager";
import { Button } from "@/components/ui/button";

interface SyncStepContentProps {
  onComplete: () => void;
  productKey: string;
  productId: string | undefined;
}

export function SyncStepContent({
  onComplete,
  productKey,
  productId,
}: SyncStepContentProps) {
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] = useState<{
    secret: string;
    name: string;
  } | null>(null);

  const secretValue = newlyGeneratedSecret?.secret || "your-secret";
  const manualSyncCode = `PILLAR_SLUG=${productKey} \\
  PILLAR_SECRET=${secretValue} \\
  npx pillar-sync --scan ./src`;

  const syncCode = `# Run in your CI/CD pipeline after building
npx pillar-sync --scan ./src`;

  const ciCode = `# Example GitHub Actions step
- name: Sync Pillar Actions
  env:
    PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
    PILLAR_SECRET: \${{ secrets.PILLAR_SECRET }}
  run: npx pillar-sync --scan ./src`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        The sync CLI needs two environment variables to authenticate:
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium shrink-0">
            PILLAR_SLUG
          </code>
          <div className="flex items-center gap-1 min-w-0">
            <code className="font-mono text-sm truncate">{productKey}</code>
            <CopyButton value={productKey} className="shrink-0 h-7 w-7 p-0" />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium shrink-0 mt-1.5">
            PILLAR_SECRET
          </code>
          <div className="flex-1 min-w-0">
            {newlyGeneratedSecret ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <code className="font-mono text-sm truncate">
                    {newlyGeneratedSecret.secret}
                  </code>
                  <CopyButton
                    value={newlyGeneratedSecret.secret}
                    className="shrink-0 h-7 w-7 p-0"
                  />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Copy this now — it won&apos;t be shown again.
                </p>
              </div>
            ) : productId ? (
              <SecretsManager
                productId={productId}
                onSecretCreated={(secret, name) =>
                  setNewlyGeneratedSecret({ secret, name })
                }
              />
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Loading...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Run manually</h4>
        <SyntaxHighlightedPre
          code={manualSyncCode}
          language="bash"
          docsUrl="https://trypillar.com/docs/guides/tools"
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Run in CI/CD pipeline</h4>
        <SyntaxHighlightedPre
          code={syncCode}
          language="bash"
          docsUrl="https://trypillar.com/docs/guides/tools"
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">GitHub Actions example</h4>
        <SyntaxHighlightedPre
          code={ciCode}
          language="yaml"
          filePath=".github/workflows/deploy.yml"
          docsUrl="https://trypillar.com/docs/guides/tools"
        />
      </div>

      <Button size="lg" className="w-full h-11" onClick={onComplete}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
