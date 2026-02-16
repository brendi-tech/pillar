"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Key,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AIPromptBlock } from "@/components/mdx/AIPromptBlock";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch } from "@/lib/admin/api-client";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers/ProductProvider";

import { TestPillarStep } from "./TestPillarStep";

// Example file imports (raw strings via webpack .txt loader)
import actionHandlerExample from "@/examples/onboarding/action-handler.tsx.txt";
import defineActionsExample from "@/examples/onboarding/define-actions.ts.txt";
import installProviderExample from "@/examples/onboarding/install-provider.tsx.txt";

// =============================================================================
// Types
// =============================================================================

interface SDKSetupStepProps {
  /** Callback when step is complete (if not provided, final Continue button is hidden) */
  onComplete?: () => void;
  /** Initial sub-step to show (defaults to 1) */
  initialSubStep?: number;
  /** Whether to show the Test step as a 4th sub-step (defaults to false) */
  showTestStep?: boolean;
}

interface SubStep {
  id: number;
  title: string;
  icon: React.ReactNode;
}

interface SyncSecret {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by_email: string | null;
}

interface CreateSecretResponse {
  id: string;
  name: string;
  secret: string;
  message: string;
}

function CopyButton({
  value,
  className,
  disabled,
}: {
  value: string;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (disabled || !value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleCopy}
      disabled={disabled || !value}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

// =============================================================================
// Secrets Manager Component
// =============================================================================

interface SecretsManagerProps {
  productId: string;
  onSecretCreated: (secret: string, name: string) => void;
}

function SecretsManager({ productId, onSecretCreated }: SecretsManagerProps) {
  const queryClient = useQueryClient();
  const [newSecretName, setNewSecretName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const autoCreatedRef = useRef(false);

  const {
    data: secrets,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["sync-secrets", productId],
    queryFn: () => adminFetch<SyncSecret[]>(`/configs/${productId}/secrets/`),
    enabled: !!productId,
  });

  const createSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      return adminFetch<CreateSecretResponse>(
        `/configs/${productId}/secrets/`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sync-secrets", productId] });
      queryClient.invalidateQueries({ queryKey: ["help-center-config"] });
      setNewSecretName("");
      setNameError(null);
      onSecretCreated(result.secret, result.name);
    },
    onError: (error: Error) => {
      setNameError(error.message || "Failed to create secret");
    },
  });

  // Auto-create a "default" secret when the page loads with no existing secrets
  useEffect(() => {
    if (
      !isPending &&
      !isError &&
      secrets &&
      secrets.length === 0 &&
      !autoCreatedRef.current &&
      !createSecretMutation.isPending
    ) {
      autoCreatedRef.current = true;
      createSecretMutation.mutate("default");
    }
  }, [isPending, isError, secrets, createSecretMutation]);

  const deleteSecretMutation = useMutation({
    mutationFn: async (secretId: string) => {
      return adminFetch(`/configs/${productId}/secrets/${secretId}/`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-secrets", productId] });
      queryClient.invalidateQueries({ queryKey: ["help-center-config"] });
    },
  });

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name.toLowerCase())) {
      setNameError("Use lowercase letters, numbers, and hyphens only");
      return false;
    }
    if (name.length > 50) {
      setNameError("Name must be 50 characters or less");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleCreateSecret = () => {
    const name = newSecretName.toLowerCase().trim();
    if (validateName(name)) {
      createSecretMutation.mutate(name);
    }
  };

  const isAutoCreating =
    createSecretMutation.isPending && (!secrets || secrets.length === 0);

  if (isPending || isAutoCreating) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {isAutoCreating ? "Generating your secret key..." : "Loading..."}
          </span>
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load secrets. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const hasSecrets = secrets && secrets.length > 0;
  const canCreateMore = !secrets || secrets.length < 10;

  return (
    <div className="space-y-4">
      {/* Existing secrets table */}
      {hasSecrets && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-mono text-sm">
                    {secret.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(secret.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {secret.last_used_at
                      ? formatDistanceToNow(new Date(secret.last_used_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteSecretMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke Secret</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke the &quot;
                            {secret.name}&quot; secret? Any CI/CD pipelines
                            using this secret will fail to authenticate.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteSecretMutation.mutate(secret.id)
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create new secret */}
      {canCreateMore && (
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <Label htmlFor="secret-name" className="text-sm font-medium">
            {hasSecrets ? "Add Another Secret" : "Create Your First Secret"}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="secret-name"
                placeholder="e.g., production, staging, dev-ci"
                value={newSecretName}
                onChange={(e) => {
                  setNewSecretName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  );
                  setNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateSecret();
                  }
                }}
                className="font-mono"
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1">{nameError}</p>
              )}
            </div>
            <Button
              onClick={handleCreateSecret}
              disabled={createSecretMutation.isPending || !newSecretName.trim()}
            >
              {createSecretMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <Plus className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Generate</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Create separate secrets for different environments (e.g.,
            production, staging)
          </p>
        </div>
      )}

      {!canCreateMore && (
        <p className="text-xs text-muted-foreground">
          Maximum 10 secrets per product. Delete an existing secret to create a
          new one.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Sub-step Components
// =============================================================================

const FRAMEWORKS = [
  { id: "react", name: "React", enabled: true },
  { id: "vue", name: "Vue", enabled: false },
  { id: "angular", name: "Angular", enabled: false },
  { id: "svelte", name: "Svelte", enabled: false },
] as const;

function InstallStep({ subdomain }: { subdomain: string }) {
  const installCode = `npm install @pillar-ai/sdk @pillar-ai/react`;

  const providerCode = installProviderExample.replace(
    "your-product-key",
    subdomain
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Install the Pillar SDK packages and wrap your app with the provider.
      </p>

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
            <h4 className="text-sm font-medium">
              Wrap your app with PillarProvider
            </h4>
            <SyntaxHighlightedPre
              code={providerCode}
              language="tsx"
              filePath="app/layout.tsx"
              docsUrl="https://trypillar.com/docs/quickstarts/react"
            />
          </div>
        </TabsContent>

        {/* Placeholder content for future frameworks */}
        {FRAMEWORKS.filter((f) => !f.enabled).map((framework) => (
          <TabsContent key={framework.id} value={framework.id} className="mt-4">
            <div className="text-center py-8 text-muted-foreground">
              <p>{framework.name} support coming soon!</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ActionsStep() {
  const actionsCode = defineActionsExample;

  const handlerCode = actionHandlerExample;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Actions let the AI assistant perform tasks in your app, like navigating
        to pages or triggering features. Use the{" "}
        <code className="bg-muted px-1 rounded">usePillarTool</code> hook to
        define tools with co-located handlers.
      </p>

      <AIPromptBlock title="Build tools for my app" src="build-tools.md" />

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Action types</h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">navigate</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Go to a page in your app
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  trigger_action
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Run custom logic (modals, wizards, API calls)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">query</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Fetch data and return to the AI agent
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  external_link
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Open URL in new tab
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Define tools with usePillarTool</h4>
        <SyntaxHighlightedPre
          code={actionsCode}
          language="typescript"
          filePath="hooks/usePillarTools.ts"
          docsUrl="https://trypillar.com/docs/guides/tools"
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Use the hook in your app</h4>
        <SyntaxHighlightedPre
          code={handlerCode}
          language="tsx"
          filePath="app/layout.tsx"
          docsUrl="https://trypillar.com/docs/guides/tools"
        />
      </div>

      <div className="bg-blue-100 dark:bg-blue-500/10 rounded-lg p-3 border border-blue-300 dark:border-blue-500/30 flex gap-2">
        <Check className="h-4 w-4 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          The CLI automatically scans your code for{" "}
          <code className="bg-blue-200 dark:bg-blue-500/20 px-1 rounded">
            usePillarTool
          </code>{" "}
          calls — no need to export from a single file.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        The AI uses the description and examples to match user requests to the
        right action.{" "}
        <a
          href="https://trypillar.com/docs/guides/tools"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Read the full Actions guide
        </a>{" "}
        for data extraction, context filtering, and best practices.
      </p>
    </div>
  );
}

function SyncStep({
  subdomain,
  productId,
}: {
  subdomain: string;
  productId: string | undefined;
}) {
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] = useState<{
    secret: string;
    name: string;
  } | null>(null);

  const handleSecretCreated = (secret: string, name: string) => {
    setNewlyGeneratedSecret({ secret, name });
  };

  const manualSyncCode = `PILLAR_SLUG=your-slug PILLAR_SECRET=your-secret npx pillar-sync --scan ./src`;

  const syncCode = `# Run in your CI/CD pipeline after building
npx pillar-sync --scan ./src`;

  const ciCode = `# Example GitHub Actions step
- name: Sync Pillar Actions
  env:
    PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
    PILLAR_SECRET: \${{ secrets.PILLAR_SECRET }}
  run: npx pillar-sync --scan ./src`;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        The CLI scans your code for{" "}
        <code className="bg-muted px-1 rounded">usePillarTool</code> calls and
        syncs them to Pillar. Run this in your CI/CD pipeline to keep actions up
        to date.
      </p>

      {/* PILLAR_SLUG */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-purple-500" />
          <code className="font-mono text-sm font-medium">PILLAR_SLUG</code>
        </div>
        <p className="text-xs text-muted-foreground">Your product identifier</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
            {subdomain}
          </div>
          <CopyButton value={subdomain} />
        </div>
      </div>

      {/* PILLAR_SECRET - Secrets Manager */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-green-500" />
          <code className="font-mono text-sm font-medium">PILLAR_SECRET</code>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate a secret key to authenticate the sync command. Secret values
          are only displayed once — copy it when it appears.
        </p>
        {productId && (
          <SecretsManager
            productId={productId}
            onSecretCreated={handleSecretCreated}
          />
        )}
      </div>

      {/* Newly Generated Secret Warning */}
      {newlyGeneratedSecret && (
        <Alert
          variant="default"
          className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30"
        >
          <Key className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Copy Your &quot;{newlyGeneratedSecret.name}&quot; Secret Now!
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
            <p>
              This secret will only be shown once. Copy it now and store it
              securely.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs break-all">
                {newlyGeneratedSecret.secret}
              </code>
              <CopyButton value={newlyGeneratedSecret.secret} />
            </div>
          </AlertDescription>
        </Alert>
      )}

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
    </div>
  );
}

// =============================================================================
// Mini Stepper Header
// =============================================================================

function MiniStepperHeader({
  currentSubStep,
  subSteps,
  onStepClick,
}: {
  currentSubStep: number;
  subSteps: SubStep[];
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="relative  mb-6">
      {/* Connector line behind */}
      <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted-foreground/20" />
      <div
        className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300"
        style={{
          width: `${((currentSubStep - 1) / (subSteps.length - 1)) * 100}%`,
        }}
      />
      <div className="flex items-center justify-between">
        {/* Steps */}
        {subSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.id)}
            className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer first:translate-x-[-2px]"
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors bg-background",
                currentSubStep === step.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : currentSubStep > step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {currentSubStep > step.id ? (
                <Check className="h-4 w-4" />
              ) : (
                step.icon
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                currentSubStep >= step.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

const BASE_SUB_STEPS: SubStep[] = [
  { id: 1, title: "Install", icon: <Package className="h-4 w-4" /> },
  { id: 2, title: "Actions", icon: <Play className="h-4 w-4" /> },
  { id: 3, title: "Sync", icon: <RefreshCw className="h-4 w-4" /> },
];

const TEST_SUB_STEP: SubStep = {
  id: 4,
  title: "Test",
  icon: <Sparkles className="h-4 w-4" />,
};

export function SDKSetupStep({
  onComplete,
  initialSubStep = 1,
  showTestStep = false,
}: SDKSetupStepProps) {
  const { currentProduct } = useProduct();
  const subdomain = currentProduct?.subdomain || "your-subdomain";
  const productId = currentProduct?.id;
  const [currentSubStep, setCurrentSubStep] = useState(initialSubStep);

  // Include test step if enabled
  const subSteps = showTestStep
    ? [...BASE_SUB_STEPS, TEST_SUB_STEP]
    : BASE_SUB_STEPS;

  const handleNext = () => {
    if (currentSubStep < subSteps.length) {
      setCurrentSubStep(currentSubStep + 1);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    } else if (onComplete) {
      onComplete();
    }
  };

  const isLastStep = currentSubStep === subSteps.length;
  const showNextButton = !isLastStep || onComplete;

  const handleBack = () => {
    if (currentSubStep > 1) {
      setCurrentSubStep(currentSubStep - 1);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          SDK Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MiniStepperHeader
          currentSubStep={currentSubStep}
          subSteps={subSteps}
          onStepClick={setCurrentSubStep}
        />

        {/* Step Content */}
        {currentSubStep === 1 && <InstallStep subdomain={subdomain} />}
        {currentSubStep === 2 && <ActionsStep />}
        {currentSubStep === 3 && (
          <SyncStep subdomain={subdomain} productId={productId} />
        )}
        {currentSubStep === 4 && showTestStep && (
          <TestPillarStep onComplete={onComplete} onBack={handleBack} />
        )}

        {/* Navigation - hide when on Test step since TestPillarStep has its own buttons */}
        {!(currentSubStep === 4 && showTestStep) && (
          <div className="flex gap-3">
            {currentSubStep > 1 && (
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
              </Button>
            )}
            {showNextButton && (
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-medium"
                onClick={handleNext}
              >
                {isLastStep ? "Continue" : "Next"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
