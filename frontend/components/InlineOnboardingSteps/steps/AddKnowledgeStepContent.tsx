"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  createKnowledgeSourceMutation,
  knowledgeSourceKeys,
  triggerKnowledgeSourceSyncMutation,
} from "@/queries/sources.queries";
import type { CrawlConfig } from "@/types/sources";

interface AddKnowledgeStepContentProps {
  onComplete: () => void;
}

export function AddKnowledgeStepContent({
  onComplete,
}: AddKnowledgeStepContentProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [maxPages, setMaxPages] = useState(1000);
  const [includePaths, setIncludePaths] = useState("");
  const [excludePaths, setExcludePaths] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const getHostname = (urlString: string): string => {
    const trimmed = urlString.trim();
    const withProtocol = trimmed.match(/^https?:\/\//)
      ? trimmed
      : `https://${trimmed}`;
    try {
      return new URL(withProtocol).hostname;
    } catch {
      return trimmed.split("/")[0];
    }
  };
  const derivedName = name || getHostname(url);

  const createSource = useMutation({
    ...createKnowledgeSourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
    },
  });

  const triggerSync = useMutation({
    ...triggerKnowledgeSourceSyncMutation(),
  });

  const isValidUrl = (urlString: string) => urlString.trim().includes(".");
  const isValid = url.trim() !== "" && isValidUrl(url.trim());
  const isSubmitting = createSource.isPending || triggerSync.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const crawlConfig: CrawlConfig = {
      max_pages: maxPages,
      include_paths: includePaths
        ? includePaths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
      exclude_paths: excludePaths
        ? excludePaths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
    };

    try {
      const newSource = await createSource.mutateAsync({
        source_type: "website_crawl",
        name: derivedName || "My Website",
        url: url.trim(),
        crawl_config: crawlConfig,
      });

      try {
        await triggerSync.mutateAsync({ id: newSource.id });
      } catch {
        // Don't fail the whole flow if sync trigger fails
      }

      toast.success("Crawl started!", {
        description: `We're crawling ${derivedName || url}. This may take a few minutes.`,
      });

      onComplete();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create source";
      toast.error("Something went wrong", { description: message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="crawl-url" className="text-sm font-medium">
          Website URL
        </Label>
        <Input
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.example.com"
          className="h-11"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Enter your docs site, marketing site, or knowledge base URL
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="crawl-name" className="text-sm font-medium">
          Display Name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="crawl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={derivedName || "My Docs"}
          className="h-11"
        />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground -ml-1"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                advancedOpen && "rotate-180"
              )}
            />
            Advanced Settings
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="crawl-maxPages">Max Pages</Label>
            <Input
              id="crawl-maxPages"
              type="number"
              min={1}
              max={10000}
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value) || 1000)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crawl-includePaths">Include Paths</Label>
            <Input
              id="crawl-includePaths"
              value={includePaths}
              onChange={(e) => setIncludePaths(e.target.value)}
              placeholder="/docs, /help, /guides"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crawl-excludePaths">Exclude Paths</Label>
            <Input
              id="crawl-excludePaths"
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              placeholder="/blog, /changelog"
              className="h-10"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button
        type="submit"
        size="lg"
        className="w-full h-11"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Starting Crawl...
          </>
        ) : (
          <>
            Start Crawling
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
