"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function DocsLink() {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Need help defining actions?</p>
        <p className="text-xs text-muted-foreground">
          Learn how to export actions from your code
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href="/help/features/actions" target="_blank" rel="noopener">
          <ExternalLink className="mr-2 h-3 w-3" />
          View Docs
        </a>
      </Button>
    </div>
  );
}
