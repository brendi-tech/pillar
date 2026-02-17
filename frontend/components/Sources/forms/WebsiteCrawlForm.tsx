'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { CrawlConfig } from '@/types/sources';

interface WebsiteCrawlFormProps {
  onBack: () => void;
  onSubmit: (data: { name: string; url: string; crawl_config: CrawlConfig }) => void;
  isSubmitting?: boolean;
}

export function WebsiteCrawlForm({ onBack, onSubmit, isSubmitting }: WebsiteCrawlFormProps) {
  const [name, setName] = useState('My Website');
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState<number | undefined>(1000);
  const [includePaths, setIncludePaths] = useState('');
  const [excludePaths, setExcludePaths] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize URL: add https:// if no protocol specified
    let normalizedUrl = url.trim();
    if (normalizedUrl && !normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    const crawlConfig: CrawlConfig = {
      max_pages: maxPages,
      include_paths: includePaths
        ? includePaths.split(',').map((p) => p.trim()).filter(Boolean)
        : undefined,
      exclude_paths: excludePaths
        ? excludePaths.split(',').map((p) => p.trim()).filter(Boolean)
        : undefined,
    };

    onSubmit({ name: name.trim(), url: normalizedUrl, crawl_config: crawlConfig });
  };

  // URL just needs a dot to indicate a domain (e.g., example.com) - backend normalizes
  const isValid = name.trim() !== '' && url.trim() !== '' && url.includes('.');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Website Content (Crawl)</h2>
        <p className="text-sm text-muted-foreground">
          Crawl your docs site, marketing pages, or knowledge base to give the AI context.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Docs"
          />
          <p className="text-xs text-muted-foreground">
            A friendly name to identify this source.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="docs.example.com"
          />
          <p className="text-xs text-muted-foreground">
            The root URL to start crawling from.
          </p>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
              Advanced Settings
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="maxPages">Max Pages</Label>
              <Input
                id="maxPages"
                type="number"
                min={1}
                max={10000}
                value={maxPages ?? ''}
                onChange={(e) => setMaxPages(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of pages to crawl. Default is 1000.
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
                Only crawl pages under these paths (comma-separated).
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
                Skip pages under these paths (comma-separated).
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Create Source
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
