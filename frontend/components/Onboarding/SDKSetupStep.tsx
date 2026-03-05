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
import { useState } from "react";

import {
  DOCS_URLS,
  FRAMEWORKS,
  getProviderCode,
  INSTALL_COMMANDS,
  PROVIDER_LABELS,
  TOOL_EXAMPLES,
} from "@/components/InlineOnboardingSteps/InlineOnboardingSteps.constants";
import type { FrameworkId } from "@/components/InlineOnboardingSteps/InlineOnboardingSteps.types";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers/ProductProvider";

import { CopyButton, SecretsManager } from "./SecretsManager";
import { TestPillarStep } from "./TestPillarStep";

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

function InstallStep({
  subdomain,
  selectedFramework,
  onFrameworkChange,
}: {
  subdomain: string;
  selectedFramework: FrameworkId;
  onFrameworkChange: (framework: FrameworkId) => void;
}) {
  const providerCodes = getProviderCode(subdomain);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Install the Pillar SDK packages and wrap your app with the provider.
      </p>

      <Tabs
        value={selectedFramework}
        onValueChange={(v) => onFrameworkChange(v as FrameworkId)}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FRAMEWORKS.map((framework) => (
            <TabsTrigger
              key={framework.id}
              value={framework.id}
              className="relative shrink-0 px-3 py-1.5 sm:px-4"
            >
              {framework.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {FRAMEWORKS.map((framework) => {
          const providerConfig = providerCodes[framework.id];
          return (
            <TabsContent
              key={framework.id}
              value={framework.id}
              className="space-y-4 mt-4 min-w-0"
            >
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Install packages</h4>
                <SyntaxHighlightedPre
                  code={INSTALL_COMMANDS[framework.id]}
                  language="bash"
                  docsUrl={DOCS_URLS[framework.id]}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {PROVIDER_LABELS[framework.id]}
                </h4>
                <SyntaxHighlightedPre
                  code={providerConfig.code}
                  language={providerConfig.language}
                  filePath={providerConfig.filePath}
                  docsUrl={DOCS_URLS[framework.id]}
                />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function ActionsStep({
  selectedFramework,
  onFrameworkChange,
}: {
  selectedFramework: FrameworkId;
  onFrameworkChange: (framework: FrameworkId) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Tools let the AI assistant perform tasks in your app. Here&apos;s an
        example to get started:
      </p>

      <Tabs
        value={selectedFramework}
        onValueChange={(v) => onFrameworkChange(v as FrameworkId)}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FRAMEWORKS.map((framework) => (
            <TabsTrigger
              key={framework.id}
              value={framework.id}
              className="shrink-0 px-3 py-1.5 sm:px-4"
            >
              {framework.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {FRAMEWORKS.map((framework) => {
          const toolConfig = TOOL_EXAMPLES[framework.id];
          return (
            <TabsContent
              key={framework.id}
              value={framework.id}
              className="space-y-4 mt-4 min-w-0"
            >
              <SyntaxHighlightedPre
                code={toolConfig.code}
                language={toolConfig.language}
                filePath={toolConfig.filePath}
                docsUrl="https://trypillar.com/docs/guides/tools"
              />
            </TabsContent>
          );
        })}
      </Tabs>
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
  const [selectedFramework, setSelectedFramework] =
    useState<FrameworkId>("react");

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
        {currentSubStep === 1 && (
          <InstallStep
            subdomain={subdomain}
            selectedFramework={selectedFramework}
            onFrameworkChange={setSelectedFramework}
          />
        )}
        {currentSubStep === 2 && (
          <ActionsStep
            selectedFramework={selectedFramework}
            onFrameworkChange={setSelectedFramework}
          />
        )}
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
