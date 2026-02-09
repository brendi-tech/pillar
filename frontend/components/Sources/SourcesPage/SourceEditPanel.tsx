"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UpdateKnowledgeSourceRequest, KnowledgeSourceConfig } from "@/lib/admin/sources-api";
import { knowledgeSourceKeys, updateKnowledgeSourceMutation } from "@/queries/sources.queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Save, X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface SourceEditPanelProps {
  source: KnowledgeSourceConfig;
  onCancel: () => void;
  onSaved: () => void;
}

export function SourceEditPanel({
  source,
  onCancel,
  onSaved,
}: SourceEditPanelProps) {
  const queryClient = useQueryClient();

  // Edit form state
  const [name, setName] = useState(source.name);
  const [url, setUrl] = useState(source.url || "");
  const [maxPages, setMaxPages] = useState(source.crawl_config?.max_pages?.toString() || "");
  const [includePaths, setIncludePaths] = useState(source.crawl_config?.include_paths?.join(", ") || "");
  const [excludePaths, setExcludePaths] = useState(source.crawl_config?.exclude_paths?.join(", ") || "");

  // Save mutation
  const saveMutation = useMutation({
    ...updateKnowledgeSourceMutation(),
    onSuccess: () => {
      toast.success("Source saved successfully");
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.detail(source.id) });
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
      onSaved();
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to save source";
      toast.error(message);
    },
  });

  const handleSave = useCallback(() => {
    const updates: UpdateKnowledgeSourceRequest = {
      name: name.trim(),
    };

    // Only include URL for non-snippet sources
    if (source.source_type !== 'snippets' && url.trim()) {
      updates.url = url.trim();
    }

    // Build crawl config if any field is set
    const hasMaxPages = maxPages.trim() !== "";
    const hasIncludePaths = includePaths.trim() !== "";
    const hasExcludePaths = excludePaths.trim() !== "";

    if (hasMaxPages || hasIncludePaths || hasExcludePaths) {
      updates.crawl_config = {};
      if (hasMaxPages) {
        updates.crawl_config.max_pages = parseInt(maxPages);
      }
      if (hasIncludePaths) {
        updates.crawl_config.include_paths = includePaths.split(",").map(p => p.trim()).filter(Boolean);
      }
      if (hasExcludePaths) {
        updates.crawl_config.exclude_paths = excludePaths.split(",").map(p => p.trim()).filter(Boolean);
      }
    }

    saveMutation.mutate({ id: source.id, data: updates });
  }, [source.id, source.source_type, name, url, maxPages, includePaths, excludePaths, saveMutation]);

  const canSave = name.trim().length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold">Edit Source</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={saveMutation.isPending}
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending || !canSave}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {source.error_message && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Sync Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {source.error_message}
              </p>
            </div>
          </div>
        )}

        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-name">Name</Label>
              <Input
                id="source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Knowledge Source"
              />
            </div>

            {source.source_type !== 'snippets' && (
              <div className="space-y-2">
                <Label htmlFor="source-url">URL</Label>
                <Input
                  id="source-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="docs.example.com"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crawl Settings (only for crawlable sources) */}
        {source.source_type !== 'snippets' && (
          <Card>
            <CardHeader>
              <CardTitle>Crawl Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-pages">Max Pages</Label>
                <Input
                  id="max-pages"
                  type="number"
                  min="1"
                  max="10000"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of pages to crawl. Default is 1000.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="include-paths">Include Paths</Label>
                <Input
                  id="include-paths"
                  value={includePaths}
                  onChange={(e) => setIncludePaths(e.target.value)}
                  placeholder="/docs, /guides, /api"
                />
                <p className="text-xs text-muted-foreground">
                  Only crawl pages under these paths (comma-separated).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exclude-paths">Exclude Paths</Label>
                <Input
                  id="exclude-paths"
                  value={excludePaths}
                  onChange={(e) => setExcludePaths(e.target.value)}
                  placeholder="/blog, /news"
                />
                <p className="text-xs text-muted-foreground">
                  Skip pages under these paths (comma-separated).
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
