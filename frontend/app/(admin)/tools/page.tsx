"use client";

import { SDKSetupStep } from "@/components/Onboarding/SDKSetupStep";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useProduct } from "@/providers";
import { actionListQuery } from "@/queries/actions.queries";
import { useQuery } from "@tanstack/react-query";
import { Code2, Rocket, Zap } from "lucide-react";
import Link from "next/link";

/**
 * Actions page - shows SDKSetupStep when no actions exist,
 * otherwise shows empty state when no action is selected.
 * The sidebar is rendered by the layout.
 */
export default function ActionsPage() {
  const { currentProduct } = useProduct();

  const { data, isLoading } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
    })
  );

  const actions = data?.results ?? [];

  // Show loading spinner
  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Spinner variant="border" size="lg" />
      </div>
    );
  }

  // Show SDKSetupStep when no actions exist
  if (actions.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="p-page">
          <SDKSetupStep 
            showTestStep={true}
            initialSubStep={1}
          />
        </div>
      </ScrollArea>
    );
  }

  // Show empty state when actions exist but none selected
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Zap className="mb-6 h-16 w-16 text-muted-foreground/30" />
      <h3 className="mb-2 text-lg font-medium text-foreground">
        No Action Selected
      </h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Select an action from the sidebar to view its details, or access
        deployments and sync configuration.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <Link href="/actions/deployments">
            <Rocket className="mr-2 h-4 w-4" />
            View Deployments
          </Link>
        </Button>
      </div>
      <div className="mt-8 flex max-w-sm items-start gap-2 rounded-md bg-muted/50 p-3 text-left text-xs text-muted-foreground">
        <Code2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Actions are defined in your client code and synced via CI/CD. Changes
          to actions should be made in your codebase.
        </span>
      </div>
    </div>
  );
}
