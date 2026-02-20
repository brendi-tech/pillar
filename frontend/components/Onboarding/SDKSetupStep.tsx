"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Key,
  Package,
  Play,
  RefreshCw,
  Sparkles,
  Tag,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";

import { AIPromptBlock } from "@/components/mdx/AIPromptBlock";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers/ProductProvider";

import { CopyButton, SecretsManager } from "./SecretsManager";
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
