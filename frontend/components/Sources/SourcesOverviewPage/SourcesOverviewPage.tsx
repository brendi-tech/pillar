"use client";

import { SourceEmptyState } from "@/components/Sources/SourceEmptyState";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useSources } from "@/providers";
import { FileText, Globe, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { SourceCategorySection } from "./SourceCategorySection";

export function SourcesOverviewPage() {
  const { sourcesByType, counts, isLoading, refresh } = useSources();

  if (isLoading) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Knowledge Sources"
          description="Connect knowledge sources to power your AI assistant"
        />
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  // Show empty state if no sources
  if (counts.total === 0) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Knowledge Sources"
          description="Connect knowledge sources to power your AI assistant"
        />
        <SourceEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title="Knowledge Sources"
        description="Connect knowledge sources to power your AI assistant"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => refresh()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button asChild>
              <Link href="/knowledge/new" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Source
              </Link>
            </Button>
          </div>
        }
      />

      {/* Main Content - Sections by Type */}
      <div className="divide-y">
        {/* Website Crawls */}
        {sourcesByType.website_crawl.length > 0 && (
          <SourceCategorySection
            id="website_crawl"
            title="Website Content"
            description="Crawled websites and documentation sites"
            icon={Globe}
            sources={sourcesByType.website_crawl}
          />
        )}

        {/* Cloud Storage */}
        {sourcesByType.cloud_storage.length > 0 && (
          <SourceCategorySection
            id="cloud_storage"
            title="Cloud Storage"
            description="S3 and GCS bucket syncs"
            icon={Globe}
            sources={sourcesByType.cloud_storage}
          />
        )}

        {/* Document Uploads */}
        {sourcesByType.document_upload.length > 0 && (
          <SourceCategorySection
            id="document_upload"
            title="Document Uploads"
            description="Directly uploaded files and documents"
            icon={FileText}
            sources={sourcesByType.document_upload}
          />
        )}

        {/* Snippets */}
        {sourcesByType.snippets.length > 0 && (
          <SourceCategorySection
            id="snippets"
            title="Custom Snippets"
            description="Custom text content for AI context"
            icon={FileText}
            sources={sourcesByType.snippets}
          />
        )}
      </div>
    </div>
  );
}
