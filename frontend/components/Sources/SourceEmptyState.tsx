'use client';

import Link from 'next/link';
import { BookOpen, ArrowRight, Sparkles, Globe, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SourceEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 p-4">
          <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          No knowledge sources connected yet
        </h3>
        
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Add knowledge sources to give the AI context about your product. 
          Connect documentation sites, marketing pages, or add custom content.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="/knowledge/new" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Add Your First Source
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Documentation Sites
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Crawl your docs sites and knowledge bases
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Marketing Sites
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Import content from your company website
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Custom Snippets
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Add custom instructions and context for the AI
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Content is automatically indexed and made available to the AI</span>
        </div>
      </CardContent>
    </Card>
  );
}
