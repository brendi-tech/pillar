'use client';

import { EmptyState, PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  knowledgeSourceListQuery,
  snippetListQuery,
} from '@/queries/knowledge.queries';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  FileText,
  Globe,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { KnowledgeSourceCard } from './KnowledgeSourceCard';
import { SnippetsSection } from './SnippetsSection';

/**
 * Knowledge Page Content - Main dashboard for managing knowledge sources and snippets
 */
export function KnowledgePageContent() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'sources' | 'snippets'>('sources');

  const {
    data: sourcesData,
    isPending: sourcesLoading,
    isError: sourcesError,
    error: sourcesErrorData,
    refetch: refetchSources,
  } = useQuery(knowledgeSourceListQuery({ search: search || undefined }));

  const {
    data: snippetsData,
    isPending: snippetsLoading,
    refetch: refetchSnippets,
  } = useQuery(snippetListQuery({ search: search || undefined }));

  const sources = sourcesData?.results ?? [];
  const snippets = snippetsData?.results ?? [];
  const isLoading = activeTab === 'sources' ? sourcesLoading : snippetsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Knowledge"
          description="Manage knowledge sources for your AI assistant"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (sourcesError && activeTab === 'sources') {
    return (
      <div className="flex flex-col items-center justify-center p-page py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load knowledge sources</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {sourcesErrorData?.message || 'An error occurred'}
        </p>
        <Button onClick={() => refetchSources()} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title="Knowledge"
        description="Manage knowledge sources for your AI assistant"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                activeTab === 'sources' ? refetchSources() : refetchSnippets()
              }
            >
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

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'sources' | 'snippets')}
      >
        <TabsList>
          <TabsTrigger value="sources" className="gap-2">
            <Globe className="h-4 w-4" />
            Sources ({sources.length})
          </TabsTrigger>
          <TabsTrigger value="snippets" className="gap-2">
            <FileText className="h-4 w-4" />
            Snippets ({snippets.length})
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <TabsContent value="sources" className="mt-6">
          {sources.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No knowledge sources"
              description="Add a documentation site or marketing URL to give your AI assistant context about your product."
              action={
                <Button asChild>
                  <Link href="/knowledge/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Knowledge Source
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => (
                <KnowledgeSourceCard key={source.id} source={source} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snippets" className="mt-6">
          <SnippetsSection snippets={snippets} onRefetch={refetchSnippets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
