"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { CopyButton } from "@/components/Onboarding/SecretsManager";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/providers/ProductProvider";

import { STEPS } from "./InlineOnboardingSteps.constants";
import type {
  FrameworkId,
  InlineOnboardingStepsProps,
} from "./InlineOnboardingSteps.types";
import { StepSection } from "./StepSection";
import {
  AddKnowledgeStepContent,
  ApiKeyStepContent,
  CreateToolStepContent,
  InstallSdkStepContent,
  SyncStepContent,
} from "./steps";

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
  const [selectedFramework, setSelectedFramework] =
    useState<FrameworkId>("react");

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
            <ApiKeyStepContent onComplete={() => handleStepComplete(1)} />
          )}
          {step.id === 1 && currentProduct?.subdomain && (
            <p className="text-sm text-muted-foreground">
              Your product key is{" "}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {productKey}
              </code>
              <CopyButton
                value={productKey}
                className="inline-flex h-5 w-5 p-0 ml-1 align-text-bottom"
              />
            </p>
          )}
          {step.id === 2 && (
            <InstallSdkStepContent
              onComplete={() => handleStepComplete(2)}
              productKey={productKey}
              selectedFramework={selectedFramework}
              onFrameworkChange={setSelectedFramework}
            />
          )}
          {step.id === 3 && (
            <CreateToolStepContent
              onComplete={() => handleStepComplete(3)}
              selectedFramework={selectedFramework}
              onFrameworkChange={setSelectedFramework}
            />
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
              <AddKnowledgeStepContent
                onComplete={() => handleStepComplete(5)}
              />
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
