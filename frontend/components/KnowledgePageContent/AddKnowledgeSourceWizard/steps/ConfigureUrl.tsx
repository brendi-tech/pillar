'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type {
  KnowledgeCrawlConfig,
  KnowledgeSourceTypeOption,
} from '@/types/knowledge';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface FieldErrors {
  url?: string;
  name?: string;
  [key: string]: string | undefined;
}

interface ConfigureUrlProps {
  sourceType: KnowledgeSourceTypeOption;
  url: string;
  name: string;
  crawlConfig: KnowledgeCrawlConfig;
  onSubmit: (url: string, name: string, crawlConfig: KnowledgeCrawlConfig) => void;
  onBack: () => void;
  /** Field-level errors from API validation */
  fieldErrors?: FieldErrors;
  /** Callback to clear field errors when user starts editing */
  onClearFieldError?: (field: string) => void;
}

export function ConfigureUrl({
  sourceType,
  url: initialUrl,
  name: initialName,
  crawlConfig: initialCrawlConfig,
  onSubmit,
  onBack,
  fieldErrors,
  onClearFieldError,
}: ConfigureUrlProps) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(initialName || sourceType.name);
  const [maxPages, setMaxPages] = useState(initialCrawlConfig.max_pages ?? 100);
  const [includePaths, setIncludePaths] = useState(
    initialCrawlConfig.include_paths?.join(', ') ?? ''
  );
  const [excludePaths, setExcludePaths] = useState(
    initialCrawlConfig.exclude_paths?.join(', ') ?? ''
  );

  // Sync with parent state when returning to this step with errors
  useEffect(() => {
    setUrl(initialUrl);
    setName(initialName || sourceType.name);
  }, [initialUrl, initialName, sourceType.name]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (fieldErrors?.url && onClearFieldError) {
      onClearFieldError('url');
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (fieldErrors?.name && onClearFieldError) {
      onClearFieldError('name');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const crawlConfig: KnowledgeCrawlConfig = {
      max_pages: maxPages,
      include_paths: includePaths
        ? includePaths.split(',').map((p) => p.trim()).filter(Boolean)
        : undefined,
      exclude_paths: excludePaths
        ? excludePaths.split(',').map((p) => p.trim()).filter(Boolean)
        : undefined,
    };

    onSubmit(url, name, crawlConfig);
  };

  // URL just needs a dot to indicate a domain (e.g., example.com) - backend normalizes
  const isValid = url.trim() !== '' && url.includes('.') && name.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure {sourceType.name}</h2>
        <p className="text-sm text-muted-foreground">
          Enter the URL of your {sourceType.name.toLowerCase()} to crawl.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Docs"
            aria-invalid={!!fieldErrors?.name}
          />
          {fieldErrors?.name ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this source.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://help.example.com"
            aria-invalid={!!fieldErrors?.url}
            className={cn(fieldErrors?.url && "border-destructive focus-visible:border-destructive")}
          />
          {fieldErrors?.url ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.url}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The root URL to start crawling from (e.g., https://help.example.com).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxPages">Maximum Pages</Label>
          <Input
            id="maxPages"
            type="number"
            min={1}
            max={1000}
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value) || 100)}
          />
          <p className="text-xs text-muted-foreground">
            Limit the number of pages to crawl (1-1000).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="includePaths">Include Paths (optional)</Label>
          <Input
            id="includePaths"
            value={includePaths}
            onChange={(e) => setIncludePaths(e.target.value)}
            placeholder="/docs, /help, /guides"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of path prefixes to include.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excludePaths">Exclude Paths (optional)</Label>
          <Input
            id="excludePaths"
            value={excludePaths}
            onChange={(e) => setExcludePaths(e.target.value)}
            placeholder="/blog, /changelog"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of path prefixes to exclude.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
