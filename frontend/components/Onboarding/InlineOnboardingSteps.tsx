"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AIPromptBlock } from "@/components/mdx/AIPromptBlock";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productsAPI } from "@/lib/admin/v2/products-api";
import { cn } from "@/lib/utils";
import { extractCompanyDomain, domainToWebsiteUrl } from "@/lib/utils/email-domain";
import { useAuth } from "@/providers/AuthProvider";
import { useProduct } from "@/providers/ProductProvider";
import {
  createKnowledgeSourceMutation,
  knowledgeSourceKeys,
  triggerKnowledgeSourceSyncMutation,
} from "@/queries/sources.queries";
import {
  updateProductMutation,
  productKeys,
} from "@/queries/v2/products.queries";
import type { CrawlConfig } from "@/types/sources";

import { CopyButton, SecretsManager } from "./SecretsManager";

import installProviderExample from "@/examples/onboarding/install-provider.tsx.txt";

// =============================================================================
// Types
// =============================================================================

interface Step {
  id: number;
  title: string;
  description: string;
  optional?: boolean;
}

const STEPS: Step[] = [
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
    description: "Crawl your website to give the AI context about your product.",
    optional: true,
  },
];

type SubdomainStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// =============================================================================
// Step Section
// =============================================================================

interface StepSectionProps {
  step: Step;
  state: "completed" | "active" | "locked";
  isLast: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  children: React.ReactNode;
}

function StepSection({
  step,
  state,
  isLast,
  onToggle,
  isExpanded,
  children,
}: StepSectionProps) {
  const isLocked = state === "locked";
  const isCompleted = state === "completed";

  return (
    <div className={cn("relative flex gap-6", isLocked && "opacity-50")}>
      <div className="flex flex-col items-center">
        <button
          type="button"
          disabled={isLocked}
          onClick={onToggle}
          className={cn(
            "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            isCompleted &&
              "border-foreground/20 bg-foreground text-background cursor-pointer",
            state === "active" &&
              "border-foreground bg-background text-foreground ring-4 ring-foreground/5",
            isLocked &&
              "border-muted-foreground/20 bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isCompleted ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <span className="text-sm font-medium">{step.id}</span>
          )}
        </button>

        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 min-h-6",
              isCompleted ? "bg-foreground/20" : "bg-border"
            )}
          />
        )}
      </div>

      <div className={cn("flex-1 pb-10", isLast && "pb-0")}>
        <button
          type="button"
          disabled={isLocked}
          onClick={onToggle}
          className={cn(
            "text-left w-full",
            !isLocked && "cursor-pointer",
            isLocked && "cursor-not-allowed"
          )}
        >
          <h3
            className={cn(
              "text-base font-semibold leading-tight inline-flex items-center gap-2",
              isLocked ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {step.title}
            {step.optional && (
              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                Optional
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step.description}
          </p>
        </button>

        {isExpanded && !isLocked && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

// =============================================================================
// Step 1: Add an API Key
// =============================================================================

function ApiKeyStepContent({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const { currentProduct, refetchProducts } = useProduct();
  const queryClient = useQueryClient();

  const isDraft = !currentProduct?.subdomain;
  const [productKey, setProductKey] = useState(currentProduct?.subdomain || "");
  const [productKeyStatus, setProductKeyStatus] = useState<SubdomainStatus>(
    currentProduct?.subdomain ? "available" : "idle"
  );
  const [productKeyError, setProductKeyError] = useState<string | null>(null);
  const [productKeySuggestion, setProductKeySuggestion] = useState<string | null>(null);
  const hasUserEdited = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedAutofill = useRef(false);

  // Keep in sync when the active product changes
  useEffect(() => {
    if (currentProduct?.subdomain && !hasUserEdited.current) {
      setProductKey(currentProduct.subdomain);
      setProductKeyStatus("available");
      setProductKeyError(null);
    }
  }, [currentProduct?.subdomain]);

  // Auto-fill from email domain (only for draft products with no subdomain yet)
  useEffect(() => {
    if (!isDraft) return;
    if (hasAttemptedAutofill.current || hasUserEdited.current || productKey.trim()) return;
    hasAttemptedAutofill.current = true;
    if (!user?.email) return;

    const companyDomain = extractCompanyDomain(user.email);
    if (companyDomain) {
      const suggestedUrl = domainToWebsiteUrl(companyDomain);
      productsAPI.suggestSubdomain(suggestedUrl).then((response) => {
        if (!hasUserEdited.current) {
          setProductKey(response.suggestion);
          setProductKeyStatus(response.available ? "available" : "taken");
          setProductKeyError(response.available ? null : "This product key is already taken");
        }
      }).catch(() => {});
    }
  }, [isDraft, user?.email, productKey]);

  const checkAvailability = useCallback(async (value: string) => {
    if (!value.trim()) {
      setProductKeyStatus("idle");
      setProductKeyError(null);
      setProductKeySuggestion(null);
      return;
    }
    setProductKeyStatus("checking");
    setProductKeySuggestion(null);
    try {
      const response = await productsAPI.checkSubdomain(value.trim());
      if (!response.valid) {
        setProductKeyStatus("invalid");
        setProductKeyError(response.error || "Invalid format");
        setProductKeySuggestion(null);
      } else if (!response.available) {
        setProductKeyStatus("taken");
        setProductKeyError("This product key is already taken");
        setProductKeySuggestion(response.suggestion || null);
      } else {
        setProductKeyStatus("available");
        setProductKeyError(null);
        setProductKeySuggestion(null);
      }
      if (response.subdomain !== value.trim()) {
        setProductKey(response.subdomain);
      }
    } catch {
      setProductKeyStatus("idle");
      setProductKeyError("Failed to check availability");
    }
  }, []);

  const handleProductKeyChange = (value: string) => {
    hasUserEdited.current = true;
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setProductKey(sanitized);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => checkAvailability(sanitized), 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const updateProduct = useMutation({
    ...updateProductMutation(),
    onSuccess: async () => {
      await refetchProducts();
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const handleContinue = async () => {
    if (productKeyStatus !== "available") return;

    if (isDraft && currentProduct?.id) {
      try {
        await updateProduct.mutateAsync({
          id: currentProduct.id,
          data: { subdomain: productKey.trim(), name: productKey.trim() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save product key";
        toast.error("Something went wrong", { description: message });
        return;
      }
    }
    onComplete();
  };

  const isReady = productKeyStatus === "available";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="product-key" className="text-sm font-medium">
          Product Key
        </Label>
        <div className="relative">
          <Input
            id="product-key"
            value={productKey}
            onChange={(e) => handleProductKeyChange(e.target.value)}
            placeholder="your-product"
            className="h-11 pr-10 font-mono"
            disabled={!isDraft}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {productKeyStatus === "checking" && <Spinner size="sm" />}
            {productKeyStatus === "available" && <Check className="h-4 w-4 text-green-600" />}
            {(productKeyStatus === "taken" || productKeyStatus === "invalid") && (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        {productKeyError ? (
          <div className="space-y-1">
            <p className="text-xs text-destructive">{productKeyError}</p>
            {productKeySuggestion && (
              <p className="text-xs text-muted-foreground">
                Try{" "}
                <button
                  type="button"
                  onClick={() => {
                    setProductKey(productKeySuggestion);
                    setProductKeyStatus("available");
                    setProductKeyError(null);
                    setProductKeySuggestion(null);
                    hasUserEdited.current = true;
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {productKeySuggestion}
                </button>{" "}
                instead
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Used as <code className="bg-muted px-1 rounded">PILLAR_SLUG</code> and in the SDK provider.
          </p>
        )}
      </div>

      <Button
        size="lg"
        className="w-full h-11"
        disabled={!isReady || updateProduct.isPending}
        onClick={handleContinue}
      >
        {updateProduct.isPending ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Saving...
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// =============================================================================
// Step 2: Install the SDK
// =============================================================================

const FRAMEWORKS = [
  { id: "react", name: "React", enabled: true },
  { id: "vue", name: "Vue", enabled: false },
  { id: "angular", name: "Angular", enabled: false },
  { id: "svelte", name: "Svelte", enabled: false },
] as const;

function InstallSdkStepContent({
  onComplete,
  productKey,
}: {
  onComplete: () => void;
  productKey: string;
}) {
  const installCode = `npm install @pillar-ai/sdk @pillar-ai/react`;
  const providerCode = installProviderExample.replace("your-product-key", productKey);

  return (
    <div className="space-y-5">
      <Tabs defaultValue="react" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FRAMEWORKS.map((framework) => (
            <TabsTrigger
              key={framework.id}
              value={framework.id}
              disabled={!framework.enabled}
              className="relative shrink-0"
            >
              {framework.name}
              {!framework.enabled && (
                <span className="ml-1.5 text-[10px] text-muted-foreground/70">
                  Soon
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="react" className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Install packages</h4>
            <SyntaxHighlightedPre
              code={installCode}
              language="bash"
              docsUrl="https://trypillar.com/docs/quickstarts/react"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Wrap your app with PillarProvider</h4>
            <SyntaxHighlightedPre
              code={providerCode}
              language="tsx"
              filePath="app/layout.tsx"
              docsUrl="https://trypillar.com/docs/quickstarts/react"
            />
          </div>
        </TabsContent>

        {FRAMEWORKS.filter((f) => !f.enabled).map((framework) => (
          <TabsContent key={framework.id} value={framework.id} className="mt-4">
            <div className="text-center py-8 text-muted-foreground">
              <p>{framework.name} support coming soon!</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Button size="lg" className="w-full h-11" onClick={onComplete}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// =============================================================================
// Step 3: Create an Action
// =============================================================================

const REACT_TOOL_EXAMPLE = `import { usePillarTool } from '@pillar-ai/react';
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

// Call usePillarTools() inside PillarProvider (e.g. in app/layout.tsx)`;

const VANILLA_TOOL_EXAMPLE = `import Pillar from '@pillar-ai/sdk';

const pillar = new Pillar({ productKey: 'your-product-key' });

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
});`;

function CreateActionStepContent({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tools let the AI assistant perform tasks in your app. Here&apos;s
        an example to get started:
      </p>

      <Tabs defaultValue="react" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="react" className="shrink-0">React</TabsTrigger>
          <TabsTrigger value="vanilla" className="shrink-0">Vanilla JS</TabsTrigger>
          {["Vue", "Angular", "Svelte"].map((fw) => (
            <TabsTrigger key={fw} value={fw.toLowerCase()} disabled className="relative shrink-0">
              {fw}
              <span className="ml-1.5 text-[10px] text-muted-foreground/70">Soon</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="react" className="space-y-4 mt-4">
          <SyntaxHighlightedPre
            code={REACT_TOOL_EXAMPLE}
            language="typescript"
            filePath="hooks/usePillarTools.ts"
            docsUrl="https://trypillar.com/docs/guides/tools"
          />
          <AIPromptBlock title="Build React tools for my app" src="build-tools-react.md" />
        </TabsContent>

        <TabsContent value="vanilla" className="space-y-4 mt-4">
          <SyntaxHighlightedPre
            code={VANILLA_TOOL_EXAMPLE}
            language="typescript"
            docsUrl="https://trypillar.com/docs/guides/tools"
          />
          <AIPromptBlock title="Build Vanilla JS tools for my app" src="build-tools-vanilla.md" />
        </TabsContent>

        {["vue", "angular", "svelte"].map((fw) => (
          <TabsContent key={fw} value={fw} className="mt-4">
            <div className="text-center py-8 text-muted-foreground">
              <p>{fw.charAt(0).toUpperCase() + fw.slice(1)} support coming soon!</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Button size="lg" className="w-full h-11" onClick={onComplete}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// =============================================================================
// Step 4: Sync
// =============================================================================

function SyncStepContent({
  onComplete,
  productKey,
  productId,
}: {
  onComplete: () => void;
  productKey: string;
  productId: string | undefined;
}) {
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
        {/* PILLAR_SLUG */}
        <div className="flex items-center gap-3">
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium shrink-0">PILLAR_SLUG</code>
          <div className="flex items-center gap-1 min-w-0">
            <code className="font-mono text-sm truncate">{productKey}</code>
            <CopyButton value={productKey} className="shrink-0 h-7 w-7 p-0" />
          </div>
        </div>

        {/* PILLAR_SECRET */}
        <div className="flex items-start gap-3">
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium shrink-0 mt-1.5">PILLAR_SECRET</code>
          <div className="flex-1 min-w-0">
            {newlyGeneratedSecret ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <code className="font-mono text-sm truncate">{newlyGeneratedSecret.secret}</code>
                  <CopyButton value={newlyGeneratedSecret.secret} className="shrink-0 h-7 w-7 p-0" />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Copy this now — it won&apos;t be shown again.
                </p>
              </div>
            ) : productId ? (
              <SecretsManager
                productId={productId}
                onSecretCreated={(secret, name) => setNewlyGeneratedSecret({ secret, name })}
              />
            ) : (
              <span className="text-sm text-muted-foreground italic">Loading...</span>
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

// =============================================================================
// Step 5: Add Knowledge (Optional)
// =============================================================================

function AddKnowledgeStepContent({ onComplete }: { onComplete: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [maxPages, setMaxPages] = useState(1000);
  const [includePaths, setIncludePaths] = useState("");
  const [excludePaths, setExcludePaths] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const getHostname = (urlString: string): string => {
    const trimmed = urlString.trim();
    const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withProtocol).hostname;
    } catch {
      return trimmed.split("/")[0];
    }
  };
  const derivedName = name || getHostname(url);

  const createSource = useMutation({
    ...createKnowledgeSourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
    },
  });

  const triggerSync = useMutation({
    ...triggerKnowledgeSourceSyncMutation(),
  });

  const isValidUrl = (urlString: string) => urlString.trim().includes(".");
  const isValid = url.trim() !== "" && isValidUrl(url.trim());
  const isSubmitting = createSource.isPending || triggerSync.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const crawlConfig: CrawlConfig = {
      max_pages: maxPages,
      include_paths: includePaths
        ? includePaths.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined,
      exclude_paths: excludePaths
        ? excludePaths.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined,
    };

    try {
      const newSource = await createSource.mutateAsync({
        source_type: "website_crawl",
        name: derivedName || "My Website",
        url: url.trim(),
        crawl_config: crawlConfig,
      });

      try {
        await triggerSync.mutateAsync({ id: newSource.id });
      } catch {
        // Don't fail the whole flow if sync trigger fails
      }

      toast.success("Crawl started!", {
        description: `We're crawling ${derivedName || url}. This may take a few minutes.`,
      });

      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create source";
      toast.error("Something went wrong", { description: message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="crawl-url" className="text-sm font-medium">
          Website URL
        </Label>
        <Input
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.example.com"
          className="h-11"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Enter your docs site, marketing site, or knowledge base URL
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="crawl-name" className="text-sm font-medium">
          Display Name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="crawl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={derivedName || "My Docs"}
          className="h-11"
        />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground -ml-1"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                advancedOpen && "rotate-180"
              )}
            />
            Advanced Settings
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="crawl-maxPages">Max Pages</Label>
            <Input
              id="crawl-maxPages"
              type="number"
              min={1}
              max={10000}
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value) || 1000)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crawl-includePaths">Include Paths</Label>
            <Input
              id="crawl-includePaths"
              value={includePaths}
              onChange={(e) => setIncludePaths(e.target.value)}
              placeholder="/docs, /help, /guides"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crawl-excludePaths">Exclude Paths</Label>
            <Input
              id="crawl-excludePaths"
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              placeholder="/blog, /changelog"
              className="h-10"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button
        type="submit"
        size="lg"
        className="w-full h-11"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Starting Crawl...
          </>
        ) : (
          <>
            Start Crawling
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface InlineOnboardingStepsProps {
  initialStep: number;
  redirectTo?: string;
}

export function InlineOnboardingSteps({
  initialStep,
  redirectTo = "/knowledge",
}: InlineOnboardingStepsProps) {
  const router = useRouter();
  const { currentProduct } = useProduct();
  const productKey = currentProduct?.subdomain || "";

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    const set = new Set<number>();
    for (let i = 1; i < initialStep; i++) set.add(i);
    return set;
  });

  const [activeStep, setActiveStep] = useState(initialStep);
  const [expandedStep, setExpandedStep] = useState(initialStep);

  const getStepState = useCallback(
    (stepId: number): "completed" | "active" | "locked" => {
      if (completedSteps.has(stepId)) return "completed";
      if (stepId === activeStep) return "active";
      return "locked";
    },
    [completedSteps, activeStep]
  );

  const handleStepComplete = useCallback(
    (stepId: number) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });

      if (stepId < STEPS.length) {
        const nextStep = stepId + 1;
        setActiveStep(nextStep);
        setExpandedStep(nextStep);
      } else {
        router.push(redirectTo);
      }
    },
    [redirectTo, router]
  );

  const handleToggle = useCallback(
    (stepId: number) => {
      const state = getStepState(stepId);
      if (state === "locked") return;
      setExpandedStep((prev) => (prev === stepId ? -1 : stepId));
    },
    [getStepState]
  );

  const handleSkip = useCallback(
    (stepId: number) => {
      handleStepComplete(stepId);
    },
    [handleStepComplete]
  );

  return (
    <div className="w-full max-w-3xl mx-auto">
      {STEPS.map((step, index) => (
        <StepSection
          key={step.id}
          step={step}
          state={getStepState(step.id)}
          isLast={index === STEPS.length - 1}
          onToggle={() => handleToggle(step.id)}
          isExpanded={expandedStep === step.id}
        >
          {step.id === 1 && !currentProduct?.subdomain && (
            <ApiKeyStepContent
              onComplete={() => handleStepComplete(1)}
            />
          )}
          {step.id === 1 && currentProduct?.subdomain && (
            <p className="text-sm text-muted-foreground">
              Your product key is{" "}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {productKey}
              </code>
              <CopyButton value={productKey} className="inline-flex h-5 w-5 p-0 ml-1 align-text-bottom" />
            </p>
          )}
          {step.id === 2 && (
            <InstallSdkStepContent
              onComplete={() => handleStepComplete(2)}
              productKey={productKey}
            />
          )}
          {step.id === 3 && (
            <CreateActionStepContent onComplete={() => handleStepComplete(3)} />
          )}
          {step.id === 4 && (
            <SyncStepContent
              onComplete={() => handleStepComplete(4)}
              productKey={productKey}
              productId={currentProduct?.id}
            />
          )}
          {step.id === 5 && (
            <div className="space-y-3">
              <AddKnowledgeStepContent onComplete={() => handleStepComplete(5)} />
              <div className="text-center">
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => handleSkip(5)}
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}
        </StepSection>
      ))}
    </div>
  );
}
