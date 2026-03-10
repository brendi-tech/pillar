"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Server } from "lucide-react";
import { CopyButton } from "./CopyButton";

interface ApiUrlCollapsibleProps {
  apiUrl: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiUrlCollapsible({
  apiUrl,
  isOpen,
  onOpenChange,
}: ApiUrlCollapsibleProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="text-sm text-muted-foreground">
            Advanced: API URL (for local dev)
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <code className="font-mono text-sm font-medium">
                PILLAR_API_URL
              </code>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <CopyButton value={`PILLAR_API_URL=${apiUrl}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Only needed for local development. Defaults to
            https://help-api.trypillar.com
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
              {apiUrl}
            </div>
            <CopyButton value={apiUrl} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
