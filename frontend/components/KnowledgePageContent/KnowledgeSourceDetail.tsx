'use client';

import { PageHeader } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  knowledgeSourceDetailQuery,
  triggerKnowledgeSyncMutation,
  deleteKnowledgeSourceMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import {
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_STATUS_COLORS,
} from '@/types/knowledge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  RefreshCw,
  Trash2,
  Cloud,
  Upload,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KnowledgeItemsTable } from './KnowledgeItemsTable';
import { DocumentUploadZone } from './DocumentUploadZone';
import { SnippetsSection } from './SnippetsSection';
import { knowledgeItemListQuery } from '@/queries/knowledge.queries';

interface KnowledgeSourceDetailProps {
  sourceId: string;
}

const sourceTypeIcons: Record<string, typeof Globe> = {
  help_center: HelpCircle,
  marketing_site: Globe,
  snippets: FileText,
  cloud_storage: Cloud,
  document_upload: Upload,
};

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colorMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    green: 'default',
    blue: 'secondary',
    red: 'destructive',
    yellow: 'outline',
  };
  const color = KNOWLEDGE_STATUS_COLORS[status as keyof typeof KNOWLEDGE_STATUS_COLORS] || 'gray';
  return colorMap[color] || 'secondary';
}

export function KnowledgeSourceDetail({ sourceId }: KnowledgeSourceDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: source,
    isPending,
    isError,
    error,
  } = useQuery(knowledgeSourceDetailQuery(sourceId));

  const syncMutation = useMutation({
    ...triggerKnowledgeSyncMutation(),
    onSuccess: () => {
      toast.success('Sync started');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.sources() });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.sourceDetail(sourceId),
      });
    },
    onError: (err: Error) => {
      toast.error(`Failed to start sync: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    ...deleteKnowledgeSourceMutation(),
    onSuccess: () => {
      toast.success('Knowledge source deleted');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.sources() });
      router.push('/knowledge');
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  // Fetch items for snippets sources
  const {
    data: snippetsData,
    refetch: refetchSnippets,
  } = useQuery({
    ...knowledgeItemListQuery({
      source: sourceId,
      page_size: 100, // Get all snippets for card view
    }),
    enabled: source?.source_type === 'snippets',
  });

  const handleSync = () => {
    syncMutation.mutate({
      id: sourceId,
      restart: source?.status === 'syncing',
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(sourceId);
  };

  if (isPending) {
    return (
      <div className="space-y-6 p-page">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-1 h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !source) {
    return (
      <div className="flex flex-col items-center justify-center p-page py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load source</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message || 'Source not found'}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/knowledge">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge
          </Link>
        </Button>
      </div>
    );
  }

  const Icon = sourceTypeIcons[source.source_type] || Globe;

  return (
    <div className="space-y-6 p-page">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/knowledge" className="hover:text-foreground">
          Knowledge
        </Link>
        <span>/</span>
        <span>{source.name}</span>
      </div>

      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            {source.name}
          </div>
        }
        description={KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
        actions={
          <div className="flex items-center gap-2">
            {/* Sync button - not applicable for snippets or document_upload */}
            {source.source_type !== 'snippets' && source.source_type !== 'document_upload' && (
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {source.status === 'syncing'
                  ? 'Stop & sync again'
                  : 'Sync Now'}
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Knowledge Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{source.name}"? This will
                    remove all indexed content and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {/* Source Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Source Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1">
                <Badge variant={getStatusBadgeVariant(source.status)}>
                  {source.status === 'syncing' && (
                    <Spinner size="xs" className="mr-1" />
                  )}
                  {source.status_display || source.status}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Items
              </dt>
              <dd className="mt-1 text-lg font-semibold">{source.item_count}</dd>
            </div>

            {source.url && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  URL
                </dt>
                <dd className="mt-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {source.url}
                  </a>
                </dd>
              </div>
            )}

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 text-sm">
                {format(new Date(source.created_at), 'MMM d, yyyy')}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Last Synced
              </dt>
              <dd className="mt-1 text-sm">
                {source.last_synced_at
                  ? formatDistanceToNow(new Date(source.last_synced_at), {
                      addSuffix: true,
                    })
                  : 'Never'}
              </dd>
            </div>
          </dl>

          {source.error_message && source.status === 'error' && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                <strong>Error:</strong> {source.error_message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud Storage Connection Info */}
      {source.source_type === 'cloud_storage' && source.connection_config && (
        <Card>
          <CardHeader>
            <CardTitle>Cloud Storage Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Provider
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  {source.connection_config.provider === 's3' 
                    ? 'Amazon S3' 
                    : 'Google Cloud Storage'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Bucket
                </dt>
                <dd className="mt-1 text-sm font-mono">
                  {source.connection_config.bucket}
                </dd>
              </div>
              {source.connection_config.prefix && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Path Prefix
                  </dt>
                  <dd className="mt-1 text-sm font-mono">
                    {source.connection_config.prefix}
                  </dd>
                </div>
              )}
              {source.connection_config.region && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Region
                  </dt>
                  <dd className="mt-1 text-sm">
                    {source.connection_config.region}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Document Upload Zone */}
      {source.source_type === 'document_upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadZone
              sourceId={sourceId}
              onUploadComplete={() => {
                queryClient.invalidateQueries({
                  queryKey: knowledgeKeys.sourceDetail(sourceId),
                });
                queryClient.invalidateQueries({
                  queryKey: knowledgeKeys.items(),
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Snippets Section - special UI for snippets sources */}
      {source.source_type === 'snippets' && (
        <Card>
          <CardHeader>
            <CardTitle>Snippets</CardTitle>
          </CardHeader>
          <CardContent>
            <SnippetsSection
              snippets={snippetsData?.results ?? []}
              onRefetch={() => {
                refetchSnippets();
                queryClient.invalidateQueries({
                  queryKey: knowledgeKeys.sourceDetail(sourceId),
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Items Table - for non-snippet sources */}
      {source.source_type !== 'snippets' && (
        <Card>
          <CardHeader>
            <CardTitle>Indexed Items</CardTitle>
          </CardHeader>
          <CardContent>
            <KnowledgeItemsTable sourceId={sourceId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
