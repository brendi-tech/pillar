"use client";

import { Button } from "@/components/ui/button";
import { usePillar } from "@pillar-ai/react";
import { Sparkles } from "lucide-react";

/**
 * Ask AI button for docs pages.
 * Opens the SDK panel for AI assistance.
 */
export function DocsAskAI() {
  const { open } = usePillar();

  return (
    <div className="my-8 flex justify-center">
      <Button
        onClick={() => open()}
        variant="outline"
        size="lg"
        className="gap-2 px-6 py-5 text-base border-dashed hover:border-primary hover:bg-primary/5"
      >
        <Sparkles className="h-5 w-5 text-primary" />
        Ask AI about this page
      </Button>
    </div>
  );
}
