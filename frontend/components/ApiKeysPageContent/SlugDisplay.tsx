"use client";

import { Tag } from "lucide-react";
import { CopyButton } from "./CopyButton";

interface SlugDisplayProps {
  slug: string;
}

export function SlugDisplay({ slug }: SlugDisplayProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-purple-500" />
          <code className="font-mono text-sm font-medium">PILLAR_SLUG</code>
        </div>
        <CopyButton value={`PILLAR_SLUG=${slug}`} />
      </div>
      <p className="text-xs text-muted-foreground">Your Pillar subdomain</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
          {slug}
        </div>
        <CopyButton value={slug} />
      </div>
    </div>
  );
}
