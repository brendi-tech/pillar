'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  knowledgeItemListQuery,
  updateKnowledgeItemMutation,
  reprocessKnowledgeItemMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import type { KnowledgeItem } from '@/types/knowledge';
import { KNOWLEDGE_ITEM_STATUS_COLORS } from '@/types/knowledge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useState } from 'react';
import { toast } from 'sonner';

interface KnowledgeItemsTableProps {
  sourceId: string;
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colorMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    green: 'default',
    blue: 'secondary',
    red: 'destructive',
    yellow: 'outline',
  };
  const color = KNOWLEDGE_ITEM_STATUS_COLORS[status as keyof typeof KNOWLEDGE_ITEM_STATUS_COLORS] || 'gray';
  return colorMap[color] || 'secondary';
}

export function KnowledgeItemsTable({ sourceId }: KnowledgeItemsTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isPending, isError } = useQuery(
    knowledgeItemListQuery({
      source: sourceId,
      search: search || undefined,
      page,
      page_size: pageSize,
    })
  );

  const items = data?.results ?? [];
  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  const updateItemMutation = useMutation({
    ...updateKnowledgeItemMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  const reprocessMutation = useMutation({
    ...reprocessKnowledgeItemMutation(),
    onSuccess: () => {
      toast.success('Reprocessing started');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reprocess: ${error.message}`);
    },
  });

  const handleToggleActive = (item: KnowledgeItem) => {
    updateItemMutation.mutate({
      id: item.id,
      data: { is_active: !item.is_active },
    });
  };

  const handleReprocess = (id: string) => {
    reprocessMutation.mutate(id);
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Failed to load items
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Active</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Chunks</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item)}
                      disabled={updateItemMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.title || 'Untitled'}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {item.url}
                        </a>
                      )}
                      {item.excerpt && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {item.excerpt}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {item.status === 'processing' && (
                        <Spinner size="xs" className="mr-1" />
                      )}
                      {item.status_display || item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.chunk_count}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReprocess(item.id)}
                      disabled={
                        reprocessMutation.isPending || item.status === 'processing'
                      }
                      title="Reprocess"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
