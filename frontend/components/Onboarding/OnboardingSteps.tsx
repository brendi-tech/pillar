"use client";

import { Check, LogOut, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SDKSetupStep } from "./SDKSetupStep";
import { TestPillarStep } from "./TestPillarStep";
import { WebsiteCrawlOnboarding } from "./WebsiteCrawlOnboarding";

// =============================================================================
// Types
// =============================================================================

interface Step {
  id: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, title: "Add Knowledge", description: "Crawl your website" },
  { id: 2, title: "SDK Setup", description: "Install the widget" },
  { id: 3, title: "Test Pillar", description: "Try it out" },
];

// =============================================================================
// Stepper Header Component
// =============================================================================

interface StepperHeaderProps {
  currentStep: number;
  steps: Step[];
}

function StepperHeader({ currentStep, steps }: StepperHeaderProps) {
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="relative flex justify-between">
        {/* Connector lines - positioned behind circles */}
        <div className="absolute top-5 left-0 right-0 flex items-center px-[60px]">
          {steps.slice(0, -1).map((step, index) => (
            <div
              key={`line-${index}`}
              className={cn(
                "h-0.5 flex-1",
                currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Steps */}
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center z-10 w-[120px]">
            {/* Circle */}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors bg-background",
                currentStep > step.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : currentStep === step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-semibold">{step.id}</span>
              )}
            </div>

            {/* Label */}
            <div className="mt-2 text-center">
              <p
                className={cn(
                  "text-sm font-medium",
                  currentStep >= step.id
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface OnboardingStepsProps {
  /** Initial step to start on (1, 2, or 3) */
  initialStep: number;
  /** Final redirect path after all steps complete (defaults to /knowledge) */
  redirectTo?: string;
  /** Whether this is creating a new product (vs updating existing) */
  isNewProduct?: boolean;
}

export function OnboardingSteps({
  initialStep,
  redirectTo = "/knowledge",
  isNewProduct = false,
}: OnboardingStepsProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [cameBackFromTestStep, setCameBackFromTestStep] = useState(false);

  const handleStepComplete = () => {
    if (currentStep < STEPS.length) {
      // Reset the back flag when advancing from SDK Setup
      if (currentStep === 2) {
        setCameBackFromTestStep(false);
      }
      setCurrentStep(currentStep + 1);
    } else {
      // Final step complete - redirect
      router.push(redirectTo);
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      // Track if coming back from Test Pillar step to SDK Setup
      if (currentStep === 3) {
        setCameBackFromTestStep(true);
      }
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 p-4 relative">
      {/* Logout Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/logout")}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center w-full max-w-3xl mx-auto pt-12">
        {/* Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Set Up Your Product Copilot
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete these steps to get your AI-powered product copilot running.
          </p>
        </div>

        {/* Stepper Header */}
        <StepperHeader currentStep={currentStep} steps={STEPS} />

        {/* Step Content */}
        <div className="w-full">
          {currentStep === 1 && (
            <WebsiteCrawlOnboarding onComplete={handleStepComplete} isNewProduct={isNewProduct} />
          )}
          {currentStep === 2 && (
            <SDKSetupStep 
              onComplete={handleStepComplete} 
              initialSubStep={cameBackFromTestStep ? 3 : 1}
            />
          )}
          {currentStep === 3 && (
            <TestPillarStep onComplete={handleStepComplete} onBack={handleStepBack} />
          )}
        </div>

        {/* Skip button - shown after Add Knowledge step */}
        {currentStep > 1 && (
          <Button
            variant="link"
            className="mt-4 text-muted-foreground"
            onClick={() => router.push(redirectTo)}
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  );
}
