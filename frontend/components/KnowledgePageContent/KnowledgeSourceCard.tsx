'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  triggerKnowledgeSyncMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import type { KnowledgeSource } from '@/types/knowledge';
import {
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_STATUS_COLORS,
} from '@/types/knowledge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface KnowledgeSourceCardProps {
  source: KnowledgeSource;
}

const sourceTypeIcons: Record<string, typeof Globe> = {
  help_center: HelpCircle,
  marketing_site: Globe,
  snippets: FileText,
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

export function KnowledgeSourceCard({ source }: KnowledgeSourceCardProps) {
  const queryClient = useQueryClient();
  const Icon = sourceTypeIcons[source.source_type] || Globe;

  const syncMutation = useMutation({
    ...triggerKnowledgeSyncMutation(),
    onSuccess: () => {
      toast.success('Sync started');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.sources() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to start sync: ${error.message}`);
    },
  });

  const handleSync = () => {
    syncMutation.mutate({
      id: source.id,
      restart: source.status === 'syncing',
    });
  };

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>
                <Link
                  href={`/knowledge/${source.id}`}
                  className="hover:underline"
                >
                  {source.name}
                </Link>
              </CardTitle>
              <CardDescription className="text-xs">
                {KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/knowledge/${source.id}`}>View Details</Link>
              </DropdownMenuItem>
              {source.url && (
                <DropdownMenuItem asChild>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open URL
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSync}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {source.status === 'syncing'
                  ? 'Stop & sync again'
                  : 'Sync Now'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(source.status)}>
              {source.status === 'syncing' && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {source.status_display || source.status}
            </Badge>
          </div>
          <span className="text-muted-foreground">
            {source.item_count} {source.item_count === 1 ? 'item' : 'items'}
          </span>
        </div>

        {source.url && (
          <p className="mt-3 truncate text-xs text-muted-foreground">
            {source.url}
          </p>
        )}

        {source.last_synced_at && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last synced{' '}
            {formatDistanceToNow(new Date(source.last_synced_at), {
              addSuffix: true,
            })}
          </p>
        )}

        {source.error_message && source.status === 'error' && (
          <p className="mt-2 text-xs text-red-500 dark:text-red-400">
            {source.error_message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
