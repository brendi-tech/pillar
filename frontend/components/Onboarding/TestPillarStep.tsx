"use client";

import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers/ProductProvider";
import { productIntegrationStatusQuery } from "@/queries/v2/products.queries";

// Polling timeout: 30 minutes in milliseconds
const POLLING_TIMEOUT_MS = 30 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

interface TestPillarStepProps {
  /** Callback when step is complete (if not provided, Complete Setup button is hidden) */
  onComplete?: () => void;
  /** Callback to go back to previous step */
  onBack?: () => void;
}

interface StatusItemProps {
  label: string;
  description: string;
  isComplete: boolean;
  isLoading?: boolean;
}

// =============================================================================
// Status Item Component
// =============================================================================

function StatusItem({
  label,
  description,
  isComplete,
  isLoading,
}: StatusItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
          isComplete
            ? "bg-green-500/20 text-green-500"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : isComplete ? (
          <Check className="h-4 w-4" />
        ) : (
          <Circle className="h-3 w-3" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            isComplete ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function TestPillarStep({ onComplete, onBack }: TestPillarStepProps) {
  const { currentProduct } = useProduct();
  const productId = currentProduct?.id;

  // Track polling state with 30 minute timeout
  const [isPollingActive, setIsPollingActive] = useState(true);

  // Stop polling after 30 minutes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsPollingActive(false);
    }, POLLING_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  // Poll integration status every 5 seconds, stop after 30 minutes
  const { data: integrationStatus, isLoading } = useQuery({
    ...productIntegrationStatusQuery(productId || ""),
    enabled: !!productId,
    refetchInterval: isPollingActive ? 5000 : false,
  });

  const sdkInitialized = integrationStatus?.sdk_initialized ?? false;
  const actionsRegistered = integrationStatus?.actions_registered ?? false;
  const actionExecuted = integrationStatus?.action_executed ?? false;

  // Also stop polling if all checks pass
  const allChecksPassed = sdkInitialized && actionsRegistered && actionExecuted;

  useEffect(() => {
    if (allChecksPassed) {
      setIsPollingActive(false);
    }
  }, [allChecksPassed]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Test Pillar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Complete these integration checks to verify your setup is working
          correctly.
        </p>

        {/* Integration Status Checklist */}
        <div className="space-y-4 rounded-lg border p-4">
          <StatusItem
            label="Pillar Initialized"
            description="SDK has connected to your product"
            isComplete={sdkInitialized}
            isLoading={isLoading}
          />
          <StatusItem
            label="Actions Registered"
            description="Actions have been synced via the CLI"
            isComplete={actionsRegistered}
            isLoading={isLoading}
          />
          <StatusItem
            label="Action Executed"
            description="At least one action has been triggered"
            isComplete={actionExecuted}
            isLoading={isLoading}
          />
        </div>

        {/* Status message */}
        <div className="text-center">
          {allChecksPassed ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              All checks passed! Your integration is working correctly.
            </p>
          ) : !isPollingActive ? (
            <p className="text-xs text-muted-foreground">
              Status check paused. Refresh the page to resume checking.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Waiting for integration events... This page updates automatically.
            </p>
          )}
        </div>

        {(onBack || onComplete) && (
          <div className="flex gap-3">
            {onBack && (
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                onClick={onBack}
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
              </Button>
            )}
            {onComplete && (
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-medium"
                onClick={onComplete}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Setup
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
